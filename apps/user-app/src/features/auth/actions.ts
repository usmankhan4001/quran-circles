import type { AppServices } from '../../providers/services';

/**
 * Leaves the device clean after the person signs out or deletes the account: tokens, saved
 * copies of anything, reminders, push and the signed-in state. The server call, if any, is
 * made first and is allowed to fail: on a flat battery or no signal the device is still
 * signed out here.
 */
export async function clearLocalAccountState(services: AppServices): Promise<void> {
  await services.push.disable(services.api).catch(() => undefined);
  await services.reminders.reset().catch(() => undefined);
  await services.auth.clear();
  await services.cache.clear();
}

export async function signOut(services: AppServices): Promise<void> {
  try {
    await services.api.auth.signOut();
  } catch {
    // The token may already be gone. Signing out here must not depend on the network.
  }
  await clearLocalAccountState(services);
}

/** Deletes the account and personal data on the server, then clears this device. */
export async function deleteAccount(services: AppServices): Promise<void> {
  await services.api.me.delete({ body: { confirm: true } });
  await clearLocalAccountState(services);
}
