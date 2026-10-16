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
import { errorMessageKeyOf } from '../lib/errors';

const OFFSETS = [-2, -1, 0, 1, 2] as const;

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft = {
    hijriOffsetDays: Number(hijri),
    seasonMode: season,
    whatsappDailyCapPerPerson: cap.trim() === '' ? Number.NaN : Number(cap),
    circleRequestAlertThreshold: threshold.trim() === '' ? Number.NaN : Number(threshold),
  };
  const changed: Partial<Settings> = {};
  if (draft.hijriOffsetDays !== saved.hijriOffsetDays)
    changed.hijriOffsetDays = draft.hijriOffsetDays;
  if (draft.seasonMode !== saved.seasonMode) changed.seasonMode = draft.seasonMode;
  if (draft.whatsappDailyCapPerPerson !== saved.whatsappDailyCapPerPerson)
    changed.whatsappDailyCapPerPerson = draft.whatsappDailyCapPerPerson;
  if (draft.circleRequestAlertThreshold !== saved.circleRequestAlertThreshold)
    changed.circleRequestAlertThreshold = draft.circleRequestAlertThreshold;
  const dirty = Object.keys(changed).length > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    setFailure(null);
    const parsed = SettingsUpdate.safeParse(changed);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        next[key] =
          key === 'hijriOffsetDays'
            ? t('console.settings.hijri.invalid')
            : key === 'whatsappDailyCapPerPerson'
              ? t('console.settings.cap.invalid')
              : key === 'circleRequestAlertThreshold'
                ? t('console.settings.threshold.invalid')
                : t('errors.validation_failed');
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
      setDone(true);
    } catch (error) {
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
      <div className="form-actions">
        <Button type="submit" variant="primary" busy={busy} disabled={!dirty}>
          {t('console.settings.save')}
        </Button>
      </div>
    </form>
  );
}
