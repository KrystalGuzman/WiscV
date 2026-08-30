/**
 * model.js — the measurement model behind every number this app reports.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS (read before trusting any output)
 * ---------------------------------------------------------------------------
 * The WISC-V's published raw-score-to-scaled-score norms and its
 * sum-of-scaled-scores-to-composite conversion tables are secure, copyrighted
 * material. They are not reproduced here, and no value in this file was copied
 * from them.
 *
 * Instead, composites are derived from an explicit, inspectable psychometric
 * model: a bifactor structure over the ten primary subtests, plus published
 * subtest reliability coefficients. Every conversion the app performs is a
 * consequence of the constants below, so a reviewer can audit the model rather
 * than take a lookup table on faith.
 *
 * The constants are approximations drawn from the published literature on the
 * WISC-V standardisation sample. They reproduce published composite
 * reliabilities and critical values closely (see docs/METHODOLOGY.md for the
 * side-by-side), but they are an *estimate of* the official tables, not a
 * substitute for them. See `src/core/norms.js` for loading official tables if
 * you are licensed to use them.
 * ---------------------------------------------------------------------------
 */

/** Subtest scaled scores: mean 10, SD 3, reported range 1-19. */
export const SUBTEST_SCALE = Object.freeze({ mean: 10, sd: 3, min: 1, max: 19 });

/**
 * Composite standard scores: mean 100, SD 15.
 * The reported floor/ceiling mirrors the range published composites span.
 */
export const COMPOSITE_SCALE = Object.freeze({ mean: 100, sd: 15, min: 40, max: 160 });

/** The five domains the WISC-V organises its primary subtests into. */
export const DOMAINS = Object.freeze([
  { id: 'vc', name: 'Verbal Comprehension', index: 'VCI' },
  { id: 'vs', name: 'Visual Spatial',       index: 'VSI' },
  { id: 'fr', name: 'Fluid Reasoning',      index: 'FRI' },
  { id: 'wm', name: 'Working Memory',       index: 'WMI' },
  { id: 'ps', name: 'Processing Speed',     index: 'PSI' },
]);

/**
 * The ten primary subtests.
 *
 *   g          general-factor loading
 *   reliability  internal-consistency coefficient (test-retest for the two
 *                speeded Processing Speed subtests, where alpha is not
 *                appropriate)
 *
 * The domain-specific loading is not stored: it is solved for from the
 * within-domain correlation targets below, so the model reproduces those
 * targets exactly rather than approximately.
 */
export const SUBTESTS = Object.freeze([
  { id: 'si', abbr: 'SI', name: 'Similarities',      domain: 'vc', g: 0.66, reliability: 0.87 },
  { id: 'vo', abbr: 'VC', name: 'Vocabulary',        domain: 'vc', g: 0.64, reliability: 0.89 },
  { id: 'bd', abbr: 'BD', name: 'Block Design',      domain: 'vs', g: 0.58, reliability: 0.84 },
  { id: 'vp', abbr: 'VP', name: 'Visual Puzzles',    domain: 'vs', g: 0.60, reliability: 0.87 },
  { id: 'mr', abbr: 'MR', name: 'Matrix Reasoning',  domain: 'fr', g: 0.62, reliability: 0.86 },
  { id: 'fw', abbr: 'FW', name: 'Figure Weights',    domain: 'fr', g: 0.60, reliability: 0.93 },
  { id: 'ds', abbr: 'DS', name: 'Digit Span',        domain: 'wm', g: 0.55, reliability: 0.91 },
  { id: 'pc', abbr: 'PS', name: 'Picture Span',      domain: 'wm', g: 0.48, reliability: 0.85 },
  { id: 'cd', abbr: 'CD', name: 'Coding',            domain: 'ps', g: 0.40, reliability: 0.84 },
  { id: 'ss', abbr: 'SS', name: 'Symbol Search',     domain: 'ps', g: 0.44, reliability: 0.81 },
]);

/**
 * Observed correlation between the two subtests within each domain.
 * These pin down the domain-specific loadings.
 */
export const WITHIN_DOMAIN_CORRELATION = Object.freeze({
  vc: 0.65,
  vs: 0.57,
  fr: 0.48,
  wm: 0.43,
  ps: 0.53,
});

/**
 * Composite definitions. `primary: true` marks the five index scores and the
 * FSIQ that a standard WISC-V report leads with; the rest are ancillary
 * composites, reported separately.
 *
 * Only composites computable from the ten primary subtests are defined. The
 * WISC-V's other ancillary indexes (e.g. AWMI, QRI, VECI) require secondary
 * subtests this app does not collect, so they are deliberately absent rather
 * than silently approximated.
 */
export const COMPOSITES = Object.freeze([
  { id: 'VCI',  name: 'Verbal Comprehension Index', short: 'Verbal Comprehension', subtests: ['si', 'vo'],                         primary: true, domain: 'vc' },
  { id: 'VSI',  name: 'Visual Spatial Index',       short: 'Visual Spatial',       subtests: ['bd', 'vp'],                         primary: true, domain: 'vs' },
  { id: 'FRI',  name: 'Fluid Reasoning Index',      short: 'Fluid Reasoning',      subtests: ['mr', 'fw'],                         primary: true, domain: 'fr' },
  { id: 'WMI',  name: 'Working Memory Index',       short: 'Working Memory',       subtests: ['ds', 'pc'],                         primary: true, domain: 'wm' },
  { id: 'PSI',  name: 'Processing Speed Index',     short: 'Processing Speed',     subtests: ['cd', 'ss'],                         primary: true, domain: 'ps' },
  { id: 'FSIQ', name: 'Full Scale IQ',              short: 'Full Scale IQ',        subtests: ['si', 'vo', 'bd', 'mr', 'fw', 'ds', 'cd'], primary: true },
  { id: 'GAI',  name: 'General Ability Index',      short: 'General Ability',      subtests: ['si', 'vo', 'bd', 'mr', 'fw'] },
  { id: 'CPI',  name: 'Cognitive Proficiency Index',short: 'Cognitive Proficiency',subtests: ['ds', 'pc', 'cd', 'ss'] },
  { id: 'NVI',  name: 'Nonverbal Index',            short: 'Nonverbal',            subtests: ['bd', 'vp', 'mr', 'fw', 'pc', 'cd'] },
]);

/**
 * Index-pair discrepancy comparisons a WISC-V report routinely examines.
 */
export const INDEX_COMPARISONS = Object.freeze([
  ['VCI', 'VSI'], ['VCI', 'FRI'], ['VCI', 'WMI'], ['VCI', 'PSI'],
  ['VSI', 'FRI'], ['VSI', 'WMI'], ['VSI', 'PSI'],
  ['FRI', 'WMI'], ['FRI', 'PSI'],
  ['WMI', 'PSI'],
]);

/** Subtest-pair comparisons: the two subtests making up each index. */
export const SUBTEST_COMPARISONS = Object.freeze([
  ['si', 'vo'], ['bd', 'vp'], ['mr', 'fw'], ['ds', 'pc'], ['cd', 'ss'],
]);

/**
 * Qualitative descriptors for composite standard scores, using the
 * seven-band scheme the WISC-V adopted.
 */
export const COMPOSITE_DESCRIPTORS = Object.freeze([
  { min: 130, max: Infinity, label: 'Extremely High' },
  { min: 120, max: 129,      label: 'Very High' },
  { min: 110, max: 119,      label: 'High Average' },
  { min:  90, max: 109,      label: 'Average' },
  { min:  80, max:  89,      label: 'Low Average' },
  { min:  70, max:  79,      label: 'Very Low' },
  { min: -Infinity, max: 69, label: 'Extremely Low' },
]);

/** The same bands expressed on the subtest scaled-score metric. */
export const SUBTEST_DESCRIPTORS = Object.freeze([
  { min: 16, max: Infinity, label: 'Extremely High' },
  { min: 14, max: 15,       label: 'Very High' },
  { min: 12, max: 13,       label: 'High Average' },
  { min:  8, max: 11,       label: 'Average' },
  { min:  6, max:  7,       label: 'Low Average' },
  { min:  4, max:  5,       label: 'Very Low' },
  { min: -Infinity, max: 3, label: 'Extremely Low' },
]);

// --- Derived structures -----------------------------------------------------

const subtestById = new Map(SUBTESTS.map((s) => [s.id, s]));
const compositeById = new Map(COMPOSITES.map((c) => [c.id, c]));

export function getSubtest(id) {
  const s = subtestById.get(id);
  if (!s) throw new Error(`Unknown subtest id: ${id}`);
  return s;
}

export function getComposite(id) {
  const c = compositeById.get(id);
  if (!c) throw new Error(`Unknown composite id: ${id}`);
  return c;
}

export function subtestsInDomain(domainId) {
  return SUBTESTS.filter((s) => s.domain === domainId);
}

/**
 * Domain-specific ("group factor") loading for each subtest, solved so that the
 * model reproduces WITHIN_DOMAIN_CORRELATION exactly.
 *
 * Under the bifactor model, two subtests in the same domain correlate
 *     r_ij = g_i * g_j + s_i * s_j
 * Each domain here holds exactly two subtests, which leaves s_i and s_j
 * individually unidentified; splitting the residual evenly (s_i = s_j) is the
 * conventional symmetric choice.
 */
export const SPECIFIC_LOADINGS = Object.freeze(buildSpecificLoadings());

function buildSpecificLoadings() {
  const loadings = {};
  for (const domain of DOMAINS) {
    const members = subtestsInDomain(domain.id);
    if (members.length !== 2) {
      throw new Error(
        `Domain ${domain.id} has ${members.length} subtests; the symmetric ` +
        `two-subtest solution below assumes exactly 2.`
      );
    }
    const [a, b] = members;
    const target = WITHIN_DOMAIN_CORRELATION[domain.id];
    const residual = target - a.g * b.g;
    if (residual <= 0) {
      throw new Error(
        `Domain ${domain.id}: within-domain correlation ${target} is not above ` +
        `the general-factor product ${(a.g * b.g).toFixed(3)}; the bifactor ` +
        `model cannot represent it.`
      );
    }
    const s = Math.sqrt(residual);
    for (const member of members) {
      if (member.g ** 2 + s ** 2 > 1) {
        throw new Error(
          `Subtest ${member.abbr}: communality ${(member.g ** 2 + s ** 2).toFixed(3)} ` +
          `exceeds 1, leaving negative unique variance.`
        );
      }
      loadings[member.id] = s;
    }
  }
  return loadings;
}

/**
 * Model-implied correlation between two subtests.
 * Self-correlation is 1 by definition (the reliability enters separately, via
 * the error-variance terms in scoring.js).
 */
export function subtestCorrelation(idA, idB) {
  if (idA === idB) return 1;
  const a = getSubtest(idA);
  const b = getSubtest(idB);
  const common = a.g * b.g;
  const specific = a.domain === b.domain ? SPECIFIC_LOADINGS[idA] * SPECIFIC_LOADINGS[idB] : 0;
  return common + specific;
}

/** Full 10x10 model-implied correlation matrix, in SUBTESTS order. */
export function correlationMatrix(ids = SUBTESTS.map((s) => s.id)) {
  return ids.map((rowId) => ids.map((colId) => subtestCorrelation(rowId, colId)));
}

export function descriptorFor(score, bands) {
  const band = bands.find((b) => score >= b.min && score <= b.max);
  return band ? band.label : '';
}
