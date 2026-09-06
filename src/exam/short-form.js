/**
 * short-form.js — the condensed battery.
 *
 * The full test runs ten subtests over 25-35 minutes. Tried with real children
 * that turned out to be too much: attention goes long before the battery does,
 * and a score collected from a tired or overwhelmed child measures the tiredness.
 *
 * This is a shorter form, about twelve minutes, built on the same engine.
 *
 * ---------------------------------------------------------------------------
 * WHAT WAS CUT, AND WHAT IT COSTS
 * ---------------------------------------------------------------------------
 * One subtest per area instead of two. All five areas stay represented, because
 * the shape of the profile across areas is the most useful thing the report
 * produces and dropping an area would remove it entirely.
 *
 * The cost is real and unavoidable: an area measured by one subtest is far less
 * reliable than one measured by two. A single subtest also carries its own
 * task-specific quirks with nothing to average them out — a child who dislikes
 * being timed will look weak on Processing Speed here, where the full form
 * would show it on both Coding and Symbol Search or on neither.
 *
 * So these are reported as *estimates* with their own names and wider intervals,
 * never as the index scores the full form produces. Where a result matters,
 * the full form is the one to use.
 * ---------------------------------------------------------------------------
 *
 * Subtests are chosen for reliability within their area, except where another
 * consideration outweighs it — see SHORT_FORM_CHOICES below, which records the
 * reason for each pick, including the one case that is deliberately not the
 * most reliable option.
 */

import { REFERENCE_DISTRIBUTIONS } from './reference.js';

/**
 * Why each subtest was picked, recorded rather than described in prose so the
 * reasoning can be checked against the model instead of taken on trust.
 *
 * `mostReliable` says whether this is the more reliable of the two in its area.
 * Fluid Reasoning is the deliberate exception, and the reason is written down.
 */
export const SHORT_FORM_CHOICES = Object.freeze({
  vo: { mostReliable: true, why: 'The more reliable of the two verbal subtests, and the conventional short-form choice.' },
  bd: { mostReliable: false, why: 'Marginally behind Visual Puzzles on reliability, but it is the hands-on task and holds attention far better — which is the whole point of a short form.' },
  mr: { mostReliable: false, why: 'Figure Weights is more reliable (.93 against .86), but it requires understanding balance scales and doing arithmetic. That is a heavy instruction load for a child who is already flagging, and it confounds reasoning with numeracy. Matrix Reasoning asks only "which one goes here".' },
  ds: { mostReliable: true, why: 'The most reliable subtest in the battery, and it needs no instructions beyond listening.' },
  cd: { mostReliable: true, why: 'The more reliable speeded subtest, and the conventional processing-speed short-form choice.' },
});

/** The five subtests, in administration order. */
export const SHORT_FORM_SUBTESTS = Object.freeze(['vo', 'bd', 'mr', 'ds', 'cd']);

/**
 * How much of each subtest the short form administers.
 *
 *   items      how many are presented (or the seconds, for a timed block)
 *   maxRaw     the highest raw score attainable in the shortened version
 *   kind       'items' scales as a sum of correlated items; 'rate' scales with
 *              time, because the score is a count produced at a steady rate
 */
export const SHORT_FORM_PLAN = Object.freeze({
  vo: { items: 8, maxRaw: 16, kind: 'items', note: 'Every other difficulty tier, so the full range is still spanned.' },
  bd: { items: 4, maxRaw: 24, kind: 'items', note: 'Two 2x2 patterns, then two 3x3 with the speed bonus.' },
  mr: { items: 8, maxRaw: 8, kind: 'items', note: 'One, two and three-rule items in the same proportion as the full form.' },
  ds: { items: 18, maxRaw: 18, kind: 'items', note: 'Forward to span 6 and backward to span 5. Sequencing is dropped.' },
  cd: { seconds: 60, maxRaw: 70, kind: 'rate', note: 'Sixty seconds instead of a hundred and twenty.' },
});

/**
 * Average correlation between items within a subtest.
 *
 * Used only to work out how a raw-score standard deviation shrinks when a
 * subtest is shortened. Items within a subtest measure the same thing, so they
 * correlate substantially; 0.3 is a conventional figure for that and the
 * derived numbers are not sensitive to it within the plausible range.
 */
const INTER_ITEM_CORRELATION = 0.3;

/**
 * The reference distribution for the shortened version of a subtest, derived
 * from the full one rather than invented separately.
 *
 * The mean scales with the proportion of the subtest retained: half the items,
 * half the expected raw score.
 *
 * The standard deviation does not scale the same way, and the difference
 * matters. For a sum of k correlated items the variance goes as
 * k(1 + (k-1)r), so halving the items cuts the SD by rather more than half.
 * Treating it as proportional would make short-form scores look far more
 * extreme than they are — a raw score one point above average would come out
 * as a scaled 12 rather than an 11.
 *
 * A timed subtest is different again: its score is a count accumulated at a
 * roughly constant rate, so both mean and SD scale directly with time.
 */
export function shortFormReference(subtestId) {
  const full = REFERENCE_DISTRIBUTIONS[subtestId];
  const plan = SHORT_FORM_PLAN[subtestId];
  if (!full || !plan) throw new Error(`No short-form plan for subtest: ${subtestId}`);

  const ratio = plan.maxRaw / full.maxRaw;
  const mean = full.mean * ratio;

  let sd;
  if (plan.kind === 'rate') {
    sd = full.sd * ratio;
  } else {
    const spread = (k) => k * (1 + (k - 1) * INTER_ITEM_CORRELATION);
    const fullItems = fullItemCount(subtestId);
    sd = full.sd * Math.sqrt(spread(plan.items) / spread(fullItems));
  }

  return {
    maxRaw: plan.maxRaw,
    mean: Math.round(mean * 100) / 100,
    sd: Math.round(sd * 100) / 100,
    basis:
      `Derived from the full-form estimate (mean ${full.mean}, SD ${full.sd} out of ` +
      `${full.maxRaw}) by retaining ${(100 * ratio).toFixed(0)}% of the subtest. ` +
      plan.note,
  };
}

/** How many scoreable units the full form presents for a subtest. */
function fullItemCount(subtestId) {
  return { vo: 16, bd: 8, mr: 14, ds: 44, cd: 140 }[subtestId];
}

/** Every short-form reference, keyed by subtest. */
export const SHORT_FORM_REFERENCE = Object.freeze(
  Object.fromEntries(SHORT_FORM_SUBTESTS.map((id) => [id, shortFormReference(id)]))
);

/** Convert a short-form raw score to a scaled score. */
export function shortFormRawToScaled(subtestId, rawScore) {
  const reference = SHORT_FORM_REFERENCE[subtestId];
  if (!reference) throw new Error(`No short-form reference for subtest: ${subtestId}`);
  if (rawScore == null) return null;

  const z = (rawScore - reference.mean) / reference.sd;
  return Math.min(19, Math.max(1, Math.round(10 + 3 * z)));
}

/**
 * The composites the short form reports.
 *
 * Deliberately named and identified differently from the full form's indexes.
 * A number built from one subtest is not a VCI, and giving it that label would
 * invite exactly the comparison it cannot support.
 */
export const SHORT_FORM_COMPOSITES = Object.freeze([
  { id: 'GEN', name: 'Overall Estimate', short: 'Overall', subtests: ['vo', 'bd', 'mr', 'ds', 'cd'], primary: true },
  { id: 'VCE', name: 'Verbal Comprehension estimate', short: 'Verbal Comprehension', subtests: ['vo'], primary: true, domain: 'vc' },
  { id: 'VSE', name: 'Visual Spatial estimate', short: 'Visual Spatial', subtests: ['bd'], primary: true, domain: 'vs' },
  { id: 'FRE', name: 'Fluid Reasoning estimate', short: 'Fluid Reasoning', subtests: ['mr'], primary: true, domain: 'fr' },
  { id: 'WME', name: 'Working Memory estimate', short: 'Working Memory', subtests: ['ds'], primary: true, domain: 'wm' },
  { id: 'PSE', name: 'Processing Speed estimate', short: 'Processing Speed', subtests: ['cd'], primary: true, domain: 'ps' },
]);

/** Area-pair comparisons for the short form. */
export const SHORT_FORM_COMPARISONS = Object.freeze([
  ['VCE', 'VSE'], ['VCE', 'FRE'], ['VCE', 'WME'], ['VCE', 'PSE'],
  ['VSE', 'FRE'], ['VSE', 'WME'], ['VSE', 'PSE'],
  ['FRE', 'WME'], ['FRE', 'PSE'],
  ['WME', 'PSE'],
]);

/** Roughly how long the short form takes, in minutes, for the welcome screen. */
export const SHORT_FORM_MINUTES = Object.freeze({ low: 10, high: 15 });
