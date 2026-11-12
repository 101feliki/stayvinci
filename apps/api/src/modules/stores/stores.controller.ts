import { Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { and, eq } from 'drizzle-orm';
import { booking, review } from '@stayvinci/db';
import {
  Availability,
  AvailabilityQuery,
  BookingCreate,
  GuestBooking,
  ReviewCreate,
  StoreDetail,
  StoreEnter,
  StoreEntered,
  StoreList,
  StoreListQuery,
} from '@stayvinci/types';
import { Throttle } from '@nestjs/throttler';
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
import { Idempotent, Public } from '../../security/guards.js';
import { StoresService } from './stores.service.js';

const HANDLE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/i;
const CODE = /^[A-Za-z0-9-]{4,24}$/;

export function handleOf(raw: string): string {
  if (!HANDLE.test(raw)) throw Errors.notFound('Store');
  return raw.toLowerCase();
}

/** The private store code, if the guest typed one. Malformed codes are simply ignored. */
export function codeOf(req: AppRequest): string | null {
  const v = req.header('x-store-code');
  return v && CODE.test(v) ? v : null;
}

const StoreCodeHeader = () =>
  ApiHeader({
    name: 'X-Store-Code',
    required: false,
    description: 'The private code of a private store. Listed stores need no code.',
  });

const HandleParam = () =>
  ApiParam({ name: 'handle', description: 'Store handle, e.g. `serenity-gigiri`' });

/** Guests browsing stores and booking (spec §9–§11). Browsing needs no sign-in. */
@ApiTags('Stores (guests)')
@Controller('v1/stores')
export class StoresController {
  constructor(@Inject(StoresService) private readonly stores: StoresService) {}

  @Get()
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Browse listed stores',
    description:
      'Live, listed Houses and Ateliers (the marketplace). Private stores never appear here. Search covers names, taglines, areas and service names.',
  })
  @DocQuery(StoreListQuery)
  @DocResponse(200, StoreList, 'Stores', [422, 429])
  async list(@ValidQuery(StoreListQuery) q: z.output<typeof StoreListQuery>) {
    return { items: await this.stores.list(q) };
  }

  @Post('enter')
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Enter a private store with its code',
    description:
      'Finds the private store that uses this code. Send the same code as `X-Store-Code` when reading that store. Strictly rate-limited so codes cannot be guessed.',
  })
  @DocBody(StoreEnter)
  @DocResponse(200, StoreEntered, 'The store this code opens', [404, 422, 429])
  enter(@ValidBody(StoreEnter) body: z.output<typeof StoreEnter>) {
    return this.stores.enter(body.code);
  }

  @Get(':handle')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'One store',
    description:
      'Everything a guest sees: profile, services and prices, team, rooms, opening hours and reviews from completed visits. The street address is not included (it is shared after booking). A private store answers 404 unless `X-Store-Code` matches.',
  })
  @HandleParam()
  @StoreCodeHeader()
  @DocResponse(200, StoreDetail, 'The store', [404, 429])
  detail(@Param('handle') handle: string, @Req() req: AppRequest) {
    return this.stores.detail(handleOf(handle), codeOf(req));
  }

  @Get(':handle/availability')
  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Free times for a service on a day',
    description:
      'Start times on a local date (store time zone) when the service and everything it needs (a team member, a room) are free. Optionally only for one team member.',
  })
  @HandleParam()
  @StoreCodeHeader()
  @DocQuery(AvailabilityQuery)
  @DocResponse(200, Availability, 'Free times', [404, 422, 429])
  availability(
    @Param('handle') handle: string,
    @ValidQuery(AvailabilityQuery) q: z.output<typeof AvailabilityQuery>,
    @Req() req: AppRequest,
  ) {
    return this.stores.availability(handleOf(handle), codeOf(req), q);
  }

  @Post(':handle/bookings')
  @Idempotent()
  @HttpCode(201)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Book a time',
    description:
      'Books a free time for the signed-in guest (guest app sign-in). The database guarantees no double booking: if the time was just taken the answer is 409 `slot_taken`. Needs an `Idempotency-Key` header so a retry never books twice.',
  })
  @HandleParam()
  @StoreCodeHeader()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'A unique key per booking attempt',
  })
  @DocBody(BookingCreate)
  @DocResponse(201, GuestBooking, 'Booked', [400, 401, 403, 404, 409, 422, 429])
  book(
    @Param('handle') handle: string,
    @ValidBody(BookingCreate) body: z.output<typeof BookingCreate>,
    @Req() req: AppRequest,
  ) {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    if (auth.audience !== 'guest') throw Errors.forbidden('Book from the guest app.');
    return this.stores.book(
      auth.userId,
      handleOf(handle),
      codeOf(req),
      body,
      req.header('idempotency-key') ?? null,
    );
  }
}

/** The signed-in guest's own bookings across stores. */
@ApiTags('Me')
@ApiBearerAuth('access-token')
@Controller('v1/me/bookings')
export class GuestBookingsController {
  constructor(
    @Inject(StoresService) private readonly stores: StoresService,
    @Inject(Data) private readonly data: Data,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'My bookings',
    description: 'Upcoming first, then past, across every store you have booked with.',
  })
  @DocResponse(200, z.object({ items: z.array(GuestBooking) }), 'Bookings', [401])
  async list(@Req() req: AppRequest) {
    const userId = req.auth?.userId ?? '';
    const all = [];
    for (const s of await this.stores.myStores(userId)) {
      all.push(
        ...(await this.data.asGuestIn(userId, s.tenantId, async (tx) =>
          this.stores.guestBookings(tx, await this.stores.storeOf(tx, s.tenantId), s.profileId),
        )),
      );
    }
    return { items: StoresService.sortForGuest(all) };
  }

  /** Finds one of the caller's bookings and runs `fn` inside that store. */
  private async withMine<T>(
    req: AppRequest,
    bookingId: string,
    fn: (ctx: {
      tx: Parameters<Parameters<Data['asGuestIn']>[2]>[0];
      tenantId: string;
      profileId: string;
      userId: string;
    }) => Promise<T>,
  ): Promise<T> {
    const userId = req.auth?.userId ?? '';
    for (const s of await this.stores.myStores(userId)) {
      const found = await this.data.asGuestIn(userId, s.tenantId, async (tx) => {
        const [b] = await tx
          .select({ id: booking.id })
          .from(booking)
          .where(
            and(
              eq(booking.tenantId, s.tenantId),
              eq(booking.id, bookingId),
              eq(booking.guestProfileId, s.profileId),
            ),
          );
        if (!b) return { hit: false as const };
        return {
          hit: true as const,
          value: await fn({ tx, tenantId: s.tenantId, profileId: s.profileId, userId }),
        };
      });
      if (found.hit) return found.value;
    }
    throw Errors.notFound('Booking');
  }

  @Post(':bookingId/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Cancel my booking',
    description: 'Allowed until 2 hours before the start. The time is freed for others at once.',
  })
  @DocUuidParam('bookingId', 'Booking id')
  @DocResponse(200, GuestBooking, 'Cancelled', [401, 404, 409])
  cancel(@UuidPath('bookingId') bookingId: string, @Req() req: AppRequest) {
    return this.withMine(req, bookingId, async ({ tx, tenantId, profileId, userId }) => {
      const store = await this.stores.storeOf(tx, tenantId);
      const [current] = await this.stores.guestBookings(tx, store, profileId, bookingId);
      if (!current?.can_cancel)
        throw Errors.conflict('This booking can no longer be cancelled online. Contact the store.');
      const [b] = await tx
        .select({ version: booking.version })
        .from(booking)
        .where(and(eq(booking.tenantId, tenantId), eq(booking.id, bookingId)));
      await tx
        .update(booking)
        .set({ state: 'cancelled_by_guest', version: (b?.version ?? 1) + 1, holdExpiresAt: null })
        .where(and(eq(booking.tenantId, tenantId), eq(booking.id, bookingId)));
      await audit(tx, {
        tenantId,
        actorUserId: userId,
        actorLabel: 'guest',
        action: 'booking.cancelled_by_guest',
        targetType: 'booking',
        targetId: bookingId,
      });
      await emit(tx, {
        tenantId,
        type: 'booking.cancelled',
        aggregateType: 'booking',
        aggregateId: bookingId,
        payload: { by: 'guest' },
      });
      const [after] = await this.stores.guestBookings(tx, store, profileId, bookingId);
      return after;
    });
  }

  @Post(':bookingId/review')
  @Idempotent()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Review a completed visit',
    description: 'One review per completed booking. Reviews show on the store without your name.',
  })
  @DocUuidParam('bookingId', 'Booking id')
  @DocBody(ReviewCreate)
  @DocResponse(201, GuestBooking, 'Reviewed', [400, 401, 404, 409, 422])
  review(
    @UuidPath('bookingId') bookingId: string,
    @ValidBody(ReviewCreate) body: z.output<typeof ReviewCreate>,
    @Req() req: AppRequest,
  ) {
    return this.withMine(req, bookingId, async ({ tx, tenantId, profileId, userId }) => {
      const store = await this.stores.storeOf(tx, tenantId);
      const [current] = await this.stores.guestBookings(tx, store, profileId, bookingId);
      if (!current?.can_review)
        throw Errors.conflict('Only completed visits can be reviewed, once.');
      const [r] = await tx
        .insert(review)
        .values({
          tenantId,
          bookingId,
          guestProfileId: profileId,
          rating: body.rating,
          comment: body.comment,
        })
        .returning({ id: review.id });
      await audit(tx, {
        tenantId,
        actorUserId: userId,
        actorLabel: 'guest',
        action: 'review.created',
        targetType: 'review',
        targetId: r?.id ?? '',
      });
      await emit(tx, {
        tenantId,
        type: 'review.created',
        aggregateType: 'review',
        aggregateId: r?.id ?? '',
        payload: { rating: body.rating },
      });
      const [after] = await this.stores.guestBookings(tx, store, profileId, bookingId);
      return after;
    });
  }
}
