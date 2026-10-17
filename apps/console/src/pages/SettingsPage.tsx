import { useState, type FormEvent } from 'react';
import { SEASON_MODES, SettingsUpdate, type Settings } from '@qc/contracts';
import type { MessageKey } from '@qc/i18n';
import { useSignedIn } from '../api/auth';
import { useAsync } from '../api/hooks';
import {
  Banner,
  Button,
  ErrorState,
  Loading,
  PageHeader,
  SelectField,
  TextField,
} from '../components/ui';
import { useI18n } from '../i18n';
import { errorMessageKeyOf, fieldIssues } from '../lib/errors';

const OFFSETS = [-2, -1, 0, 1, 2] as const;

type Field =
  | 'hijriOffsetDays'
  | 'seasonMode'
  | 'whatsappDailyCapPerPerson'
  | 'circleRequestAlertThreshold'
  | 'leadDora'
  | 'leadCircles';

/** Form fields by the path of a settings value, for local and server validation issues alike. */
const FIELD_PATHS: Readonly<Record<string, Field>> = {
  hijriOffsetDays: 'hijriOffsetDays',
  seasonMode: 'seasonMode',
  whatsappDailyCapPerPerson: 'whatsappDailyCapPerPerson',
  circleRequestAlertThreshold: 'circleRequestAlertThreshold',
  'reminderLeadMinutes.dora': 'leadDora',
  'reminderLeadMinutes.circles': 'leadCircles',
};

const FIELD_ERROR_KEYS = {
  hijriOffsetDays: 'console.settings.hijri.invalid',
  seasonMode: 'errors.validation_failed',
  whatsappDailyCapPerPerson: 'console.settings.cap.invalid',
  circleRequestAlertThreshold: 'console.settings.threshold.invalid',
  leadDora: 'console.settings.lead.invalid',
  leadCircles: 'console.settings.lead.invalid',
} as const satisfies Record<Field, MessageKey>;

const asNumber = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));

const SEASON_KEYS = {
  dora: 'console.settings.season.dora',
  circles: 'console.settings.season.circles',
} as const satisfies Record<Settings['seasonMode'], MessageKey>;

/** Platform settings. Only a national admin gets here; the API enforces it too. */
export default function SettingsPage() {
  const { t } = useI18n();
  const { api } = useSignedIn();
  const loaded = useAsync(() => api.adminSettings.get(), [api]);

  return (
    <div className="page">
      <PageHeader title={t('console.settings.title')} intro={t('console.settings.intro')} />
      {loaded.status === 'loading' ? <Loading /> : null}
      {loaded.status === 'error' ? (
        <ErrorState error={loaded.error} onRetry={loaded.reload} />
      ) : null}
      {loaded.status === 'ready' ? <SettingsForm initial={loaded.data} /> : null}
    </div>
  );
}

function SettingsForm({ initial }: { initial: Settings }) {
  const { t, number } = useI18n();
  const { api } = useSignedIn();
  const [saved, setSaved] = useState<Settings>(initial);
  const [hijri, setHijri] = useState(String(initial.hijriOffsetDays));
  const [season, setSeason] = useState<Settings['seasonMode']>(initial.seasonMode);
  const [cap, setCap] = useState(String(initial.whatsappDailyCapPerPerson));
  const [threshold, setThreshold] = useState(String(initial.circleRequestAlertThreshold));
  const [leadDora, setLeadDora] = useState(String(initial.reminderLeadMinutes.dora));
  const [leadCircles, setLeadCircles] = useState(String(initial.reminderLeadMinutes.circles));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft = {
    hijriOffsetDays: Number(hijri),
    seasonMode: season,
    whatsappDailyCapPerPerson: asNumber(cap),
    circleRequestAlertThreshold: asNumber(threshold),
    leadDora: asNumber(leadDora),
    leadCircles: asNumber(leadCircles),
  };
  const changed: SettingsUpdate = {};
  if (draft.hijriOffsetDays !== saved.hijriOffsetDays)
    changed.hijriOffsetDays = draft.hijriOffsetDays;
  if (draft.seasonMode !== saved.seasonMode) changed.seasonMode = draft.seasonMode;
  if (draft.whatsappDailyCapPerPerson !== saved.whatsappDailyCapPerPerson)
    changed.whatsappDailyCapPerPerson = draft.whatsappDailyCapPerPerson;
  if (draft.circleRequestAlertThreshold !== saved.circleRequestAlertThreshold)
    changed.circleRequestAlertThreshold = draft.circleRequestAlertThreshold;
  // Only the program whose lead time changed is sent; the contract takes a partial value.
  const lead: NonNullable<SettingsUpdate['reminderLeadMinutes']> = {};
  if (draft.leadDora !== saved.reminderLeadMinutes.dora) lead.dora = draft.leadDora;
  if (draft.leadCircles !== saved.reminderLeadMinutes.circles) lead.circles = draft.leadCircles;
  if (Object.keys(lead).length > 0) changed.reminderLeadMinutes = lead;
  const dirty = Object.keys(changed).length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    setFailure(null);
    const parsed = SettingsUpdate.safeParse(changed);
    if (!parsed.success) {
      const next: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = fieldOf(issue.path.map(String));
        if (field) next[field] = t(FIELD_ERROR_KEYS[field]);
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const result = await api.adminSettings.update({ body: parsed.data });
      setSaved(result);
      setHijri(String(result.hijriOffsetDays));
      setSeason(result.seasonMode);
      setCap(String(result.whatsappDailyCapPerPerson));
      setThreshold(String(result.circleRequestAlertThreshold));
      setLeadDora(String(result.reminderLeadMinutes.dora));
      setLeadCircles(String(result.reminderLeadMinutes.circles));
      setDone(true);
    } catch (error) {
      // A value the server refused is marked at its own field.
      const rejected = fieldIssues(error, FIELD_PATHS);
      const next: Partial<Record<Field, string>> = {};
      for (const field of Object.keys(rejected) as Field[])
        next[field] = t(FIELD_ERROR_KEYS[field]);
      setErrors(next);
      setFailure(error);
    } finally {
      setBusy(false);
    }
  };

  const offsetLabel = (n: number) =>
    n === 0
      ? t('console.settings.hijri.none')
      : t('console.settings.hijri.days', { days: `${n > 0 ? '+' : '−'}${number(Math.abs(n))}` });

  return (
    <form className="form card" onSubmit={(e) => void submit(e)} noValidate>
      {done ? <Banner tone="success">{t('console.settings.saved')}</Banner> : null}
      {failure ? <Banner tone="danger">{t(errorMessageKeyOf(failure))}</Banner> : null}
      <SelectField
        id="setting-hijri"
        label={t('console.settings.hijri.label')}
        hint={t('console.settings.hijri.hint')}
        value={hijri}
        error={errors.hijriOffsetDays}
        onChange={(e) => setHijri(e.target.value)}
        options={OFFSETS.map((n) => ({ value: String(n), label: offsetLabel(n) }))}
      />
      <SelectField
        id="setting-season"
        label={t('console.settings.season.label')}
        hint={t('console.settings.season.hint')}
        value={season}
        error={errors.seasonMode}
        onChange={(e) => setSeason(e.target.value as Settings['seasonMode'])}
        options={SEASON_MODES.map((m) => ({ value: m, label: t(SEASON_KEYS[m]) }))}
      />
      <TextField
        id="setting-cap"
        type="number"
        inputMode="numeric"
        min={0}
        max={5}
        dir="ltr"
        label={t('console.settings.cap.label')}
        hint={t('console.settings.cap.hint')}
        error={errors.whatsappDailyCapPerPerson}
        value={cap}
        onChange={(e) => setCap(e.target.value)}
      />
      <TextField
        id="setting-threshold"
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        dir="ltr"
        label={t('console.settings.threshold.label')}
        hint={t('console.settings.threshold.hint')}
        error={errors.circleRequestAlertThreshold}
        value={threshold}
        onChange={(e) => setThreshold(e.target.value)}
      />
      <fieldset className="fieldset">
        <legend className="field-label">{t('console.settings.lead.legend')}</legend>
        <p className="field-hint">{t('console.settings.lead.hint')}</p>
        <TextField
          id="setting-lead-dora"
          type="number"
          inputMode="numeric"
          min={5}
          max={1440}
          dir="ltr"
          label={t('console.settings.lead.dora')}
          error={errors.leadDora}
          value={leadDora}
          onChange={(e) => setLeadDora(e.target.value)}
        />
        <TextField
          id="setting-lead-circles"
          type="number"
          inputMode="numeric"
          min={5}
          max={1440}
          dir="ltr"
          label={t('console.settings.lead.circles')}
          error={errors.leadCircles}
          value={leadCircles}
          onChange={(e) => setLeadCircles(e.target.value)}
        />
      </fieldset>
      <div className="form-actions">
        <Button type="submit" variant="primary" busy={busy} disabled={!dirty}>
          {t('console.settings.save')}
        </Button>
      </div>
    </form>
  );
}

/** The form field for an issue path such as `['reminderLeadMinutes', 'dora']`. */
function fieldOf(path: readonly string[]): Field | undefined {
  for (let n = path.length; n > 0; n--) {
    const field = FIELD_PATHS[path.slice(0, n).join('.')];
    if (field) return field;
  }
  return undefined;
}
