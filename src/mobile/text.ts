// Small helpers so one fact is said once: the days circle, the tags and the time chip each own
// their fact, and the one-line reason is trimmed of anything they already show.

const SEP = /\s*·\s*/;
const TIME = /\b\d{1,2}(:\d\d)?\s?(am|pm)\b/i;

/** The reason line without what the card shows elsewhere (days to expiry, OD only / TP only). */
export function cleanWhy(why: any): string {
  const parts = String(why || '').split(SEP).filter((p) => p && !/^(ends in \d+ days?|expired \d+ days?( ago)?|expires (today|tomorrow)|od only|tp only)$/i.test(p.trim()));
  const out = parts.join(' · ');
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : '';
}

/** True when the text already names a clock time ("1 pm", "3:15 pm"). */
export function hasTime(text: any): boolean {
  return TIME.test(String(text || ''));
}
