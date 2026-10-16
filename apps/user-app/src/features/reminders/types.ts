import type { DevicePlatform, Locale, PushProvider } from '@qc/contracts';

export interface ScheduledReminder {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  /** Opens this session when the notification is tapped. */
  sessionId: string;
}

export type PermissionResult = 'granted' | 'denied' | 'unsupported';

/** On-device reminders. Native only; the PWA has no scheduler and says so. */
export interface ReminderScheduler {
  isSupported(): boolean;
  requestPermission(): Promise<PermissionResult>;
  /** Cancels what this app scheduled before and schedules exactly these. */
  replaceAll(reminders: readonly ScheduledReminder[]): Promise<void>;
  cancelAll(): Promise<void>;
}

export interface PushRegistration {
  platform: DevicePlatform;
  provider: PushProvider;
  token: string;
}

/** Gets this device's push token: FCM or APNs on a phone, web push in the PWA. */
export interface PushRegistrar {
  isSupported(): boolean;
  register(locale: Locale): Promise<PushRegistration | 'denied' | 'unsupported'>;
}
