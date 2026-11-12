import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import { BrevoMailer, parseSender, templates } from './mailer.js';

describe('parseSender', () => {
  it('reads "Name <address>" and bare addresses', () => {
    expect(parseSender('Stayvinci <hello@example.org>')).toEqual({
      name: 'Stayvinci',
      email: 'hello@example.org',
    });
    expect(parseSender('"Stay Vinci" <a@b.co>')).toEqual({ name: 'Stay Vinci', email: 'a@b.co' });
    expect(parseSender('a@b.co')).toEqual({ email: 'a@b.co' });
  });
});

describe('BrevoMailer', () => {
  const config = loadConfig({
    NODE_ENV: 'test',
    MAIL_TRANSPORT: 'brevo',
    BREVO_API_KEY: 'test-key',
    MAIL_FROM: 'Stayvinci <hello@example.org>',
  });

  it('posts the email to Brevo with the API key', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const http = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{"messageId":"x"}', { status: 201 });
    }) as unknown as typeof fetch;
    await new BrevoMailer(config, http).send(
      templates.magicLink('guest@example.org', 'https://x/y'),
    );
    expect(calls[0]?.url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((calls[0]?.init.headers as Record<string, string>)['api-key']).toBe('test-key');
    const body = JSON.parse(String(calls[0]?.init.body));
    expect(body.sender).toEqual({ name: 'Stayvinci', email: 'hello@example.org' });
    expect(body.to).toEqual([{ email: 'guest@example.org' }]);
    expect(body.subject).toBe('Your sign-in link');
  });

  it('fails without echoing the message when Brevo refuses', async () => {
    const http = (async () => new Response('bad', { status: 401 })) as unknown as typeof fetch;
    const err = await new BrevoMailer(config, http)
      .send(templates.magicLink('guest@example.org', 'https://x/secret-token'))
      .catch((e: Error) => e);
    expect(String(err)).toContain('HTTP 401');
    expect(String(err)).not.toContain('secret-token');
    expect(String(err)).not.toContain('guest@example.org');
  });

  it('refuses to start without an API key', () => {
    expect(() => loadConfig({ NODE_ENV: 'test', MAIL_TRANSPORT: 'brevo' })).toThrow(
      /BREVO_API_KEY/,
    );
  });
});
