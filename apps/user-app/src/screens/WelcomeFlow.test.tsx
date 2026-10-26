import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import {
  MATRIX,
  createWorld,
  directionOf,
  renderScreen,
  signInHandlers,
  waitFor,
} from '../test/harness';
import { AREA_SADDAR, CITY_RAWALPINDI } from '../test/factories';
import { FeaturesScreen } from './FeaturesScreen';
import { SignUpScreen } from './SignUpScreen';
import { WelcomeScreen } from './WelcomeScreen';

const en = messages.en;
const ur = messages.ur;

describe('WelcomeScreen', () => {
  it('offers every way in, and says browsing needs no account', async () => {
    const view = await renderScreen(<WelcomeScreen />);
    expect(view.getByText(en['app.name'])).toBeTruthy();
    expect(view.getByText(en['welcome.tagline'])).toBeTruthy();
    expect(view.getByText(en['welcome.browseNote'])).toBeTruthy();
    fireEvent.click(view.getByTestId('welcome-create'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'signUp' } });
    fireEvent.click(view.getByTestId('welcome-sign-in'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'signIn' } });
    fireEvent.click(view.getByTestId('welcome-features'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'features' } });
    fireEvent.click(view.getByTestId('welcome-browse'));
    expect(view.world.nav.last()).toEqual({ type: 'replace', route: { name: 'home' } });
  });

  it('is shown once: it remembers it was seen', async () => {
    const view = await renderScreen(<WelcomeScreen />);
    await waitFor(() => expect(view.world.services.preferences.get().welcomed).toBe(true));
  });

  it.each(MATRIX)('draws in $name, mirrored in Urdu', async ({ locale, color, textSize }) => {
    const view = await renderScreen(<WelcomeScreen />, { locale, color, textSize });
    expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    const words = locale === 'ur' ? ur : en;
    expect(view.getByText(words['welcome.create'])).toBeTruthy();
    expect(view.getByText(words['welcome.browse'])).toBeTruthy();
    expect(view.getByRole('heading', { level: 1 })).toBeTruthy();
  });
});

describe('FeaturesScreen', () => {
  it('lists the five things the app does and starts on Home', async () => {
    const view = await renderScreen(<FeaturesScreen />);
    for (const key of ['find', 'join', 'remind', 'quran', 'journey'] as const) {
      expect(view.getByText(en[`features.${key}.title`])).toBeTruthy();
      expect(view.getByText(en[`features.${key}.body`])).toBeTruthy();
    }
    fireEvent.click(view.getByTestId('features-start'));
    expect(view.world.nav.last()).toEqual({ type: 'replace', route: { name: 'home' } });
  });

  it('never says book, seat or ticket (joining is a pledge)', () => {
    for (const key of ['find', 'join', 'remind', 'quran', 'journey'] as const) {
      const text = `${en[`features.${key}.title`]} ${en[`features.${key}.body`]}`;
      expect(text).not.toMatch(/\b(book|booking|booked|seat|ticket)s?\b/i);
    }
  });
});

describe('SignUpScreen', () => {
  async function openWorld(locale: 'en' | 'ur' = 'en') {
    return createWorld({
      locale,
      cityId: CITY_RAWALPINDI.id,
      areaId: AREA_SADDAR.id,
      mock: { handlers: signInHandlers({ isNewAccount: true, displayName: null }) },
    });
  }

  it('asks for name, number, area and section, then checks the number before making the account', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignUpScreen returnTo="/nearby" />, { world });
    expect(view.getByText(en['signUp.title'])).toBeTruthy();
    fireEvent.change(view.getByTestId('name-input'), { target: { value: 'Ayesha Siddiqui' } });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'ayesha@example.com' } });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
    fireEvent.click(view.getByTestId('section-choice-women'));
    fireEvent.click(view.getByTestId('send-code'));
    const code = await view.findByTestId('code-input');
    expect(view.getByText(en['signUp.code.title'])).toBeTruthy();
    expect(view.getByText(/6-digit code to ayesha@example.com/)).toBeTruthy();
    fireEvent.change(code, { target: { value: '123456' } });
    fireEvent.click(view.getByTestId('verify-code'));
    await waitFor(() =>
      expect(world.nav.last()).toEqual({ type: 'replace', route: { name: 'nearby' } }),
    );
    expect(world.services.auth.getState().status).toBe('signedIn');
    expect(world.services.preferences.get().section).toBe('women');
    // The name asked for first is the one the account gets: no name step.
    expect(world.http.callsTo('PATCH /v1/me').length).toBeGreaterThan(0);
  });

  it('does not send a code until the name, area and section are filled in', async () => {
    const world = await createWorld({ mock: { handlers: signInHandlers() } });
    const view = await renderScreen(<SignUpScreen />, { world });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'ayesha@example.com' } });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['signIn.problem.name'])).toBeTruthy();
    fireEvent.change(view.getByTestId('name-input'), { target: { value: 'Ayesha' } });
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['signUp.problem.area'])).toBeTruthy();
    expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
  });

  it('does not send a code without a usable WhatsApp number', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignUpScreen />, { world });
    fireEvent.change(view.getByTestId('name-input'), { target: { value: 'Ayesha' } });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'ayesha@example.com' } });
    fireEvent.click(view.getByTestId('section-choice-women'));
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['signUp.problem.phone'])).toBeTruthy();
    expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
  });

  it('asks for the section after the area', async () => {
    const world = await openWorld();
    const view = await renderScreen(<SignUpScreen />, { world });
    fireEvent.change(view.getByTestId('name-input'), { target: { value: 'Ayesha' } });
    fireEvent.change(view.getByTestId('email-input'), { target: { value: 'ayesha@example.com' } });
    fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
    fireEvent.click(view.getByTestId('send-code'));
    expect(await view.findByText(en['signUp.problem.section'])).toBeTruthy();
  });

  it('keeps the phone left to right in Urdu', async () => {
    const view = await renderScreen(<SignUpScreen />, { world: await openWorld('ur') });
    expect(view.getByTestId('phone-input').getAttribute('dir')).toBe('ltr');
    expect(view.getByText(ur['signUp.title'])).toBeTruthy();
  });
});
