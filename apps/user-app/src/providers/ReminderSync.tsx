import { useReminderSync } from '../features/reminders/hooks';

/** Renders nothing; keeps the on-device reminder schedule in step with the registrations. */
export function ReminderSync() {
  useReminderSync();
  return null;
}
