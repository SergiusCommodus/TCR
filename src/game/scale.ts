/**
 * Uniform scale factors behind every population and materiel figure in the
 * game — INITIAL_STATE, daily upkeep, tax policy modifiers, every event and
 * focus effect, ship and troop training costs, all of it. Each literal
 * elsewhere in the codebase is simply `oldPlaceholderValue * POP_SCALE` (for
 * population) or `oldPlaceholderValue * MAT_SCALE` (for materiel) — the same
 * relative sizes and ratios the old abstract numbers had, just landing at a
 * believable interstellar-nation scale: population in the millions to
 * billions, materiel — the Republic's war treasury — in the hundreds of
 * millions to low billions early on, growing from there. No balance logic or
 * turn pacing changes with the rescale; retuning either constant rescales
 * the whole game uniformly, the same way it always could.
 *
 * Lives in its own module, not state.ts, purely to avoid a circular import:
 * events.ts, occupation.ts, focuses.ts, ships.ts and troops.ts all need
 * these constants to scale their own literals, and state.ts already imports
 * from every one of them.
 */
export const POP_SCALE = 1_000_000;
export const MAT_SCALE = 10_000_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Formats a large magnitude with a K/M/B/T suffix — "1.2B", "340M" — one
 *  decimal place, dropped when it would just be a trailing ".0". Shared by
 *  population and materiel display; below 1,000 there's nothing left in the
 *  game at that scale, but it's shown as a plain rounded integer regardless
 *  so the function stays honest at the edges. */
export function formatMagnitude(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);

  const withSuffix = (value: number, suffix: string) => {
    const rounded = round1(value);
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${sign}${text}${suffix}`;
  };

  if (abs >= 1e12) return withSuffix(abs / 1e12, 'T');
  if (abs >= 1e9) return withSuffix(abs / 1e9, 'B');
  if (abs >= 1e6) return withSuffix(abs / 1e6, 'M');
  if (abs >= 1e3) return withSuffix(abs / 1e3, 'K');
  return `${sign}${Math.round(abs)}`;
}

/** Population, formatted as a plain magnitude — "9.4B", "40M" — an alias of
 *  formatMagnitude kept separate so call sites read as what they're
 *  formatting, not just how. */
export function formatPopulation(n: number): string {
  return formatMagnitude(n);
}

/** Materiel, formatted as a monetary value — "$1.2B", "-$25M" — the sign (if
 *  any) leads the whole thing, ahead of the currency symbol. */
export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${formatMagnitude(Math.abs(n))}`;
}
