/**
 * stats.js — small, dependency-free statistical helpers.
 *
 * Everything here is pure: no DOM, no globals, no I/O. The browser UI and the
 * Node test suite import the exact same functions.
 */

/** Standard normal cumulative distribution function. */
export function normalCdf(z) {
  return 0.5 * erfc(-z / Math.SQRT2);
}

/**
 * Complementary error function.
 *
 * Numerical Recipes' `erfc` (Chebyshev fit), accurate to ~1.2e-7 relative —
 * far tighter than anything a score report needs, and short enough to read.
 */
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const poly =
    -1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))));
  const ans = t * Math.exp(-z * z + poly);
  return x >= 0 ? ans : 2 - ans;
}

/**
 * Inverse standard normal CDF (probit), via Acklam's rational approximation
 * refined by one Halley step. Used for confidence-interval z multipliers.
 */
export function normalQuantile(p) {
  if (p <= 0 || p >= 1) throw new RangeError(`normalQuantile: p must be in (0,1), got ${p}`);

  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];

  const pLow = 0.02425;
  let q, r, x;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pLow) {
    q = p - 0.5;
    r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
         ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One Halley refinement step brings it to full double precision.
  const e = 0.5 * erfc(-x / Math.SQRT2) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/**
 * Percentile rank of a standard score, on the normal curve.
 * Clamped to [0.1, 99.9] the way published score reports clamp it — a
 * percentile of "0" or "100" is never a defensible claim.
 */
export function percentileRank(score, mean, sd) {
  const pct = 100 * normalCdf((score - mean) / sd);
  return clamp(pct, 0.1, 99.9);
}

/** Format a percentile the way a report prints it: integers above 1, one decimal below. */
export function formatPercentile(pct) {
  if (pct < 1 || pct > 99) return pct.toFixed(1);
  return String(Math.round(pct));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Sum of a numeric array. */
export function sum(values) {
  return values.reduce((total, v) => total + v, 0);
}

export function mean(values) {
  if (values.length === 0) return NaN;
  return sum(values) / values.length;
}

/**
 * Ordinal suffix for a whole-number percentile ("1st", "2nd", "63rd").
 * Returns null for fractional percentiles, which read better bare.
 */
export function ordinal(n) {
  if (!Number.isInteger(n)) return null;
  const mod100 = Math.abs(n) % 100;
  const mod10 = Math.abs(n) % 10;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}
