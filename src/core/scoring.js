/**
 * scoring.js — the scoring engine.
 *
 * Pure functions over the model in model.js. Given a set of subtest scaled
 * scores, this produces composites, percentiles, confidence intervals,
 * strength/weakness analysis, and discrepancy comparisons.
 *
 * No DOM access, no I/O — the browser UI and the test suite both call in here.
 */

import {
  SUBTESTS, COMPOSITES, COMPOSITE_SCALE, SUBTEST_SCALE,
  COMPOSITE_DESCRIPTORS, SUBTEST_DESCRIPTORS,
  INDEX_COMPARISONS, SUBTEST_COMPARISONS,
  getSubtest, getComposite, subtestCorrelation, descriptorFor,
} from './model.js';
import { percentileRank, normalQuantile, clamp, sum, mean } from './stats.js';

/** Confidence levels a report may be produced at. */
export const CONFIDENCE_LEVELS = Object.freeze([0.90, 0.95]);

/** Significance levels for discrepancy and strength/weakness testing. */
export const SIGNIFICANCE_LEVELS = Object.freeze([0.15, 0.05, 0.01]);

// --- Composite construction -------------------------------------------------

/**
 * Variance of the sum of a set of subtest scaled scores, under the model.
 *
 *   Var(sum) = sigma^2 * sum_i sum_j r_ij
 *
 * with sigma the subtest SD (3). Correlated subtests inflate this above the
 * naive k * sigma^2, which is precisely why a composite's SD is not
 * sigma * sqrt(k).
 */
export function sumVariance(subtestIds) {
  const sigma2 = SUBTEST_SCALE.sd ** 2;
  let total = 0;
  for (const a of subtestIds) {
    for (const b of subtestIds) {
      total += subtestCorrelation(a, b);
    }
  }
  return sigma2 * total;
}

/**
 * Reliability of a composite sum (Mosier's formula for a weighted composite,
 * with unit weights):
 *
 *   rho = 1 - (sum_i sigma_i^2 * (1 - rho_ii)) / Var(sum)
 *
 * i.e. one minus the share of the composite's variance that is measurement
 * error. Deriving this — rather than hardcoding a published coefficient —
 * keeps the reliabilities consistent with the correlations used to build the
 * composite in the first place.
 */
export function compositeReliability(subtestIds) {
  const sigma2 = SUBTEST_SCALE.sd ** 2;
  const errorVariance = sum(subtestIds.map((id) => sigma2 * (1 - getSubtest(id).reliability)));
  return 1 - errorVariance / sumVariance(subtestIds);
}

/**
 * Convert a sum of scaled scores to a composite standard score by linear
 * equating: the sum is placed on the mean-100/SD-15 metric using its own
 * model-implied mean and SD.
 *
 * This is an estimate of the published conversion table, not the table itself.
 * It is close through the middle of the distribution and drifts slightly at
 * the extremes, where the official tables are not perfectly linear.
 */
export function compositeFromSum(subtestIds, sumOfScaledScores) {
  const k = subtestIds.length;
  const expectedSum = k * SUBTEST_SCALE.mean;
  const sdSum = Math.sqrt(sumVariance(subtestIds));
  const raw = COMPOSITE_SCALE.mean +
              COMPOSITE_SCALE.sd * (sumOfScaledScores - expectedSum) / sdSum;
  return clamp(Math.round(raw), COMPOSITE_SCALE.min, COMPOSITE_SCALE.max);
}

/** Standard error of measurement for a composite, on the composite metric. */
export function standardErrorOfMeasurement(reliability, sd = COMPOSITE_SCALE.sd) {
  return sd * Math.sqrt(1 - reliability);
}

/**
 * Confidence interval around a composite score.
 *
 * Two conventions are supported:
 *
 *  - 'true' (default): centred on the estimated true score,
 *      T = mean + rho * (X - mean),   half-width = z * sd * sqrt(rho(1-rho))
 *    This is the convention Wechsler score reports use. It pulls the interval
 *    toward the mean, correctly reflecting regression to the mean.
 *
 *  - 'obtained': centred on the obtained score, half-width = z * SEM.
 *    Simpler, and still seen in the literature.
 */
export function confidenceInterval(score, reliability, level, {
  basis = 'true',
  sd = COMPOSITE_SCALE.sd,
  mean: scaleMean = COMPOSITE_SCALE.mean,
  bounds = [COMPOSITE_SCALE.min, COMPOSITE_SCALE.max],
} = {}) {
  const z = normalQuantile(1 - (1 - level) / 2);
  let centre, halfWidth;

  if (basis === 'obtained') {
    centre = score;
    halfWidth = z * standardErrorOfMeasurement(reliability, sd);
  } else {
    centre = scaleMean + reliability * (score - scaleMean);
    halfWidth = z * sd * Math.sqrt(reliability * (1 - reliability));
  }

  return {
    level,
    basis,
    lower: clamp(Math.round(centre - halfWidth), bounds[0], bounds[1]),
    upper: clamp(Math.round(centre + halfWidth), bounds[0], bounds[1]),
  };
}

// --- Scoring a full protocol ------------------------------------------------

/**
 * Validate a raw scaled-score input. Returns a number, or null when the field
 * is blank. Throws on anything present but unusable, so a typo surfaces
 * immediately rather than propagating into a composite.
 */
export function parseScaledScore(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new RangeError(`Scaled score must be a number, got "${value}"`);
  if (!Number.isInteger(n)) throw new RangeError(`Scaled score must be a whole number, got ${n}`);
  if (n < SUBTEST_SCALE.min || n > SUBTEST_SCALE.max) {
    throw new RangeError(
      `Scaled score must be between ${SUBTEST_SCALE.min} and ${SUBTEST_SCALE.max}, got ${n}`
    );
  }
  return n;
}

/**
 * Score one composite from a map of subtest id -> scaled score.
 * Returns null when any constituent subtest is missing: a composite computed
 * from a partial set would be silently wrong, so it is withheld instead.
 */
export function scoreComposite(compositeId, scaledScores, options = {}) {
  const composite = getComposite(compositeId);
  const missing = composite.subtests.filter((id) => scaledScores[id] == null);
  if (missing.length > 0) {
    return {
      id: composite.id,
      name: composite.name,
      short: composite.short,
      primary: Boolean(composite.primary),
      subtests: composite.subtests,
      complete: false,
      missing,
    };
  }

  const values = composite.subtests.map((id) => scaledScores[id]);
  const sumOfScaledScores = sum(values);
  const score = compositeFromSum(composite.subtests, sumOfScaledScores);
  const reliability = compositeReliability(composite.subtests);
  const sem = standardErrorOfMeasurement(reliability);
  const pct = percentileRank(score, COMPOSITE_SCALE.mean, COMPOSITE_SCALE.sd);

  const intervals = {};
  for (const level of CONFIDENCE_LEVELS) {
    intervals[level] = confidenceInterval(score, reliability, level, options);
  }

  return {
    id: composite.id,
    name: composite.name,
    short: composite.short,
    primary: Boolean(composite.primary),
    subtests: composite.subtests,
    complete: true,
    missing: [],
    sumOfScaledScores,
    score,
    reliability,
    sem,
    percentile: pct,
    descriptor: descriptorFor(score, COMPOSITE_DESCRIPTORS),
    intervals,
  };
}

/**
 * Replace a composite's model-estimated score with an official one from a
 * loaded conversion table.
 *
 * Everything derived from the score moves with it: percentile, descriptor and
 * both confidence intervals are recomputed. Reporting an official score beside
 * a percentile derived from a different number would be worse than not
 * substituting at all.
 *
 * Reliability and SEM are kept from the model, since a conversion table does
 * not supply them. Mutates and returns the composite.
 */
export function applyOfficialScore(composite, officialScore, options = {}) {
  if (!composite.complete || officialScore == null) return composite;

  composite.score = officialScore;
  composite.source = 'official';
  composite.percentile = percentileRank(officialScore, COMPOSITE_SCALE.mean, COMPOSITE_SCALE.sd);
  composite.descriptor = descriptorFor(officialScore, COMPOSITE_DESCRIPTORS);
  for (const level of CONFIDENCE_LEVELS) {
    composite.intervals[level] = confidenceInterval(
      officialScore, composite.reliability, level, options
    );
  }
  return composite;
}

/**
 * Strength / weakness analysis.
 *
 * Each subtest is compared against the mean of a reference set (conventionally
 * either the seven FSIQ subtests or all ten primary subtests). The standard
 * error of the deviation accounts for the fact that the subtest is itself part
 * of the mean it is being compared to:
 *
 *   X_i - M = (1 - 1/k) X_i - (1/k) sum_{j != i} X_j
 *   SE^2    = sigma^2 [ (1 - 1/k)^2 u_i + (1/k^2) sum_{j != i} u_j ]
 *
 * with u_j = 1 - rho_jj the unique (error) variance proportion.
 */
export function strengthsAndWeaknesses(scaledScores, referenceIds, alpha = 0.05) {
  const present = referenceIds.filter((id) => scaledScores[id] != null);
  if (present.length < 2) return { referenceMean: null, alpha, entries: [] };

  const k = present.length;
  const referenceMean = mean(present.map((id) => scaledScores[id]));
  const z = normalQuantile(1 - alpha / 2);
  const sigma2 = SUBTEST_SCALE.sd ** 2;
  const unique = Object.fromEntries(present.map((id) => [id, 1 - getSubtest(id).reliability]));

  const entries = present.map((id) => {
    const othersUnique = sum(present.filter((o) => o !== id).map((o) => unique[o]));
    const seSquared = sigma2 * ((1 - 1 / k) ** 2 * unique[id] + othersUnique / k ** 2);
    const se = Math.sqrt(seSquared);
    const critical = z * se;
    const deviation = scaledScores[id] - referenceMean;

    let verdict = 'Within normal limits';
    if (Math.abs(deviation) >= critical) verdict = deviation > 0 ? 'Strength' : 'Weakness';

    return {
      subtestId: id,
      abbr: getSubtest(id).abbr,
      name: getSubtest(id).name,
      score: scaledScores[id],
      deviation,
      standardError: se,
      criticalValue: critical,
      significant: Math.abs(deviation) >= critical,
      verdict,
    };
  });

  return { referenceMean, referenceIds: present, alpha, entries };
}

/**
 * Pairwise composite discrepancy comparison.
 * The standard error of the difference treats the two composites' measurement
 * errors as independent: SE_diff = sqrt(SEM_a^2 + SEM_b^2).
 */
export function compareComposites(a, b, alpha = 0.05) {
  const seDiff = Math.sqrt(a.sem ** 2 + b.sem ** 2);
  const critical = normalQuantile(1 - alpha / 2) * seDiff;
  const difference = a.score - b.score;
  return {
    pair: [a.id, b.id],
    labels: [a.short, b.short],
    scores: [a.score, b.score],
    difference,
    standardError: seDiff,
    criticalValue: critical,
    alpha,
    significant: Math.abs(difference) >= critical,
    direction: difference === 0 ? 'equal' : (difference > 0 ? `${a.id} > ${b.id}` : `${b.id} > ${a.id}`),
  };
}

/** Pairwise subtest comparison, on the scaled-score metric. */
export function compareSubtests(idA, idB, scaledScores, alpha = 0.05) {
  const a = getSubtest(idA);
  const b = getSubtest(idB);
  if (scaledScores[idA] == null || scaledScores[idB] == null) return null;

  const seDiff = SUBTEST_SCALE.sd * Math.sqrt((1 - a.reliability) + (1 - b.reliability));
  const critical = normalQuantile(1 - alpha / 2) * seDiff;
  const difference = scaledScores[idA] - scaledScores[idB];

  return {
    pair: [idA, idB],
    labels: [a.abbr, b.abbr],
    names: [a.name, b.name],
    scores: [scaledScores[idA], scaledScores[idB]],
    difference,
    standardError: seDiff,
    criticalValue: critical,
    alpha,
    significant: Math.abs(difference) >= critical,
  };
}

/**
 * Score a complete protocol.
 *
 * @param {Object} scaledScores  map of subtest id -> scaled score (or null)
 * @param {Object} options
 * @param {number} options.alpha            significance level for comparisons
 * @param {'true'|'obtained'} options.basis confidence-interval convention
 * @param {'fsiq'|'primary'} options.swReference  reference set for strengths/weaknesses
 */
export function scoreProtocol(scaledScores, options = {}) {
  const { alpha = 0.05, basis = 'true', swReference = 'fsiq' } = options;

  const subtests = SUBTESTS.map((s) => {
    const score = scaledScores[s.id] ?? null;
    return {
      id: s.id,
      abbr: s.abbr,
      name: s.name,
      domain: s.domain,
      reliability: s.reliability,
      score,
      percentile: score == null ? null : percentileRank(score, SUBTEST_SCALE.mean, SUBTEST_SCALE.sd),
      descriptor: score == null ? null : descriptorFor(score, SUBTEST_DESCRIPTORS),
    };
  });

  const composites = {};
  for (const c of COMPOSITES) {
    composites[c.id] = scoreComposite(c.id, scaledScores, { basis });
  }

  const referenceIds = swReference === 'primary'
    ? SUBTESTS.map((s) => s.id)
    : getComposite('FSIQ').subtests;

  const indexComparisons = INDEX_COMPARISONS
    .filter(([x, y]) => composites[x].complete && composites[y].complete)
    .map(([x, y]) => compareComposites(composites[x], composites[y], alpha));

  const subtestComparisons = SUBTEST_COMPARISONS
    .map(([x, y]) => compareSubtests(x, y, scaledScores, alpha))
    .filter(Boolean);

  return {
    subtests,
    composites,
    strengthsAndWeaknesses: strengthsAndWeaknesses(scaledScores, referenceIds, alpha),
    indexComparisons,
    subtestComparisons,
    options: { alpha, basis, swReference },
    completeness: {
      entered: subtests.filter((s) => s.score != null).length,
      total: SUBTESTS.length,
    },
  };
}
