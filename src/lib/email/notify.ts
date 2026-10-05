import 'server-only';

import { prisma } from '@/lib/db';
import { sendAll, type Message } from './mailer';
import type { SubmissionStatus } from '@/generated/prisma/enums';

/**
 * Workflow notifications.
 *
 * Without these the process silently stalls: a focal point has no way to learn
 * that revisions were requested, and an administrator has no way to learn that
 * a return is waiting.
 *
 * Rules kept throughout:
 *   - Never include indicator VALUES in an email. Unpublished national
 *     statistics must not travel over mail; the message says what happened and
 *     links back to the platform.
 *   - Never throw. A mail failure must not undo a workflow transition that has
 *     already been recorded.
 *   - Address people in the language they will read the platform in where the
 *     recipient's preference is known; otherwise English.
 */

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function layout(title: string, body: string[], action?: { label: string; href: string }): Message['text'] {
  const lines = [
    title,
    '='.repeat(Math.min(title.length, 60)),
    '',
    ...body,
    '',
  ];
  if (action) {
    lines.push(`${action.label}: ${action.href}`, '');
  }
  lines.push(
    '—',
    'STISA 2034 Monitoring & Evaluation Platform',
    'African Union Commission — Education, Science, Technology and Innovation',
    '',
    'This is an automated message. It contains no reported figures.',
  );
  return lines.join('\n');
}

function html(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap">${escaped}</pre>`;
}

/** Active focal points for a Member State. */
async function focalPointsFor(countryId: string) {
  return prisma.user.findMany({
    where: { countryId, role: 'FOCAL_POINT', active: true },
    select: { email: true, name: true },
  });
}

async function administrators() {
  return prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { email: true, name: true },
  });
}

export interface TransitionNotice {
  submissionId: string;
  from: SubmissionStatus;
  to: SubmissionStatus;
  note?: string | null;
  actorName: string;
}

/**
 * Notifies the people a workflow transition actually concerns.
 *
 * Deliberately selective: not every transition is worth an email. Beginning a
 * review is internal housekeeping and would just add noise.
 */
export async function notifyTransition(notice: TransitionNotice): Promise<{ sent: number; failed: number }> {
  try {
    const submission = await prisma.submission.findUnique({
      where: { id: notice.submissionId },
      include: {
        country: { select: { id: true, shortName: true } },
        reportingCycle: { select: { label: true, reportingYear: true, closesAt: true } },
      },
    });
    if (!submission) return { sent: 0, failed: 0 };

    const country = submission.country.shortName;
    const cycle = submission.reportingCycle.label;
    const messages: Message[] = [];

    switch (`${notice.from}->${notice.to}`) {
      // ---- a return arrives for review ---------------------------------
      case 'DRAFT->SUBMITTED':
      case 'REVISION_REQUIRED->SUBMITTED': {
        const admins = await administrators();
        const text = layout(
          `${country} has submitted its ${cycle} return`,
          [
            `${country} submitted its STISA 2034 return for the ${cycle}.`,
            '',
            'It is now awaiting review by the African Union Commission.',
          ],
          { label: 'Review it', href: `${APP_URL()}/admin/submissions/${submission.id}` },
        );
        for (const admin of admins) {
          messages.push({
            to: admin.email,
            subject: `STISA 2034 — ${country} submitted its ${cycle} return`,
            text,
            html: html(text),
          });
        }
        break;
      }

      // ---- revisions requested -----------------------------------------
      case 'UNDER_REVIEW->REVISION_REQUIRED':
      case 'SUBMITTED->REVISION_REQUIRED': {
        const recipients = await focalPointsFor(submission.country.id);
        const text = layout(
          `Revisions requested for your ${cycle} return`,
          [
            `The African Union Commission has reviewed ${country}'s STISA 2034 return for the`,
            `${cycle} and asked for changes.`,
            '',
            'What was asked:',
            '',
            notice.note ? `  ${notice.note}` : '  (no note was supplied)',
            '',
            `Your return is editable again. The ${cycle} closes on ${submission.reportingCycle.closesAt
              .toISOString()
              .slice(0, 10)}.`,
          ],
          { label: 'Open your return', href: `${APP_URL()}/portal/data-entry` },
        );
        for (const person of recipients) {
          messages.push({
            to: person.email,
            subject: `STISA 2034 — revisions requested for ${country}'s ${cycle} return`,
            text,
            html: html(text),
          });
        }
        break;
      }

      // ---- approved -----------------------------------------------------
      case 'UNDER_REVIEW->APPROVED': {
        const recipients = await focalPointsFor(submission.country.id);
        const text = layout(
          `Your ${cycle} return has been approved`,
          [
            `The African Union Commission has approved ${country}'s STISA 2034 return for the`,
            `${cycle}.`,
            '',
            'Approved data is not yet public. It becomes visible on the continental',
            'dashboard once the Commission publishes it.',
          ],
          { label: 'View your portal', href: `${APP_URL()}/portal` },
        );
        for (const person of recipients) {
          messages.push({
            to: person.email,
            subject: `STISA 2034 — ${country}'s ${cycle} return approved`,
            text,
            html: html(text),
          });
        }
        break;
      }

      // ---- published ----------------------------------------------------
      case 'APPROVED->PUBLISHED': {
        const recipients = await focalPointsFor(submission.country.id);
        const text = layout(
          `Your ${cycle} return is now published`,
          [
            `${country}'s STISA 2034 return for the ${cycle} has been published by the`,
            'African Union Commission and now appears on the public continental dashboard.',
          ],
          { label: 'View the public profile', href: `${APP_URL()}/countries` },
        );
        for (const person of recipients) {
          messages.push({
            to: person.email,
            subject: `STISA 2034 — ${country}'s ${cycle} return published`,
            text,
            html: html(text),
          });
        }
        break;
      }

      // ---- unlocked for further editing ---------------------------------
      case 'SUBMITTED->DRAFT':
      case 'UNDER_REVIEW->DRAFT': {
        const recipients = await focalPointsFor(submission.country.id);
        const text = layout(
          `Your ${cycle} return has been unlocked`,
          [
            `The African Union Commission has returned ${country}'s ${cycle} submission to draft`,
            'so it can be edited again.',
            '',
            notice.note ? `Reason: ${notice.note}` : '',
            '',
            'You will need to submit it again once your changes are complete.',
          ].filter(Boolean),
          { label: 'Open your return', href: `${APP_URL()}/portal/data-entry` },
        );
        for (const person of recipients) {
          messages.push({
            to: person.email,
            subject: `STISA 2034 — ${country}'s ${cycle} return unlocked`,
            text,
            html: html(text),
          });
        }
        break;
      }

      default:
        // Beginning a review, withdrawing from publication and resuming a
        // draft are internal steps; emailing them would be noise.
        return { sent: 0, failed: 0 };
    }

    return await sendAll(messages);
  } catch (error) {
    console.error('[email] notifyTransition failed', error);
    return { sent: 0, failed: 0 };
  }
}

/** Welcomes a newly created account. Never contains the password. */
export async function notifyAccountCreated(params: {
  email: string;
  name: string;
  role: 'ADMIN' | 'FOCAL_POINT';
  countryName?: string | null;
}): Promise<void> {
  try {
    const roleLine =
      params.role === 'ADMIN'
        ? 'You have been given an administrator account, with continental scope.'
        : `You have been registered as the STISA 2034 national focal point for ${params.countryName ?? 'your Member State'}.`;

    const text = layout(
      'Your STISA 2034 platform account',
      [
        `Dear ${params.name},`,
        '',
        roleLine,
        '',
        'Your temporary password has been shared with you separately by the',
        'administrator who created the account. You will be asked to change it',
        'the first time you sign in.',
        '',
        'This message never contains a password.',
      ],
      { label: 'Sign in', href: `${APP_URL()}/portal/login` },
    );

    await sendAll([
      {
        to: params.email,
        subject: 'STISA 2034 — your platform account',
        text,
        html: html(text),
      },
    ]);
  } catch (error) {
    console.error('[email] notifyAccountCreated failed', error);
  }
}

/**
 * Announces that a reporting cycle has opened.
 *
 * Called from an administrative action rather than a timer: the platform has no
 * scheduler, and an accidental duplicate announcement to 55 Member States would
 * be worse than a manual step.
 */
export async function notifyCycleOpened(reportingCycleId: string): Promise<{ sent: number; failed: number }> {
  try {
    const cycle = await prisma.reportingCycle.findUnique({ where: { id: reportingCycleId } });
    if (!cycle) return { sent: 0, failed: 0 };

    const recipients = await prisma.user.findMany({
      where: { role: 'FOCAL_POINT', active: true, country: { active: true } },
      select: { email: true, name: true, country: { select: { shortName: true } } },
    });

    const messages: Message[] = recipients.map((person) => {
      const text = layout(
        `The ${cycle.label} is now open`,
        [
          `Dear ${person.name},`,
          '',
          `STISA 2034 reporting for ${cycle.reportingYear} is now open.`,
          `${person.country?.shortName ?? 'Your Member State'} can enter and submit data until`,
          `${cycle.closesAt.toISOString().slice(0, 10)}.`,
          '',
          'You can complete the indicators in the portal, or download the Excel',
          'template, complete it offline and upload it.',
        ],
        { label: 'Open the reporting portal', href: `${APP_URL()}/portal/data-entry` },
      );
      return {
        to: person.email,
        subject: `STISA 2034 — the ${cycle.label} is now open`,
        text,
        html: html(text),
      };
    });

    return await sendAll(messages);
  } catch (error) {
    console.error('[email] notifyCycleOpened failed', error);
    return { sent: 0, failed: 0 };
  }
}
