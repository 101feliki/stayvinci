import { Logger } from '@nestjs/common';

/** SMS adapter (spec §16). Africa's Talking is the production provider for Kenya. */
export interface Sms {
  send(phoneE164: string, text: string): Promise<void>;
}

/**
 * Development only: prints the code to the API log so you can sign in locally.
 * Config refuses this provider in production.
 */
export class ConsoleSms implements Sms {
  private readonly log = new Logger('SMS (development)');
  async send(phoneE164: string, text: string): Promise<void> {
    this.log.warn(`To ${phoneE164.slice(0, 5)}•••${phoneE164.slice(-3)}: ${text}`);
  }
}

/** Keeps messages in memory (tests). */
export class MemorySms implements Sms {
  readonly sent: { to: string; text: string }[] = [];
  async send(to: string, text: string): Promise<void> {
    this.sent.push({ to, text });
  }
}

/** Placeholder until the Africa's Talking account is set up (P1). */
export class AfricasTalkingSms implements Sms {
  async send(): Promise<void> {
    throw new Error("Africa's Talking SMS is not configured yet.");
  }
}
