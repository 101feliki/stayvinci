import { Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import {
  booking,
  bookingItem,
  guestProfile,
  resource,
  resourceAllocation,
  review,
  service,
  serviceVariant,
  type BookingState,
} from '@stayvinci/db';
import {
  BookingTransition,
  HouseBooking,
  HouseBookingQuery,
  HouseReview,
  ReviewReply,
} from '@stayvinci/types';
import { z } from 'zod';
import { Errors, type AppRequest } from '../../common/http.js';
import {
  DocBody,
  DocQuery,
  DocResponse,
  DocUuidParam,
  UuidPath,
  ValidBody,
  ValidQuery,
} from '../../common/validation.js';
import { Data, audit, emit } from '../../database.js';
import { RequireCapability } from '../../security/guards.js';

/** Allowed moves on the House side (spec §11 booking states). */
const TRANSITIONS: Partial<Record<BookingState, BookingState[]>> = {
  held: ['cancelled_by_tenant'],
  pending_payment: ['cancelled_by_tenant'],
  requested: ['confirmed', 'cancelled_by_tenant'],
  confirmed: ['checked_in', 'completed', 'no_show', 'cancelled_by_tenant'],
  checked_in: ['completed'],
};
const MAX_RANGE_DAYS = 62;

/** The House calendar and reviews. Guest contact details are never included here. */
@ApiTags('Houses: bookings and reviews')
@ApiBearerAuth('access-token')
@Controller('v1/tenants/:tenantId')
export class HouseBookingsController {
  constructor(@Inject(Data) private readonly data: Data) {}

  private async load(
    tx: Parameters<Parameters<Data['inTenant']>[1]>[0],
    where: ReturnType<typeof and>,
  ): Promise<z.output<typeof HouseBooking>[]> {
    const rows = await tx
      .select({
        b: booking,
        alias: guestProfile.alias,
        service: service.name,
        variant: serviceVariant.name,
      })
      .from(booking)
      .innerJoin(guestProfile, eq(guestProfile.id, booking.guestProfileId))
      .innerJoin(bookingItem, eq(bookingItem.bookingId, booking.id))
      .innerJoin(serviceVariant, eq(serviceVariant.id, bookingItem.serviceVariantId))
      .innerJoin(service, eq(service.id, serviceVariant.serviceId))
      .where(where)
      .orderBy(asc(booking.startsAt))
      .limit(2000);
    const ids = rows.map((r) => r.b.id);
    const res = ids.length
      ? await tx
          .select({
            bookingId: resourceAllocation.bookingId,
            id: resource.id,
            name: resource.name,
            type: resource.type,
          })
          .from(resourceAllocation)
          .innerJoin(resource, eq(resource.id, resourceAllocation.resourceId))
          .where(inArray(resourceAllocation.bookingId, ids))
      : [];
    return rows.map(({ b, alias, ...r }) => ({
      id: b.id,
      ref: b.ref,
      state: b.state,
      starts_at: new Date(b.startsAt).toISOString(),
      ends_at: new Date(b.endsAt).toISOString(),
      guest: { id: b.guestProfileId, alias },
      service: r.service,
      variant: r.variant,
      resources: res
        .filter((x) => x.bookingId === b.id)
        .map(({ id, name, type }) => ({ id, name, type })),
      total_minor: Number(b.totalMinor),
      paid_minor: Number(b.paidMinor),
      currency: b.currency,
      source: b.source,
      notes: b.notes,
    }));
  }

  @Get('bookings')
  @RequireCapability('booking.view')
  @ApiOperation({
    summary: 'Calendar',
    description: `Bookings starting between \`from\` and \`to\` (at most ${MAX_RANGE_DAYS} days). Guests appear by alias only.`,
  })
  @DocUuidParam('tenantId', 'House id')
  @DocQuery(HouseBookingQuery)
  @DocResponse(200, z.object({ items: z.array(HouseBooking) }), 'Bookings', [401, 403, 404, 422])
  async list(
    @ValidQuery(HouseBookingQuery) q: z.output<typeof HouseBookingQuery>,
    @Req() req: AppRequest,
  ) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (to <= from || to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000)
      throw Errors.invalid(`Choose a range of up to ${MAX_RANGE_DAYS} days.`);
    const items = await this.data.inTenant(req, (tx) =>
      this.load(
        tx,
        and(gte(booking.startsAt, from.toISOString()), lt(booking.startsAt, to.toISOString())),
      ),
    );
    return { items };
  }

  @Post('bookings/:bookingId/transition')
  @RequireCapability('booking.edit')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Move a booking on',
    description:
      'Check in, complete, mark no-show, confirm a request, or cancel. Send the `version` you last saw; if someone changed it meanwhile you get 409 and should reload. Cancelling frees the time at once.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('bookingId', 'Booking id')
  @DocBody(BookingTransition)
  @DocResponse(200, HouseBooking, 'Updated', [401, 403, 404, 409, 422])
  transition(
    @UuidPath('bookingId') id: string,
    @ValidBody(BookingTransition) b: z.output<typeof BookingTransition>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const [cur] = await tx.select().from(booking).where(eq(booking.id, id));
      if (!cur) throw Errors.notFound('Booking');
      if (cur.version !== b.version)
        throw Errors.conflict('This booking changed. Reload and try again.');
      if (!(TRANSITIONS[cur.state] ?? []).includes(b.to))
        throw Errors.conflict(
          `A ${cur.state.replace(/_/g, ' ')} booking can't be moved to ${b.to.replace(/_/g, ' ')}.`,
        );
      const [upd] = await tx
        .update(booking)
        .set({ state: b.to, version: cur.version + 1 })
        .where(and(eq(booking.id, id), eq(booking.version, cur.version)))
        .returning({ id: booking.id });
      if (!upd) throw Errors.conflict('This booking changed. Reload and try again.');
      await audit(tx, {
        tenantId: req.tenant?.id ?? null,
        actorUserId: req.auth?.userId ?? null,
        actorLabel: 'member',
        action: `booking.${b.to}`,
        targetType: 'booking',
        targetId: id,
        before: { state: cur.state },
        after: { state: b.to },
        ip: req.ip ?? null,
        requestId: req.requestId,
      });
      await emit(tx, {
        tenantId: req.tenant?.id ?? null,
        type: b.to === 'cancelled_by_tenant' ? 'booking.cancelled' : `booking.${b.to}`,
        aggregateType: 'booking',
        aggregateId: id,
        payload: { from: cur.state, to: b.to },
      });
      const [out] = await this.load(tx, and(eq(booking.id, id)));
      return out;
    });
  }

  @Get('reviews')
  @RequireCapability('booking.view')
  @ApiOperation({ summary: 'Reviews', description: 'Reviews from completed visits, newest first.' })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, z.object({ items: z.array(HouseReview) }), 'Reviews', [401, 403, 404])
  async reviews(@Req() req: AppRequest) {
    const rows = await this.data.inTenant(req, (tx) =>
      tx
        .select({ r: review, ref: booking.ref })
        .from(review)
        .innerJoin(booking, eq(booking.id, review.bookingId))
        .orderBy(desc(review.createdAt))
        .limit(500),
    );
    return {
      items: rows.map(({ r, ref }) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reply: r.reply,
        created_at: new Date(r.createdAt).toISOString(),
        booking_ref: ref,
        published: r.published,
      })),
    };
  }

  @Post('reviews/:reviewId/reply')
  @RequireCapability('review.reply')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reply to a review',
    description: 'Your reply shows under the review on your store.',
  })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('reviewId', 'Review id')
  @DocBody(ReviewReply)
  @DocResponse(200, HouseReview, 'Replied', [401, 403, 404, 422])
  reply(
    @UuidPath('reviewId') id: string,
    @ValidBody(ReviewReply) b: z.output<typeof ReviewReply>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const [r] = await tx
        .update(review)
        .set({ reply: b.reply })
        .where(eq(review.id, id))
        .returning();
      if (!r) throw Errors.notFound('Review');
      const [bk] = await tx
        .select({ ref: booking.ref })
        .from(booking)
        .where(eq(booking.id, r.bookingId));
      await audit(tx, {
        tenantId: req.tenant?.id ?? null,
        actorUserId: req.auth?.userId ?? null,
        actorLabel: 'member',
        action: 'review.replied',
        targetType: 'review',
        targetId: id,
        ip: req.ip ?? null,
        requestId: req.requestId,
      });
      return {
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reply: r.reply,
        created_at: new Date(r.createdAt).toISOString(),
        booking_ref: bk?.ref ?? '',
        published: r.published,
      };
    });
  }
}
