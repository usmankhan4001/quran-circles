import { useMemo, useState, type FormEvent } from 'react';
import {
  AssignRoleBody,
  InviteBody,
  PersonName,
  roleAssignAction,
  type Invite,
  type InviteStatus,
  type Role,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { fetchAllPages, usePaged, useAsync } from '../api/hooks';
import type { StaffRoleAssignment } from '../api/types';
import { roleLabelKey } from '../components/Shell';
import { useScopeLabel } from '../components/scope';
import {
  Badge,
  Banner,
  Button,
  CheckboxField,
  DataTable,
  EmptyState,
  ErrorState,
  LoadMore,
  Loading,
  Modal,
  PageHeader,
  Phone,
  Section,
  SelectField,
  TextField,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import { errorMessageKeyOf } from '../lib/errors';
import { PHONE_ISSUE_KEYS, formatPhone, normalizePhone, phoneTail } from '../lib/phone';
import { canAssignRole, canSomewhere } from '../lib/permissions';

const ROLES: readonly Role[] = ['national_admin', 'city_coordinator', 'venue_coordinator'];

export const INVITE_STATUS_KEYS = {
  pending: 'console.invites.status.pending',
  accepted: 'console.invites.status.accepted',
  revoked: 'console.invites.status.revoked',
  expired: 'console.invites.status.expired',
} as const satisfies Record<InviteStatus, MessageKey>;

const INVITE_TONE: Record<InviteStatus, BadgeTone> = {
  pending: 'accent',
  accepted: 'success',
  revoked: 'neutral',
  expired: 'warning',
};

type Notice = { tone: 'success'; key: MessageKey } | null;

/** Coordinator invites, the people who hold roles now, and handing a venue or city over. */
export default function CoordinatorsPage() {
  const { t, tx, dateTime } = useI18n();
  const { api, principal } = useSignedIn();
  const scopeLabel = useScopeLabel();
  const [notice, setNotice] = useState<Notice>(null);
  const [showPastInvites, setShowPastInvites] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [revokingInvite, setRevokingInvite] = useState<Invite | null>(null);
  const [handingOver, setHandingOver] = useState<StaffRoleAssignment | null>(null);
  const [removing, setRemoving] = useState<StaffRoleAssignment | null>(null);
  const dir = useDirectory();

  const invites = useAsync(() => api.adminRoles.invites(), [api]);
  const people = usePaged(
    (cursor) =>
      api.adminRoles.list({
        query: { limit: 50, cursor, includeRevoked: showPast ? 'true' : 'false' },
      }),
    [api, showPast],
  );

  const canInviteAny = ROLES.some((r) => canSomewhere(principal, roleAssignAction(r)));

  // A venue invite does not carry its city, so the venue list supplies it for the scope check.
  const inviteScope = (i: Invite) => ({
    cityId: i.cityId ?? dir.venueById(i.venueId)?.cityId ?? null,
    venueId: i.venueId,
  });

  const done = (key: MessageKey) => {
    setNotice({ tone: 'success', key });
    invites.reload();
    people.reload();
  };

  const inviteColumns: Column<Invite>[] = [
    {
      id: 'person',
      header: t('console.invites.col.person'),
      rowHeader: true,
      cell: (i) => i.displayName ?? t('console.invites.unnamed'),
    },
    {
      id: 'phone',
      header: t('console.invites.col.phone'),
      cell: (i) => <Phone value={i.phone} masked />,
    },
    { id: 'role', header: t('console.invites.col.role'), cell: (i) => t(roleLabelKey(i.role)) },
    { id: 'scope', header: t('console.invites.col.scope'), cell: (i) => scopeLabel(i) },
    { id: 'expires', header: t('console.invites.col.expires'), cell: (i) => dateTime(i.expiresAt) },
    {
      id: 'status',
      header: t('console.invites.col.status'),
      cell: (i) => <Badge tone={INVITE_TONE[i.status]}>{t(INVITE_STATUS_KEYS[i.status])}</Badge>,
    },
    {
      id: 'actions',
      header: t('console.invites.col.actions'),
      cell: (i) =>
        i.status === 'pending' && canAssignRole(principal, i.role, inviteScope(i)) ? (
          <Button
            className="btn-small"
            aria-label={`${t('console.invites.revoke')} ${t('console.invites.revoke.for', { digits: phoneTail(i.phone) })}`}
            onClick={() => setRevokingInvite(i)}
          >
            {t('console.invites.revoke')}
          </Button>
        ) : null,
    },
  ];

  const personColumns: Column<StaffRoleAssignment>[] = [
    {
      id: 'person',
      header: t('console.invites.col.person'),
      rowHeader: true,
      cell: (a) => a.userName ?? t('console.invites.unnamed'),
    },
    { id: 'phone', header: t('console.invites.col.phone'), cell: (a) => <Phone value={a.phone} /> },
    { id: 'role', header: t('console.invites.col.role'), cell: (a) => t(roleLabelKey(a.role)) },
    { id: 'scope', header: t('console.invites.col.scope'), cell: (a) => scopeLabel(a) },
    { id: 'since', header: t('console.invites.col.since'), cell: (a) => dateTime(a.createdAt) },
    {
      id: 'status',
      header: t('console.invites.col.status'),
      cell: (a) =>
        a.revokedAt ? (
          <Badge>{t('console.invites.status.ended', { date: dateTime(a.revokedAt) })}</Badge>
        ) : (
          <Badge tone="success">{t('console.invites.status.active')}</Badge>
        ),
    },
    {
      id: 'actions',
      header: t('console.invites.col.actions'),
      cell: (a) => {
        if (a.revokedAt) return null;
        const scope = { cityId: a.cityId, venueId: a.venueId };
        if (!canAssignRole(principal, a.role, scope)) return null;
        return (
          <div className="row-actions">
            {a.role !== 'national_admin' ? (
              <Button className="btn-small" onClick={() => setHandingOver(a)}>
                {t('console.invites.handover')}
              </Button>
            ) : null}
            <Button className="btn-small" onClick={() => setRemoving(a)}>
              {t('console.invites.remove')}
            </Button>
          </div>
        );
      },
    },
  ];

  const visibleInvites =
    invites.status === 'ready'
      ? invites.data.items.filter((i) => showPastInvites || i.status === 'pending')
      : [];

  return (
    <div className="page">
      <PageHeader
        title={t('console.nav.coordinators')}
        intro={t('console.invites.intro')}
        actions={
          canInviteAny ? (
            <Button variant="primary" onClick={() => setInviting(true)}>
              {t('console.invites.new')}
            </Button>
          ) : null
        }
      />
      {notice ? (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {t(notice.key)}
        </Banner>
      ) : null}

      <Section
        title={t('console.invites.list.title')}
        actions={
          <CheckboxField
            label={t('console.invites.showPastInvites')}
            checked={showPastInvites}
            onChange={(e) => setShowPastInvites(e.target.checked)}
          />
        }
      >
        {invites.status === 'loading' ? <Loading /> : null}
        {invites.status === 'error' ? (
          <ErrorState error={invites.error} onRetry={invites.reload} />
        ) : null}
        {invites.status === 'ready' && visibleInvites.length === 0 ? (
          <EmptyState title={t('console.invites.empty')} />
        ) : null}
        {invites.status === 'ready' && visibleInvites.length > 0 ? (
          <DataTable
            caption={t('console.invites.list.title')}
            columns={inviteColumns}
            rows={visibleInvites}
            rowKey={(i) => i.id}
          />
        ) : null}
      </Section>

      <Section
        title={t('console.invites.active.title')}
        actions={
          <CheckboxField
            label={t('console.invites.showPast')}
            checked={showPast}
            onChange={(e) => setShowPast(e.target.checked)}
          />
        }
      >
        {people.status === 'loading' ? <Loading /> : null}
        {people.status === 'error' ? (
          <ErrorState error={people.error} onRetry={people.reload} />
        ) : null}
        {people.status === 'ready' && people.items.length === 0 ? (
          <EmptyState
            title={t('console.invites.active.empty.title')}
            body={t('console.invites.active.empty.body')}
          />
        ) : null}
        {people.status === 'ready' && people.items.length > 0 ? (
          <>
            <DataTable
              caption={t('console.invites.active.title')}
              columns={personColumns}
              rows={people.items}
              rowKey={(a) => a.id}
            />
            <LoadMore
              hasMore={people.hasMore}
              loading={people.loadingMore}
              onLoadMore={people.loadMore}
              error={people.moreError}
            />
          </>
        ) : null}
      </Section>

      {inviting ? (
        <InviteDialog
          onClose={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            done('console.invites.sent');
          }}
        />
      ) : null}
      {revokingInvite ? (
        <ConfirmDialog
          title={t('console.invites.revoke.title')}
          body={t('console.invites.revoke.body', {
            name: revokingInvite.displayName ?? t('console.invites.unnamed'),
            role: tx(roleLabelKey(revokingInvite.role)),
          })}
          confirmLabel={t('console.invites.revoke.confirm')}
          onClose={() => setRevokingInvite(null)}
          onConfirm={async () => {
            await api.adminRoles.revokeInvite({ params: { inviteId: revokingInvite.id } });
            setRevokingInvite(null);
            done('console.invites.revoked');
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={t('console.invites.remove.title')}
          body={t('console.invites.remove.body', {
            name: removing.userName ?? t('console.invites.unnamed'),
            scope: scopeLabel(removing),
          })}
          confirmLabel={t('console.invites.remove.confirm')}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await api.adminRoles.revoke({ params: { assignmentId: removing.id } });
            setRemoving(null);
            done('console.invites.removed');
          }}
        />
      ) : null}
      {handingOver ? (
        <HandoverDialog
          assignment={handingOver}
          onClose={() => setHandingOver(null)}
          onDone={() => {
            setHandingOver(null);
            done('console.invites.handedOver');
          }}
        />
      ) : null}
    </div>
  );
}

/* A confirmation that runs an action and shows why it failed, in the dialog -------------------- */

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onClose,
  onConfirm,
  danger = true,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  danger?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('console.shell.keep')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={() => void run()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
      {error ? <Banner tone="danger">{t(errorMessageKeyOf(error))}</Banner> : null}
    </Modal>
  );
}

/* Invite ------------------------------------------------------------------------------------- */

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { t, tx } = useI18n();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();

  const roles = ROLES.filter((r) => {
    if (r === 'national_admin') return canAssignRole(principal, r);
    if (r === 'city_coordinator')
      return dir.cities.some((c) => canAssignRole(principal, r, { cityId: c.id }));
    return dir.venues.some((v) => canAssignRole(principal, r, { cityId: v.cityId, venueId: v.id }));
  });
  const [role, setRole] = useState<Role | ''>(roles.length === 1 ? (roles[0] as Role) : '');
  const [cityId, setCityId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const cityOptions = dir.cities
    .filter((c) => canAssignRole(principal, 'city_coordinator', { cityId: c.id }))
    .map((c) => ({ value: c.id, label: dir.cityName(c.id) }));
  const venueOptions = dir.venues
    .filter((v) =>
      canAssignRole(principal, 'venue_coordinator', { cityId: v.cityId, venueId: v.id }),
    )
    .map((v) => ({
      value: v.id,
      label: t('console.invites.form.venueOption', {
        venue: dir.venueName(v.id),
        city: dir.cityName(v.cityId),
      }),
    }));

  const preview = phone.trim() ? normalizePhone(phone, { mobileOnly: true }) : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!role) next.role = t('console.invites.form.role.required');
    if (role === 'city_coordinator' && !cityId)
      next.scope = t('console.invites.form.scope.required');
    if (role === 'venue_coordinator' && !venueId)
      next.scope = t('console.invites.form.scope.required');
    const phoneResult = normalizePhone(phone, { mobileOnly: true });
    if (!phoneResult.ok) next.phone = t(PHONE_ISSUE_KEYS[phoneResult.issue]);
    const trimmed = name.trim();
    if (trimmed && !PersonName.safeParse(trimmed).success)
      next.name = t('console.invites.form.name.invalid');
    setErrors(next);
    if (Object.keys(next).length > 0 || !phoneResult.ok || !role) return;

    const parsed = InviteBody.safeParse({
      role,
      phone: phoneResult.e164,
      ...(trimmed ? { displayName: trimmed } : {}),
      ...(role === 'city_coordinator' ? { cityId } : {}),
      ...(role === 'venue_coordinator' ? { venueId } : {}),
    });
    if (!parsed.success) {
      setErrors({ form: t('errors.validation_failed') });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await api.adminRoles.invite({ body: parsed.data });
      onDone();
    } catch (error) {
      setFailure(error);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('console.invites.new')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('console.shell.cancel')}
          </Button>
          <Button variant="primary" type="submit" form="invite-form" busy={busy}>
            {t('console.invites.send')}
          </Button>
        </>
      }
    >
      <form id="invite-form" className="form" onSubmit={(e) => void submit(e)} noValidate>
        {failure ? <Banner tone="danger">{t(errorMessageKeyOf(failure))}</Banner> : null}
        {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
        <SelectField
          id="invite-role"
          label={t('console.invites.role.label')}
          value={role}
          error={errors.role}
          required
          placeholder={t('ui.selectPlaceholder')}
          onChange={(e) => {
            setRole(e.target.value as Role | '');
            setCityId('');
            setVenueId('');
          }}
          options={roles.map((r) => ({ value: r, label: tx(roleLabelKey(r)) }))}
        />
        {role === 'city_coordinator' ? (
          <SelectField
            id="invite-city"
            label={t('console.invites.scope.city')}
            value={cityId}
            error={errors.scope}
            required
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => setCityId(e.target.value)}
            options={cityOptions}
          />
        ) : null}
        {role === 'venue_coordinator' ? (
          <SelectField
            id="invite-venue"
            label={t('console.invites.scope.venue')}
            value={venueId}
            error={errors.scope}
            required
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => setVenueId(e.target.value)}
            options={venueOptions}
          />
        ) : null}
        <TextField
          id="invite-phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          dir="ltr"
          label={t('console.invites.phone.label')}
          hint={
            preview?.ok
              ? t('console.invites.form.phone.preview', { phone: formatPhone(preview.e164) })
              : t('console.invites.form.phone.hint')
          }
          error={errors.phone}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
        <TextField
          id="invite-name"
          autoComplete="off"
          label={t('console.invites.form.name.label')}
          error={errors.name}
          optional
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </form>
    </Modal>
  );
}

/* Handover ----------------------------------------------------------------------------------- */

/**
 * Hands a venue or city to someone else. The API replaces the old assignment and gives the new
 * one in a single step: the previous coordinator loses access at once and the history stays.
 */
function HandoverDialog({
  assignment,
  onClose,
  onDone,
}: {
  assignment: StaffRoleAssignment;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const { api } = useSignedIn();
  const scopeLabel = useScopeLabel();
  const candidates = useAsync(
    () => fetchAllPages((cursor) => api.adminRoles.list({ query: { limit: 100, cursor } })),
    [api],
  );
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const people = useMemo(() => {
    if (candidates.status !== 'ready') return [];
    const seen = new Map<string, StaffRoleAssignment>();
    for (const a of candidates.data) {
      if (a.revokedAt || a.userId === assignment.userId) continue;
      if (!seen.has(a.userId)) seen.set(a.userId, a);
    }
    return [...seen.values()];
  }, [candidates, assignment.userId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) {
      setError(t('console.invites.handover.person.required'));
      return;
    }
    setError(null);
    const parsed = AssignRoleBody.safeParse(
      assignment.role === 'city_coordinator'
        ? {
            role: 'city_coordinator',
            cityId: assignment.cityId,
            userId,
            replacesAssignmentId: assignment.id,
          }
        : {
            role: 'venue_coordinator',
            venueId: assignment.venueId,
            userId,
            replacesAssignmentId: assignment.id,
          },
    );
    if (!parsed.success) {
      setError(t('errors.validation_failed'));
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await api.adminRoles.assign({ body: parsed.data });
      onDone();
    } catch (e) {
      setFailure(e);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('console.invites.handover.title', { scope: scopeLabel(assignment) })}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('console.shell.cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="handover-form"
            busy={busy}
            disabled={candidates.status !== 'ready' || people.length === 0}
          >
            {t('console.invites.handover.submit')}
          </Button>
        </>
      }
    >
      <p>
        {t('console.invites.handover.warning', {
          previous: assignment.userName ?? t('console.invites.unnamed'),
        })}
      </p>
      {candidates.status === 'loading' ? <Loading /> : null}
      {candidates.status === 'error' ? (
        <ErrorState error={candidates.error} onRetry={candidates.reload} />
      ) : null}
      {candidates.status === 'ready' && people.length === 0 ? (
        <Banner tone="warning">{t('console.invites.handover.nobody')}</Banner>
      ) : null}
      {failure ? <Banner tone="danger">{t(errorMessageKeyOf(failure))}</Banner> : null}
      {candidates.status === 'ready' && people.length > 0 ? (
        <form id="handover-form" className="form" onSubmit={(e) => void submit(e)} noValidate>
          <SelectField
            id="handover-person"
            label={t('console.invites.handover.person.label')}
            hint={t('console.invites.handover.person.hint')}
            value={userId}
            error={error}
            required
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => setUserId(e.target.value)}
            options={people.map((a) => ({
              value: a.userId,
              label: `${a.userName ?? t('console.invites.unnamed')} (${formatPhone(a.phone)})`,
            }))}
          />
        </form>
      ) : null}
    </Modal>
  );
}
