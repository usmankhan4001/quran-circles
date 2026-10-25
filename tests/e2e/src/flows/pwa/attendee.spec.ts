import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { localOnly } from '../../support/browser';
import { db } from '../../support/db';
import { stack } from '../../support/env';
import {
  bootstrapNationalAdmin,
  inviteVenueCoordinator,
  syntheticPhone,
} from '../../support/people';
import { SEED } from '../../support/seed';

/**
 * The PWA (the user app's web export) against the real API: its own `EXPO_PUBLIC_API_URL` points
 * at the API started for the run, so every screen here is fed by Postgres, not the mock.
 */
test.describe.serial('PWA attendee: find, sign in with a code, join, read updates', () => {
  let context: BrowserContext;
  let page: Page;
  const phone = syntheticPhone();

  test.beforeAll(async ({ browser }) => {
    const { pwaUrl, pwaError } = stack();
    if (!pwaUrl) throw new Error(`The PWA did not build or start: ${pwaError ?? 'unknown'}`);
    context = await browser.newContext({ baseURL: pwaUrl, viewport: { width: 412, height: 915 } });
    await localOnly(context);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('find: the nearby list shows seeded sessions from the real API', async () => {
    await page.goto('/nearby');
    await expect(page.getByTestId('nearby-screen')).toBeVisible();
    await expect(page.getByText('Taraweeh with Dora (sample)').first()).toBeVisible();
  });

  test('sign in with a code as a new attendee', async () => {
    await page.goto('/sign-in');
    await page.getByTestId('phone-input').fill(phone);
    await page.getByTestId('send-code').click();
    await page.getByTestId('code-input').fill(stack().fixedCode);
    await page.getByTestId('verify-code').click();
    await page.getByTestId('name-input').fill('E2E Web Attendee');
    await page.getByTestId('save-name').click();
    await expect(page.getByTestId('sign-in-screen')).toBeHidden();

    const { rows } = await db().query<{ display_name: string | null }>(
      'select display_name from users where phone_e164 = $1',
      [phone],
    );
    expect(rows[0]?.display_name).toBe('E2E Web Attendee');
  });

  test('join a session (a pledge, no seat booking); the API has it and Journey shows it', async () => {
    await page.goto(`/session/${SEED.sessionTaraweehNoor}`);
    await expect(page.getByTestId('session-screen')).toBeVisible();
    await expect(page.getByTestId('register-button')).toHaveText('Join');
    await page.getByTestId('register-button').click();
    await expect(page.getByTestId('registration-party')).toHaveCount(0);
    await expect(page.getByTestId('registration-form')).toBeVisible();
    await page.getByTestId('registration-city').click();
    await page.getByTestId(`registration-city-option-${SEED.rawalpindi}`).click();
    await page.getByTestId('registration-area').click();
    await page.getByTestId(`area-option-${SEED.areaSaddar}`).click();
    // A family session takes women, men or a family; nothing is preselected.
    await page.getByTestId('registration-section').getByRole('radio', { name: 'Family' }).click();
    await page.getByTestId('registration-submit').click();
    await expect(page.getByTestId('registration-confirmation')).toBeVisible();

    const { rows } = await db().query<{ id: string; status: string }>(
      `select r.id, r.status from registrations r join users u on u.id = r.user_id
        where u.phone_e164 = $1 and r.session_id = $2`,
      [phone, SEED.sessionTaraweehNoor],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('confirmed');

    await page.goto('/journey');
    await expect(page.getByTestId(`registration-${rows[0]?.id}`)).toBeVisible();

    await page.goto(`/session/${SEED.sessionTaraweehNoor}`);
    await expect(page.getByTestId('register-button')).toHaveText('You are joining');
  });

  test('an update a coordinator posts shows in the PWA feed', async () => {
    const admin = await bootstrapNationalAdmin();
    const coordinator = await inviteVenueCoordinator(admin, SEED.venueNoor);
    const title = `E2E web update ${Date.now()}`;
    await coordinator.api.adminUpdates.post({
      body: {
        scope: { type: 'venue', venueId: SEED.venueNoor },
        title: { en: title },
        body: { en: 'Synthetic update for the PWA feed.' },
        notify: true,
      },
    });
    await page.goto('/updates');
    await expect(page.getByTestId('updates-screen')).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  });
});
