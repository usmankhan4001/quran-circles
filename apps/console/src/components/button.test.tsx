import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminSession } from '@qc/contracts';
import { sessions } from '@qc/contracts/fixtures';
import { renderConsole, text } from '../test/harness';
import { I18nProvider } from '../i18n';
import { Button } from './ui';

const inI18n = (node: ReactNode) => render(<I18nProvider initialLocale="en">{node}</I18nProvider>);

describe('Button when it cannot be pressed', () => {
  it('is disabled and says so to screen readers', () => {
    inI18n(<Button disabled>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('is disabled while busy, and marked busy', () => {
    inI18n(<Button busy>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('carries no disabled marks when it can be pressed', () => {
    inI18n(<Button>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.hasAttribute('aria-disabled')).toBe(false);
  });
});

describe('the disabled look in the stylesheet', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

  it('mutes every disabled button the same way, for both kinds of disabled', () => {
    const match = /\.btn:disabled,\s*\.btn\[aria-disabled='true'\]\s*\{([^}]*)\}/.exec(css);
    expect(match).not.toBeNull();
    const body = match?.[1] ?? '';
    expect(body).toMatch(/cursor:\s*not-allowed/);
    expect(body).toMatch(/background:\s*var\(--c-disabled-background\)/);
    expect(body).toMatch(/color:\s*var\(--c-disabled-text\)/);
    expect(body).toMatch(/opacity:\s*0\.\d+/);
  });

  it('has no page or variant rule that gives a disabled button its enabled look back', () => {
    const overrides = [...css.matchAll(/([^{}]*:disabled[^{}]*)\{([^}]*)\}/g)].filter(
      ([, selector, body]) =>
        /\.btn|inspector-save/.test(selector ?? '') &&
        !/^\s*\.btn:disabled,/.test(selector ?? '') &&
        /(opacity:\s*1\b|background:\s*var\(--c-cta\)|background:\s*var\(--c-sidebar)/.test(
          body ?? '',
        ),
    );
    expect(overrides.map(([, selector]) => selector?.trim())).toEqual([]);
  });
});

describe('the session save button on the sessions page', () => {
  it('is drawn and announced as disabled', async () => {
    const listed = sessions.map((s) => ({ ...s, circleStatus: null })) as AdminSession[];
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => ({ items: listed, nextCursor: null }) },
    });
    const save = await screen.findByRole('button', {
      name: text('console.sessions.inspector.save'),
    });
    expect(save.hasAttribute('disabled')).toBe(true);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(save.classList.contains('btn')).toBe(true);
    expect(save.getAttribute('title')).toBe(text('console.sessions.inspector.saveSoon'));
  });
});
