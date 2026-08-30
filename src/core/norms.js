/**
 * norms.js — optional support for user-supplied normative tables.
 *
 * The app works out of the box from scaled scores, using the model in
 * model.js. This module lets someone who is *licensed to use the official
 * WISC-V norms* supply those tables so the app converts raw scores by age and
 * uses the official sum-to-composite conversions instead of the model estimate.
 *
 * No normative data ships with this repository. `data/norms-template.json`
 * documents the expected shape with obviously-synthetic placeholder values.
 *
 * Loaded tables live only in the browser tab that loaded them: nothing here
 * writes to disk or sends data anywhere.
 */

import { SUBTESTS, COMPOSITES, SUBTEST_SCALE, COMPOSITE_SCALE } from './model.js';

const SUBTEST_IDS = new Set(SUBTESTS.map((s) => s.id));
const COMPOSITE_IDS = new Set(COMPOSITES.map((c) => c.id));

/**
 * Validate a parsed norms object.
 * Returns { valid, errors, warnings, norms } — errors block loading,
 * warnings do not.
 */
export function validateNorms(data) {
  const errors = [];
  const warnings = [];

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Norms file must be a JSON object.'], warnings: [] };
  }
  if (typeof data.version !== 'number') {
    errors.push('Missing numeric "version" field.');
  }

  // --- Age bands -----------------------------------------------------------
  const bands = data.ageBands;
  if (bands !== undefined) {
    if (!Array.isArray(bands) || bands.length === 0) {
      errors.push('"ageBands" must be a non-empty array.');
    } else {
      bands.forEach((band, i) => {
        const where = `ageBands[${i}]`;
        if (typeof band.id !== 'string' || band.id === '') errors.push(`${where}: missing "id".`);
        if (!Number.isFinite(band.minMonths) || !Number.isFinite(band.maxMonths)) {
          errors.push(`${where}: "minMonths" and "maxMonths" must be numbers.`);
        } else if (band.minMonths > band.maxMonths) {
          errors.push(`${where}: minMonths (${band.minMonths}) exceeds maxMonths (${band.maxMonths}).`);
        }
        validateRawTables(band, where, errors, warnings);
      });
      checkBandCoverage(bands, warnings);
    }
  }

  // --- Composite conversion tables ----------------------------------------
  if (data.compositeTables !== undefined) {
    if (typeof data.compositeTables !== 'object' || data.compositeTables === null) {
      errors.push('"compositeTables" must be an object keyed by composite id.');
    } else {
      for (const [id, table] of Object.entries(data.compositeTables)) {
        if (!COMPOSITE_IDS.has(id)) {
          warnings.push(`compositeTables: unknown composite "${id}" ignored.`);
          continue;
        }
        validateLookupTable(
          table, `compositeTables.${id}`,
          COMPOSITE_SCALE.min, COMPOSITE_SCALE.max, errors
        );
      }
    }
  }

  if (data.ageBands === undefined && data.compositeTables === undefined) {
    errors.push('Norms file contains neither "ageBands" nor "compositeTables"; nothing to load.');
  }

  return { valid: errors.length === 0, errors, warnings, norms: data };
}

function validateRawTables(band, where, errors, warnings) {
  if (band.subtests === undefined) return;
  if (typeof band.subtests !== 'object' || band.subtests === null) {
    errors.push(`${where}.subtests must be an object keyed by subtest id.`);
    return;
  }
  for (const [id, table] of Object.entries(band.subtests)) {
    if (!SUBTEST_IDS.has(id)) {
      warnings.push(`${where}.subtests: unknown subtest "${id}" ignored.`);
      continue;
    }
    validateLookupTable(
      table, `${where}.subtests.${id}`,
      SUBTEST_SCALE.min, SUBTEST_SCALE.max, errors
    );
  }
}

/**
 * A lookup table maps an input total to an output score. It is expressed as an
 * array of { max, score } rungs: the first rung whose `max` is at or above the
 * input wins. This is how published norms tables are laid out — bands of raw
 * scores collapsing onto one scaled score — so it transcribes directly.
 */
function validateLookupTable(table, where, outMin, outMax, errors) {
  if (!Array.isArray(table) || table.length === 0) {
    errors.push(`${where} must be a non-empty array of {max, score} entries.`);
    return;
  }
  let previousMax = -Infinity;
  table.forEach((entry, i) => {
    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${where}[${i}] must be an object.`);
      return;
    }
    if (!Number.isFinite(entry.max)) {
      errors.push(`${where}[${i}]: "max" must be a number.`);
    } else if (entry.max <= previousMax) {
      errors.push(`${where}[${i}]: "max" (${entry.max}) must increase monotonically.`);
    } else {
      previousMax = entry.max;
    }
    if (!Number.isFinite(entry.score)) {
      errors.push(`${where}[${i}]: "score" must be a number.`);
    } else if (entry.score < outMin || entry.score > outMax) {
      errors.push(`${where}[${i}]: score ${entry.score} outside valid range ${outMin}-${outMax}.`);
    }
  });
}

/** Warn about gaps and overlaps between age bands, which usually mean a typo. */
function checkBandCoverage(bands, warnings) {
  const sorted = [...bands]
    .filter((b) => Number.isFinite(b.minMonths) && Number.isFinite(b.maxMonths))
    .sort((a, b) => a.minMonths - b.minMonths);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.minMonths <= prev.maxMonths) {
      warnings.push(`Age bands "${prev.id}" and "${curr.id}" overlap; the first match wins.`);
    } else if (curr.minMonths > prev.maxMonths + 1) {
      warnings.push(`Gap in age coverage between "${prev.id}" and "${curr.id}".`);
    }
  }
}

/** Find the age band covering an age in months, or null. */
export function findAgeBand(norms, ageInMonths) {
  if (!norms?.ageBands) return null;
  return norms.ageBands.find(
    (b) => ageInMonths >= b.minMonths && ageInMonths <= b.maxMonths
  ) ?? null;
}

/** Look a value up in a {max, score} table. Returns null if past the top rung. */
export function lookup(table, value) {
  if (!Array.isArray(table)) return null;
  for (const entry of table) {
    if (value <= entry.max) return entry.score;
  }
  return null;
}

/**
 * Convert a raw score to a scaled score for a given subtest and age.
 * Returns null when no loaded table covers that subtest at that age.
 */
export function rawToScaled(norms, subtestId, rawScore, ageInMonths) {
  const band = findAgeBand(norms, ageInMonths);
  const table = band?.subtests?.[subtestId];
  if (!table) return null;
  return lookup(table, rawScore);
}

/**
 * Official sum-of-scaled-scores to composite conversion, when a table for that
 * composite has been loaded. Returns null otherwise, and the caller falls back
 * to the model estimate.
 */
export function sumToComposite(norms, compositeId, sumOfScaledScores) {
  const table = norms?.compositeTables?.[compositeId];
  if (!table) return null;
  return lookup(table, sumOfScaledScores);
}

/** Age in whole months between two dates, as psychological reports compute it. */
export function ageInMonths(birthDate, testDate) {
  const b = new Date(birthDate);
  const t = new Date(testDate);
  if (Number.isNaN(b.getTime()) || Number.isNaN(t.getTime())) return null;
  if (t < b) return null;

  let months = (t.getFullYear() - b.getFullYear()) * 12 + (t.getMonth() - b.getMonth());
  if (t.getDate() < b.getDate()) months -= 1;
  return months;
}

/** Format an age in months as "10 years 4 months". */
export function formatAge(months) {
  if (months == null) return '';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return `${years} year${years === 1 ? '' : 's'} ${rem} month${rem === 1 ? '' : 's'}`;
}
