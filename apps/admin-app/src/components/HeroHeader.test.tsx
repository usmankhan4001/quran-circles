import { screen } from '@testing-library/react';
import { semanticColors } from '@qc/ui';
import { describe, expect, it } from 'vitest';
import { combos, renderScreen } from '../test/render';
import { HeroHeader } from './HeroHeader';

describe.each(combos)('HeroHeader in $name', (combo) => {
  it('is green from the hero token and writes on it in the on-hero colour', async () => {
    renderScreen(
      <HeroHeader title="Sample title" subtitle="Sample line" testID="hero" onBack={() => {}} />,
      {
        combo,
      },
    );
    const el = await screen.findByTestId('hero');
    expect(el.getAttribute('style') ?? '').toMatch(/background-color/);
    expect(screen.getByText('Sample title')).toBeTruthy();
    expect(screen.getByTestId('hero-back')).toBeTruthy();
  });
});

describe('HeroHeader tokens', () => {
  it('has a hero and an on-hero colour in every colour mode', () => {
    for (const mode of Object.values(semanticColors)) {
      expect(mode.hero).toBeTruthy();
      expect(mode.textOnHero).toBeTruthy();
    }
  });
});
