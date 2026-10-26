import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  AssignRoleBody,
  INVITE_DAILY_LIMIT,
  InviteBody,
  PersonName,
  issueMessageKey,
  roleAssignAction,
  type Invite,
  type InviteStatus,
  type Role,
  type StaffRoleAssignment,
  EmailAddress,
} from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useDirectory } from '../api/directory';
import { fetchAllPages, usePaged, useAsync } from '../api/hooks';
import { roleLabelKey } from '../components/Shell';
import { useScopeLabel } from '../components/scope';
import { Icon } from '../components/icons';
import { useShellSearch } from '../components/ShellFilters';
import {
  AddButton,
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
  NoMatch,
  PageHeader,
  Phone,
  SearchField,
  SegmentedControl,
  SelectField,
  TableCard,
  TextField,
  type BadgeTone,
  type Column,
} from '../components/ui';
import { useI18n } from '../i18n';
import { coordinatorStats } from '../lib/kpis';
import { filterBySearch } from '../lib/search';
import { errorKind, errorMessageKeyOf, fieldIssues, issuesOf } from '../lib/errors';
import { PHONE_ISSUE_KEYS, formatPhone, maskPhone, normalizePhone, phoneTail } from '../lib/phone';
import { isolate } from '../lib/ui-tokens';
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

type InviteFilter = 'all' | InviteStatus;
const INVITE_FILTERS: readonly InviteFilter[] = [
  'all',
  'pending',
  'accepted',
  'expired',
  'revoked',
];

/** Fields of an invite form, by the path the server names in a `validation_failed` answer. */
const INVITE_FIELD_PATHS = {
  phone: 'phone',
  email: 'email',
  displayName: 'name',
  role: 'role',
  cityId: 'scope',
  venueId: 'scope',
} as const satisfies Record<string, 'phone' | 'email' | 'name' | 'role' | 'scope'>;

type Translate = ReturnType<typeof useI18n>['t'];

/** True when the server refused an invite because of the person's 24-hour invitation limit. */
const overInviteLimit = (error: unknown): boolean =>
  issuesOf(error).some((i) => i.code === INVITE_DAILY_LIMIT);

/** What went wrong with an invite call, in words: the invite limit has its own message. */
function inviteFailureKey(error: unknown): MessageKey {
  return overInviteLimit(error) ? issueMessageKey(INVITE_DAILY_LIMIT) : errorMessageKeyOf(error);
}

/** Messages for the invite fields the server rejected, so the person sees which one to fix. */
function serverFieldErrors(error: unknown, t: Translate): Record<string, string> {
  const rejected = fieldIssues(error, INVITE_FIELD_PATHS);
  const out: Record<string, string> = {};
  // The invite limit is reported on `phone`, but nothing is wrong with the number.
  if (rejected.phone && rejected.phone.code !== INVITE_DAILY_LIMIT)
    out.phone = t(PHONE_ISSUE_KEYS.invalid);
  if (rejected.email) out.email = t('console.invites.form.email.invalid');
  if (rejected.name) out.name = t('console.invites.form.name.invalid');
  if (rejected.role) out.role = t('console.invites.form.rejected');
  if (rejected.scope) out.scope = t('console.invites.form.rejected');
  return out;
}

/** A handover invite names the assignment it replaces (city and venue roles only). */
const isHandover = (invite: Invite) =>
  Boolean(invite.replacesAssignmentId) && invite.role !== 'national_admin';

/**
 * The body that sends an invite again: a new invite for the same number, role and place. The
 * contract documents this as the resend; the server replaces the waiting invite and sends the
 * message again with a new expiry. A handover invite keeps its `replacesAssignmentId` (rc.3), so
 * resending a lapsed one still hands over, unless `withHandover` is false.
 */
export function resendBody(
  invite: Invite,
  { withHandover = true }: { withHandover?: boolean } = {},
): InviteBody | null {
  const name =
    invite.displayName && PersonName.safeParse(invite.displayName).success
      ? { displayName: invite.displayName }
      : {};
  const handover =
    withHandover && isHandover(invite) ? { replacesAssignmentId: invite.replacesAssignmentId } : {};
  const parsed = InviteBody.safeParse({
    role: invite.role,
    phone: invite.phone,
    ...(invite.email ? { email: invite.email } : {}),
    ...name,
    ...(invite.role === 'city_coordinator' ? { cityId: invite.cityId, ...handover } : {}),
    ...(invite.role === 'venue_coordinator' ? { venueId: invite.venueId, ...handover } : {}),
  });
  return parsed.success ? parsed.data : null;
}

/** Coordinator invites, the people who hold roles now, and handing a venue or city over. */
export default function CoordinatorsPage() {
  const { t, tx, dateTime, number } = useI18n();
  const { api, principal } = useSignedIn();
  const scopeLabel = useScopeLabel();
  const [peopleQuery] = useShellSearch(t('console.invites.active.search'));
  const [notice, setNotice] = useState<Notice>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>('all');
  const [resending, setResending] = useState<string | null>(null);
  // A handover resend the server refused because the old coordinator is already gone.
  const [handoverGone, setHandoverGone] = useState<Invite | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [revokingInvite, setRevokingInvite] = useState<Invite | null>(null);
  const [handingOver, setHandingOver] = useState<StaffRoleAssignment | null>(null);
  const [removing, setRemoving] = useState<StaffRoleAssignment | null>(null);
  const [inviteQuery, setInviteQuery] = useState('');
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
    setFailure(null);
    setNotice({ tone: 'success', key });
    invites.reload();
    people.reload();
  };

  const resend = async (invite: Invite, withHandover = true) => {
    const body = resendBody(invite, { withHandover });
    if (!body) return;
    setResending(invite.id);
    setNotice(null);
    setFailure(null);
    if (withHandover) setHandoverGone(null);
    try {
      await api.adminRoles.invite({ body });
      setHandoverGone(null);
      done('console.invites.resent');
    } catch (error) {
      // The replaced assignment has ended (the old coordinator was removed): offer to send it
      // again as a plain invite rather than showing a bare "not found".
      const handoverLost =
        'replacesAssignmentId' in body &&
        Boolean(body.replacesAssignmentId) &&
        errorKind(error) === 'not_found';
      if (handoverLost) {
        setHandoverGone(invite);
      } else {
        setHandoverGone(null);
        setFailure(error);
      }
    } finally {
      setResending(null);
    }
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
    {
      id: 'role',
      header: t('console.invites.col.role'),
      cell: (i) => (
        <>
          {t(roleLabelKey(i.role))}
          {isHandover(i) ? (
            <>
              {' '}
              <Badge tone="accent">{t('console.invites.handoverTag')}</Badge>
            </>
          ) : null}
        </>
      ),
    },
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
      cell: (i) => {
        if (!canAssignRole(principal, i.role, inviteScope(i))) return null;
        const forNumber = t('console.invites.revoke.for', { digits: phoneTail(i.phone) });
        const canResend = (i.status === 'pending' || i.status === 'expired') && resendBody(i);
        if (!canResend && i.status !== 'pending') return null;
        return (
          <div className="row-actions">
            {canResend ? (
              <Button
                className="btn-small"
                aria-label={`${t('console.invites.resend')} ${forNumber}`}
                busy={resending === i.id}
                disabled={resending !== null}
                onClick={() => void resend(i)}
              >
                {t('console.invites.resend')}
              </Button>
            ) : null}
            {i.status === 'pending' ? (
              <Button
                variant="danger"
                className="btn-small"
                aria-label={`${t('console.invites.revoke')} ${forNumber}`}
                onClick={() => setRevokingInvite(i)}
              >
                {t('console.invites.revoke')}
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  // The artboard's "Field coordinators & working scopes" table: who, their verified number, the
  // place, a coloured role badge and the two actions as quiet links.
  const personColumns: Column<StaffRoleAssignment>[] = [
    {
      id: 'person',
      header: t('console.invites.col.coordinator'),
      rowHeader: true,
      cell: (a) => a.userName ?? t('console.invites.unnamed'),
    },
    {
      id: 'phone',
      header: t('console.invites.col.phoneVerified'),
      // Masked to the last four digits, like every number in the coordinators lists.
      cell: (a) => <Phone value={a.phone} masked />,
    },
    { id: 'scope', header: t('console.invites.col.assigned'), cell: (a) => scopeLabel(a) },
    {
      id: 'role',
      header: t('console.invites.col.roleBadge'),
      cell: (a) => (
        <div className="cell-stack">
          <span className={`role-tag role-tag-${a.role}`}>{t(roleLabelKey(a.role))}</span>
          {a.revokedAt ? (
            <Badge>{t('console.invites.status.ended', { date: dateTime(a.revokedAt) })}</Badge>
          ) : null}
        </div>
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
          <div className="link-actions">
            {a.role !== 'national_admin' ? (
              <button type="button" className="link-action" onClick={() => setHandingOver(a)}>
                {t('console.invites.handover')}
              </button>
            ) : null}
            <button
              type="button"
              className="link-action link-action-danger"
              onClick={() => setRemoving(a)}
            >
              {t('console.invites.remove')}
            </button>
          </div>
        );
      },
    },
  ];

  const allInvites = invites.status === 'ready' ? invites.data.items : [];
  const loadedPeople = people.status === 'ready' ? people.items : [];
  const stats = useMemo(
    () => coordinatorStats(allInvites, loadedPeople),
    [allInvites, loadedPeople],
  );
  const statusInvites = allInvites.filter(
    (i) => inviteFilter === 'all' || i.status === inviteFilter,
  );
  const visibleInvites = filterBySearch(statusInvites, inviteQuery, (i) => [
    i.displayName,
    i.phone,
    tx(roleLabelKey(i.role)),
    scopeLabel(i),
  ]);
  const visiblePeople = filterBySearch(loadedPeople, peopleQuery, (a) => [
    a.userName,
    a.phone,
    tx(roleLabelKey(a.role)),
    scopeLabel(a),
  ]);
  const filterLabel = (f: InviteFilter) =>
    f === 'all' ? t('console.invites.filter.all') : t(INVITE_STATUS_KEYS[f]);
  // "Invite" in the table card moves to the form beside the table, as drawn.
  const openInviteForm = () => {
    const first = document.getElementById('invite-role');
    first?.scrollIntoView?.({ block: 'nearest' });
    first?.focus();
  };

  return (
    <div className="page">
      <PageHeader title={t('console.nav.coordinators')} intro={t('console.invites.intro')} />
      {notice ? (
        <Banner tone="success" onDismiss={() => setNotice(null)}>
          {t(notice.key)}
        </Banner>
      ) : null}
      {failure ? (
        <Banner tone="danger" onDismiss={() => setFailure(null)}>
          {t(inviteFailureKey(failure))}
        </Banner>
      ) : null}
      {handoverGone ? (
        <Banner
          tone="warning"
          title={t('console.invites.handoverGone.title')}
          onDismiss={() => setHandoverGone(null)}
        >
          <p>{t('console.invites.handoverGone.body')}</p>
          <Button
            className="btn-small"
            busy={resending === handoverGone.id}
            disabled={resending !== null}
            onClick={() => void resend(handoverGone, false)}
          >
            {t('console.invites.handoverGone.resendPlain')}
          </Button>
        </Banner>
      ) : null}
      <div className={canInviteAny ? 'split' : undefined}>
        <TableCard
          title={t('console.invites.active.title')}
          subtitle={
            invites.status === 'ready' && people.status === 'ready'
              ? t('console.invites.active.sub', {
                  active: number(stats.activeRoles),
                  waiting: number(stats.waiting),
                })
              : undefined
          }
          tag={<span className="tag tag-emerald">{t('console.invites.rbacTag')}</span>}
          filters={
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
          {people.status === 'ready' && people.items.length > 0 && visiblePeople.length === 0 ? (
            <NoMatch query={peopleQuery} partial={people.hasMore} />
          ) : null}
          {people.status === 'ready' && visiblePeople.length > 0 ? (
            <DataTable
              caption={t('console.invites.active.title')}
              columns={personColumns}
              rows={visiblePeople}
              rowKey={(a) => a.id}
            />
          ) : null}
          {people.status === 'ready' ? (
            <LoadMore
              hasMore={people.hasMore}
              loading={people.loadingMore}
              onLoadMore={people.loadMore}
              error={people.moreError}
            />
          ) : null}
        </TableCard>
        {canInviteAny ? <InvitePanel onDone={() => done('console.invites.sent')} /> : null}
      </div>

      <TableCard
        title={t('console.invites.list.title')}
        search={
          <SearchField
            id="invites-search"
            label={t('console.invites.search')}
            value={inviteQuery}
            onChange={setInviteQuery}
          />
        }
        filters={
          <SegmentedControl
            label={t('console.invites.filter.label')}
            value={inviteFilter}
            options={INVITE_FILTERS.map((f) => ({ value: f, label: filterLabel(f) }))}
            onChange={setInviteFilter}
          />
        }
        action={
          canInviteAny ? (
            <AddButton onClick={openInviteForm}>{t('console.invites.new')}</AddButton>
          ) : null
        }
      >
        {invites.status === 'loading' ? <Loading /> : null}
        {invites.status === 'error' ? (
          <ErrorState error={invites.error} onRetry={invites.reload} />
        ) : null}
        {invites.status === 'ready' && statusInvites.length === 0 ? (
          <EmptyState
            title={
              inviteFilter === 'all'
                ? t('console.invites.empty')
                : t('console.invites.filter.empty')
            }
          />
        ) : null}
        {invites.status === 'ready' && statusInvites.length > 0 && visibleInvites.length === 0 ? (
          <NoMatch query={inviteQuery} />
        ) : null}
        {invites.status === 'ready' && visibleInvites.length > 0 ? (
          <DataTable
            caption={t('console.invites.list.title')}
            columns={inviteColumns}
            rows={visibleInvites}
            rowKey={(i) => i.id}
          />
        ) : null}
      </TableCard>

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
          onDone={(mode) => {
            setHandingOver(null);
            done(
              mode === 'phone' ? 'console.invites.handoverInvited' : 'console.invites.handedOver',
            );
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
      careful={danger}
      footer={
        <>
          <Button variant={danger ? 'primary' : 'secondary'} onClick={onClose} disabled={busy}>
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

/**
 * The invite form, in a card beside the invites table (two columns at 64rem and wider, one
 * below), as drawn. It is part of the page, not a dialog, so nothing traps focus; "Invite" in the
 * table card moves focus to its first field. After a sent invite the form clears for the next one.
 */
function InvitePanel({ onDone }: { onDone: () => void }) {
  const { t, tx } = useI18n();
  const headingId = useId();
  const { api, principal } = useSignedIn();
  const dir = useDirectory();

  const roles = ROLES.filter((r) => {
    if (r === 'national_admin') return canAssignRole(principal, r);
    if (r === 'city_coordinator')
      return dir.cities.some((c) => canAssignRole(principal, r, { cityId: c.id }));
    return dir.venues.some((v) => canAssignRole(principal, r, { cityId: v.cityId, venueId: v.id }));
  });
  // The form is on the page from the start, before the cities and venues have loaded, so the
  // only-one-role default is worked out on every render rather than fixed when it mounts.
  const [chosenRole, setRole] = useState<Role | '' | null>(null);
  const role: Role | '' = chosenRole ?? (roles.length === 1 ? (roles[0] as Role) : '');
  const [cityId, setCityId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
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
    const emailResult = EmailAddress.safeParse(email);
    if (!emailResult.success) next.email = t('console.invites.form.email.invalid');
    const trimmed = name.trim();
    if (trimmed && !PersonName.safeParse(trimmed).success)
      next.name = t('console.invites.form.name.invalid');
    setErrors(next);
    if (Object.keys(next).length > 0 || !phoneResult.ok || !emailResult.success || !role) return;

    const parsed = InviteBody.safeParse({
      role,
      phone: phoneResult.e164,
      email: emailResult.data,
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
      setRole(null);
      setCityId('');
      setVenueId('');
      setPhone('');
      setEmail('');
      setName('');
      setErrors({});
      onDone();
    } catch (error) {
      setErrors(serverFieldErrors(error, t));
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card side-card assign-card" aria-labelledby={headingId}>
      <div className="assign-head">
        <div>
          <h2 id={headingId}>
            <span aria-hidden="true">+ </span>
            {t('console.invites.new')}
          </h2>
          <p className="table-card-sub">{t('console.invites.form.sub')}</p>
        </div>
        <Icon name="shield-check" size={18} weight="duotone" />
      </div>
      <form
        id="invite-form"
        className="form"
        aria-labelledby={headingId}
        onSubmit={(e) => void submit(e)}
        noValidate
      >
        {failure ? <Banner tone="danger">{t(inviteFailureKey(failure))}</Banner> : null}
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
        <div className="assign-pair">
          <TextField
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            dir="ltr"
            label={t('console.invites.form.email.label')}
            hint={t('console.invites.form.email.hint')}
            error={errors.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
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
        </div>
        <div className="form-actions assign-actions">
          <Button variant="primary" type="submit" busy={busy}>
            <Icon name="paper-plane-tilt" size={14} weight="fill" />
            <span>{t('console.invites.send')}</span>
          </Button>
        </div>
      </form>
    </section>
  );
}

/* Handover ----------------------------------------------------------------------------------- */

type HandoverMode = 'existing' | 'phone';

/**
 * Hands a venue or city to someone else, in one of two ways:
 * - to someone who already holds a role: `adminRoles.assign` with `replacesAssignmentId`. The new
 *   coordinator has access at once and the previous one loses it in the same step.
 * - to a phone number: `adminRoles.invite` with `replacesAssignmentId`. Nothing changes until the
 *   person accepts the invite; then the server gives them the role and ends the old one together.
 * The history stays either way.
 */
function HandoverDialog({
  assignment,
  onClose,
  onDone,
}: {
  assignment: StaffRoleAssignment;
  onClose: () => void;
  onDone: (mode: HandoverMode) => void;
}) {
  const { t } = useI18n();
  const { api } = useSignedIn();
  const scopeLabel = useScopeLabel();
  const candidates = useAsync(
    () => fetchAllPages((cursor) => api.adminRoles.list({ query: { limit: 100, cursor } })),
    [api],
  );
  const [chosenMode, setMode] = useState<HandoverMode | null>(null);
  const [userId, setUserId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  // With nobody else holding a role, a phone number is the only way, so it is chosen for them.
  const mode: HandoverMode =
    chosenMode ?? (candidates.status === 'ready' && people.length === 0 ? 'phone' : 'existing');
  const previous = assignment.userName ?? t('console.invites.unnamed');
  const place =
    assignment.role === 'city_coordinator'
      ? { role: 'city_coordinator' as const, cityId: assignment.cityId }
      : { role: 'venue_coordinator' as const, venueId: assignment.venueId };
  const preview = phone.trim() ? normalizePhone(phone, { mobileOnly: true }) : null;

  const send = async (call: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(null);
    try {
      await call();
      onDone(mode);
    } catch (e) {
      setErrors(serverFieldErrors(e, t));
      setFailure(e);
      setBusy(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'existing') {
      if (!userId) {
        setErrors({ person: t('console.invites.handover.person.required') });
        return;
      }
      setErrors({});
      const parsed = AssignRoleBody.safeParse({
        ...place,
        userId,
        replacesAssignmentId: assignment.id,
      });
      if (!parsed.success) {
        setErrors({ form: t('errors.validation_failed') });
        return;
      }
      await send(() => api.adminRoles.assign({ body: parsed.data }));
      return;
    }

    const next: Record<string, string> = {};
    const phoneResult = normalizePhone(phone, { mobileOnly: true });
    if (!phoneResult.ok) next.phone = t(PHONE_ISSUE_KEYS[phoneResult.issue]);
    const emailResult = EmailAddress.safeParse(email);
    if (!emailResult.success) next.email = t('console.invites.form.email.invalid');
    const trimmed = name.trim();
    if (trimmed && !PersonName.safeParse(trimmed).success)
      next.name = t('console.invites.form.name.invalid');
    setErrors(next);
    if (Object.keys(next).length > 0 || !phoneResult.ok || !emailResult.success) return;
    const parsed = InviteBody.safeParse({
      ...place,
      phone: phoneResult.e164,
      email: emailResult.data,
      ...(trimmed ? { displayName: trimmed } : {}),
      replacesAssignmentId: assignment.id,
    });
    if (!parsed.success) {
      setErrors({ form: t('errors.validation_failed') });
      return;
    }
    await send(() => api.adminRoles.invite({ body: parsed.data }));
  };

  const ready = candidates.status === 'ready' || mode === 'phone';

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
            disabled={!ready || (mode === 'existing' && people.length === 0)}
          >
            {mode === 'phone'
              ? t('console.invites.handover.sendInvite')
              : t('console.invites.handover.submit')}
          </Button>
        </>
      }
    >
      <p>
        {mode === 'phone'
          ? t('console.invites.handover.inviteWarning', { previous })
          : t('console.invites.handover.warning', { previous })}
      </p>
      {failure ? <Banner tone="danger">{t(inviteFailureKey(failure))}</Banner> : null}
      {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
      <form id="handover-form" className="form" onSubmit={(e) => void submit(e)} noValidate>
        <SelectField
          id="handover-mode"
          label={t('console.invites.handover.mode.label')}
          value={mode}
          disabled={busy}
          onChange={(e) => {
            setMode(e.target.value as HandoverMode);
            setErrors({});
            setFailure(null);
          }}
          options={[
            { value: 'existing', label: t('console.invites.handover.mode.existing') },
            { value: 'phone', label: t('console.invites.handover.mode.phone') },
          ]}
        />
        {mode === 'existing' && candidates.status === 'loading' ? <Loading /> : null}
        {mode === 'existing' && candidates.status === 'error' ? (
          <ErrorState error={candidates.error} onRetry={candidates.reload} />
        ) : null}
        {mode === 'existing' && candidates.status === 'ready' && people.length === 0 ? (
          <Banner tone="warning">{t('console.invites.handover.nobodyYet')}</Banner>
        ) : null}
        {mode === 'existing' && candidates.status === 'ready' && people.length > 0 ? (
          <SelectField
            id="handover-person"
            label={t('console.invites.handover.person.label')}
            hint={t('console.invites.handover.person.hintExisting')}
            value={userId}
            error={errors.person}
            required
            placeholder={t('ui.selectPlaceholder')}
            onChange={(e) => setUserId(e.target.value)}
            options={people.map((a) => ({
              value: a.userId,
              label: `${a.userName ?? t('console.invites.unnamed')} (${isolate(maskPhone(a.phone))})`,
            }))}
          />
        ) : null}
        {mode === 'phone' ? (
          <>
            <TextField
              id="handover-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              dir="ltr"
              label={t('console.invites.form.email.label')}
              hint={t('console.invites.form.email.hint')}
              error={errors.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              id="handover-phone"
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
              id="handover-name"
              autoComplete="off"
              label={t('console.invites.form.name.label')}
              error={errors.name}
              optional
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </>
        ) : null}
      </form>
    </Modal>
  );
}
