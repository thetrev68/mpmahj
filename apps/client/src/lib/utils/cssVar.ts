/**
 * Read a CSS custom property from :root and parse it as a pixel number.
 * Falls back to the provided default if the property is missing or unparseable.
 *
 * Only works for simple values (e.g. "63px", "2px"). Does NOT resolve
 * nested calc(var(...)) expressions — use var() in CSS for those.
 */
export function getCssVarPx(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? fallback : parsed;
}
