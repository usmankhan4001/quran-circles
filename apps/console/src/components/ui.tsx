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
import { useI18n } from '../i18n';
import { errorMessageKeyOf, retryAfterOf } from '../lib/errors';
import { formatPhone } from '../lib/phone';

/* Buttons ---------------------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

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
  return (
    <button
      type={type}
      className={`btn btn-${variant}${className ? ` ${className}` : ''}`}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      {...rest}
    >
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
  children: (aria: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
  }) => ReactNode;
}

/** A label, the control, a hint and an error message, wired together for screen readers. */
export function FieldShell({ id, label, hint, error, optional, children }: FieldShellProps) {
  const { t } = useI18n();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={`field${error ? ' field-invalid' : ''}`}>
      <label htmlFor={id} className="field-label">
        {label}
        {optional ? <span className="field-optional"> ({t('ui.optional')})</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {error ? (
        <p id={errorId} className="field-error">
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
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
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

export type BannerTone = 'info' | 'success' | 'warning' | 'danger';

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

/** A failed load, with the reason in plain words and a way to try again. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, number } = useI18n();
  const wait = retryAfterOf(error);
  return (
    <div className="state state-error" role="alert">
      <h2 className="state-title">{t('ui.errorTitle')}</h2>
      <p className="state-body">{t(errorMessageKeyOf(error))}</p>
      {wait ? <p className="state-body">{t('console.shell.retryAfter', { seconds: number(wait) })}</p> : null}
      {onRetry ? <Button onClick={onRetry}>{t('ui.retry')}</Button> : null}
    </div>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** Phone numbers always read left to right, even inside Urdu text. */
export function Phone({ value }: { value: string | null | undefined }) {
  if (!value) return <span aria-hidden="true">–</span>;
  return (
    <bdi dir="ltr" className="phone">
      {formatPhone(value)}
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
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
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
    <header className="page-header">
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

/* Tables ----------------------------------------------------------------------------------- */

export interface Column<T> {
  id: string;
  header: string;
  cell(row: T): ReactNode;
  /** The cell that names the row, for screen readers. */
  rowHeader?: boolean;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className="table-wrap" role="region" aria-label={caption} tabIndex={0}>
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.id} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) =>
                c.rowHeader ? (
                  <th key={c.id} scope="row">
                    {c.cell(row)}
                  </th>
                ) : (
                  <td key={c.id}>{c.cell(row)}</td>
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
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
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
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
