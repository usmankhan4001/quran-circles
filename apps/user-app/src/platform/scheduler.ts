import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type {
  PermissionResult,
  ReminderScheduler,
  ScheduledReminder,
} from '../features/reminders/types';

/** On-device reminders through expo-notifications. Phones only. */
export class ExpoReminderScheduler implements ReminderScheduler {
  private channelReady = false;

  constructor(private readonly channelName: string) {}

  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  }

  async requestPermission(): Promise<PermissionResult> {
    if (!this.isSupported()) return 'unsupported';
    await this.ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'denied';
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted ? 'granted' : 'denied';
  }

  async replaceAll(reminders: readonly ScheduledReminder[]): Promise<void> {
    if (!this.isSupported()) return;
    await this.ensureChannel();
    // Only this app's own reminders are ever scheduled locally, so clearing all is safe.
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const reminder of reminders) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { sessionId: reminder.sessionId },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
          channelId: 'reminders',
        },
      });
    }
  }

  async cancelAll(): Promise<void> {
    if (!this.isSupported()) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  private async ensureChannel(): Promise<void> {
    if (this.channelReady || Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('reminders', {
      name: this.channelName,
      importance: Notifications.AndroidImportance.HIGH,
    });
    this.channelReady = true;
  }
}

/** The PWA cannot schedule local notifications; reminders there come from the server as push. */
export class UnsupportedReminderScheduler implements ReminderScheduler {
  isSupported(): boolean {
    return false;
  }
  async requestPermission(): Promise<PermissionResult> {
    return 'unsupported';
  }
  async replaceAll(): Promise<void> {}
  async cancelAll(): Promise<void> {}
}
