import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNorms, findAgeBand, lookup, rawToScaled, sumToComposite,
  ageInMonths, formatAge,
} from '../src/core/norms.js';

const minimalNorms = {
  version: 1,
  ageBands: [
    {
      id: '8:0-8:3',
      minMonths: 96,
      maxMonths: 99,
      subtests: {
        si: [{ max: 5, score: 1 }, { max: 12, score: 7 }, { max: 20, score: 10 }, { max: 60, score: 19 }],
      },
    },
  ],
  compositeTables: {
    VCI: [{ max: 10, score: 55 }, { max: 20, score: 100 }, { max: 38, score: 150 }],
  },
};

describe('validateNorms', () => {
  test('accepts a well-formed file', () => {
    const result = validateNorms(minimalNorms);
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.deepEqual(result.errors, []);
  });

  test('rejects non-objects', () => {
    assert.equal(validateNorms(null).valid, false);
    assert.equal(validateNorms([]).valid, false);
    assert.equal(validateNorms('nope').valid, false);
  });

  test('requires a version', () => {
    const { version, ...rest } = minimalNorms;
    const result = validateNorms(rest);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('version')));
  });

  test('rejects a file with nothing loadable in it', () => {
    const result = validateNorms({ version: 1 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('nothing to load')));
  });

  test('rejects a non-monotonic lookup table', () => {
    const result = validateNorms({
      version: 1,
      compositeTables: { VCI: [{ max: 20, score: 100 }, { max: 10, score: 55 }] },
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('monotonically')));
  });

  test('rejects scores outside the metric range', () => {
    const outOfRange = validateNorms({
      version: 1,
      ageBands: [{ id: 'a', minMonths: 72, maxMonths: 83, subtests: { si: [{ max: 10, score: 25 }] } }],
    });
    assert.equal(outOfRange.valid, false);
    assert.ok(outOfRange.errors.some((e) => e.includes('outside valid range')));
  });

  test('rejects an age band whose bounds are inverted', () => {
    const result = validateNorms({
      version: 1,
      ageBands: [{ id: 'a', minMonths: 99, maxMonths: 96, subtests: {} }],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('exceeds maxMonths')));
  });

  test('warns rather than fails on unknown subtest and composite ids', () => {
    const result = validateNorms({
      version: 1,
      ageBands: [{ id: 'a', minMonths: 72, maxMonths: 83, subtests: { xx: [{ max: 1, score: 1 }] } }],
      compositeTables: { ZZZ: [{ max: 1, score: 50 }] },
    });
    assert.equal(result.valid, true, result.errors.join('; '));
    assert.equal(result.warnings.length, 2);
  });

  test('warns about gaps and overlaps in age coverage', () => {
    const gap = validateNorms({
      version: 1,
      ageBands: [
        { id: 'a', minMonths: 72, maxMonths: 83, subtests: {} },
        { id: 'b', minMonths: 96, maxMonths: 107, subtests: {} },
      ],
    });
    assert.ok(gap.warnings.some((w) => w.includes('Gap in age coverage')));

    const overlap = validateNorms({
      version: 1,
      ageBands: [
        { id: 'a', minMonths: 72, maxMonths: 90, subtests: {} },
        { id: 'b', minMonths: 84, maxMonths: 107, subtests: {} },
      ],
    });
    assert.ok(overlap.warnings.some((w) => w.includes('overlap')));
  });
});

describe('lookup', () => {
  const table = [{ max: 5, score: 1 }, { max: 12, score: 7 }, { max: 20, score: 10 }];

  test('returns the first rung at or above the value', () => {
    assert.equal(lookup(table, 0), 1);
    assert.equal(lookup(table, 5), 1);
    assert.equal(lookup(table, 6), 7);
    assert.equal(lookup(table, 12), 7);
    assert.equal(lookup(table, 13), 10);
    assert.equal(lookup(table, 20), 10);
  });

  test('returns null above the top rung rather than guessing', () => {
    assert.equal(lookup(table, 21), null);
  });

  test('tolerates a missing table', () => {
    assert.equal(lookup(undefined, 5), null);
  });
});

describe('age handling', () => {
  test('finds the band covering an age', () => {
    assert.equal(findAgeBand(minimalNorms, 97).id, '8:0-8:3');
    assert.equal(findAgeBand(minimalNorms, 120), null);
    assert.equal(findAgeBand(null, 97), null);
  });

  test('computes whole months, not rounding up a partial month', () => {
    assert.equal(ageInMonths('2015-03-15', '2025-03-14'), 119);
    assert.equal(ageInMonths('2015-03-15', '2025-03-15'), 120);
    assert.equal(ageInMonths('2015-03-15', '2025-07-10'), 123);
  });

  test('rejects impossible or unparseable dates', () => {
    assert.equal(ageInMonths('2025-01-01', '2015-01-01'), null);
    assert.equal(ageInMonths('not-a-date', '2025-01-01'), null);
  });

  test('formats an age for a report', () => {
    assert.equal(formatAge(123), '10 years 3 months');
    assert.equal(formatAge(13), '1 year 1 month');
    assert.equal(formatAge(null), '');
  });
});

describe('conversions', () => {
  test('converts a raw score by age when a table covers it', () => {
    assert.equal(rawToScaled(minimalNorms, 'si', 10, 97), 7);
    assert.equal(rawToScaled(minimalNorms, 'si', 3, 97), 1);
  });

  test('returns null when no table covers that subtest or age', () => {
    assert.equal(rawToScaled(minimalNorms, 'si', 10, 200), null, 'age not covered');
    assert.equal(rawToScaled(minimalNorms, 'cd', 10, 97), null, 'subtest not covered');
  });

  test('uses an official composite table when one is loaded', () => {
    assert.equal(sumToComposite(minimalNorms, 'VCI', 20), 100);
    assert.equal(sumToComposite(minimalNorms, 'FSIQ', 70), null, 'falls back to the model');
    assert.equal(sumToComposite(null, 'VCI', 20), null);
  });
});
