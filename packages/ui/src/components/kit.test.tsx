import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import {
  Avatar,
  Checkbox,
  EmptyState,
  ErrorState,
  Header,
  IconButton,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  TextField,
  Toast,
  initialsOf,
} from '../index';
import { semanticColors } from '../semantic-colors';
import { minTouchTarget } from '../tokens';
import { matrix, px, renderThemed, rgb } from '../test/utils';

const ui = (locale: 'en' | 'ur', key: string) =>
  (messages[locale] as Record<string, string>)[key] as string;

describe.each(matrix)('rest of the kit in $name', (combo) => {
  it('IconButton has a name and a 48 dp target', () => {
    const onPress = vi.fn();
    renderThemed(<IconButton icon="plus" accessibilityLabel="Add" onPress={onPress} />, combo);
    const b = screen.getByRole('button', { name: 'Add' });
    expect(px(getComputedStyle(b).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    expect(px(getComputedStyle(b).minWidth)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(b);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('TextField has a visible label, an input and an announced error', () => {
    const onChangeText = vi.fn();
    renderThemed(
      <TextField
        label="Full name"
        value=""
        onChangeText={onChangeText}
        required
        error="Enter your name"
      />,
      combo,
    );
    const input = screen.getByLabelText('Full name');
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Enter your name');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
    expect(screen.getByText(ui(combo.locale, 'ui.required'))).toBeTruthy();
    fireEvent.change(input, { target: { value: 'Amina' } });
    expect(onChangeText).toHaveBeenCalledWith('Amina');
    expect(px(getComputedStyle(input).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
  });

  it('Select opens a sheet of radio options and reports the choice', async () => {
    const onChange = vi.fn();
    renderThemed(
      <Select
        label="Section"
        value="women"
        onChange={onChange}
        options={[
          { value: 'women', label: 'Women' },
          { value: 'men', label: 'Men' },
        ]}
      />,
      combo,
    );
    const trigger = screen.getByRole('button', { name: 'Section, Women' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Section' });
    const radios = within(dialog).getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');
    expect(radios[1]?.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(radios[1] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('men');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Switch reports its state in words and toggles', () => {
    const onValueChange = vi.fn();
    renderThemed(<Switch label="Dark mode" value onValueChange={onValueChange} />, combo);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(ui(combo.locale, 'ui.on'))).toBeTruthy();
    expect(px(getComputedStyle(sw).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(sw);
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('Checkbox is a labelled checkbox with a 48 dp row and a tick when checked', () => {
    const onChange = vi.fn();
    renderThemed(<Checkbox label="Parking" checked onChange={onChange} />, combo);
    const box = screen.getByRole('checkbox', { name: 'Parking' });
    expect(box.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('icon-check')).toBeTruthy();
    expect(px(getComputedStyle(box).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('SegmentedControl is a radio group with one checked segment', () => {
    const onChange = vi.fn();
    renderThemed(
      <SegmentedControl
        accessibilityLabel="Section"
        value="men"
        onChange={onChange}
        options={[
          { value: 'women', label: 'Women' },
          { value: 'men', label: 'Men' },
          { value: 'family', label: 'Family' },
        ]}
      />,
      combo,
    );
    expect(screen.getByRole('radiogroup', { name: 'Section' })).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
    for (const r of radios)
      expect(px(getComputedStyle(r).minHeight)).toBeGreaterThanOrEqual(minTouchTarget);
    fireEvent.click(radios[2] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('family');
  });

  it('EmptyState, ErrorState, Skeleton, Toast, Avatar and Header render with roles', () => {
    renderThemed(
      <>
        <EmptyState
          title="Nothing yet"
          description="Register for a session."
          action={{ label: 'Find a session', onPress: () => undefined }}
        />
        <ErrorState onRetry={() => undefined} />
        <Skeleton lines={3} />
        <Toast message="Saved" kind="success" onDismiss={() => undefined} durationMs={0} />
        <Avatar name="Amina Khan" />
        <Header title="Nearby" onBack={() => undefined} />
      </>,
      combo,
    );
    expect(screen.getByRole('heading', { name: 'Nothing yet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find a session' })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(ui(combo.locale, 'ui.errorTitle'));
    expect(screen.getByRole('button', { name: ui(combo.locale, 'ui.retry') })).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: ui(combo.locale, 'ui.loading') })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Saved');
    expect(screen.getByRole('img', { name: 'Amina Khan' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Nearby', level: 1 })).toBeTruthy();
    expect(screen.getByRole('button', { name: ui(combo.locale, 'ui.back') })).toBeTruthy();
  });
});

describe('IconButton', () => {
  it('ignores presses while disabled or loading', () => {
    const onPress = vi.fn();
    const { unmount } = renderThemed(
      <IconButton icon="close" accessibilityLabel="Close" disabled onPress={onPress} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    unmount();
    renderThemed(<IconButton icon="close" accessibilityLabel="Close" loading onPress={onPress} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('shows helper text without announcing it as an alert', () => {
    renderThemed(
      <TextField
        label="WhatsApp number"
        value=""
        onChangeText={() => undefined}
        helper="We send a code here."
      />,
    );
    expect(screen.getByText('We send a code here.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('WhatsApp number').getAttribute('aria-invalid')).toBeNull();
  });

  it('marks optional fields as optional', () => {
    renderThemed(<TextField label="Profession" value="" onChangeText={() => undefined} />);
    expect(screen.getByText('Optional')).toBeTruthy();
  });

  it('is read only and does not take input while disabled or loading', () => {
    const onChangeText = vi.fn();
    const { unmount } = renderThemed(
      <TextField label="Name" value="" onChangeText={onChangeText} disabled />,
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).readOnly).toBe(true);
    unmount();
    renderThemed(<TextField label="Name" value="" onChangeText={onChangeText} loading />);
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('aria-busy')).toBe('true');
  });

  it('draws the error border in the danger colour', () => {
    renderThemed(
      <TextField label="Name" value="" onChangeText={() => undefined} error="Required" />,
      { mode: 'dark' },
    );
    expect(screen.getByLabelText('Name').style.borderTopColor).toBe(
      rgb(semanticColors.dark.danger),
    );
  });

  it('keeps a phone number left to right but aligned to the start on an Urdu screen', () => {
    renderThemed(
      <TextField
        label="Number"
        value="0300"
        onChangeText={() => undefined}
        contentDirection="ltr"
        keyboardType="phone-pad"
      />,
      { locale: 'ur' },
    );
    const input = screen.getByLabelText('Number');
    expect(input.getAttribute('dir')).toBe('ltr');
  });

  it('supports several lines', () => {
    renderThemed(<TextField label="Update" value="" onChangeText={() => undefined} multiline />);
    expect(screen.getByLabelText('Update').tagName).toBe('TEXTAREA');
  });
});

describe('Select', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo', disabled: true },
  ] as const;

  it('shows the placeholder, then the kit default, when nothing is chosen', () => {
    const { unmount } = renderThemed(
      <Select
        label="Area"
        options={options}
        value={undefined}
        onChange={() => undefined}
        placeholder="Pick an area"
      />,
    );
    expect(screen.getByRole('button', { name: 'Area, Pick an area' })).toBeTruthy();
    unmount();
    renderThemed(
      <Select label="Area" options={options} value={undefined} onChange={() => undefined} />,
    );
    expect(screen.getByRole('button', { name: 'Area, Choose one' })).toBeTruthy();
  });

  it('does not open while disabled', () => {
    renderThemed(
      <Select label="Area" options={options} value="a" onChange={() => undefined} disabled />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not choose a disabled option', () => {
    const onChange = vi.fn();
    renderThemed(<Select label="Area" options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('radio', { name: 'Bravo' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an error as an alert', () => {
    renderThemed(
      <Select
        label="Area"
        options={options}
        value={undefined}
        onChange={() => undefined}
        error="Choose your area"
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Choose your area');
  });

  it('closes without choosing from the close button', async () => {
    const onChange = vi.fn();
    renderThemed(<Select label="Area" options={options} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Switch', () => {
  it('shows Off and toggles on', () => {
    const onValueChange = vi.fn();
    renderThemed(
      <Switch label="Alerts" description="Per venue" value={false} onValueChange={onValueChange} />,
    );
    expect(screen.getByText('Off')).toBeTruthy();
    const sw = screen.getByRole('switch', { name: 'Alerts. Per venue' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('puts the thumb at the end when on, whatever the direction', () => {
    const { unmount } = renderThemed(
      <Switch label="A" value testID="s" onValueChange={() => undefined} />,
      { locale: 'ur' },
    );
    expect(screen.getByTestId('s-track').style.justifyContent).toBe('flex-end');
    unmount();
    renderThemed(<Switch label="A" value={false} testID="s" onValueChange={() => undefined} />, {
      locale: 'en',
    });
    expect(screen.getByTestId('s-track').style.justifyContent).toBe('flex-start');
  });

  it('ignores presses while disabled', () => {
    const onValueChange = vi.fn();
    renderThemed(<Switch label="A" value={false} disabled onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('switch').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('Checkbox', () => {
  it('shows no tick when unchecked and checks on press', () => {
    const onChange = vi.fn();
    renderThemed(
      <Checkbox
        label="Wudu area"
        description="Near the entrance"
        checked={false}
        onChange={onChange}
      />,
    );
    const box = screen.getByRole('checkbox', { name: 'Wudu area. Near the entrance' });
    expect(box.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByTestId('icon-check')).toBeNull();
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('ignores presses while disabled', () => {
    const onChange = vi.fn();
    renderThemed(<Checkbox label="Parking" checked={false} disabled onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox').getAttribute('aria-disabled')).toBe('true');
  });
});

describe('SegmentedControl', () => {
  it('ignores disabled segments and a disabled group', () => {
    const onChange = vi.fn();
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ] as const;
    const { unmount } = renderThemed(
      <SegmentedControl
        accessibilityLabel="Pick"
        value="a"
        onChange={onChange}
        options={options}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).not.toHaveBeenCalled();
    unmount();
    renderThemed(
      <SegmentedControl
        accessibilityLabel="Pick"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'c', label: 'C' },
        ]}
        disabled
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'C' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('EmptyState and ErrorState', () => {
  it('EmptyState runs its actions', () => {
    const a = vi.fn();
    const b = vi.fn();
    renderThemed(
      <EmptyState
        title="No sessions"
        action={{ label: 'Browse', onPress: a }}
        secondaryAction={{ label: 'Request a circle', onPress: b }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request a circle' }));
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('EmptyState without actions shows no buttons', () => {
    renderThemed(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('ErrorState offline uses calm wording and retries', () => {
    const onRetry = vi.fn();
    renderThemed(<ErrorState kind="offline" onRetry={onRetry} />);
    expect(screen.getByText('You are offline')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState shows a busy retry button while retrying and accepts custom text', () => {
    const onRetry = vi.fn();
    renderThemed(
      <ErrorState
        title="No venues"
        description="Try later"
        retrying
        onRetry={onRetry}
        retryLabel="Reload"
      />,
    );
    const b = screen.getByRole('button', { name: 'Reload' });
    expect(b.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(b);
    expect(onRetry).not.toHaveBeenCalled();
    expect(screen.getByText('No venues')).toBeTruthy();
  });

  it('ErrorState without onRetry has no button', () => {
    renderThemed(<ErrorState />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Skeleton', () => {
  it('draws the right number of lines and hides repeated placeholders', () => {
    const { container } = renderThemed(
      <>
        <Skeleton lines={3} testID="a" />
        <Skeleton shape="circle" announce={false} testID="b" />
        <Skeleton shape="block" announce={false} testID="c" />
      </>,
    );
    expect(screen.getByTestId('a').children).toHaveLength(3);
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    expect(screen.getByTestId('b').getAttribute('aria-hidden')).toBe('true');
    expect(container).toBeTruthy();
  });

  it('draws at least one line for zero lines', () => {
    renderThemed(<Skeleton lines={0} testID="a" />);
    expect(screen.getByTestId('a').children).toHaveLength(1);
  });
});

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('dismisses itself after its time', () => {
    const onDismiss = vi.fn();
    renderThemed(<Toast message="Saved" onDismiss={onDismiss} durationMs={3000} />);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('stays while it has an action', () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();
    renderThemed(
      <Toast message="Removed" actionLabel="Undo" onAction={onAction} onDismiss={onDismiss} />,
    );
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('stays when the duration is 0', () => {
    const onDismiss = vi.fn();
    renderThemed(<Toast message="Offline" onDismiss={onDismiss} durationMs={0} />);
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('announces errors as alerts and dismisses on request', () => {
    const onDismiss = vi.fn();
    renderThemed(
      <Toast kind="danger" message="Could not save" onDismiss={onDismiss} durationMs={0} />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Could not save');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('clears its timer when it unmounts', () => {
    const onDismiss = vi.fn();
    const { unmount } = renderThemed(
      <Toast message="Saved" onDismiss={onDismiss} durationMs={1000} />,
    );
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('uses a different icon per kind so colour is not the only cue', () => {
    const names = ['info', 'success', 'warning', 'danger'] as const;
    const seen = new Set<string>();
    for (const kind of names) {
      const { unmount } = renderThemed(<Toast kind={kind} message="m" />);
      const icon = document.querySelector('[data-testid^="icon-"]');
      seen.add(icon?.getAttribute('data-testid') ?? '');
      unmount();
    }
    expect(seen.size).toBe(4);
  });
});

describe('Avatar', () => {
  it('takes initials from the first two words, including Urdu names', () => {
    expect(initialsOf('Amina Bibi Khan')).toBe('AB');
    expect(initialsOf('  zayd ')).toBe('Z');
    expect(initialsOf('عائشہ صدیقہ')).toBe('عص');
    expect(initialsOf('')).toBe('');
  });

  it('shows the initials when there is no picture', () => {
    renderThemed(<Avatar name="Amina Khan" />);
    expect(screen.getByText('AK')).toBeTruthy();
  });

  it('falls back to the initials when the picture fails to load', async () => {
    class FailingImage {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
      decode() {
        return Promise.reject(new Error('decode failed'));
      }
    }
    vi.stubGlobal('Image', FailingImage);
    try {
      renderThemed(<Avatar name="Amina Khan" imageUri="https://example.invalid/a.png" />);
      await waitFor(() => expect(screen.getByText('AK')).toBeTruthy());
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('is the same tint for the same name and sized by the size prop', () => {
    const { unmount } = renderThemed(<Avatar name="Same Name" size="lg" testID="a" />);
    const first = screen.getByTestId('a').style.backgroundColor;
    expect(px(screen.getByTestId('a').style.width)).toBe(72);
    unmount();
    renderThemed(<Avatar name="Same Name" size="sm" testID="a" />);
    expect(screen.getByTestId('a').style.backgroundColor).toBe(first);
    expect(px(screen.getByTestId('a').style.width)).toBe(32);
  });
});

describe('Header', () => {
  it('has no back button without onBack and shows actions and a subtitle', () => {
    renderThemed(
      <Header
        title="Venue"
        subtitle="Lahore"
        actions={<IconButton icon="plus" accessibilityLabel="Add" />}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(screen.getByText('Lahore')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
  });

  it('goes back and mirrors the arrow on an Urdu screen only', () => {
    const onBack = vi.fn();
    const { unmount } = renderThemed(<Header title="T" onBack={onBack} />, { locale: 'ur' });
    expect(screen.getByTestId('icon-chevron-back').style.transform).toContain('scaleX(-1)');
    fireEvent.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledTimes(1);
    unmount();
    renderThemed(<Header title="T" onBack={onBack} />, { locale: 'en' });
    expect(screen.getByTestId('icon-chevron-back').style.transform).toBe('');
  });

  it('accepts a custom back label and a large title', () => {
    renderThemed(
      <Header title="My Journey" variant="large" onBack={() => undefined} backLabel="Go back" />,
    );
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'My Journey' })).toBeTruthy();
  });
});
