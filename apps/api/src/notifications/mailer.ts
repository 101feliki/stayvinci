import { Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Config } from '../config.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Email adapter (spec §16: notifications behind adapters). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/**
 * Nodemailer over SMTP. Locally this points at Mailpit (inbox at http://localhost:8025);
 * in production at any SMTP provider (for example Resend's SMTP endpoint).
 */
export class SmtpMailer implements Mailer {
  private readonly transport: Transporter;

  constructor(private readonly config: Config) {
    this.transport = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      ...(config.smtp.user && config.smtp.password
        ? { auth: { user: config.smtp.user, pass: config.smtp.password } }
        : {}),
      // Never fall back to plain text when the server offers TLS.
      requireTLS: config.env === 'production',
    });
  }

  async send(m: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.config.smtp.from,
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
    });
  }
}

/**
 * Development only (MAIL_TRANSPORT=console): prints the plain-text email, including its
 * sign-in link, to the API log. Config refuses this in production.
 */
export class ConsoleMailer implements Mailer {
  private readonly log = new Logger('Email (development)');
  async send(m: MailMessage): Promise<void> {
    this.log.warn(`To ${m.to} | ${m.subject} | ${m.text.replace(/\s+/g, ' ')}`);
  }
}

/** Keeps messages in memory (tests). */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  async send(m: MailMessage): Promise<void> {
    this.sent.push(m);
  }
}

/* ---------- Templates ---------- */
// Discreet by default (CLAUDE.md rule 5): subjects never name a House or a service.

const shell = (title: string, body: string, cta: { label: string; url: string }) => `<!doctype html>
<html lang="en"><body style="margin:0;background:#f5f1e8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1c1c1e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0b0b0c;padding:20px 28px;color:#c8a96a;font-size:18px;font-weight:600;letter-spacing:.5px">Stayvinci</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px">${title}</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4a4f">${body}</p>
<a href="${cta.url}" style="display:inline-block;background:#0b0b0c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${cta.label}</a>
<p style="margin:24px 0 0;font-size:12px;color:#8a877f">If you didn't ask for this, you can ignore this email. The link works once and expires soon.</p>
</td></tr></table></td></tr></table></body></html>`;

export const templates = {
  verifyEmail: (to: string, url: string): MailMessage => ({
    to,
    subject: 'Confirm your email',
    text: `Confirm your email address for Stayvinci:\n\n${url}\n\nThe link expires in 24 hours.`,
    html: shell(
      'Confirm your email',
      'Tap the button to confirm this email address. The link expires in 24 hours.',
      {
        label: 'Confirm email',
        url,
      },
    ),
  }),
  magicLink: (to: string, url: string): MailMessage => ({
    to,
    subject: 'Your sign-in link',
    text: `Sign in to Stayvinci:\n\n${url}\n\nThe link works once and expires in 15 minutes.`,
    html: shell(
      'Your sign-in link',
      'Tap the button to sign in. The link works once and expires in 15 minutes.',
      {
        label: 'Sign in',
        url,
      },
    ),
  }),
  passwordReset: (to: string, url: string): MailMessage => ({
    to,
    subject: 'Reset your password',
    text: `Choose a new password for Stayvinci:\n\n${url}\n\nThe link works once and expires in 30 minutes. Your other sessions will be signed out.`,
    html: shell(
      'Reset your password',
      'Tap the button to choose a new password. The link expires in 30 minutes, and you will be signed out everywhere else.',
      { label: 'Choose a new password', url },
    ),
  }),
};
