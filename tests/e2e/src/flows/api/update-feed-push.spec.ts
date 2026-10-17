import { expect, test } from '@playwright/test';
import { outboxFor } from '../../support/db';
import {
  addWebPushDevice,
  bootstrapNationalAdmin,
  inviteVenueCoordinator,
  signIn,
} from '../../support/people';
import { SEED } from '../../support/seed';
import { eventually } from '../../support/wait';

/** Gate 3: "post an update, then feed and push". */
test.describe('coordinator posts an update', () => {
  test('it appears in a follower’s feed and the worker sends them a push', async () => {
    const admin = await bootstrapNationalAdmin();
    const coordinator = await inviteVenueCoordinator(admin, SEED.venueNoor);

    const follower = await signIn();
    await addWebPushDevice(follower);
    await follower.api.follows.create({
      body: { target: 'venue', venueId: SEED.venueNoor, alertsEnabled: true },
    });
    // Someone following a different venue must not get it.
    const outsider = await signIn();
    await addWebPushDevice(outsider);
    await outsider.api.follows.create({
      body: { target: 'venue', venueId: SEED.venueHira, alertsEnabled: true },
    });

    const preview = await coordinator.api.adminUpdates.preview({
      body: {
        scope: { type: 'venue', venueId: SEED.venueNoor },
        title: { en: 'E2E update' },
        body: { en: 'Synthetic announcement for the end-to-end test.' },
      },
    });
    expect(preview.recipients).toBeGreaterThanOrEqual(1);

    const posted = await coordinator.api.adminUpdates.post({
      body: {
        scope: { type: 'venue', venueId: SEED.venueNoor },
        kind: 'announcement',
        title: { en: 'E2E update' },
        body: { en: 'Synthetic announcement for the end-to-end test.' },
        notify: true,
      },
    });
    expect(posted.recipients).toBeGreaterThanOrEqual(1);

    const feed = await follower.api.updates.feed({ query: {} });
    const item = feed.items.find((u) => u.id === posted.id);
    expect(item, 'the update is in the follower’s feed').toBeDefined();
    expect(item?.isRead).toBe(false);
    expect(feed.unreadCount).toBeGreaterThanOrEqual(1);

    await follower.api.updates.markRead({ body: { updateIds: [posted.id] } });
    const after = await follower.api.updates.feed({ query: {} });
    expect(after.items.find((u) => u.id === posted.id)?.isRead).toBe(true);

    const outsiderFeed = await outsider.api.updates.feed({ query: {} });
    expect(outsiderFeed.items.map((u) => u.id)).not.toContain(posted.id);

    const push = await eventually('the update push to be sent', async () => {
      const row = (await outboxFor(follower.me.id)).find((r) => r.update_id === posted.id);
      if (row && ['failed', 'dead'].includes(row.status)) {
        throw new Error(`update push ${row.status}: ${row.last_error_code ?? 'no code'}`);
      }
      return row && ['sent', 'delivered'].includes(row.status) ? row : null;
    });
    expect(push.channel).toBe('push');
    expect(push.provider_message_id).toMatch(/^fake-push-/);

    const outsiderRows = await outboxFor(outsider.me.id);
    expect(outsiderRows.filter((r) => r.update_id === posted.id)).toEqual([]);

    const list = await coordinator.api.adminUpdates.list({ query: {} });
    expect(list.items.map((u) => u.id)).toContain(posted.id);
  });
});
