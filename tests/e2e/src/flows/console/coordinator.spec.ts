import { expect, test, type Page } from '@playwright/test';
import { localOnly } from '../../support/browser';
import { db } from '../../support/db';
import { stack } from '../../support/env';
import {
  bootstrapNationalAdmin,
  nationalAdminInvite,
  signIn,
  syntheticPhone,
  syntheticEmail,
} from '../../support/people';
import { SEED } from '../../support/seed';

/**
 * The console (Vite dev server, its `/v1` proxy pointed at the real API with
 * CONSOLE_API_PROXY_TARGET) against the real API.
 */
const at = (path: string): string => `${stack().consoleUrl ?? ''}${path}`;

async function consoleSignIn(page: Page, phone: string): Promise<void> {
  await page.goto(at('/sign-in'));
  await page.getByLabel('Email address').fill(syntheticEmail(phone));
  // A first sign-in also gives the WhatsApp number.
  await page.getByLabel('WhatsApp number (first sign-in only)').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByLabel('6-digit code').fill(stack().fixedCode);
  // Wait for the answer, so a following navigation does not cut the sign-in short.
  const verified = page.waitForResponse((r) => r.url().endsWith('/v1/auth/verify'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await verified).status()).toBe(200);
}

test.describe('console against the real API', () => {
  test.beforeEach(async ({ context }) => {
    const { consoleUrl, consoleError } = stack();
    if (!consoleUrl) throw new Error(`The console did not start: ${consoleError ?? 'unknown'}`);
    await localOnly(context);
  });

  test('an attendee with no role is told the console is not for them', async ({ page }) => {
    await consoleSignIn(page, syntheticPhone());
    await expect(page.getByText('This email cannot open the console')).toBeVisible();
  });

  test('a national admin invites a venue coordinator, who then signs in and sees only their venue', async ({
    page,
    browser,
  }) => {
    await consoleSignIn(page, await nationalAdminInvite());
    await expect(page.getByRole('link', { name: 'Coordinators' })).toBeVisible();

    await page.goto(at('/coordinators'));
    const invitee = syntheticPhone();
    await page.locator('#invite-role').selectOption('venue_coordinator');
    await page.locator('#invite-venue').selectOption(SEED.venueNoor);
    await page.locator('#invite-email').fill(syntheticEmail(invitee));
    await page.locator('#invite-phone').fill(invitee);
    await page.locator('#invite-name').fill('E2E Console Invitee');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(page.getByText('Invite sent.')).toBeVisible();

    const { rows } = await db().query<{ status: string; venue_id: string }>(
      'select status, venue_id from coordinator_invites where phone_e164 = $1',
      [invitee],
    );
    expect(rows).toEqual([{ status: 'pending', venue_id: SEED.venueNoor }]);

    // The invitee signs in to the console in their own browser.
    const theirs = await browser.newContext();
    await localOnly(theirs);
    const theirPage = await theirs.newPage();
    try {
      await consoleSignIn(theirPage, invitee);
      await theirPage.goto(at('/sessions'));
      await expect(theirPage.getByText('Taraweeh with Dora (sample)').first()).toBeVisible();
      await expect(theirPage.getByText('Tuesday Tajweed Circle (sample)').first()).toBeVisible();
      // Iqra's session is another venue's: never listed.
      await expect(theirPage.getByText('Women Dora (sample)')).toHaveCount(0);
      // No coordinator management for a venue coordinator.
      await expect(theirPage.getByRole('link', { name: 'Bulk import' })).toHaveCount(0);
    } finally {
      await theirs.close();
    }
  });

  test('a venue coordinator sees their registrants, and not another venue’s', async ({ page }) => {
    const admin = await bootstrapNationalAdmin();
    const phone = syntheticPhone();
    await admin.api.adminRoles.invite({
      body: {
        role: 'venue_coordinator',
        venueId: SEED.venueNoor,
        phone,
        email: syntheticEmail(phone),
        displayName: 'E2E Reg Viewer',
      },
    });
    const registrantName = `E2E Listed ${Date.now().toString(36)}`;
    const attendee = await signIn();
    await attendee.api.registrations.create({
      body: {
        sessionId: SEED.sessionTajweedNoor,
        areaId: SEED.areaSaddar,
        section: 'family',
        partySize: 3,
        name: registrantName,
        allowWhatsapp: false,
      },
    });

    await consoleSignIn(page, phone);
    await expect(page.getByRole('link', { name: 'Sessions' })).toBeVisible();
    await page.goto(at(`/sessions/${SEED.sessionTajweedNoor}/registrations`));
    await expect(page.getByText(registrantName)).toBeVisible();

    const refused = page.waitForResponse((r) =>
      r.url().includes(`/v1/admin/sessions/${SEED.sessionWomenIqra}/registrations`),
    );
    await page.goto(at(`/sessions/${SEED.sessionWomenIqra}/registrations`));
    expect([403, 404]).toContain((await refused).status());
    await expect(page.getByText(registrantName)).toHaveCount(0);
    await expect(page.getByRole('alert').or(page.getByRole('status')).first()).toBeVisible();
  });

  test('a national admin makes posters in English and Urdu and sees the finished picture', async ({
    page,
  }) => {
    const { rendererError } = stack();
    if (rendererError) throw new Error(`The poster renderer did not start: ${rendererError}`);
    await consoleSignIn(page, await nationalAdminInvite());
    await page.goto(at(`/sessions/${SEED.sessionTaraweehNoor}/posters`));
    await page.getByRole('radio', { name: 'English and Urdu, English first' }).check();
    await page.getByRole('checkbox', { name: /^Story/ }).check();
    await page.getByRole('button', { name: 'Make posters' }).click();
    const card = page.getByRole('article').first();
    await expect(card.getByText('Ready')).toBeVisible({ timeout: 60_000 });
    const picture = card.getByRole('img');
    await expect(picture).toBeVisible();
    // A real picture: the renderer draws story posters at 1080 by 1920.
    await expect
      .poll(() =>
        picture.evaluate((img: HTMLImageElement) => `${img.naturalWidth}x${img.naturalHeight}`),
      )
      .toBe('1080x1920');
  });
});
