import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outbound email.
 *
 * Plain SMTP rather than a hosted API, because an AU deployment will most
 * likely be required to send through its own mail infrastructure rather than a
 * third-party service holding Member State correspondence.
 *
 * Two deliberate behaviours:
 *
 *   1. With no SMTP configuration, messages are LOGGED rather than sent. A
 *      developer running the platform locally must never be able to email a
 *      real ministry by accident.
 *   2. Sending never throws into the caller. A mail outage must not roll back
 *      an approved submission — the workflow is the record, email is a
 *      courtesy on top of it.
 */

export interface Message {
  to: string;
  subject: string;
  /** Plain text is the source of truth; HTML is generated from it. */
  text: string;
  html?: string;
  replyTo?: string;
}

let cached: Transporter | null | undefined;

function transport(): Transporter | null {
  if (cached !== undefined) return cached;

  const host = process.env.SMTP_HOST;
  if (!host) {
    cached = null;
    return cached;
  }

  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    // Port 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
      : undefined,
  });

  return cached;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export interface SendResult {
  sent: boolean;
  /** True when the message was logged instead of sent (no SMTP configured). */
  logged: boolean;
  error?: string;
}

export async function sendMail(message: Message): Promise<SendResult> {
  const from = process.env.SMTP_FROM ?? 'STISA 2034 Platform <no-reply@au-stisa.org>';
  const mailer = transport();

  if (!mailer) {
    // Unconfigured is the normal state in development. Log enough to verify the
    // content without pretending anything was delivered.
    console.info(
      [
        '',
        '─── EMAIL (not sent — SMTP_HOST is not configured) ───',
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        '',
        message.text,
        '──────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
    return { sent: false, logged: true };
  }

  try {
    await mailer.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      replyTo: message.replyTo,
    });
    return { sent: true, logged: false };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[email] delivery failed', { to: message.to, subject: message.subject, detail });
    return { sent: false, logged: false, error: detail };
  }
}

/**
 * Sends to several recipients, never letting one failure stop the rest.
 * Returns how many were delivered, for the audit record.
 */
export async function sendAll(messages: Message[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const message of messages) {
    const result = await sendMail(message);
    if (result.sent || result.logged) sent++;
    else failed++;
  }
  return { sent, failed };
}
