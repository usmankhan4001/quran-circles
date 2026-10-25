import type { Locale } from '@qc/contracts';
import {
  EMAIL_ADDRESSES,
  EMAIL_APP_ORIGIN,
  EMAIL_THEME as T,
  FONT_LATIN,
  FONT_URDU,
} from './config';
import { escapeHtml as h, safeUrl } from './escape';
import { FOOTER, type EmailContent } from './templates';

export interface LayoutOptions {
  /** Base URL for `logo.png`, no trailing slash. */
  assetBaseUrl: string;
}

const LOGO_WIDTH = 150;
const LOGO_HEIGHT = 132;

/** Email clients drop `<style>` blocks now and then, so every rule that matters is also inline. */
const CSS = `
:root { color-scheme: light only; supported-color-schemes: light only; }
body { margin: 0 !important; padding: 0 !important; background-color: ${T.page} !important; }
table { border-collapse: collapse; }
img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
a { color: ${T.green}; }
/* Outlook.com and Outlook apps recolour in their dark theme; these keep the light colours. */
[data-ogsc] .bg-page, [data-ogsb] .bg-page { background-color: ${T.page} !important; }
[data-ogsc] .ink { color: ${T.ink} !important; }
[data-ogsc] .muted { color: ${T.muted} !important; }
[data-ogsc] .green { color: ${T.green} !important; }
[data-ogsb] .bg-green { background-color: ${T.green} !important; }
[data-ogsc] .on-green { color: ${T.onGreen} !important; }
[data-ogsb] .bg-tint { background-color: ${T.tint} !important; }
@media only screen and (max-width: 620px) {
  .container { width: 100% !important; }
  .pad { padding-left: 20px !important; padding-right: 20px !important; }
  .code { font-size: 32px !important; letter-spacing: 6px !important; }
}
`;

interface Face {
  dir: 'ltr' | 'rtl';
  align: 'left' | 'right';
  family: string;
  body: number;
  small: number;
  heading: number;
  lineBody: string;
  lineSmall: string;
}

function face(locale: Locale): Face {
  return locale === 'ur'
    ? {
        dir: 'rtl',
        align: 'right',
        family: FONT_URDU,
        body: 19,
        small: 16,
        heading: 28,
        lineBody: '2.1',
        lineSmall: '2.0',
      }
    : {
        dir: 'ltr',
        align: 'left',
        family: FONT_LATIN,
        body: 16,
        small: 13,
        heading: 26,
        lineBody: '1.6',
        lineSmall: '1.55',
      };
}

const text = (f: Face, size: number, line: string, color: string, weight = 400): string =>
  `font-family:${f.family};font-size:${size}px;line-height:${line};color:${color};font-weight:${weight};`;

/** A button that survives Outlook (VML) and everything else (a padded link in a coloured cell). */
function button(f: Face, label: string, url: string): string {
  const href = safeUrl(url);
  const width = 240;
  const height = 52;
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0"><tr><td align="${f.align}"><table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0;"><tr><td align="center" bgcolor="${T.green}" class="bg-green" style="background-color:${T.green};border-radius:${T.radius}px;">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="23%" strokecolor="${T.green}" fillcolor="${T.green}"><w:anchorlock/><center style="color:${T.onGreen};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${h(label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${href}" target="_blank" class="on-green" style="display:inline-block;min-width:${width - 48}px;padding:15px 24px;border-radius:${T.radius}px;background-color:${T.green};${text(f, f.body, '1.4', T.onGreen, 700)}text-decoration:none;text-align:center;">${h(label)}</a><!--<![endif]-->
</td></tr></table></td></tr></table>`;
}

function detailsCard(f: Face, details: NonNullable<EmailContent['details']>): string {
  const rows = details
    .map(
      (d, i) =>
        `<tr><td align="${f.align}" style="padding:${i === 0 ? 18 : 6}px 20px ${i === details.length - 1 ? 18 : 6}px 20px;text-align:${f.align};"><div class="muted" style="${text(f, f.small, f.lineSmall, T.muted, 600)}">${h(d.label)}</div><div class="ink" style="${text(f, f.body, f.lineBody, T.ink, 600)}">${h(d.value)}</div></td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${T.page}" class="bg-page" style="background-color:${T.page};border:1px solid ${T.border};border-radius:${T.radius}px;">${rows}</table>`;
}

function codeBox(f: Face, code: string): string {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${T.tint}" class="bg-tint" style="background-color:${T.tint};border:1px solid ${T.border};border-radius:${T.radius}px;"><tr><td align="center" style="padding:22px 12px;"><div dir="ltr" class="green code" style="font-family:'SFMono-Regular',Menlo,Consolas,'Courier New',monospace;font-size:38px;line-height:1.2;font-weight:700;letter-spacing:10px;color:${T.green};text-align:center;">${h(code)}</div></td></tr></table>`;
}

export function renderHtml(content: EmailContent, locale: Locale, options: LayoutOptions): string {
  const f = face(locale);
  const foot = FOOTER[locale];
  const para = (s: string): string =>
    `<p class="ink" style="margin:0 0 16px 0;${text(f, f.body, f.lineBody, T.ink)}">${h(s)}</p>`;
  const spacer = (px: number): string =>
    `<div style="height:${px}px;line-height:${px}px;font-size:1px;">&nbsp;</div>`;

  const parts: string[] = [];
  if (content.greeting) parts.push(para(content.greeting));
  parts.push(...content.paragraphs.map(para));
  if (content.code) parts.push(`${spacer(4)}${codeBox(f, content.code)}${spacer(20)}`);
  if (content.details) parts.push(`${detailsCard(f, content.details)}${spacer(24)}`);
  if (content.button)
    parts.push(`${button(f, content.button.label, content.button.url)}${spacer(28)}`);
  parts.push(
    ...content.notes.map(
      (n) =>
        `<p class="muted" style="margin:0 0 12px 0;${text(f, f.small, f.lineSmall, T.muted)}">${h(n)}</p>`,
    ),
  );

  const link = (label: string, url: string): string =>
    `<a href="${safeUrl(url)}" class="green" style="color:${T.green};text-decoration:underline;">${h(label)}</a>`;
  const pad = Array.from({ length: 40 }, () => '&zwnj;&nbsp;').join('');

  return `<!doctype html>
<html lang="${locale}" dir="${f.dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${h(content.subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&amp;display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body class="bg-page" bgcolor="${T.page}" style="margin:0;padding:0;background-color:${T.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${h(content.preheader)}${pad}</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${T.page}" class="bg-page" style="background-color:${T.page};"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="${T.width}" align="center" border="0" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="${T.width}" border="0" cellspacing="0" cellpadding="0" class="container bg-page" bgcolor="${T.page}" style="width:${T.width}px;max-width:${T.width}px;background-color:${T.page};" dir="${f.dir}">
<tr><td class="pad" align="${f.align}" style="padding:8px 32px 8px 32px;text-align:${f.align};"><img src="${h(`${options.assetBaseUrl}/logo.png`)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="Quran Circles" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;border:0;"></td></tr>
<tr><td class="pad" align="${f.align}" style="padding:16px 32px 4px 32px;text-align:${f.align};"><h1 class="ink" style="margin:0;${text(f, f.heading, '1.4', T.ink, 700)}">${h(content.heading)}</h1></td></tr>
<tr><td class="pad" align="${f.align}" style="padding:12px 32px 8px 32px;text-align:${f.align};">${parts.join('\n')}</td></tr>
<tr><td class="pad" style="padding:8px 32px 0 32px;"><div style="border-top:1px solid ${T.border};height:1px;line-height:1px;font-size:1px;">&nbsp;</div></td></tr>
<tr><td class="pad" align="${f.align}" style="padding:16px 32px 24px 32px;text-align:${f.align};"><p class="muted" style="margin:0 0 8px 0;${text(f, f.small, f.lineSmall, T.muted)}">${h(foot.reason)}</p><p class="muted" style="margin:0;${text(f, f.small, f.lineSmall, T.muted)}">${link(foot.support, `mailto:${EMAIL_ADDRESSES.support}`)} &nbsp;·&nbsp; ${link(foot.privacy, `${EMAIL_APP_ORIGIN}/privacy`)}</p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>
`;
}

/** The plain-text version: same words, no layout. */
export function renderPlainText(content: EmailContent, locale: Locale): string {
  const foot = FOOTER[locale];
  const lines: string[] = [content.heading, ''];
  if (content.greeting) lines.push(content.greeting, '');
  for (const p of content.paragraphs) lines.push(p, '');
  if (content.code) lines.push(content.code, '');
  if (content.details) {
    for (const d of content.details) lines.push(`${d.label}: ${d.value}`);
    lines.push('');
  }
  if (content.button) lines.push(`${content.button.label}:`, content.button.url, '');
  for (const n of content.notes) lines.push(n, '');
  lines.push('--', foot.reason);
  lines.push(`${foot.support}: ${EMAIL_ADDRESSES.support}`);
  lines.push(`${foot.privacy}: ${EMAIL_APP_ORIGIN}/privacy`);
  return `${lines.join('\n')}\n`;
}
