import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  sumVariance, compositeReliability, compositeFromSum, standardErrorOfMeasurement,
  confidenceInterval, parseScaledScore, scoreComposite, scoreProtocol,
  strengthsAndWeaknesses, compareComposites, compareSubtests, applyOfficialScore,
} from '../src/core/scoring.js';
import { SUBTESTS, COMPOSITES, getComposite } from '../src/core/model.js';

const close = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b}, got ${a} (tol ${tol})`);

/** A protocol with every subtest at the normative mean. */
const allAverage = Object.fromEntries(SUBTESTS.map((s) => [s.id, 10]));

/** Build a protocol from an object of overrides on top of all-average. */
const protocol = (overrides = {}) => ({ ...allAverage, ...overrides });

describe('sumVariance', () => {
  test('equals k * sigma^2 only when subtests are uncorrelated', () => {
    // Two subtests correlated at r inflate the sum's variance above 2*9.
    const vci = sumVariance(['si', 'vo']);
    assert.ok(vci > 2 * 9, 'correlated subtests must inflate sum variance');
    close(vci, 9 * (2 + 2 * 0.65), 1e-9, 'VCI sum variance');
  });

  test('grows with the number of subtests', () => {
    assert.ok(sumVariance(getComposite('FSIQ').subtests) > sumVariance(getComposite('VCI').subtests));
  });
});

describe('compositeReliability', () => {
  // The model is built from correlations and subtest reliabilities only; that
  // it lands on the published composite coefficients is a genuine check that
  // the structure is coherent rather than tuned.
  const published = {
    VCI: 0.92, VSI: 0.92, FRI: 0.93, WMI: 0.92, PSI: 0.88,
    FSIQ: 0.96, GAI: 0.95, CPI: 0.93, NVI: 0.95,
  };

  test('lands within .015 of every published WISC-V coefficient', () => {
    for (const c of COMPOSITES) {
      const derived = compositeReliability(c.subtests);
      close(derived, published[c.id], 0.015, `${c.id} reliability`);
    }
  });

  test('FSIQ is the most reliable composite', () => {
    const fsiq = compositeReliability(getComposite('FSIQ').subtests);
    for (const c of COMPOSITES) {
      if (c.id === 'FSIQ') continue;
      assert.ok(fsiq >= compositeReliability(c.subtests), `FSIQ should be at least as reliable as ${c.id}`);
    }
  });

  test('every coefficient is a valid proportion', () => {
    for (const c of COMPOSITES) {
      const r = compositeReliability(c.subtests);
      assert.ok(r > 0 && r < 1, `${c.id} reliability ${r} out of range`);
    }
  });
});

describe('compositeFromSum', () => {
  test('maps the normative mean sum to 100 for every composite', () => {
    for (const c of COMPOSITES) {
      assert.equal(compositeFromSum(c.subtests, 10 * c.subtests.length), 100, `${c.id} at mean`);
    }
  });

  test('is symmetric about the mean', () => {
    for (const c of COMPOSITES) {
      const k = c.subtests.length;
      const above = compositeFromSum(c.subtests, 10 * k + 3 * k);
      const below = compositeFromSum(c.subtests, 10 * k - 3 * k);
      close(above - 100, 100 - below, 1, `${c.id} symmetry`);
    }
  });

  test('is monotonically non-decreasing in the sum', () => {
    for (const c of COMPOSITES) {
      const k = c.subtests.length;
      let previous = -Infinity;
      for (let s = k; s <= 19 * k; s += 1) {
        const composite = compositeFromSum(c.subtests, s);
        assert.ok(composite >= previous, `${c.id} decreased at sum ${s}`);
        previous = composite;
      }
    }
  });

  test('stays inside the reportable composite range', () => {
    for (const c of COMPOSITES) {
      const k = c.subtests.length;
      assert.ok(compositeFromSum(c.subtests, k) >= 40, `${c.id} floor`);
      assert.ok(compositeFromSum(c.subtests, 19 * k) <= 160, `${c.id} ceiling`);
    }
  });

  test('approximates the published FSIQ conversion at anchor points', () => {
    // Published WISC-V FSIQ: a sum of 70 gives 100, and each 14 points of sum
    // moves the composite by roughly one SD.
    const fsiq = getComposite('FSIQ').subtests;
    assert.equal(compositeFromSum(fsiq, 70), 100);
    close(compositeFromSum(fsiq, 84), 115, 2, 'FSIQ at +1 SD');
    close(compositeFromSum(fsiq, 56), 85, 2, 'FSIQ at -1 SD');
    close(compositeFromSum(fsiq, 98), 130, 3, 'FSIQ at +2 SD');
  });

  test('a uniform scaled score yields the same composite across the five indexes', () => {
    // The five indexes all draw on two subtests, so a flat +1 SD profile puts
    // each of them in the same place.
    const indexes = COMPOSITES.filter((c) => c.primary && c.id !== 'FSIQ');
    const scores = indexes.map((c) => compositeFromSum(c.subtests, 13 * 2));
    for (const [i, c] of indexes.entries()) {
      close(scores[i], 117, 2, `${c.id} at uniform 13`);
    }
  });

  test('a uniform profile pushes broader composites further from the mean', () => {
    // This is a real property of the instrument, not an artefact: averaging
    // more imperfectly-correlated subtests cancels specific and error variance,
    // so a *consistently* +1 SD profile across seven subtests is rarer -- and
    // therefore scores higher -- than +1 SD on any single two-subtest index.
    // The published FSIQ table behaves the same way.
    const vci = compositeFromSum(getComposite('VCI').subtests, 13 * 2);
    const gai = compositeFromSum(getComposite('GAI').subtests, 13 * 5);
    const fsiq = compositeFromSum(getComposite('FSIQ').subtests, 13 * 7);
    assert.ok(fsiq > gai, `FSIQ (${fsiq}) should exceed GAI (${gai}) on a flat 13 profile`);
    assert.ok(gai > vci, `GAI (${gai}) should exceed VCI (${vci}) on a flat 13 profile`);
    close(fsiq, 123, 2, 'FSIQ at uniform 13');

    // The same holds symmetrically below the mean.
    const vciLow = compositeFromSum(getComposite('VCI').subtests, 7 * 2);
    const fsiqLow = compositeFromSum(getComposite('FSIQ').subtests, 7 * 7);
    assert.ok(fsiqLow < vciLow, 'and below the mean the ordering reverses');
  });
});

describe('confidence intervals', () => {
  test('95% VCI interval is about +/- 8 points, matching published tables', () => {
    const r = compositeReliability(['si', 'vo']);
    const ci = confidenceInterval(100, r, 0.95, { basis: 'obtained' });
    close((ci.upper - ci.lower) / 2, 8, 1, 'VCI 95% half-width');
  });

  test('the estimated-true-score interval regresses toward the mean', () => {
    const r = compositeReliability(getComposite('FSIQ').subtests);
    const high = confidenceInterval(130, r, 0.95, { basis: 'true' });
    const centre = (high.lower + high.upper) / 2;
    assert.ok(centre < 130, 'a high score should regress downward');
    assert.ok(centre > 100, 'but not all the way to the mean');
  });

  test('a score at the mean is not shifted by regression', () => {
    const r = compositeReliability(['si', 'vo']);
    const ci = confidenceInterval(100, r, 0.95, { basis: 'true' });
    close((ci.lower + ci.upper) / 2, 100, 1, 'centre at the mean');
  });

  test('99% intervals are wider than 90% intervals', () => {
    const r = compositeReliability(['si', 'vo']);
    const narrow = confidenceInterval(110, r, 0.90);
    const wide = confidenceInterval(110, r, 0.99);
    assert.ok((wide.upper - wide.lower) > (narrow.upper - narrow.lower));
  });

  test('a more reliable composite yields a narrower interval', () => {
    const psi = compositeReliability(['cd', 'ss']);
    const fsiq = compositeReliability(getComposite('FSIQ').subtests);
    const psiCi = confidenceInterval(100, psi, 0.95, { basis: 'obtained' });
    const fsiqCi = confidenceInterval(100, fsiq, 0.95, { basis: 'obtained' });
    assert.ok((fsiqCi.upper - fsiqCi.lower) < (psiCi.upper - psiCi.lower));
  });

  test('intervals are clamped to the reportable range', () => {
    const r = compositeReliability(['si', 'vo']);
    assert.ok(confidenceInterval(160, r, 0.95, { basis: 'obtained' }).upper <= 160);
    assert.ok(confidenceInterval(40, r, 0.95, { basis: 'obtained' }).lower >= 40);
  });

  test('SEM shrinks as reliability rises', () => {
    assert.ok(standardErrorOfMeasurement(0.96) < standardErrorOfMeasurement(0.88));
    close(standardErrorOfMeasurement(1), 0, 1e-12, 'perfect reliability');
  });
});

describe('parseScaledScore', () => {
  test('accepts valid scaled scores', () => {
    assert.equal(parseScaledScore(1), 1);
    assert.equal(parseScaledScore(19), 19);
    assert.equal(parseScaledScore('12'), 12);
  });

  test('treats blank input as absent rather than zero', () => {
    assert.equal(parseScaledScore(''), null);
    assert.equal(parseScaledScore('   '), null);
    assert.equal(parseScaledScore(null), null);
    assert.equal(parseScaledScore(undefined), null);
  });

  test('rejects out-of-range, fractional, and non-numeric input', () => {
    assert.throws(() => parseScaledScore(0), RangeError);
    assert.throws(() => parseScaledScore(20), RangeError);
    assert.throws(() => parseScaledScore(-3), RangeError);
    assert.throws(() => parseScaledScore(10.5), RangeError);
    assert.throws(() => parseScaledScore('abc'), RangeError);
  });
});

describe('scoreComposite', () => {
  test('withholds a composite when any subtest is missing', () => {
    const partial = protocol({ vo: null });
    const vci = scoreComposite('VCI', partial);
    assert.equal(vci.complete, false);
    assert.deepEqual(vci.missing, ['vo']);
    assert.equal(vci.score, undefined, 'an incomplete composite must not report a score');
  });

  test('scores an average protocol at 100, 50th percentile', () => {
    const vci = scoreComposite('VCI', allAverage);
    assert.equal(vci.complete, true);
    assert.equal(vci.score, 100);
    assert.equal(vci.sumOfScaledScores, 20);
    close(vci.percentile, 50, 0.01);
    assert.equal(vci.descriptor, 'Average');
  });

  test('reports both confidence levels', () => {
    const vci = scoreComposite('VCI', allAverage);
    assert.ok(vci.intervals[0.90]);
    assert.ok(vci.intervals[0.95]);
    const w90 = vci.intervals[0.90].upper - vci.intervals[0.90].lower;
    const w95 = vci.intervals[0.95].upper - vci.intervals[0.95].lower;
    assert.ok(w95 > w90, '95% interval must be wider than 90%');
  });
});

describe('strengths and weaknesses', () => {
  test('flags a markedly low subtest as a weakness', () => {
    const scores = protocol({ cd: 3 });
    const result = strengthsAndWeaknesses(scores, getComposite('FSIQ').subtests, 0.05);
    const coding = result.entries.find((e) => e.subtestId === 'cd');
    assert.equal(coding.verdict, 'Weakness');
    assert.ok(coding.deviation < 0);
  });

  test('flags a markedly high subtest as a strength', () => {
    const scores = protocol({ fw: 18 });
    const result = strengthsAndWeaknesses(scores, getComposite('FSIQ').subtests, 0.05);
    const fw = result.entries.find((e) => e.subtestId === 'fw');
    assert.equal(fw.verdict, 'Strength');
    assert.ok(fw.deviation > 0);
  });

  test('a flat profile produces no strengths or weaknesses', () => {
    const result = strengthsAndWeaknesses(allAverage, getComposite('FSIQ').subtests, 0.05);
    assert.equal(result.referenceMean, 10);
    assert.equal(result.entries.filter((e) => e.significant).length, 0);
  });

  test('a stricter alpha requires a larger deviation', () => {
    const scores = protocol({ cd: 6 });
    const lenient = strengthsAndWeaknesses(scores, getComposite('FSIQ').subtests, 0.15);
    const strict = strengthsAndWeaknesses(scores, getComposite('FSIQ').subtests, 0.01);
    const cdLenient = lenient.entries.find((e) => e.subtestId === 'cd');
    const cdStrict = strict.entries.find((e) => e.subtestId === 'cd');
    assert.ok(cdStrict.criticalValue > cdLenient.criticalValue);
  });

  test('ignores missing subtests and needs at least two present', () => {
    const sparse = { si: 12, vo: null, bd: null, mr: null, fw: null, ds: null, cd: null };
    const result = strengthsAndWeaknesses(sparse, getComposite('FSIQ').subtests, 0.05);
    assert.equal(result.entries.length, 0, 'one subtest cannot support the analysis');
  });

  test('deviations sum to zero across the reference set', () => {
    const scores = protocol({ si: 14, cd: 6, fw: 12 });
    const result = strengthsAndWeaknesses(scores, getComposite('FSIQ').subtests, 0.05);
    const total = result.entries.reduce((acc, e) => acc + e.deviation, 0);
    close(total, 0, 1e-9, 'deviations from the mean must cancel');
  });
});

describe('discrepancy comparisons', () => {
  test('VCI vs VSI critical value is about 12 points at .05', () => {
    // Published WISC-V critical values for index pairs sit near 11-13 points.
    const result = scoreProtocol(allAverage, { alpha: 0.05 });
    const pair = result.indexComparisons.find((c) => c.pair[0] === 'VCI' && c.pair[1] === 'VSI');
    close(pair.criticalValue, 12, 2, 'VCI-VSI critical value');
  });

  test('detects a large index split', () => {
    const scores = protocol({ si: 16, vo: 16, cd: 4, ss: 4 });
    const result = scoreProtocol(scores, { alpha: 0.05 });
    const pair = result.indexComparisons.find((c) => c.pair[0] === 'VCI' && c.pair[1] === 'PSI');
    assert.ok(pair.significant, 'a 6-point scaled split should be significant');
    assert.ok(pair.difference > 0);
    assert.equal(pair.direction, 'VCI > PSI');
  });

  test('a flat profile yields no significant discrepancies', () => {
    const result = scoreProtocol(allAverage, { alpha: 0.05 });
    assert.equal(result.indexComparisons.filter((c) => c.significant).length, 0);
    assert.equal(result.subtestComparisons.filter((c) => c.significant).length, 0);
  });

  test('all ten index pairs are compared when the protocol is complete', () => {
    const result = scoreProtocol(allAverage);
    assert.equal(result.indexComparisons.length, 10);
    assert.equal(result.subtestComparisons.length, 5);
  });

  test('comparisons involving an incomplete index are omitted', () => {
    const result = scoreProtocol(protocol({ cd: null }));
    assert.ok(result.indexComparisons.every((c) => !c.pair.includes('PSI')));
  });

  test('subtest comparison returns null when a score is missing', () => {
    assert.equal(compareSubtests('si', 'vo', protocol({ vo: null })), null);
  });

  test('difference direction is reported consistently', () => {
    const result = scoreProtocol(protocol({ si: 4, vo: 4 }), { alpha: 0.05 });
    const pair = result.indexComparisons.find((c) => c.pair[0] === 'VCI' && c.pair[1] === 'VSI');
    assert.ok(pair.difference < 0);
    assert.equal(pair.direction, 'VSI > VCI');
  });
});

describe('scoreProtocol', () => {
  test('scores a complete average protocol coherently', () => {
    const result = scoreProtocol(allAverage);
    assert.equal(result.completeness.entered, 10);
    assert.equal(result.completeness.total, 10);
    for (const c of COMPOSITES) {
      assert.equal(result.composites[c.id].score, 100, `${c.id} should be 100`);
    }
  });

  test('handles an entirely empty protocol without throwing', () => {
    const empty = Object.fromEntries(SUBTESTS.map((s) => [s.id, null]));
    const result = scoreProtocol(empty);
    assert.equal(result.completeness.entered, 0);
    assert.equal(result.indexComparisons.length, 0);
    for (const c of COMPOSITES) assert.equal(result.composites[c.id].complete, false);
  });

  test('a high verbal / low processing profile reads as expected', () => {
    const scores = protocol({ si: 15, vo: 16, cd: 5, ss: 6 });
    const result = scoreProtocol(scores);
    assert.ok(result.composites.VCI.score > 120, 'VCI should be well above average');
    assert.ok(result.composites.PSI.score < 85, 'PSI should be well below average');
    assert.ok(result.composites.GAI.score > result.composites.CPI.score,
      'GAI should exceed CPI for this profile');
    assert.equal(result.composites.VCI.descriptor, 'Extremely High');
    assert.equal(result.composites.PSI.descriptor, 'Very Low');
  });

  test('extreme floor and ceiling protocols stay in range', () => {
    const floor = Object.fromEntries(SUBTESTS.map((s) => [s.id, 1]));
    const ceiling = Object.fromEntries(SUBTESTS.map((s) => [s.id, 19]));
    for (const c of COMPOSITES) {
      const low = scoreProtocol(floor).composites[c.id].score;
      const high = scoreProtocol(ceiling).composites[c.id].score;
      assert.ok(low >= 40 && low < 100, `${c.id} floor ${low}`);
      assert.ok(high <= 160 && high > 100, `${c.id} ceiling ${high}`);
    }
  });

  test('every subtest carries a percentile and descriptor when scored', () => {
    const result = scoreProtocol(protocol({ ss: null }));
    for (const s of result.subtests) {
      if (s.id === 'ss') {
        assert.equal(s.score, null);
        assert.equal(s.percentile, null);
      } else {
        assert.ok(s.percentile > 0 && s.percentile < 100, `${s.abbr} percentile`);
        assert.ok(s.descriptor, `${s.abbr} descriptor`);
      }
    }
  });

  test('the reference set for strengths/weaknesses is selectable', () => {
    const fsiqBased = scoreProtocol(allAverage, { swReference: 'fsiq' });
    const allBased = scoreProtocol(allAverage, { swReference: 'primary' });
    assert.equal(fsiqBased.strengthsAndWeaknesses.referenceIds.length, 7);
    assert.equal(allBased.strengthsAndWeaknesses.referenceIds.length, 10);
  });

  test('scoring is pure: the input is not mutated', () => {
    const input = protocol({ cd: 7 });
    const snapshot = JSON.stringify(input);
    scoreProtocol(input);
    assert.equal(JSON.stringify(input), snapshot);
  });
});

describe('applyOfficialScore', () => {
  // Regression: substituting an official composite score used to leave the
  // percentile, descriptor and confidence intervals derived from the model's
  // score, so a report could show 133 next to the 93rd percentile.
  test('moves every derived value with the substituted score', () => {
    const composite = scoreComposite('VCI', allAverage);
    assert.equal(composite.score, 100);

    applyOfficialScore(composite, 133);

    assert.equal(composite.score, 133);
    assert.equal(composite.source, 'official');
    assert.equal(composite.descriptor, 'Extremely High');
    close(composite.percentile, 98.7, 0.2, 'percentile follows the substituted score');
    assert.ok(composite.intervals[0.95].lower > 100,
      'the interval must sit around the substituted score, not the model score');
    assert.ok(composite.intervals[0.95].lower <= 133 && composite.intervals[0.95].upper >= 133 - 15,
      'interval brackets the substituted score region');
  });

  test('keeps the model reliability and SEM, which a table does not supply', () => {
    const composite = scoreComposite('VCI', allAverage);
    const { reliability, sem } = composite;
    applyOfficialScore(composite, 120);
    assert.equal(composite.reliability, reliability);
    assert.equal(composite.sem, sem);
  });

  test('leaves an incomplete composite alone', () => {
    const composite = scoreComposite('VCI', protocol({ vo: null }));
    applyOfficialScore(composite, 120);
    assert.equal(composite.complete, false);
    assert.equal(composite.score, undefined);
  });

  test('is a no-op when no official score is supplied', () => {
    const composite = scoreComposite('VCI', allAverage);
    applyOfficialScore(composite, null);
    assert.equal(composite.score, 100);
    assert.equal(composite.source, undefined);
  });

  test('respects the confidence-interval basis option', () => {
    const trueBased = scoreComposite('VCI', allAverage);
    const obtained = scoreComposite('VCI', allAverage);
    applyOfficialScore(trueBased, 135, { basis: 'true' });
    applyOfficialScore(obtained, 135, { basis: 'obtained' });
    const trueCentre = (trueBased.intervals[0.95].lower + trueBased.intervals[0.95].upper) / 2;
    const obtainedCentre = (obtained.intervals[0.95].lower + obtained.intervals[0.95].upper) / 2;
    assert.ok(trueCentre < obtainedCentre, 'the true-score basis regresses toward the mean');
  });
});
