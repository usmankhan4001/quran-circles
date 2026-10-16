import en from './en.json';
import ur from './ur.json';

export const messages = { en, ur } as const;
export type MessageKey = Exclude<keyof typeof en, `_${string}`>;
