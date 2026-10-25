/** One block of a help page: a question with its answer. */
export interface FaqItem {
  question: string;
  answer: readonly string[];
}

export interface HelpBody {
  /** Paragraphs before the first question, or the whole text when there are no questions. */
  intro: readonly string[];
  items: readonly FaqItem[];
}

const QUESTION_END = /[?؟]$/u;

const isQuestion = (p: string): boolean => !p.includes('\n') && QUESTION_END.test(p);

/**
 * Reads the text of a help page edited in the console. Paragraphs are separated by a blank line.
 * A paragraph that is a single line ending in a question mark (`?` or the Urdu `؟`) and has an
 * answer under it is a question; the paragraphs after it, up to the next question, are its
 * answer. Anything else is plain text, so an About page or a short note reads as it was written.
 */
export function parseHelpBody(text: string): HelpBody {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const intro: string[] = [];
  const items: { question: string; answer: string[] }[] = [];
  paragraphs.forEach((p, i) => {
    const next = paragraphs[i + 1];
    const asksSomething = isQuestion(p) && next !== undefined && !isQuestion(next);
    if (asksSomething) {
      items.push({ question: p, answer: [] });
    } else if (items.length === 0) {
      intro.push(p);
    } else {
      items[items.length - 1]!.answer.push(p);
    }
  });
  return { intro, items };
}
