import { expect, test, type Page } from '@playwright/test';
import { localOnly } from '../../support/browser';
import { outboxFor } from '../../support/db';
import { stack } from '../../support/env';
import {
  addWebPushDevice,
  bootstrapNationalAdmin,
  signIn,
  syntheticPhone,
} from '../../support/people';
import { SEED } from '../../support/seed';
import { pktDate } from '../../support/time';
import { eventually } from '../../support/wait';

/**
 * The coordinators' app (admin-app web export, `EXPO_PUBLIC_API_URL` = the real API) driving the
 * two coordinator flows of Gate 3 through its screens. Native builds need Maestro on a simulator
 * (FINDINGS.md).
 */
const at = (path: string): string => `${stack().adminUrl ?? ''}${path}`;

async function adminSignIn(page: Page, phone: string): Promise<void> {
  await page.goto(at('/'));
  await page.getByTestId('sign-in-phone').fill(phone);
  await page.getByTestId('sign-in-send-code').click();
  await page.getByTestId('sign-in-code').fill(stack().fixedCode);
  await page.getByTestId('sign-in-verify').click();
  await expect(page.getByTestId('sign-in')).toBeHidden();
}

/** Invites a venue coordinator through the API and returns the number (not yet signed in). */
async function invitedCoordinator(venueId: string): Promise<string> {
  const admin = await bootstrapNationalAdmin();
  const phone = syntheticPhone();
  await admin.api.adminRoles.invite({
    body: { role: 'venue_coordinator', venueId, phone, displayName: 'E2E App Coordinator' },
  });
  return phone;
}

test.describe('admin app against the real API', () => {
  test.beforeEach(async ({ context }) => {
    const { adminUrl, adminError } = stack();
    if (!adminUrl) throw new Error(`The admin app did not build or start: ${adminError ?? ''}`);
    await localOnly(context);
  });

  test('an invited coordinator posts an update; the follower sees it and gets a push', async ({
    page,
  }) => {
    const phone = await invitedCoordinator(SEED.venueNoor);
    const follower = await signIn();
    await addWebPushDevice(follower);
    await follower.api.follows.create({
      body: { target: 'venue', venueId: SEED.venueNoor, alertsEnabled: true },
    });

    await adminSignIn(page, phone);
    await expect(page.getByTestId('not-invited')).toHaveCount(0);
    await page.goto(at('/post-update'));
    await expect(page.getByTestId('post-update-compose')).toBeVisible();
    const title = `E2E app update ${Date.now().toString(36)}`;
    await page.getByRole('textbox', { name: 'Title (English)' }).fill(title);
    await page
      .getByRole('textbox', { name: 'Message (English)' })
      .fill('Synthetic update posted from the admin app.');
    await page.getByTestId('post-update-preview').click();
    await expect(page.getByTestId('post-update-preview-step')).toBeVisible();
    await page.getByTestId('post-update-send').click();
    await page.getByTestId('post-update-confirm-confirm').click();
    await expect(page.getByTestId('post-update-done')).toBeVisible();

    const feed = await follower.api.updates.feed({ query: {} });
    const item = feed.items.find((u) => u.title.en === title);
    expect(item, 'the posted update is in the follower’s feed').toBeDefined();
    const push = await eventually('the push for the app-posted update', async () => {
      const row = (await outboxFor(follower.me.id)).find((r) => r.update_id === item?.id);
      return row && ['sent', 'delivered'].includes(row.status) ? row : null;
    });
    expect(push.provider_message_id).toMatch(/^fake-push-/);
  });

  test('a coordinator changes a session time; the registrant is told', async ({ page }) => {
    const phone = await invitedCoordinator(SEED.venueNoor);
    const admin = await bootstrapNationalAdmin();
    const startsOn = pktDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
    const session = await admin.api.adminSessions.create({
      body: {
        kind: 'recurring',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        startsOn,
        venueId: SEED.venueNoor,
        program: 'dora',
        title: { en: `E2E app schedule ${Date.now().toString(36)}` },
        section: 'family',
        language: 'en',
        localStartTime: '18:30',
        durationMinutes: 45,
      },
    });
    const registrant = await signIn();
    await addWebPushDevice(registrant);
    await registrant.api.registrations.create({
      body: {
        sessionId: session.id,
        areaId: SEED.areaSaddar,
        section: 'family',
        partySize: 1,
        name: 'E2E App Registrant',
        allowWhatsapp: false,
      },
    });

    await adminSignIn(page, phone);
    await page.goto(at(`/session/${session.id}/schedule`));
    await expect(page.getByTestId('schedule-form')).toBeVisible();
    await page.getByTestId('schedule-time').fill('19:45');
    await page.getByTestId('schedule-review').click();
    await page.getByTestId('schedule-confirm-confirm').click();
    await expect(page.getByTestId('schedule-done')).toBeVisible();

    const after = await registrant.api.sessions.get({ params: { sessionId: session.id } });
    expect(after.localStartTime).toBe('19:45');
    const notice = await eventually('the time-change update in the registrant’s feed', async () => {
      const feed = await registrant.api.updates.feed({ query: {} });
      return feed.items.find((u) => u.kind === 'time_change' && u.sessionId === session.id);
    });
    const push = await eventually('the time-change push', async () => {
      const row = (await outboxFor(registrant.me.id)).find((r) => r.update_id === notice.id);
      return row && ['sent', 'delivered'].includes(row.status) ? row : null;
    });
    expect(push.channel).toBe('push');
  });
});
