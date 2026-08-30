import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalCdf, erfc, normalQuantile, percentileRank, formatPercentile,
  formatPercentileLabel, ordinal, mean, sum,
} from '../src/core/stats.js';

/** Assert two floats agree to `tol`. */
const close = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol,
    `${msg ?? ''} expected ${expected}, got ${actual} (tol ${tol})`);

describe('normalCdf', () => {
  test('matches known standard normal values', () => {
    close(normalCdf(0), 0.5, 1e-7, 'cdf(0)');
    close(normalCdf(1), 0.8413447461, 1e-7, 'cdf(1)');
    close(normalCdf(-1), 0.1586552539, 1e-7, 'cdf(-1)');
    close(normalCdf(1.96), 0.9750021049, 1e-7, 'cdf(1.96)');
    close(normalCdf(2.5), 0.9937903347, 1e-7, 'cdf(2.5)');
    close(normalCdf(-3), 0.0013498980, 1e-8, 'cdf(-3)');
  });

  test('is symmetric about zero', () => {
    for (const z of [0.25, 0.8, 1.4, 2.2, 3.1]) {
      close(normalCdf(z) + normalCdf(-z), 1, 1e-9, `symmetry at ${z}`);
    }
  });

  test('is monotonically increasing', () => {
    let previous = -Infinity;
    for (let z = -4; z <= 4; z += 0.05) {
      const value = normalCdf(z);
      assert.ok(value >= previous, `cdf decreased at z=${z}`);
      previous = value;
    }
  });
});

describe('erfc', () => {
  test('matches known values', () => {
    close(erfc(0), 1, 1e-7);
    close(erfc(0.5), 0.4795001222, 1e-7);
    close(erfc(1), 0.1572992071, 1e-7);
    close(erfc(-1), 1.8427007929, 1e-7);
  });
});

describe('normalQuantile', () => {
  test('matches known critical values', () => {
    // Tolerance is set by erfc's ~1e-8 accuracy, which bounds the Halley
    // refinement step. Reported scores round to whole numbers, so this is
    // many orders of magnitude tighter than anything the app depends on.
    close(normalQuantile(0.975), 1.9599639845, 1e-7, 'z for 95%');
    close(normalQuantile(0.95), 1.6448536270, 1e-7, 'z for 90%');
    close(normalQuantile(0.995), 2.5758293035, 1e-7, 'z for 99%');
    close(normalQuantile(0.5), 0, 1e-7, 'median');
  });

  test('inverts normalCdf', () => {
    for (const p of [0.001, 0.05, 0.25, 0.5, 0.75, 0.95, 0.999]) {
      close(normalCdf(normalQuantile(p)), p, 1e-7, `round trip at p=${p}`);
    }
  });

  test('rejects probabilities outside (0,1)', () => {
    assert.throws(() => normalQuantile(0), RangeError);
    assert.throws(() => normalQuantile(1), RangeError);
    assert.throws(() => normalQuantile(-0.1), RangeError);
  });
});

describe('percentileRank', () => {
  test('places composite scores correctly', () => {
    close(percentileRank(100, 100, 15), 50, 1e-5);
    close(percentileRank(115, 100, 15), 84.134475, 1e-4);
    close(percentileRank(85, 100, 15), 15.865525, 1e-4);
    close(percentileRank(130, 100, 15), 97.724987, 1e-4);
  });

  test('places subtest scaled scores correctly', () => {
    close(percentileRank(10, 10, 3), 50, 1e-5);
    close(percentileRank(13, 10, 3), 84.134475, 1e-4);
    close(percentileRank(7, 10, 3), 15.865525, 1e-4);
  });

  test('clamps to the reportable range', () => {
    assert.equal(percentileRank(40, 100, 15), 0.1);
    assert.equal(percentileRank(160, 100, 15), 99.9);
  });
});

describe('formatting helpers', () => {
  test('formatPercentile uses decimals only in the tails', () => {
    assert.equal(formatPercentile(50), '50');
    assert.equal(formatPercentile(84.13), '84');
    assert.equal(formatPercentile(0.4), '0.4');
    assert.equal(formatPercentile(99.6), '99.6');
  });

  test('ordinal handles the teens and the common suffixes', () => {
    assert.equal(ordinal(1), '1st');
    assert.equal(ordinal(2), '2nd');
    assert.equal(ordinal(3), '3rd');
    assert.equal(ordinal(4), '4th');
    assert.equal(ordinal(11), '11th');
    assert.equal(ordinal(12), '12th');
    assert.equal(ordinal(13), '13th');
    assert.equal(ordinal(21), '21st');
    assert.equal(ordinal(63), '63rd');
    assert.equal(ordinal(0.5), null);
  });

  test('formatPercentileLabel never claims a 0th or 100th percentile', () => {
    // Percentile ranks clamp to [0.1, 99.9]; rounding those naively produces
    // "0th percentile" and "100th percentile", which no report should assert.
    assert.equal(formatPercentileLabel(percentileRank(40, 100, 15)), 'below the 1st percentile');
    assert.equal(formatPercentileLabel(percentileRank(160, 100, 15)), 'above the 99th percentile');
    assert.equal(formatPercentileLabel(0.1), 'below the 1st percentile');
    assert.equal(formatPercentileLabel(99.9), 'above the 99th percentile');
  });

  test('formatPercentileLabel reads naturally through the middle', () => {
    assert.equal(formatPercentileLabel(50), '50th percentile');
    assert.equal(formatPercentileLabel(77.4), '77th percentile');
    assert.equal(formatPercentileLabel(1), '1st percentile');
    assert.equal(formatPercentileLabel(2.2), '2nd percentile');
    assert.equal(formatPercentileLabel(3), '3rd percentile');
    assert.equal(formatPercentileLabel(21), '21st percentile');
    assert.equal(formatPercentileLabel(99), '99th percentile');
  });

  test('sum and mean', () => {
    assert.equal(sum([1, 2, 3, 4]), 10);
    assert.equal(mean([2, 4, 6]), 4);
    assert.ok(Number.isNaN(mean([])));
  });
});
