import { useState } from 'react';
import { View } from 'react-native';
import { can, type AdminCircle, type Venue } from '@qc/contracts';
import {
  Button,
  Card,
  ConfirmSheet,
  Select,
  SegmentedControl,
  Tag,
  Text,
  TextField,
  Toast,
  spacing,
  type TagKind,
} from '@qc/ui';
import { useMutation, useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { BilingualField } from '../../components/BilingualField';
import { ErrorNotice } from '../../components/ErrorNotice';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Screen, ScreenFooter } from '../../components/Screen';
import { pickLocalized } from '../../lib/localized';
import { useNavigation } from '../../navigation/NavigationContext';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import {
  circleFormOf,
  emptyCircleForm,
  validateCircle,
  type CircleErrors,
  type CircleForm,
} from './form';
import { findCircle } from './find';

export interface CircleEditorScreenProps {
  /** Leave out to create a circle. */
  circleId?: string;
  /** Preselects the venue when creating from a venue page. */
  venueId?: string;
}

interface Loaded {
  circle: AdminCircle | null;
  venues: Venue[];
}

/**
 * Create or edit a circle. A venue coordinator's new circle goes to the city coordinator as
 * pending; a city coordinator or admin approves or rejects it here.
 */
export function CircleEditorScreen({ circleId, venueId }: CircleEditorScreenProps) {
  const { t } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { filter } = useWorkingScope();
  const query = useQuery<Loaded>(async () => {
    const [venues, circle] = await Promise.all([
      api.adminVenues.list({
        query: { ...(filter.cityId ? { cityId: filter.cityId } : {}), limit: 100 },
      }),
      circleId ? findCircle(api, circleId) : Promise.resolve(null),
    ]);
    return { circle, venues: venues.items };
  }, [circleId, filter.cityId]);
  return (
    <Screen
      title={circleId ? t('admin.circleEditor.title.edit') : t('admin.circleEditor.title.new')}
      onBack={nav.back}
      testID="circle-editor"
    >
      <QueryBoundary query={query} testID="circle-editor-data">
        {(loaded) => (
          <CircleEditorFlow loaded={loaded} presetVenueId={venueId} onChanged={query.refetch} />
        )}
      </QueryBoundary>
    </Screen>
  );
}

function CircleEditorFlow({
  loaded,
  presetVenueId,
  onChanged,
}: {
  loaded: Loaded;
  presetVenueId?: string;
  onChanged: () => Promise<void>;
}) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const original = loaded.circle;

  const venueOptions = loaded.venues.filter((v) =>
    can(principal, 'circle.create', { venueId: v.id, cityId: v.cityId }),
  );
  const [form, setForm] = useState<CircleForm>(() =>
    original
      ? circleFormOf(original)
      : emptyCircleForm(
          venueOptions.find((v) => v.id === presetVenueId)?.id ?? venueOptions[0]?.id ?? null,
          locale,
        ),
  );
  const [errors, setErrors] = useState<CircleErrors>({});
  const [created, setCreated] = useState<AdminCircle | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const create = useMutation(api.adminCircles.create);
  const update = useMutation(api.adminCircles.update);
  const decide = useMutation(api.adminCircles.decide);
  const patch = (p: Partial<CircleForm>) => setForm((f) => ({ ...f, ...p }));

  const venueOfForm = loaded.venues.find((v) => v.id === (original?.venueId ?? form.venueId));
  const resource = {
    venueId: venueOfForm?.id ?? null,
    cityId: venueOfForm?.cityId ?? original?.cityId ?? null,
  };
  const canEdit = original ? can(principal, 'circle.update', resource) : venueOptions.length > 0;
  const canDecide = can(principal, 'circle.approve', resource);
  const willBePending = !original && !can(principal, 'circle.approve', resource);

  if (!canEdit && !original) {
    return (
      <Card variant="flat" testID="circle-editor-forbidden">
        <Text>{t('admin.circleEditor.cannotCreate')}</Text>
      </Card>
    );
  }

  if (created) {
    return (
      <View style={{ gap: spacing.lg }} testID="circle-created">
        <Card variant="flat">
          <View style={{ gap: spacing.sm }}>
            <Text variant="title3" heading={2}>
              {t('admin.circleEditor.createdTitle')}
            </Text>
            <Text testID="circle-created-status">
              {created.status === 'pending_approval'
                ? t('admin.circleEditor.createdPending')
                : t('admin.circleEditor.createdLive')}
            </Text>
          </View>
        </Card>
        <ScreenFooter>
          <Button label={t('admin.common.done')} size="large" fullWidth onPress={nav.back} />
        </ScreenFooter>
      </View>
    );
  }

  const busy = create.status === 'running' || update.status === 'running';

  const submit = async () => {
    const checked = validateCircle(form, original ?? undefined);
    setErrors(checked.errors);
    if (original && checked.update) {
      const saved = await update.run({ params: { circleId: original.id }, body: checked.update });
      if (saved) nav.back();
    } else if (!original && checked.create) {
      const saved = await create.run({ body: checked.create });
      if (saved) setCreated(saved);
    }
  };

  const decideNow = async (decision: 'approve' | 'reject') => {
    if (!original) return;
    // There is no free-text note: personal text must not reach the audit log.
    const res = await decide.run({
      params: { circleId: original.id },
      body: { decision },
    });
    setRejecting(false);
    if (res) nav.back();
    else await onChanged();
  };

  return (
    <View style={{ gap: spacing.lg }} testID="circle-editor-form">
      {original ? <StatusBanner status={original.status} canDecide={canDecide} /> : null}

      {original?.status === 'pending_approval' && canDecide ? (
        <Card variant="outlined" testID="circle-decision">
          <View style={{ gap: spacing.md }}>
            <Text variant="title3" heading={2}>
              {t('admin.circleEditor.decisionTitle')}
            </Text>
            <Text variant="caption" color="textSecondary">
              {t('admin.circleEditor.decisionHelper')}
            </Text>
            <ErrorNotice error={rejecting ? null : decide.error} onDismiss={decide.reset} />
            <Button
              testID="circle-approve"
              label={t('admin.circleEditor.approve')}
              size="large"
              fullWidth
              loading={decide.status === 'running' && !rejecting}
              onPress={() => void decideNow('approve')}
            />
            <Button
              testID="circle-reject"
              label={t('admin.circleEditor.reject')}
              variant="outline"
              fullWidth
              disabled={decide.status === 'running'}
              onPress={() => setRejecting(true)}
            />
          </View>
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: spacing.md }}>
          <Select
            testID="circle-venue"
            label={t('admin.circleEditor.venue.label')}
            required
            disabled={Boolean(original)}
            value={form.venueId ?? undefined}
            onChange={(id) => patch({ venueId: id })}
            options={(original ? loaded.venues : venueOptions).map((v) => ({
              value: v.id,
              label: pickLocalized(v.name, locale),
            }))}
            error={errors.venue ? t(errors.venue) : undefined}
          />
          <BilingualField
            testID="circle-name"
            label={t('admin.circleEditor.name.label')}
            value={form.name}
            onChange={(name) => patch({ name })}
            required
            error={errors.name ? t(errors.name) : undefined}
            disabled={busy}
          />
          <TextField
            testID="circle-teacher"
            label={t('admin.circleEditor.teacher.label')}
            helper={t('admin.circleEditor.teacher.help')}
            value={form.teacherName}
            onChangeText={(teacherName) => patch({ teacherName })}
            error={errors.teacher ? t(errors.teacher) : undefined}
            maxLength={80}
            loading={busy}
          />
          <BilingualField
            testID="circle-description"
            label={t('admin.circleEditor.description')}
            value={form.description}
            onChange={(description) => patch({ description })}
            multiline
            disabled={busy}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="title3" heading={2}>
            {t('admin.circleEditor.whoFor')}
          </Text>
          <Text variant="label">{t('admin.circleEditor.language.label')}</Text>
          <SegmentedControl
            accessibilityLabel={t('admin.circleEditor.language.label')}
            value={form.language}
            onChange={(language) => patch({ language })}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ur', label: 'اردو' },
            ]}
            disabled={busy}
          />
          <Text variant="label">{t('admin.circleEditor.section.label')}</Text>
          <SegmentedControl
            accessibilityLabel={t('admin.circleEditor.section.label')}
            value={form.section}
            onChange={(section) => patch({ section })}
            options={[
              { value: 'women', label: t('admin.circleEditor.section.women') },
              { value: 'men', label: t('admin.circleEditor.section.men') },
              { value: 'family', label: t('admin.circleEditor.section.family') },
            ]}
            disabled={busy}
          />
        </View>
      </Card>

      <TextField
        testID="circle-link"
        label={t('admin.circleEditor.online.label')}
        helper={t('admin.circleEditor.online.help')}
        value={form.onlineLink}
        onChangeText={(onlineLink) => patch({ onlineLink })}
        error={errors.link ? t(errors.link) : undefined}
        keyboardType="url"
        contentDirection="ltr"
        loading={busy}
      />

      {willBePending ? (
        <Toast
          testID="circle-pending-note"
          kind="info"
          durationMs={0}
          message={t('admin.circleEditor.pendingNote')}
        />
      ) : null}
      {errors.nothing ? (
        <Text variant="caption" color="textDanger" testID="circle-nothing">
          {t(errors.nothing)}
        </Text>
      ) : null}
      <ErrorNotice
        error={original ? update.error : create.error}
        onDismiss={original ? update.reset : create.reset}
      />
      {canEdit ? (
        <ScreenFooter>
          <Button
            testID="circle-save"
            label={
              original
                ? t('admin.common.save')
                : willBePending
                  ? t('admin.circleEditor.sendForApproval')
                  : t('admin.circleEditor.submit')
            }
            size="large"
            fullWidth
            loading={busy}
            onPress={() => void submit()}
          />
        </ScreenFooter>
      ) : null}

      <ConfirmSheet
        testID="circle-reject-confirm"
        visible={rejecting}
        title={t('admin.circleEditor.reject.title')}
        message={t('admin.circleEditor.reject.body')}
        confirmLabel={t('admin.circleEditor.reject')}
        cancelLabel={t('admin.common.cancel')}
        destructive
        busy={decide.status === 'running'}
        onCancel={() => setRejecting(false)}
        onConfirm={() => void decideNow('reject')}
      />
    </View>
  );
}

function StatusBanner({
  status,
  canDecide,
}: {
  status: AdminCircle['status'];
  canDecide: boolean;
}) {
  const { t } = useT();
  const text =
    status === 'pending_approval' && !canDecide
      ? t('admin.circleEditor.statusWaiting')
      : t(`admin.circleEditor.status.${status}`);
  const kind: Record<AdminCircle['status'], TagKind> = {
    draft: 'neutral',
    pending_approval: 'gilt',
    published: 'ok',
    rejected: 'alert',
    archived: 'neutral',
  };
  return (
    <Card variant="flat" testID="circle-status">
      <View style={{ gap: spacing.xs }}>
        <Tag label={t(`admin.circleEditor.status.${status}`)} kind={kind[status]} />
        {text !== t(`admin.circleEditor.status.${status}`) ? (
          <Text variant="caption" color="textSecondary">
            {text}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
