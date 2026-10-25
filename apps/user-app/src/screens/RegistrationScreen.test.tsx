import { fireEvent, within } from '@testing-library/react';
import { fixtures } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { AREA_SADDAR, CITY_RAWALPINDI, SESSIONS } from '../test/factories';
import { MATRIX, createWorld, directionOf, renderScreen, waitFor } from '../test/harness';
import { RegistrationScreen } from './RegistrationScreen';

const en = messages.en;
const ur = messages.ur;

async function signedIn() {
  return createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
}

async function chooseArea(view: Awaited<ReturnType<typeof renderScreen>>) {
  fireEvent.click(await view.findByTestId('registration-area'));
  fireEvent.click(await view.findByTestId(`area-option-${AREA_SADDAR.id}`));
}

describe('RegistrationScreen', () => {
  it('sends a signed-out person to sign in and brings them back here', async () => {
    const s = SESSIONS.taraweeh;
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} occurrenceId="o1" />);
    await waitFor(() => expect(view.world.nav.last()).toBeDefined());
    expect(view.world.nav.last()).toEqual({
      type: 'replace',
      route: {
        name: 'signIn',
        returnTo: { name: 'register', sessionId: s.id, occurrenceId: 'o1' },
      },
    });
  });

  it('shows the form with consent unticked, and asks for the area and section before sending', async () => {
    const s = SESSIONS.taraweeh;
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    expect(await view.findByTestId('registration-form')).toBeTruthy();
    expect(view.getByText(en['registration.intro'])).toBeTruthy();
    expect(view.getByTestId('registration-consent').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(view.getByTestId('registration-submit'));
    expect(await view.findByTestId('registration-area-problem')).toBeTruthy();
    expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
  });

  it('registers and shows the confirmation with the reminder choice', async () => {
    const s = SESSIONS.taraweeh;
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    await view.findByTestId('registration-form');
    await chooseArea(view);
    fireEvent.click(view.getByTestId('registration-section-family'));
    fireEvent.click(view.getByTestId('registration-consent'));
    expect(view.getByTestId('registration-consent').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(view.getByTestId('registration-submit'));
    expect(await view.findByTestId('registration-confirmation')).toBeTruthy();
    expect(view.getByText(en['registration.success.title'])).toBeTruthy();
    expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({
      sessionId: s.id,
      areaId: AREA_SADDAR.id,
      section: 'family',
      allowWhatsapp: true,
    });
    fireEvent.click(view.getByTestId('view-journey'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
  });

  it('asks nothing about seats, even for a session with an old seat limit', async () => {
    const s = SESSIONS.womenFull;
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    await view.findByTestId('registration-form');
    expect(view.getByText(en['registration.intro'])).toBeTruthy();
    expect(view.queryByTestId('registration-party')).toBeNull();
    expect(view.getByTestId('registration-section-fixed')).toBeTruthy();
    await chooseArea(view);
    expect(view.getByTestId('registration-submit').textContent).toBe(en['registration.pledge']);
    fireEvent.click(view.getByTestId('registration-submit'));
    // The server still puts the person in line for a limited session; we say so without seats.
    expect(await view.findByText(en['registration.waitlist.title'])).toBeTruthy();
    expect(view.queryByTestId('waitlist-position')).toBeNull();
  });

  it.each([['already_registered'], ['session_full'], ['registration_closed']] as const)(
    'shows the message for %s and lets the person carry on',
    async (code) => {
      const s = SESSIONS.taraweeh;
      const world = await signedIn();
      world.http.failNext('POST /v1/registrations', code);
      const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
      await view.findByTestId('registration-form');
      await chooseArea(view);
      fireEvent.click(view.getByTestId('registration-section-family'));
      fireEvent.click(view.getByTestId('registration-submit'));
      const error = await view.findByTestId('registration-error');
      expect(error.textContent).toContain(en[`errors.${code}` as keyof typeof en]);
      expect(view.queryByTestId('registration-confirmation')).toBeNull();
    },
  );

  it('shows the confirmation of an existing registration through the journey link when already registered', async () => {
    const s = SESSIONS.taraweeh;
    const world = await signedIn();
    world.http.failNext('POST /v1/registrations', 'already_registered');
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    await view.findByTestId('registration-form');
    await chooseArea(view);
    fireEvent.click(view.getByTestId('registration-section-family'));
    fireEvent.click(view.getByTestId('registration-submit'));
    const error = await view.findByTestId('registration-error');
    const button = Array.from(error.querySelectorAll('[role="button"]')).find(
      (el) => el.textContent === en['registration.success.journey'],
    );
    expect(button).toBeDefined();
    fireEvent.click(button!);
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
  });

  it('asks a new account for a name', async () => {
    const s = SESSIONS.taraweeh;
    const world = await createWorld({
      signedIn: true,
      cityId: CITY_RAWALPINDI.id,
      mock: { handlers: { 'me.get': () => ({ ...fixtures.me, displayName: null }) } },
    });
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    expect(await view.findByTestId('registration-name')).toBeTruthy();
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the form', async () => {
      const world = await createWorld({
        signedIn: true,
        cityId: CITY_RAWALPINDI.id,
        locale,
        color,
        textSize,
      });
      const view = await renderScreen(<RegistrationScreen sessionId={SESSIONS.taraweeh.id} />, {
        world,
      });
      await view.findByTestId('registration-form');
      expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
      const words = locale === 'ur' ? ur : en;
      // A plain white top with back and the title in the middle (D17), not the green header.
      const header = view.getByTestId('screen-header');
      expect(within(header).getByText(words['registration.topTitle'])).toBeTruthy();
      expect(within(header).getByLabelText(words['ui.back'])).toBeTruthy();
      expect(view.getByText(words['registration.heading'])).toBeTruthy();
      expect(view.getByText(words['registration.consent.whatsapp'])).toBeTruthy();
      expect(view.getByTestId('registration-submit').textContent).toBe(
        words['registration.pledge'],
      );
    });
  });
});
