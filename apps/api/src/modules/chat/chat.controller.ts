import { Controller, Get, HttpCode, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { conversation, guestProfile, message, type Tx } from '@stayvinci/db';
import {
  ChatMessage,
  ChatReply,
  ChatSend,
  GuestChat,
  HouseConversation,
  HouseThread,
} from '@stayvinci/types';
import { z } from 'zod';
import { Errors, type AppRequest } from '../../common/http.js';
import {
  DocBody,
  DocResponse,
  DocUuidParam,
  UuidPath,
  ValidBody,
} from '../../common/validation.js';
import { Data, audit, emit } from '../../database.js';
import { RequireCapability } from '../../security/guards.js';
import { codeOf, handleOf } from '../stores/stores.controller.js';
import { StoresService } from '../stores/stores.service.js';

type Msg = typeof message.$inferSelect;
type Conv = typeof conversation.$inferSelect;

const msgOut = (m: Msg): z.output<typeof ChatMessage> => ({
  id: m.id,
  sender: m.sender,
  body: m.body,
  created_at: new Date(m.createdAt).toISOString(),
});

/** A neutral label: the guest's alias, or "Guest" plus four characters of their profile id. */
const guestLabel = (alias: string | null, profileId: string) =>
  alias?.trim() || `Guest ${profileId.slice(0, 4).toUpperCase()}`;

/* ---------- Guests ---------- */

/** A guest's conversation with one store (spec §12). Needs the guest app sign-in. */
@ApiTags('Stores (guests)')
@ApiBearerAuth('access-token')
@Controller('v1/stores/:handle/chat')
export class GuestChatController {
  constructor(
    @Inject(StoresService) private readonly stores: StoresService,
    @Inject(Data) private readonly data: Data,
  ) {}

  private guest(req: AppRequest): string {
    const auth = req.auth;
    if (!auth) throw Errors.unauthorized();
    if (auth.audience !== 'guest') throw Errors.forbidden('Chat from the guest app.');
    return auth.userId;
  }

  @Get()
  @ApiOperation({
    summary: 'My chat with this store',
    description:
      'Messages oldest first. `enabled: false` means the House has turned chat off (old messages stay readable).',
  })
  @ApiParam({ name: 'handle', description: 'Store handle' })
  @DocResponse(200, GuestChat, 'Conversation', [401, 403, 404])
  async get(@Param('handle') handle: string, @Req() req: AppRequest) {
    const userId = this.guest(req);
    const store = await this.stores.resolve(handleOf(handle), codeOf(req));
    const messages = await this.data.asGuestIn(userId, store.tenantId, async (tx) => {
      const c = await this.mine(tx, store.tenantId, userId);
      if (!c) return [];
      await tx
        .update(conversation)
        .set({ guestReadAt: new Date().toISOString() })
        .where(eq(conversation.id, c.id));
      return tx
        .select()
        .from(message)
        .where(and(eq(message.tenantId, store.tenantId), eq(message.conversationId, c.id)))
        .orderBy(asc(message.createdAt))
        .limit(500);
    });
    return { enabled: store.chatEnabled, store_name: store.name, messages: messages.map(msgOut) };
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a message to this store',
    description: 'Refused with 403 when the House has turned chat off.',
  })
  @ApiParam({ name: 'handle', description: 'Store handle' })
  @DocBody(ChatSend)
  @DocResponse(201, ChatMessage, 'Sent', [400, 401, 403, 404, 422, 429])
  async send(
    @Param('handle') handle: string,
    @ValidBody(ChatSend) b: z.output<typeof ChatSend>,
    @Req() req: AppRequest,
  ) {
    const userId = this.guest(req);
    const store = await this.stores.resolve(handleOf(handle), codeOf(req));
    if (!store.chatEnabled) throw Errors.forbidden('This House is not taking messages here.');
    return this.data.asGuestIn(userId, store.tenantId, async (tx) => {
      // First contact creates the guest's profile in this House (first touch is permanent).
      await tx
        .insert(guestProfile)
        .values({
          tenantId: store.tenantId,
          userId,
          firstTouchSource: b.via,
          firstTouchDetail: b.via === 'marketplace' ? 'marketplace' : 'chat',
        })
        .onConflictDoNothing();
      const [profile] = await tx
        .select({ id: guestProfile.id })
        .from(guestProfile)
        .where(and(eq(guestProfile.tenantId, store.tenantId), eq(guestProfile.userId, userId)));
      if (!profile) throw Errors.forbidden();
      const now = new Date().toISOString();
      await tx
        .insert(conversation)
        .values({ tenantId: store.tenantId, guestProfileId: profile.id })
        .onConflictDoNothing();
      const [c] = await tx
        .update(conversation)
        .set({ lastMessageAt: now, lastSender: 'guest', guestReadAt: now })
        .where(
          and(
            eq(conversation.tenantId, store.tenantId),
            eq(conversation.guestProfileId, profile.id),
          ),
        )
        .returning();
      if (!c) throw Errors.forbidden();
      const [m] = await tx
        .insert(message)
        .values({ tenantId: store.tenantId, conversationId: c.id, sender: 'guest', body: b.body })
        .returning();
      if (!m) throw Errors.forbidden();
      // No message text in the event: notifications stay neutral (CLAUDE.md rule 5).
      await emit(tx, {
        tenantId: store.tenantId,
        type: 'message.sent',
        aggregateType: 'conversation',
        aggregateId: c.id,
        payload: { conversation_id: c.id, sender: 'guest' },
      });
      return msgOut(m);
    });
  }

  private async mine(tx: Tx, tenantId: string, userId: string): Promise<Conv | null> {
    const [row] = await tx
      .select({ c: conversation })
      .from(conversation)
      .innerJoin(guestProfile, eq(guestProfile.id, conversation.guestProfileId))
      .where(and(eq(conversation.tenantId, tenantId), eq(guestProfile.userId, userId)));
    return row?.c ?? null;
  }
}

/* ---------- Houses ---------- */

/** The House inbox. Guests show by alias only; contact details never appear here. */
@ApiTags('Houses: chat')
@ApiBearerAuth('access-token')
@Controller('v1/tenants/:tenantId/conversations')
export class HouseChatController {
  constructor(@Inject(Data) private readonly data: Data) {}

  private async describe(tx: Tx, convs: Conv[]): Promise<z.output<typeof HouseConversation>[]> {
    if (!convs.length) return [];
    const ids = convs.map((c) => c.id);
    const [profiles, latest] = await Promise.all([
      tx
        .select({ id: guestProfile.id, alias: guestProfile.alias })
        .from(guestProfile)
        .where(
          inArray(
            guestProfile.id,
            convs.map((c) => c.guestProfileId),
          ),
        ),
      tx
        .selectDistinctOn([message.conversationId], {
          conversationId: message.conversationId,
          body: message.body,
        })
        .from(message)
        .where(inArray(message.conversationId, ids))
        .orderBy(message.conversationId, desc(message.createdAt)),
    ]);
    return convs.map((c) => {
      const alias = profiles.find((p) => p.id === c.guestProfileId)?.alias ?? null;
      const preview = latest.find((l) => l.conversationId === c.id)?.body ?? '';
      return {
        id: c.id,
        guest_label: guestLabel(alias, c.guestProfileId),
        last_message_at: new Date(c.lastMessageAt).toISOString(),
        last_sender: c.lastSender ?? null,
        preview: preview.length > 140 ? `${preview.slice(0, 139)}…` : preview,
        unread:
          c.lastSender === 'guest' &&
          (!c.houseReadAt || new Date(c.houseReadAt) < new Date(c.lastMessageAt)),
      };
    });
  }

  @Get()
  @RequireCapability('message.reply')
  @ApiOperation({ summary: 'Inbox', description: 'Conversations with guests, newest first.' })
  @DocUuidParam('tenantId', 'House id')
  @DocResponse(200, z.object({ items: z.array(HouseConversation) }), 'Inbox', [401, 403, 404])
  list(@Req() req: AppRequest) {
    return this.data.inTenant(req, async (tx) => {
      const convs = await tx
        .select()
        .from(conversation)
        .orderBy(desc(conversation.lastMessageAt))
        .limit(200);
      return { items: await this.describe(tx, convs) };
    });
  }

  @Get(':conversationId')
  @RequireCapability('message.reply')
  @ApiOperation({ summary: 'Open a conversation', description: 'Marks it read for the House.' })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('conversationId', 'Conversation id')
  @DocResponse(200, HouseThread, 'Conversation', [401, 403, 404])
  open(@UuidPath('conversationId') id: string, @Req() req: AppRequest) {
    return this.data.inTenant(req, async (tx) => {
      const [c] = await tx
        .update(conversation)
        .set({ houseReadAt: new Date().toISOString() })
        .where(eq(conversation.id, id))
        .returning();
      if (!c) throw Errors.notFound('Conversation');
      const msgs = await tx
        .select()
        .from(message)
        .where(eq(message.conversationId, id))
        .orderBy(asc(message.createdAt))
        .limit(500);
      const [described] = await this.describe(tx, [c]);
      if (!described) throw Errors.notFound('Conversation');
      return { conversation: described, messages: msgs.map(msgOut) };
    });
  }

  @Post(':conversationId/messages')
  @RequireCapability('message.reply')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reply', description: 'Sends a message to the guest as the House.' })
  @DocUuidParam('tenantId', 'House id')
  @DocUuidParam('conversationId', 'Conversation id')
  @DocBody(ChatReply)
  @DocResponse(201, ChatMessage, 'Sent', [400, 401, 403, 404, 422, 429])
  reply(
    @UuidPath('conversationId') id: string,
    @ValidBody(ChatReply) b: z.output<typeof ChatReply>,
    @Req() req: AppRequest,
  ) {
    return this.data.inTenant(req, async (tx) => {
      const now = new Date().toISOString();
      const [c] = await tx
        .update(conversation)
        .set({ lastMessageAt: now, lastSender: 'house', houseReadAt: now })
        .where(eq(conversation.id, id))
        .returning();
      if (!c) throw Errors.notFound('Conversation');
      const [m] = await tx
        .insert(message)
        .values({
          tenantId: c.tenantId,
          conversationId: c.id,
          sender: 'house',
          authorUserId: req.auth?.userId ?? null,
          body: b.body,
        })
        .returning();
      if (!m) throw Errors.notFound('Conversation');
      await audit(tx, {
        tenantId: c.tenantId,
        actorUserId: req.auth?.userId ?? null,
        actorLabel: 'member',
        action: 'message.sent',
        targetType: 'conversation',
        targetId: c.id,
        ip: req.ip ?? null,
        requestId: req.requestId,
      });
      await emit(tx, {
        tenantId: c.tenantId,
        type: 'message.sent',
        aggregateType: 'conversation',
        aggregateId: c.id,
        payload: { conversation_id: c.id, sender: 'house' },
      });
      return msgOut(m);
    });
  }
}
