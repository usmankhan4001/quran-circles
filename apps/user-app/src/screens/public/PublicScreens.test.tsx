import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { MATRIX, createWorld, directionOf, renderScreen, waitFor } from '../../test/harness';
import { ProfileScreen } from '../ProfileScreen';
import {
  DeleteAccountScreen,
  PrivacyScreen,
  SupportScreen,
  TermsScreen,
  WelcomeScreen,
} from './PublicScreens';
import { deleteAccountPage, privacyPage, supportPage, termsPage } from './pages';

const en = messages.en as Record<string, string>;
const ur = messages.ur as Record<string, string>;

const pages = [
  { name: 'privacy', Screen: PrivacyScreen, spec: privacyPage, testID: 'public-privacy' },
  { name: 'terms', Screen: TermsScreen, spec: termsPage, testID: 'public-terms' },
  {
    name: 'deleteAccount',
    Screen: DeleteAccountScreen,
    spec: deleteAccountPage,
    testID: 'public-deleteAccount',
  },
  { name: 'support', Screen: SupportScreen, spec: supportPage, testID: 'public-support' },
] as const;

afterEach(() => vi.unstubAllEnvs());

describe('public pages', () => {
  it.each(pages)('$name has words in both languages for every section', ({ spec }) => {
    for (const section of spec.sections) {
      expect(en[section.heading], section.heading).toBeTruthy();
      expect(ur[section.heading], section.heading).toBeTruthy();
      for (const block of section.blocks) {
        const keys =
          block.kind === 'p'
            ? [block.key]
            : block.kind === 'list' || block.kind === 'steps'
              ? block.keys
              : block.kind === 'faq'
                ? block.items.flatMap((i) => [i.q, i.a])
                : [];
        for (const key of keys) {
          expect(en[key], key).toBeTruthy();
          expect(ur[key], key).toBeTruthy();
        }
      }
    }
  });

  it('keeps placeholders the same in English and Urdu', () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    const prefixes = ['legal.', 'store.', 'privacy.', 'deleteAccount.', 'support.', 'terms.'];
    for (const key of Object.keys(en).filter((k) => prefixes.some((p) => k.startsWith(p)))) {
      expect(holes(ur[key] ?? ''), key).toBe(holes(en[key]!));
    }
  });

  it('names the delete button the way the profile does, in both languages', () => {
    expect(en['deleteAccount.app.step3']).toContain(en['profile.account.delete']);
    expect(ur['deleteAccount.app.step3']).toContain(ur['profile.account.delete']);
    expect(en['deleteAccount.web.step3']).toContain(en['profile.account.delete']);
    expect(ur['deleteAccount.web.step3']).toContain(ur['profile.account.delete']);
    expect(ur['deleteAccount.app.step2']).toContain(ur['profile.title']);
  });

  it('says the Android app does not collect location, and that nothing is sold', () => {
    expect(en['privacy.not.location']).toMatch(/does not ask/);
    expect(en['privacy.not.ads']).toMatch(/never sell/);
  });

  describe('the contact address', () => {
    it('falls back to the owner’s address when none is configured', async () => {
      vi.stubEnv('EXPO_PUBLIC_CONTACT_EMAIL', '');
      const view = await renderScreen(<SupportScreen />);
      expect(view.getByTestId('contact-text').textContent).toContain(
        'support@qurancircles.doraquran.pk',
      );
      fireEvent.click(view.getByTestId('contact-mail'));
      await waitFor(() =>
        expect(view.world.opened).toEqual(['mailto:support@qurancircles.doraquran.pk']),
      );
    });

    it('shows a configured address instead', async () => {
      vi.stubEnv('EXPO_PUBLIC_CONTACT_EMAIL', 'help@example.test');
      const view = await renderScreen(<SupportScreen />);
      expect(view.getByTestId('contact-text').textContent).toContain('help@example.test');
      fireEvent.click(view.getByTestId('contact-mail'));
      await waitFor(() => expect(view.world.opened).toEqual(['mailto:help@example.test']));
    });
  });

  it('links on to the other pages and into the app', async () => {
    const view = await renderScreen(<PrivacyScreen />);
    expect(view.queryByTestId('link-privacy')).toBeNull();
    fireEvent.click(view.getByTestId('link-deleteAccount'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'deleteAccount' } });
    fireEvent.click(view.getByTestId('link-home'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'home' } });
  });

  it('is reached from Profile', async () => {
    const view = await renderScreen(<ProfileScreen />);
    fireEvent.click(view.getByTestId('profile-privacy'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'privacy' } });
    fireEvent.click(view.getByTestId('profile-terms'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'terms' } });
  });

  it('needs no account and asks the server for nothing about the person', async () => {
    const view = await renderScreen(<DeleteAccountScreen />);
    expect(view.getByTestId('public-deleteAccount')).toBeTruthy();
    expect(view.world.http.calls.filter((c) => !c.path.startsWith('/v1/config'))).toEqual([]);
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it.each(pages)('draws $name in the language and direction of the screen', async (page) => {
      const world = await createWorld({ locale, color, textSize });
      const view = await renderScreen(<page.Screen />, { world });
      const words = locale === 'ur' ? ur : en;
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      expect(view.getByTestId(page.testID)).toBeTruthy();
      expect(view.getByText(words[page.spec.intro]!)).toBeTruthy();
      for (const section of page.spec.sections) {
        expect(view.getByTestId(`section-${section.id}`)).toBeTruthy();
      }
    });
  });
});

describe('WelcomeScreen', () => {
  it('names the app and offers Google Play and the web app', async () => {
    const view = await renderScreen(<WelcomeScreen />);
    expect(view.getByText(en['store.tagline']!)).toBeTruthy();
    expect(view.getByTestId('store-features').textContent).toContain(
      en['store.feature.join.title'],
    );
    fireEvent.click(view.getByTestId('store-play'));
    await waitFor(() =>
      expect(view.world.opened).toEqual([
        'https://play.google.com/store/apps/details?id=pk.doraquran.circles',
      ]),
    );
    fireEvent.click(view.getByTestId('store-web'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'home' } });
  });

  it('describes joining as a pledge, not a booked seat', () => {
    expect(en['store.feature.join.body']).not.toMatch(/seat|reserve/i);
  });

  it.each(['en', 'ur'] as const)('lists the policy pages in %s', async (locale) => {
    const world = await createWorld({ locale });
    const view = await renderScreen(<WelcomeScreen />, { world });
    for (const id of ['privacy', 'terms', 'deleteAccount', 'support']) {
      expect(view.getByTestId(`link-${id}`)).toBeTruthy();
    }
  });
});
