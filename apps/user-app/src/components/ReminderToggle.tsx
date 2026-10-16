import { Switch } from '@qc/ui';
import type { Registration } from '@qc/contracts';
import { useReminderToggle } from '../features/reminders/hooks';
import { useI18n } from '../i18n/I18nProvider';

/** The per-session reminder switch: an on-device reminder before each session. Opt-in. */
export function ReminderToggle({
  sessionId,
  registration,
  testID,
}: {
  sessionId: string;
  registration?: Registration;
  testID?: string;
}) {
  const { t } = useI18n();
  const { enabled, supported, toggle } = useReminderToggle(sessionId);
  return (
    <Switch
      label={t('reminders.toggle.label')}
      description={supported ? t('reminders.toggle.description') : t('reminders.unsupported')}
      value={enabled}
      disabled={!supported}
      onValueChange={(next) => void toggle(next, registration)}
      testID={testID ?? `reminder-${sessionId}`}
    />
  );
}
