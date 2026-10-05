import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Outbound email.
 *
 * The two behaviours that matter are safety ones: an unconfigured environment
 * must never attempt real delivery, and a mail failure must never propagate
 * into the workflow that triggered it.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe('unconfigured environments never send', () => {
  it('reports itself as unconfigured when SMTP_HOST is absent', async () => {
    delete process.env.SMTP_HOST;
    const { emailConfigured } = await import('../src/lib/email/mailer');
    expect(emailConfigured()).toBe(false);
  });

  it('logs the message instead of delivering it', async () => {
    delete process.env.SMTP_HOST;
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { sendMail } = await import('../src/lib/email/mailer');
    const result = await sendMail({
      to: 'focal.ke@test.invalid',
      subject: 'STISA 2034 — test',
      text: 'Body.',
    });

    // `sent: false` is the important half — nothing left the machine.
    expect(result.sent).toBe(false);
    expect(result.logged).toBe(true);
    expect(log).toHaveBeenCalled();
    expect(log.mock.calls[0]![0]).toContain('not sent');
    expect(log.mock.calls[0]![0]).toContain('focal.ke@test.invalid');
  });

  it('sendAll keeps going and counts every message', async () => {
    delete process.env.SMTP_HOST;
    vi.spyOn(console, 'info').mockImplementation(() => {});

    const { sendAll } = await import('../src/lib/email/mailer');
    const result = await sendAll([
      { to: 'a@test.invalid', subject: 's', text: 't' },
      { to: 'b@test.invalid', subject: 's', text: 't' },
      { to: 'c@test.invalid', subject: 's', text: 't' },
    ]);

    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
  });
});

describe('delivery failure is contained', () => {
  it('returns an error rather than throwing, so a workflow cannot be rolled back', async () => {
    // A closed local port: the transport is built, then fails on connect.
    // Deliberately not a bogus hostname — nodemailer resolves through
    // dns.resolve(), which on some resolvers hangs instead of returning
    // ENOTFOUND, and the test would then measure DNS rather than the
    // error handling it is meant to cover.
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '1';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { sendMail } = await import('../src/lib/email/mailer');

    await expect(
      sendMail({ to: 'x@test.invalid', subject: 's', text: 't' }),
    ).resolves.toMatchObject({ sent: false, logged: false });

    expect(error).toHaveBeenCalled();
  }, 30_000);
});

describe('message content', () => {
  it('never carries a password', async () => {
    delete process.env.SMTP_HOST;
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});

    const { notifyAccountCreated } = await import('../src/lib/email/notify');
    await notifyAccountCreated({
      email: 'new.user@test.invalid',
      name: 'New User',
      role: 'FOCAL_POINT',
      countryName: 'Kenya',
    });

    const body = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(body).toContain('New User');
    expect(body).toContain('Kenya');
    // The account email deliberately says a password exists without carrying it.
    expect(body).toContain('never contains a password');
    expect(body).not.toMatch(/password:\s*\S+/i);
  });
});
