import { useState } from 'react';
import { View } from 'react-native';
import { can, type City, type Venue } from '@qc/contracts';
import { Button, Card, Checkbox, Select, Text, TextField, spacing } from '@qc/ui';
import { isErrorCode, serverFieldErrors } from '../../api/errors';
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
  emptyVenueForm,
  FACILITY_KEYS,
  validateVenue,
  venueFormOf,
  type VenueErrors,
  type VenueForm,
} from './form';

/** Where the server's validation paths land on this form. */
const VENUE_FIELDS = {
  cityId: 'city',
  areaId: 'area',
  name: 'name',
  address: 'address',
  lat: 'lat',
  lng: 'lng',
  contactPhone: 'phone',
} as const;

export interface VenueEditorScreenProps {
  /** Leave out to create a venue. */
  venueId?: string;
}

interface Loaded {
  venue: Venue | null;
  cities: City[];
}

/** Create a venue or edit one, including the facilities checklist every venue page shows. */
export function VenueEditorScreen({ venueId }: VenueEditorScreenProps) {
  const { t } = useT();
  const api = useApi();
  const nav = useNavigation();

  const query = useQuery<Loaded>(async () => {
    const [cities, venue] = await Promise.all([
      api.places.cities(),
      venueId ? loadVenue(api, venueId) : Promise.resolve(null),
    ]);
    return { venue, cities: cities.items };
  }, [venueId]);

  return (
    <Screen
      title={venueId ? t('admin.venueEditor.title.edit') : t('admin.venueEditor.title.new')}
      onBack={nav.back}
      testID="venue-editor"
    >
      <QueryBoundary query={query} testID="venue-editor-data">
        {(loaded) => <VenueEditorFlow loaded={loaded} />}
      </QueryBoundary>
    </Screen>
  );
}

/** The public call reads published venues; a draft or archived one comes from the admin list. */
async function loadVenue(api: ReturnType<typeof useApi>, venueId: string): Promise<Venue> {
  try {
    return await api.venues.get({ params: { venueId } });
  } catch (error) {
    if (!isErrorCode(error, 'not_found')) throw error;
    const page = await api.adminVenues.list({ query: { includeArchived: 'true', limit: 100 } });
    const found = page.items.find((v) => v.id === venueId);
    if (!found) throw error;
    return found;
  }
}

function VenueEditorFlow({ loaded }: { loaded: Loaded }) {
  const { t, locale } = useT();
  const api = useApi();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const original = loaded.venue;

  const creatableCities = loaded.cities.filter((c) =>
    can(principal, 'venue.create', { cityId: c.id }),
  );
  const [form, setForm] = useState<VenueForm>(() =>
    original ? venueFormOf(original) : emptyVenueForm(creatableCities[0]?.id ?? null),
  );
  const [errors, setErrors] = useState<VenueErrors>({});
  const create = useMutation(api.adminVenues.create);
  const update = useMutation(api.adminVenues.update);
  const patch = (p: Partial<VenueForm>) => setForm((f) => ({ ...f, ...p }));

  const areas = useQuery(
    async () =>
      form.cityId ? (await api.places.areas({ query: { cityId: form.cityId } })).items : [],
    [form.cityId],
  );

  const allowed = original
    ? can(principal, 'venue.update', { venueId: original.id, cityId: original.cityId })
    : creatableCities.length > 0;
  if (!allowed) {
    return (
      <Card variant="flat" testID="venue-editor-forbidden">
        <Text>{original ? t('errors.forbidden') : t('admin.venueEditor.cannotCreate')}</Text>
      </Card>
    );
  }

  const failure = original ? update.error : create.error;
  // What the form found, else what the server rejected (`ApiClientError.issues`).
  const shown = { ...serverFieldErrors(failure, VENUE_FIELDS), ...errors };
  const busy = create.status === 'running' || update.status === 'running';

  const submit = async () => {
    const checked = validateVenue(form, original ?? undefined);
    setErrors(checked.errors);
    if (original && checked.update) {
      const saved = await update.run({ params: { venueId: original.id }, body: checked.update });
      if (saved) nav.back();
    } else if (!original && checked.create) {
      const saved = await create.run({ body: checked.create });
      if (saved) nav.back();
    }
  };

  return (
    <View style={{ gap: spacing.lg }} testID="venue-editor-form">
      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="title3" heading={2}>
            {t('admin.venueEditor.details')}
          </Text>
          {!original ? (
            <Select
              testID="venue-city"
              label={t('admin.venueEditor.city.label')}
              required
              value={form.cityId ?? undefined}
              onChange={(cityId) => patch({ cityId, areaId: null })}
              options={creatableCities.map((c) => ({
                value: c.id,
                label: pickLocalized(c.name, locale),
              }))}
              error={shown.city ? t(shown.city) : undefined}
            />
          ) : null}
          <Select
            testID="venue-area"
            label={t('admin.venueEditor.area.label')}
            required
            value={form.areaId ?? undefined}
            onChange={(areaId) => patch({ areaId })}
            options={(areas.data ?? []).map((a) => ({
              value: a.id,
              label: pickLocalized(a.name, locale),
            }))}
            error={shown.area ? t(shown.area) : undefined}
            disabled={areas.status === 'loading'}
          />
          <BilingualField
            testID="venue-name"
            label={t('admin.venueEditor.name.label')}
            value={form.name}
            onChange={(name) => patch({ name })}
            required
            error={shown.name ? t(shown.name) : undefined}
            disabled={busy}
          />
          <BilingualField
            testID="venue-address"
            label={t('admin.venueEditor.address.label')}
            value={form.address}
            onChange={(address) => patch({ address })}
            multiline
            required
            error={shown.address ? t(shown.address) : undefined}
            disabled={busy}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="title3" heading={2}>
            {t('admin.venueEditor.pin.label')}
          </Text>
          <TextField
            testID="venue-lat"
            label={t('admin.venueEditor.lat.label')}
            helper={t('admin.venueEditor.coords.help')}
            value={form.lat}
            onChangeText={(lat) => patch({ lat })}
            error={shown.lat ? t(shown.lat) : undefined}
            keyboardType="numbers-and-punctuation"
            contentDirection="ltr"
            required
            loading={busy}
          />
          <TextField
            testID="venue-lng"
            label={t('admin.venueEditor.lng.label')}
            value={form.lng}
            onChangeText={(lng) => patch({ lng })}
            error={shown.lng ? t(shown.lng) : undefined}
            keyboardType="numbers-and-punctuation"
            contentDirection="ltr"
            required
            loading={busy}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.md }}>
          <Text variant="title3" heading={2}>
            {t('admin.venueEditor.contact')}
          </Text>
          <TextField
            testID="venue-phone"
            label={t('admin.venueEditor.phone.label')}
            helper={t('admin.venueEditor.phone.help')}
            value={form.contactPhone}
            onChangeText={(contactPhone) => patch({ contactPhone })}
            error={shown.phone ? t(shown.phone) : undefined}
            keyboardType="phone-pad"
            contentDirection="ltr"
            loading={busy}
          />
        </View>
      </Card>

      <Card>
        <Text variant="title3" heading={2}>
          {t('admin.venueEditor.facilities.title')}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('admin.venueEditor.facilities.help')}
        </Text>
        {FACILITY_KEYS.map((key) => (
          <Checkbox
            key={key}
            testID={`venue-facility-${key}`}
            label={t(`admin.venueEditor.facility.${key}`)}
            checked={form.facilities[key]}
            onChange={(on) => patch({ facilities: { ...form.facilities, [key]: on } })}
            disabled={busy}
          />
        ))}
      </Card>
      <Card>
        <BilingualField
          testID="venue-entrance"
          label={t('admin.venueEditor.entrance.label')}
          value={form.entranceNotes}
          onChange={(entranceNotes) => patch({ entranceNotes })}
          multiline
          disabled={busy}
        />
      </Card>

      {shown.nothing ? (
        <Text variant="caption" color="textDanger" testID="venue-nothing">
          {t(shown.nothing)}
        </Text>
      ) : null}
      <ErrorNotice error={failure} onDismiss={original ? update.reset : create.reset} />
      <ScreenFooter>
        <Button
          testID="venue-save"
          label={t('admin.venueEditor.submit')}
          size="large"
          fullWidth
          loading={busy}
          onPress={() => void submit()}
        />
      </ScreenFooter>
    </View>
  );
}
