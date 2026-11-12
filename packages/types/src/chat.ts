// Contracts for chat between a guest and a House (spec §12). Guests appear by alias only:
// no phone or email ever travels with a conversation (CLAUDE.md rule 5).
import { z } from 'zod';

export const ChatMessage = z
  .object({
    id: z.uuid(),
    sender: z.enum(['guest', 'house']),
    body: z.string(),
    created_at: z.string().describe('ISO 8601, UTC'),
  })
  .meta({ id: 'ChatMessage' });

export const ChatSend = z
  .object({
    body: z.string().trim().min(1, 'Write a message').max(2000),
    via: z
      .enum(['own_channel', 'marketplace'])
      .default('own_channel')
      .describe(
        'How the guest found this store (first touch, used if this is their first contact)',
      ),
  })
  .meta({ id: 'ChatSend' });

export const ChatReply = z
  .object({ body: z.string().trim().min(1, 'Write a message').max(2000) })
  .meta({ id: 'ChatReply' });

export const GuestChat = z
  .object({
    enabled: z.boolean().describe('False when the House has turned chat off'),
    store_name: z.string(),
    messages: z.array(ChatMessage),
  })
  .meta({ id: 'GuestChat' });

export const HouseConversation = z
  .object({
    id: z.uuid(),
    guest_label: z.string().describe('The guest alias, or a neutral "Guest ABCD"'),
    last_message_at: z.string(),
    last_sender: z.enum(['guest', 'house']).nullable(),
    preview: z.string(),
    unread: z.boolean().describe('The guest wrote since the House last opened it'),
  })
  .meta({ id: 'HouseConversation' });

export const HouseThread = z
  .object({ conversation: HouseConversation, messages: z.array(ChatMessage) })
  .meta({ id: 'HouseThread' });
