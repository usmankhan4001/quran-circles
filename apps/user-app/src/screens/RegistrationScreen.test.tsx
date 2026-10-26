import { fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messages } from '@qc/i18n';
import { AREA_SADDAR, CITY_RAWALPINDI, SESSIONS } from '../test/factories';
import {
  MATRIX,
  createWorld,
  directionOf,
  renderScreen,
  signInHandlers,
  waitFor,
} from '../test/harness';
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

describe('RegistrationScreen (the join pledge)', () => {
  it('shows the session and a sheet that says no seat is reserved, with consent unticked', async () => {
    const s = SESSIONS.taraweeh;
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    expect(await view.findByTestId('registration-form')).toBeTruthy();
    expect(view.getByTestId('registration-summary')).toBeTruthy();
    expect(view.getByText(en['join.noSeat'])).toBeTruthy();
    expect(view.getByText(en['join.remind'])).toBeTruthy();
    expect(view.getByTestId('registration-consent').getAttribute('aria-checked')).toBe('false');
    expect(view.queryByTestId('registration-party')).toBeNull();
    expect(view.getByTestId('registration-submit').textContent).toBe(en['registration.pledge']);
  });

  it('does not send the pledge until the area and section are known', async () => {
    const s = SESSIONS.taraweeh;
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    await view.findByTestId('registration-form');
    fireEvent.click(view.getByTestId('registration-submit'));
    expect(await view.findByTestId('registration-area-problem')).toBeTruthy();
    expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
  });

  it('records the pledge with a section and the reminder choice, then confirms', async () => {
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
    expect(view.getByText(en['join.done.title'])).toBeTruthy();
    expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({
      sessionId: s.id,
      areaId: AREA_SADDAR.id,
      section: 'family',
      allowWhatsapp: true,
    });
    fireEvent.click(view.getByTestId('view-journey'));
    expect(world.nav.last()).toEqual({ type: 'tab', route: { name: 'journey' } });
    fireEvent.click(view.getByTestId('join-done'));
    expect(world.nav.last()).toEqual({
      type: 'replace',
      route: { name: 'session', sessionId: s.id },
    });
  });

  it('fixes the section for a women-only session and says so', async () => {
    const s = SESSIONS.womenFull;
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
    await view.findByTestId('registration-form');
    expect(view.getByTestId('registration-section-fixed')).toBeTruthy();
    await chooseArea(view);
    fireEvent.click(view.getByTestId('registration-submit'));
    // The server still puts the person in line for a full session; we say so without seats.
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

  it('offers the journey when the person has already joined', async () => {
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

  it('closes with Not now', async () => {
    const world = await signedIn();
    const view = await renderScreen(<RegistrationScreen sessionId={SESSIONS.taraweeh.id} />, {
      world,
    });
    fireEvent.click(await view.findByTestId('registration-not-now'));
    expect(world.nav.last()).toEqual({ type: 'back' });
  });

  describe('a first-time visitor', () => {
    async function visitor(locale: 'en' | 'ur' = 'en') {
      return createWorld({
        locale,
        cityId: CITY_RAWALPINDI.id,
        areaId: AREA_SADDAR.id,
        mock: { handlers: signInHandlers({ isNewAccount: true, displayName: null }) },
      });
    }

    it('is not sent away: name, email, number and the code are all inside the sheet, once', async () => {
      const s = SESSIONS.taraweeh;
      const world = await visitor();
      const view = await renderScreen(<RegistrationScreen sessionId={s.id} />, { world });
      await view.findByTestId('registration-form');
      expect(world.nav.last()).toBeUndefined();
      fireEvent.change(view.getByTestId('registration-name'), { target: { value: 'Ayesha' } });
      fireEvent.change(view.getByTestId('email-input'), {
        target: { value: 'ayesha@example.com' },
      });
      fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
      fireEvent.click(view.getByTestId('registration-section-family'));
      fireEvent.click(view.getByTestId('registration-submit'));
      const code = await view.findByTestId('code-input');
      expect(view.getByText(en['join.code.title'])).toBeTruthy();
      expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
      fireEvent.change(code, { target: { value: '123456' } });
      fireEvent.click(view.getByTestId('verify-code'));
      expect(await view.findByTestId('registration-confirmation')).toBeTruthy();
      expect(world.services.auth.getState().status).toBe('signedIn');
      expect(world.http.callsTo('POST /v1/registrations')[0]!.body).toMatchObject({
        sessionId: s.id,
        section: 'family',
        name: 'Ayesha',
      });
      expect(world.nav.last()).toBeUndefined();
    });

    it('asks for the name, the number and the area before sending a code', async () => {
      const world = await visitor();
      const view = await renderScreen(<RegistrationScreen sessionId={SESSIONS.taraweeh.id} />, {
        world,
      });
      await view.findByTestId('registration-form');
      fireEvent.click(view.getByTestId('registration-submit'));
      expect(await view.findByText(en['registration.name.error'])).toBeTruthy();
      expect(world.http.callsTo('POST /v1/auth/code')).toHaveLength(0);
    });

    it('keeps the phone left to right in Urdu', async () => {
      const view = await renderScreen(<RegistrationScreen sessionId={SESSIONS.taraweeh.id} />, {
        world: await visitor('ur'),
      });
      await view.findByTestId('registration-form');
      expect(view.getByTestId('phone-input').getAttribute('dir')).toBe('ltr');
    });

    it('shows a wrong code in words and stays on the code step', async () => {
      const world = await visitor();
      const view = await renderScreen(<RegistrationScreen sessionId={SESSIONS.taraweeh.id} />, {
        world,
      });
      await view.findByTestId('registration-form');
      fireEvent.change(view.getByTestId('registration-name'), { target: { value: 'Ayesha' } });
      fireEvent.change(view.getByTestId('email-input'), {
        target: { value: 'ayesha@example.com' },
      });
      fireEvent.change(view.getByTestId('phone-input'), { target: { value: '0300 1234567' } });
      fireEvent.click(view.getByTestId('registration-section-family'));
      fireEvent.click(view.getByTestId('registration-submit'));
      fireEvent.change(await view.findByTestId('code-input'), { target: { value: '654321' } });
      fireEvent.click(view.getByTestId('verify-code'));
      await waitFor(() => expect(view.getByText(en['errors.otp_invalid'])).toBeTruthy());
      expect(world.http.callsTo('POST /v1/registrations')).toHaveLength(0);
    });
  });

  describe.each(MATRIX)('in $name', ({ locale, color, textSize }) => {
    it('draws the sheet', async () => {
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
      expect(view.getByLabelText(words['ui.back'])).toBeTruthy();
      expect(view.getByText(words['join.noSeat'])).toBeTruthy();
      expect(view.getByText(words['join.remind'])).toBeTruthy();
      expect(view.getByTestId('registration-submit').textContent).toBe(
        words['registration.pledge'],
      );
    });
  });
});
