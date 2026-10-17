import { useI18n } from '../i18n';
import { creditGroups } from '../lib/ui-tokens';

/**
 * The short credits area at the foot of every signed-in page: the bundled fonts and their
 * licences, the Quran text and the translations. The list is the same one the user app shows
 * on its About and credits screen (`creditGroups` in `@qc/ui`).
 */
export function CreditsFooter() {
  const { t } = useI18n();
  return (
    <footer className="credits" aria-label={t('credits.title')}>
      <details>
        <summary>{t('credits.console.heading')}</summary>
        <p className="credits-intro">{t('credits.intro')}</p>
        {creditGroups.map((group) => (
          <section key={group.id} className="credits-group" aria-labelledby={`credits-${group.id}`}>
            <h2 id={`credits-${group.id}`}>{t(group.heading)}</h2>
            <ul>
              {group.entries.map((entry) => (
                <li key={entry.id} data-testid={`credit-${entry.id}`}>
                  <span className="credits-name">{t(entry.name)}</span>
                  <span>{t(entry.body)}</span>
                  {entry.link ? (
                    <a href={entry.link.url} target="_blank" rel="noopener noreferrer">
                      {t(entry.link.label)}
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </details>
    </footer>
  );
}
