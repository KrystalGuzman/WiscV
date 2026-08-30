/**
 * reference.js — the reference distribution used to convert practice-test raw
 * scores into scaled scores.
 *
 * ===========================================================================
 * READ THIS BEFORE INTERPRETING ANY SCORE FROM THE PRACTICE TEST
 * ===========================================================================
 * These are NOT norms. There is no standardisation sample behind them.
 *
 * The WISC-V's norms come from a stratified sample of roughly 2,200 children,
 * with separate tables for each four-month age band. Nothing of that kind
 * exists here and none of it is reproduced. What follows are *design
 * estimates*: for each subtest, the raw-score mean and SD an unimpaired adult
 * or older adolescent might plausibly obtain, inferred from the item count,
 * the intended difficulty gradient, and the time limits.
 *
 * The consequences, stated plainly:
 *
 *  1. A scaled score from the practice test says how you did relative to these
 *     *assumed* parameters, not relative to any real population.
 *  2. There is no age correction. A single reference distribution is applied
 *     to everyone, so results are not comparable across ages the way real
 *     scaled scores are.
 *  3. If an estimate below is wrong, every score on that subtest shifts with
 *     it. A mean set two points low inflates everyone's scaled score.
 *  4. The forced-choice format of the verbal subtests makes them recognition
 *     tasks rather than recall tasks, which is easier than the open-ended
 *     format they are modelled on.
 *
 * The output is a practice-test profile. It is not an IQ, not a WISC-V score,
 * and carries no clinical meaning whatsoever.
 *
 * Every parameter is exposed here precisely so it can be argued with. If you
 * collect real data with this instrument, recalibrate `mean` and `sd` from it
 * and the conversions improve immediately.
 * ===========================================================================
 */

import { SUBTEST_SCALE } from '../core/model.js';

/**
 * Per-subtest raw-score parameters.
 *
 *   maxRaw  the highest raw score the subtest can yield
 *   mean    estimated reference mean
 *   sd      estimated reference standard deviation
 *   basis   why those numbers, so the estimate can be checked
 */
export const REFERENCE_DISTRIBUTIONS = Object.freeze({
  si: {
    maxRaw: 28, mean: 19, sd: 4.5,
    basis: '14 items at 0/1/2. Early items are near-ceiling; the 2-point ' +
           'response requires naming a category rather than a shared property.',
  },
  vo: {
    maxRaw: 32, mean: 22, sd: 5.0,
    basis: '16 items at 0/1/2. The difficulty gradient runs from concrete ' +
           'nouns to low-frequency adjectives, so the upper items separate.',
  },
  bd: {
    maxRaw: 52, mean: 26, sd: 8.0,
    basis: '3 two-by-two items at 4 points, 5 three-by-three items at 4 points ' +
           'plus up to 4 for speed. Most of the variance is the speed bonus.',
  },
  vp: {
    maxRaw: 10, mean: 6, sd: 2.2,
    basis: '10 items, 1 point each, 30s limit. Chance alone yields 0.5 items ' +
           'across the test, so the floor is close to zero.',
  },
  mr: {
    maxRaw: 14, mean: 9, sd: 3.0,
    basis: '14 items, 1 point each, five options. Difficulty rises with the ' +
           'number of attributes varying at once.',
  },
  fw: {
    maxRaw: 14, mean: 9, sd: 3.0,
    basis: '14 items, 1 point each. Later items require chaining two ' +
           'equivalences rather than applying one.',
  },
  ds: {
    maxRaw: 44, mean: 26, sd: 5.0,
    basis: 'Forward spans 2-9, backward 2-8, sequencing 2-8, two trials each. ' +
           'Typical adult spans are around 7 forward and 5 backward.',
  },
  pc: {
    maxRaw: 20, mean: 12, sd: 4.0,
    basis: '10 trials at 0/1/2, spans of 2 to 6 symbols. Partial credit for ' +
           'the right set in the wrong order.',
  },
  cd: {
    maxRaw: 140, mean: 62, sd: 15.0,
    basis: '120 seconds of symbol-digit substitution. Rate is roughly one ' +
           'item every two seconds once the key is learned.',
  },
  ss: {
    maxRaw: 60, mean: 35, sd: 9.0,
    basis: '120 seconds of visual search, scored correct minus incorrect so ' +
           'that guessing is not rewarded.',
  },
});

/**
 * Convert a raw score to a scaled score against the reference distribution.
 *
 * Standard linear transformation onto the mean-10/SD-3 metric, clamped to
 * 1-19. This assumes raw scores are normally distributed, which for a short
 * test with a hard ceiling is an approximation — scores near the maximum are
 * compressed in reality and this conversion does not model that.
 */
export function rawToScaledScore(subtestId, rawScore) {
  const reference = REFERENCE_DISTRIBUTIONS[subtestId];
  if (!reference) throw new Error(`No reference distribution for subtest: ${subtestId}`);
  if (rawScore == null) return null;

  const z = (rawScore - reference.mean) / reference.sd;
  const scaled = Math.round(SUBTEST_SCALE.mean + SUBTEST_SCALE.sd * z);
  return Math.min(SUBTEST_SCALE.max, Math.max(SUBTEST_SCALE.min, scaled));
}

/**
 * The raw score that would map to a given scaled score. Used to show an
 * examinee where the reference mean sat relative to their own performance.
 */
export function scaledToRawScore(subtestId, scaledScore) {
  const reference = REFERENCE_DISTRIBUTIONS[subtestId];
  if (!reference) throw new Error(`No reference distribution for subtest: ${subtestId}`);
  const z = (scaledScore - SUBTEST_SCALE.mean) / SUBTEST_SCALE.sd;
  return reference.mean + z * reference.sd;
}

/**
 * The highest scaled score each subtest can actually yield.
 *
 * A short test cannot discriminate at the top of the range: 14 items with a
 * reference SD of 3 raw points puts a perfect score under +2 SD, so no amount
 * of ability can produce a scaled 19 there. Reporting these alongside the
 * profile stops a capped score being read as a real one.
 */
export function scaledCeilings() {
  return Object.fromEntries(
    Object.entries(REFERENCE_DISTRIBUTIONS).map(([id, reference]) => [
      id, rawToScaledScore(id, reference.maxRaw),
    ])
  );
}
