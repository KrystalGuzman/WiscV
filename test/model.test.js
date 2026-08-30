import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUBTESTS, COMPOSITES, DOMAINS, SPECIFIC_LOADINGS, WITHIN_DOMAIN_CORRELATION,
  subtestCorrelation, correlationMatrix, subtestsInDomain,
  getSubtest, getComposite, descriptorFor,
  COMPOSITE_DESCRIPTORS, SUBTEST_DESCRIPTORS,
} from '../src/core/model.js';

const close = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} expected ${b}, got ${a} (tol ${tol})`);

describe('subtest definitions', () => {
  test('there are ten primary subtests, two per domain', () => {
    assert.equal(SUBTESTS.length, 10);
    for (const domain of DOMAINS) {
      assert.equal(subtestsInDomain(domain.id).length, 2, `domain ${domain.id}`);
    }
  });

  test('ids and abbreviations are unique', () => {
    assert.equal(new Set(SUBTESTS.map((s) => s.id)).size, 10);
    assert.equal(new Set(SUBTESTS.map((s) => s.abbr)).size, 10);
  });

  test('the ten named subtests are exactly the ones requested', () => {
    assert.deepEqual(SUBTESTS.map((s) => s.name).sort(), [
      'Block Design', 'Coding', 'Digit Span', 'Figure Weights', 'Matrix Reasoning',
      'Picture Span', 'Similarities', 'Symbol Search', 'Visual Puzzles', 'Vocabulary',
    ]);
  });

  test('reliabilities are plausible coefficients', () => {
    for (const s of SUBTESTS) {
      assert.ok(s.reliability > 0.7 && s.reliability < 1, `${s.abbr} reliability`);
      assert.ok(s.g > 0 && s.g < 1, `${s.abbr} g loading`);
    }
  });

  test('unknown ids throw rather than returning undefined', () => {
    assert.throws(() => getSubtest('nope'), /Unknown subtest/);
    assert.throws(() => getComposite('NOPE'), /Unknown composite/);
  });
});

describe('bifactor correlation model', () => {
  test('reproduces the within-domain correlation targets exactly', () => {
    for (const domain of DOMAINS) {
      const [a, b] = subtestsInDomain(domain.id);
      close(
        subtestCorrelation(a.id, b.id),
        WITHIN_DOMAIN_CORRELATION[domain.id],
        1e-12,
        `${domain.id} within-domain r`
      );
    }
  });

  test('leaves every subtest with positive unique variance', () => {
    for (const s of SUBTESTS) {
      const communality = s.g ** 2 + SPECIFIC_LOADINGS[s.id] ** 2;
      assert.ok(communality < 1, `${s.abbr} communality ${communality} must be below 1`);
    }
  });

  test('produces a symmetric matrix with a unit diagonal', () => {
    const ids = SUBTESTS.map((s) => s.id);
    const M = correlationMatrix();
    for (let i = 0; i < ids.length; i += 1) {
      assert.equal(M[i][i], 1, `diagonal at ${ids[i]}`);
      for (let j = 0; j < ids.length; j += 1) {
        close(M[i][j], M[j][i], 1e-12, `symmetry ${ids[i]}x${ids[j]}`);
      }
    }
  });

  test('all correlations are in (0,1]', () => {
    for (const row of correlationMatrix()) {
      for (const r of row) {
        assert.ok(r > 0 && r <= 1, `correlation ${r} out of range`);
      }
    }
  });

  test('is positive definite (a valid correlation matrix)', () => {
    // Cholesky succeeds iff the matrix is positive definite.
    const M = correlationMatrix();
    const n = M.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j <= i; j += 1) {
        let acc = M[i][j];
        for (let k = 0; k < j; k += 1) acc -= L[i][k] * L[j][k];
        if (i === j) {
          assert.ok(acc > 1e-10, `not positive definite: pivot ${acc} at index ${i}`);
          L[i][j] = Math.sqrt(acc);
        } else {
          L[i][j] = acc / L[j][j];
        }
      }
    }
  });

  test('within-domain correlations exceed cross-domain ones for the same subtest', () => {
    for (const s of SUBTESTS) {
      const partner = subtestsInDomain(s.domain).find((o) => o.id !== s.id);
      const within = subtestCorrelation(s.id, partner.id);
      for (const other of SUBTESTS) {
        if (other.domain === s.domain) continue;
        assert.ok(
          within > subtestCorrelation(s.id, other.id),
          `${s.abbr}: within-domain r with ${partner.abbr} should exceed r with ${other.abbr}`
        );
      }
    }
  });
});

describe('composite definitions', () => {
  test('every composite is built from known subtests', () => {
    const ids = new Set(SUBTESTS.map((s) => s.id));
    for (const c of COMPOSITES) {
      assert.ok(c.subtests.length >= 2, `${c.id} needs at least two subtests`);
      assert.equal(new Set(c.subtests).size, c.subtests.length, `${c.id} has a duplicate subtest`);
      for (const id of c.subtests) assert.ok(ids.has(id), `${c.id} references unknown subtest ${id}`);
    }
  });

  test('the five index scores pair with the five domains', () => {
    const indexes = COMPOSITES.filter((c) => c.primary && c.id !== 'FSIQ');
    assert.equal(indexes.length, 5);
    for (const index of indexes) {
      const members = subtestsInDomain(index.domain).map((s) => s.id).sort();
      assert.deepEqual([...index.subtests].sort(), members, `${index.id} membership`);
    }
  });

  test('FSIQ uses the standard seven subtests', () => {
    assert.deepEqual(getComposite('FSIQ').subtests, ['si', 'vo', 'bd', 'mr', 'fw', 'ds', 'cd']);
  });

  test('GAI and CPI partition ability from proficiency', () => {
    const gai = new Set(getComposite('GAI').subtests);
    const cpi = new Set(getComposite('CPI').subtests);
    for (const id of gai) assert.ok(!cpi.has(id), `${id} cannot be in both GAI and CPI`);
  });
});

describe('qualitative descriptors', () => {
  test('composite bands match the WISC-V seven-band scheme', () => {
    assert.equal(descriptorFor(145, COMPOSITE_DESCRIPTORS), 'Extremely High');
    assert.equal(descriptorFor(130, COMPOSITE_DESCRIPTORS), 'Extremely High');
    assert.equal(descriptorFor(129, COMPOSITE_DESCRIPTORS), 'Very High');
    assert.equal(descriptorFor(115, COMPOSITE_DESCRIPTORS), 'High Average');
    assert.equal(descriptorFor(100, COMPOSITE_DESCRIPTORS), 'Average');
    assert.equal(descriptorFor(90, COMPOSITE_DESCRIPTORS), 'Average');
    assert.equal(descriptorFor(89, COMPOSITE_DESCRIPTORS), 'Low Average');
    assert.equal(descriptorFor(75, COMPOSITE_DESCRIPTORS), 'Very Low');
    assert.equal(descriptorFor(60, COMPOSITE_DESCRIPTORS), 'Extremely Low');
  });

  test('every score in the reportable range gets a descriptor', () => {
    for (let s = 40; s <= 160; s += 1) {
      assert.ok(descriptorFor(s, COMPOSITE_DESCRIPTORS), `no descriptor for composite ${s}`);
    }
    for (let s = 1; s <= 19; s += 1) {
      assert.ok(descriptorFor(s, SUBTEST_DESCRIPTORS), `no descriptor for scaled score ${s}`);
    }
  });

  test('subtest bands align with the composite bands at equivalent z scores', () => {
    // Scaled 13 == composite 115 == +1 SD, both "High Average".
    assert.equal(descriptorFor(13, SUBTEST_DESCRIPTORS), 'High Average');
    assert.equal(descriptorFor(10, SUBTEST_DESCRIPTORS), 'Average');
    assert.equal(descriptorFor(7, SUBTEST_DESCRIPTORS), 'Low Average');
    assert.equal(descriptorFor(16, SUBTEST_DESCRIPTORS), 'Extremely High');
  });
});
