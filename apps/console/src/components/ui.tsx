import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { useI18n } from '../i18n';
import { errorMessageKeyOf, retryAfterOf } from '../lib/errors';
import { formatPhone, maskPhone } from '../lib/phone';
import { EightPointStar, Icon, StarBadge, type IconName } from './icons';

/* Buttons ---------------------------------------------------------------------------------- */

/**
 * Soft rounded buttons (D8). `primary` is the one main action; `secondary` is the leaf tint;
 * `outline` is the green outline; `ghost` is text only; `danger` is the terracotta outline for
 * careful actions; `onHero` is for the green sidebar and headers.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'onHero';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows that work is in progress and blocks a second press. */
  busy?: boolean;
}

export function Button({
  variant = 'secondary',
  busy = false,
  disabled,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const off = Boolean(disabled || busy);
  return (
    <button
      type={type}
      className={`btn btn-${variant}${className ? ` ${className}` : ''}`}
      disabled={off}
      // Said out loud as well as drawn: `.btn:disabled` and `[aria-disabled]` share one muted look.
      aria-disabled={off || undefined}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <EightPointStar className="btn-spinner" /> : null}
      {children}
    </button>
  );
}

/* Form fields ------------------------------------------------------------------------------ */

interface FieldShellProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  optional?: boolean | undefined;
  /** Extra class on the outlined box, such as the one that draws a select's chevron. */
  boxClassName?: string;
  children: (aria: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
  }) => ReactNode;
}

/**
 * An outlined field with the label small at the top inside the border (D9). The label, the
 * control, the hint and the error message are wired together for screen readers.
 */
export function FieldShell({
  id,
  label,
  hint,
  error,
  optional,
  boxClassName,
  children,
}: FieldShellProps) {
  const { t } = useI18n();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <div className={`field-box${boxClassName ? ` ${boxClassName}` : ''}`}>
        <label htmlFor={id} className="field-label">
          {label}
          {optional ? <span className="field-optional"> ({t('ui.optional')})</span> : null}
        </label>
        {children({
          id,
          'aria-describedby': describedBy || undefined,
          'aria-invalid': error ? true : undefined,
        })}
      </div>
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          <Icon name="warning-circle" size="sm" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface CommonFieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  optional,
  id: idProp,
  className,
  ...rest
}: CommonFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      {(aria) => (
        <input
          {...aria}
          aria-required={rest.required || undefined}
          className={`input${className ? ` ${className}` : ''}`}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  optional,
  id: idProp,
  ...rest
}: CommonFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      {(aria) => <textarea {...aria} className="input" {...rest} />}
    </FieldShell>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({
  label,
  hint,
  error,
  optional,
  id: idProp,
  options,
  placeholder,
  ...rest
}: CommonFieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & { options: readonly Option[]; placeholder?: string }) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      boxClassName="field-box-select"
    >
      {(aria) => (
        <select
          {...aria}
          aria-required={rest.required || undefined}
          className="input select"
          {...rest}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  id: idProp,
  className,
  ...rest
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <div className={`check${className ? ` ${className}` : ''}`}>
      <input id={id} type="checkbox" {...rest} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/* Messages and states ---------------------------------------------------------------------- */

/**
 * `notice` is the gold banner (D13) for things to read before acting, such as the privacy line on
 * exports. It is a polite status, not an alert, because it is part of the page, not an event.
 */
export type BannerTone = 'info' | 'success' | 'warning' | 'danger' | 'notice';

const BANNER_ICONS: Record<BannerTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'warning-circle',
  danger: 'warning-circle',
  notice: 'info',
};

export function Banner({
  tone = 'info',
  title,
  children,
  onDismiss,
}: {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`banner banner-${tone}`}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      <span className="banner-icon">
        <Icon name={BANNER_ICONS[tone]} />
      </span>
      <div className="banner-body">
        {title ? <p className="banner-title">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {onDismiss ? (
        <Button variant="ghost" onClick={onDismiss}>
          {t('ui.dismiss')}
        </Button>
      ) : null}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <p className="loading" role="status">
      {label ?? t('ui.loading')}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <h2 className="state-title">{title}</h2>
      {body ? <p className="state-body">{body}</p> : null}
      {action}
    </div>
  );
}

/**
 * Rows were loaded but none match the search. When the list has more pages, it says only the
 * loaded rows were searched, because search runs in the browser.
 */
export function NoMatch({ query, partial = false }: { query: string; partial?: boolean }) {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t('console.search.noMatch.title', { query: query.trim() })}
      body={partial ? t('console.search.noMatch.partial') : t('console.search.noMatch.body')}
    />
  );
}

/** A failed load, with the reason in plain words and a way to try again. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, number } = useI18n();
  const wait = retryAfterOf(error);
  return (
    <div className="state state-error" role="alert">
      <h2 className="state-title">{t('ui.errorTitle')}</h2>
      <p className="state-body">{t(errorMessageKeyOf(error))}</p>
      {wait ? (
        <p className="state-body">{t('console.shell.retryAfter', { seconds: number(wait) })}</p>
      ) : null}
      {onRetry ? <Button onClick={onRetry}>{t('ui.retry')}</Button> : null}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Phone numbers always read left to right, even inside Urdu text. */
export function Phone({
  value,
  masked = false,
}: {
  value: string | null | undefined;
  /** Hides the middle digits, for lists where the number only needs to identify a row. */
  masked?: boolean;
}) {
  if (!value) return <span aria-hidden="true">–</span>;
  return (
    <bdi dir="ltr" className="phone">
      {masked ? maskPhone(value) : formatPhone(value)}
    </bdi>
  );
}

/** Machine values (action names, ids) are always left to right. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" className="code">
      {children}
    </bdi>
  );
}

/* Page structure --------------------------------------------------------------------------- */

export function PageHeader({
  title,
  intro,
  actions,
  hidden = false,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
  /** Kept for screen readers and the tab title only, where the artboard draws no page title. */
  hidden?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    document.title = `${title} · ${t('console.shell.appTitle')}`;
  }, [title, t]);
  return (
    <header className={hidden ? 'page-header sr-only' : 'page-header'}>
      <div>
        <h1 ref={ref} tabIndex={-1}>
          {title}
        </h1>
        {intro ? <p className="page-intro">{intro}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <h2 id={id}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

/**
 * A row of numbered steps. The current step is marked with text for screen readers (and an
 * `aria-current`), not by colour alone.
 */
export function StepIndicator({
  label,
  steps,
  current,
}: {
  label: string;
  steps: readonly string[];
  /** Zero-based index of the current step. */
  current: number;
}) {
  const { t, number } = useI18n();
  return (
    <ol className="steps" aria-label={label}>
      {steps.map((name, i) => (
        <li
          key={name}
          className={`step${i < current ? ' step-done' : ''}${i === current ? ' step-current' : ''}`}
          aria-current={i === current ? 'step' : undefined}
        >
          <span className="step-number" aria-hidden="true">
            {i < current ? <Icon name="check" size="sm" /> : number(i + 1)}
          </span>
          <span className="step-name">{name}</span>
          {i === current ? (
            <span className="sr-only">
              {t('console.import.step.current', {
                number: number(i + 1),
                total: number(steps.length),
              })}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function LoadMore({
  hasMore,
  loading,
  onLoadMore,
  error,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  error?: unknown;
}) {
  const { t } = useI18n();
  if (!hasMore && !error) return null;
  return (
    <div className="load-more">
      {error ? (
        <p className="field-error" role="alert">
          {t(errorMessageKeyOf(error))}
        </p>
      ) : null}
      {hasMore ? (
        <Button onClick={onLoadMore} busy={loading}>
          {t('console.shell.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}

/* Numbers on top (KPI cards) ---------------------------------------------------------------- */

export interface Stat {
  id: string;
  label: string;
  value: number;
  /** `notice` is the gold card for numbers that ask for attention, such as approvals waiting. */
  tone?: 'default' | 'notice';
  /** The small tinted tile at the card's end edge. Decoration: the label says it all. */
  icon?: IconName;
  /** The tile's tint, as on the artboard's four cards. */
  iconTone?: 'emerald' | 'sky' | 'amber' | 'mint';
  /** A short line under the number, only when the data gives one. */
  sub?: string;
  /** Words to show in place of the bare number, as the artboard's "48 Active Masjids". */
  display?: string;
}

/**
 * The row of number cards above a table, as drawn (D17: white hairline cards, the label over the
 * number and a tinted icon tile at the end edge): a labelled region holding a description
 * list, so a screen reader hears each label with its number. `partial` says the numbers only
 * count the rows loaded so far, when the list has more pages: the API returns no totals.
 */
export function StatRow({
  label,
  stats,
  partial = false,
}: {
  label: string;
  stats: readonly Stat[];
  partial?: boolean;
}) {
  const { t, number } = useI18n();
  return (
    <section className="stat-row" aria-label={label}>
      <dl className="stats">
        {stats.map((s) => (
          <div
            key={s.id}
            className={`stat${s.tone === 'notice' && s.value > 0 ? ' stat-warn' : ''}`}
          >
            <dt className="stat-label">{s.label}</dt>
            <dd className="stat-value">
              {s.display ?? number(s.value)}
              {s.icon ? (
                <span className={`stat-icon stat-icon-${s.iconTone ?? 'emerald'}`}>
                  <Icon name={s.icon} size={18} weight="duotone" />
                </span>
              ) : null}
            </dd>
            {s.sub ? <dd className="stat-sub">{s.sub}</dd> : null}
          </div>
        ))}
      </dl>
      {partial ? <p className="stats-note">{t('console.kpi.partial')}</p> : null}
    </section>
  );
}

/* Table card: search, filters and the add button over the table ------------------------------ */

/**
 * A search box in the table card's top row. The label is the placeholder people see, and also a
 * real (visually hidden) label, so it is announced. It filters the rows already on screen.
 */
export function SearchField({
  id,
  label,
  value,
  onChange,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`search${className ? ` ${className}` : ''}`}>
      <Icon name="magnifying-glass" size="sm" />
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        className="search-input"
        placeholder={label}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** The primary "Add" button of a table card, with the plus icon. */
export function AddButton({ children, ...rest }: ButtonProps) {
  return (
    <Button variant="primary" {...rest}>
      <Icon name="plus" size="sm" />
      {children}
    </Button>
  );
}

/** The same "Add" action when it goes to another page, such as the bulk import. */
export function AddLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="btn btn-primary" to={to}>
      <Icon name="plus" size="sm" />
      {children}
    </Link>
  );
}

/**
 * A raised card that holds a table: the top row has the title or search, any filters, and the
 * add action at the end; the table, its empty state or its loading state sit below.
 */
export function TableCard({
  title,
  subtitle,
  tag,
  tabs,
  search,
  filters,
  filtersLabel,
  action,
  footer,
  children,
}: {
  /** A heading for the card when the page has more than one table. */
  title?: string;
  /** The small grey line under the heading. */
  subtitle?: string;
  /** A pill at the end of the heading row, such as "RBAC scoped". */
  tag?: ReactNode;
  /** Pill tabs at the start of the top row, as on the sessions card. */
  tabs?: ReactNode;
  /** The grey strip under the table: counts and a hint. */
  footer?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  /** Names the group of filters for screen readers. */
  filtersLabel?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section className="table-card" aria-labelledby={title ? headingId : undefined}>
      <div className="table-tools">
        {title ? (
          <div className="table-card-heading">
            <h2 id={headingId} className="table-card-title">
              {title}
            </h2>
            {subtitle ? <p className="table-card-sub">{subtitle}</p> : null}
          </div>
        ) : null}
        {tabs ? <div className="card-tabs">{tabs}</div> : null}
        {tag ? <div className="table-card-tag">{tag}</div> : null}
        {search}
        {filters ? (
          <div className="table-filters" role="group" aria-label={filtersLabel}>
            {filters}
          </div>
        ) : null}
        {action ? <div className="table-action">{action}</div> : null}
      </div>
      <div className="table-card-body">{children}</div>
      {footer ? <div className="table-card-foot">{footer}</div> : null}
    </section>
  );
}

/**
 * A row of joined buttons where one is chosen, as drawn for the invite status filter. Each is a
 * toggle button with `aria-pressed`, inside a labelled group.
 */
export function SegmentedControl<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segment"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Tables ----------------------------------------------------------------------------------- */

export interface Column<T> {
  id: string;
  header: string;
  cell(row: T): ReactNode;
  /** The cell that names the row, for screen readers. */
  rowHeader?: boolean;
}

/**
 * A real table on wide screens. Below the phone breakpoint (`.table-stack` in styles.css) each
 * row becomes a card of "label: value" lines, so nothing scrolls sideways at 390 px. Every body
 * cell carries its column header as `data-label` for that card view. The roles are written out
 * because a table drawn with `display: block` loses its implicit roles in some browsers, and a
 * screen reader must still hear the column header with each value.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  rowClassName,
  className,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  rowClassName?: (row: T) => string | undefined;
  /** A look of its own, such as the audit log's list rows. */
  className?: string;
}) {
  return (
    <div className="table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className={`table table-stack${className ? ` ${className}` : ''}`} role="table">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((c) => (
              <th key={c.id} scope="col" role="columnheader">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr key={rowKey(row)} className={rowClassName?.(row)} role="row">
              {columns.map((c) =>
                c.rowHeader ? (
                  <th key={c.id} scope="row" role="rowheader" data-label={c.header}>
                    {c.cell(row)}
                  </th>
                ) : (
                  <td key={c.id} role="cell" data-label={c.header}>
                    {c.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Dialog ----------------------------------------------------------------------------------- */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog: focus moves in, Tab stays inside, Escape closes, and focus returns to the
 * control that opened it. It does not close when the backdrop is clicked, so a stray click never
 * throws away a half-filled form.
 */
export function Modal({
  title,
  onClose,
  children,
  footer,
  careful = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  /**
   * For a careful action (D13): the icon sits on a white eight-point star and the footer stacks,
   * with the safe action first and the careful (terracotta outline) action under it.
   */
  careful?: boolean;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const firstItem = items[0] as HTMLElement;
      const lastItem = items[items.length - 1] as HTMLElement;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className={`modal${careful ? ' modal-careful' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-head">
          {careful ? (
            <StarBadge>
              <Icon name="warning-circle" />
            </StarBadge>
          ) : null}
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
