import type { Route } from '../../nav/routes';
import type { TranslationKey } from '../../i18n/translate';

/**
 * The public pages Google Play (and anyone without the app) needs: the privacy policy, the
 * delete-account page, help and contact, and the terms. Each is a list of sections of plain
 * blocks, so the words live in `@qc/i18n` (`privacy.*`, `deleteAccount.*`, `support.*`,
 * `terms.*`, `legal.*`) and one renderer (`PublicPage.tsx`) lays them all out.
 */
export type PublicBlock =
  | { kind: 'p'; key: TranslationKey }
  | { kind: 'list'; keys: TranslationKey[] }
  | { kind: 'steps'; keys: TranslationKey[] }
  | { kind: 'faq'; items: { q: TranslationKey; a: TranslationKey }[] }
  | { kind: 'contact' };

export interface PublicSection {
  id: string;
  heading: TranslationKey;
  blocks: PublicBlock[];
}

export type PublicPageId = 'privacy' | 'terms' | 'deleteAccount' | 'support';

export interface PublicPageSpec {
  id: PublicPageId;
  title: TranslationKey;
  intro: TranslationKey;
  /** Shows "Last updated". */
  dated: boolean;
  sections: PublicSection[];
}

const contactSection: PublicSection = {
  id: 'contact',
  heading: 'legal.contact.heading',
  blocks: [{ kind: 'contact' }],
};

export const privacyPage: PublicPageSpec = {
  id: 'privacy',
  title: 'privacy.title',
  intro: 'privacy.intro',
  dated: true,
  sections: [
    { id: 'who', heading: 'privacy.who.heading', blocks: [{ kind: 'p', key: 'privacy.who.body' }] },
    {
      id: 'noaccount',
      heading: 'privacy.noaccount.heading',
      blocks: [{ kind: 'p', key: 'privacy.noaccount.body' }],
    },
    {
      id: 'collect',
      heading: 'privacy.collect.heading',
      blocks: [
        { kind: 'p', key: 'privacy.collect.intro' },
        {
          kind: 'list',
          keys: [
            'privacy.collect.email',
            'privacy.collect.phone',
            'privacy.collect.name',
            'privacy.collect.area',
            'privacy.collect.joins',
            'privacy.collect.follows',
            'privacy.collect.profile',
            'privacy.collect.reading',
            'privacy.collect.device',
            'privacy.collect.signin',
            'privacy.collect.attendance',
          ],
        },
      ],
    },
    {
      id: 'not',
      heading: 'privacy.not.heading',
      blocks: [
        { kind: 'list', keys: ['privacy.not.location', 'privacy.not.device', 'privacy.not.ads'] },
      ],
    },
    {
      id: 'use',
      heading: 'privacy.use.heading',
      blocks: [
        {
          kind: 'list',
          keys: [
            'privacy.use.signin',
            'privacy.use.join',
            'privacy.use.messages',
            'privacy.use.ayah',
            'privacy.use.reading',
            'privacy.use.safe',
          ],
        },
      ],
    },
    {
      id: 'messages',
      heading: 'privacy.messages.heading',
      blocks: [{ kind: 'p', key: 'privacy.messages.body' }],
    },
    {
      id: 'sees',
      heading: 'privacy.sees.heading',
      blocks: [
        { kind: 'list', keys: ['privacy.sees.coordinators'] },
        { kind: 'p', key: 'privacy.sees.providers' },
        {
          kind: 'list',
          keys: [
            'privacy.sees.meta',
            'privacy.sees.email',
            'privacy.sees.google',
            'privacy.sees.browser',
            'privacy.sees.quran',
            'privacy.sees.hosting',
          ],
        },
        { kind: 'list', keys: ['privacy.sees.nobody'] },
      ],
    },
    {
      id: 'keep',
      heading: 'privacy.keep.heading',
      blocks: [
        {
          kind: 'list',
          keys: [
            'privacy.keep.account',
            'privacy.keep.codes',
            'privacy.keep.deleted',
            'privacy.keep.backups',
          ],
        },
      ],
    },
    {
      id: 'choices',
      heading: 'privacy.choices.heading',
      blocks: [
        {
          kind: 'list',
          keys: [
            'privacy.choices.edit',
            'privacy.choices.notify',
            'privacy.choices.signout',
            'privacy.choices.delete',
            'privacy.choices.ask',
          ],
        },
      ],
    },
    {
      id: 'safe',
      heading: 'privacy.safe.heading',
      blocks: [{ kind: 'p', key: 'privacy.safe.body' }],
    },
    {
      id: 'children',
      heading: 'privacy.children.heading',
      blocks: [{ kind: 'p', key: 'privacy.children.body' }],
    },
    {
      id: 'changes',
      heading: 'privacy.changes.heading',
      blocks: [{ kind: 'p', key: 'privacy.changes.body' }],
    },
    contactSection,
  ],
};

export const deleteAccountPage: PublicPageSpec = {
  id: 'deleteAccount',
  title: 'deleteAccount.title',
  intro: 'deleteAccount.intro',
  dated: false,
  sections: [
    {
      id: 'before',
      heading: 'deleteAccount.before.heading',
      blocks: [{ kind: 'p', key: 'deleteAccount.before.body' }],
    },
    {
      id: 'app',
      heading: 'deleteAccount.app.heading',
      blocks: [
        {
          kind: 'steps',
          keys: [
            'deleteAccount.app.step1',
            'deleteAccount.app.step2',
            'deleteAccount.app.step3',
            'deleteAccount.app.step4',
          ],
        },
      ],
    },
    {
      id: 'web',
      heading: 'deleteAccount.web.heading',
      blocks: [
        { kind: 'p', key: 'deleteAccount.web.intro' },
        {
          kind: 'steps',
          keys: ['deleteAccount.web.step1', 'deleteAccount.web.step2', 'deleteAccount.web.step3'],
        },
      ],
    },
    {
      id: 'request',
      heading: 'deleteAccount.request.heading',
      blocks: [{ kind: 'p', key: 'deleteAccount.request.body' }, { kind: 'contact' }],
    },
    {
      id: 'deleted',
      heading: 'deleteAccount.deleted.heading',
      blocks: [
        {
          kind: 'list',
          keys: [
            'deleteAccount.deleted.profile',
            'deleteAccount.deleted.settings',
            'deleteAccount.deleted.reading',
            'deleteAccount.deleted.requests',
            'deleteAccount.deleted.messages',
            'deleteAccount.deleted.codes',
            'deleteAccount.deleted.roles',
          ],
        },
      ],
    },
    {
      id: 'kept',
      heading: 'deleteAccount.kept.heading',
      blocks: [
        {
          kind: 'list',
          keys: [
            'deleteAccount.kept.joins',
            'deleteAccount.kept.totals',
            'deleteAccount.kept.records',
            'deleteAccount.kept.audit',
            'deleteAccount.kept.backups',
          ],
        },
      ],
    },
  ],
};

export const supportPage: PublicPageSpec = {
  id: 'support',
  title: 'support.title',
  intro: 'support.intro',
  dated: false,
  sections: [
    contactSection,
    {
      id: 'faq',
      heading: 'support.faq.heading',
      blocks: [
        {
          kind: 'faq',
          items: [
            { q: 'support.faq.code.q', a: 'support.faq.code.a' },
            { q: 'support.faq.name.q', a: 'support.faq.name.a' },
            { q: 'support.faq.alerts.q', a: 'support.faq.alerts.a' },
            { q: 'support.faq.wrong.q', a: 'support.faq.wrong.a' },
            { q: 'support.faq.delete.q', a: 'support.faq.delete.a' },
          ],
        },
      ],
    },
    {
      id: 'report',
      heading: 'support.report.heading',
      blocks: [{ kind: 'p', key: 'support.report.body' }],
    },
  ],
};

export const termsPage: PublicPageSpec = {
  id: 'terms',
  title: 'terms.title',
  intro: 'terms.intro',
  dated: true,
  sections: [
    {
      id: 'use',
      heading: 'terms.use.heading',
      blocks: [{ kind: 'p', key: 'terms.use.body' }],
    },
    {
      id: 'account',
      heading: 'terms.account.heading',
      blocks: [{ kind: 'p', key: 'terms.account.body' }],
    },
    { id: 'join', heading: 'terms.join.heading', blocks: [{ kind: 'p', key: 'terms.join.body' }] },
    {
      id: 'details',
      heading: 'terms.details.heading',
      blocks: [{ kind: 'p', key: 'terms.details.body' }],
    },
    {
      id: 'conduct',
      heading: 'terms.conduct.heading',
      blocks: [{ kind: 'p', key: 'terms.conduct.body' }],
    },
    {
      id: 'quran',
      heading: 'terms.quran.heading',
      blocks: [{ kind: 'p', key: 'terms.quran.body' }],
    },
    {
      id: 'service',
      heading: 'terms.service.heading',
      blocks: [{ kind: 'p', key: 'terms.service.body' }],
    },
    {
      id: 'privacy',
      heading: 'terms.privacy.heading',
      blocks: [{ kind: 'p', key: 'terms.privacy.body' }],
    },
    {
      id: 'changes',
      heading: 'terms.changes.heading',
      blocks: [{ kind: 'p', key: 'terms.changes.body' }],
    },
    contactSection,
  ],
};

/** The pages a visitor can go on to; the page they are on is left out. */
export const PAGE_LINKS: { id: string; route: Route; label: TranslationKey }[] = [
  { id: 'welcome', route: { name: 'store' }, label: 'legal.links.welcome' },
  { id: 'privacy', route: { name: 'privacy' }, label: 'legal.links.privacy' },
  { id: 'terms', route: { name: 'terms' }, label: 'legal.links.terms' },
  { id: 'deleteAccount', route: { name: 'deleteAccount' }, label: 'legal.links.delete' },
  { id: 'support', route: { name: 'support' }, label: 'legal.links.support' },
];
