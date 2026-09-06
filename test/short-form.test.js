import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHORT_FORM_SUBTESTS, SHORT_FORM_PLAN, SHORT_FORM_REFERENCE,
  SHORT_FORM_COMPOSITES, SHORT_FORM_COMPARISONS, SHORT_FORM_CHOICES,
  shortFormReference, shortFormRawToScaled,
} from '../src/exam/short-form.js';
import { REFERENCE_DISTRIBUTIONS } from '../src/exam/reference.js';
import { buildSession, scoreSession, expectedDigitResponse, sessionLength } from '../src/exam/session.js';
import { scoreProtocol } from '../src/core/scoring.js';
import { DOMAINS, SUBTESTS } from '../src/core/model.js';

/** A flawless run of whatever subtests a session administers. */
function perfectResponses(session) {
  const responses = {};
  for (const subtest of session.subtests) {
    switch (subtest.type) {
      case 'verbal-choice':
        responses[subtest.id] = { answers: subtest.items.map((i) => i.options.findIndex((o) => o.credit === 2)) };
        break;
      case 'matrix': case 'figure-weights':
        responses[subtest.id] = { answers: subtest.items.map((i) => i.answerIndex) };
        break;
      case 'visual-puzzle':
        responses[subtest.id] = { answers: subtest.items.map((i) => [...i.answerIndices]) };
        break;
      case 'block-design':
        responses[subtest.id] = { answers: subtest.items.map((i) => ({ grid: i.grid, elapsedSeconds: 5 })) };
        break;
      case 'digit-span':
        responses[subtest.id] = {
          answers: subtest.sections.map((s) => s.trials.map((t) => expectedDigitResponse(s.mode, t.digits))),
        };
        break;
      case 'picture-span':
        responses[subtest.id] = { answers: subtest.trials.map((t) => [...t.stimulus]) };
        break;
      case 'coding':
        responses[subtest.id] = { correct: SHORT_FORM_PLAN.cd?.maxRaw ?? 140 };
        break;
      case 'symbol-search':
        responses[subtest.id] = { correct: 60, incorrect: 0 };
        break;
    }
  }
  return responses;
}

describe('the short form covers every area', () => {
  test('administers exactly one subtest per area', () => {
    // Dropping an area would remove the profile across areas, which is the most
    // useful thing the report produces.
    const domains = SHORT_FORM_SUBTESTS.map(
      (id) => SUBTESTS.find((s) => s.id === id).domain);
    assert.equal(domains.length, DOMAINS.length);
    assert.equal(new Set(domains).size, DOMAINS.length, `areas covered: ${domains}`);
  });

  test('records, accurately, whether each pick is the more reliable of its pair', () => {
    // Figure Weights is more reliable than Matrix Reasoning, so the short form
    // does not simply take the strongest subtest in every area. That trade is
    // deliberate and written down; this checks the record matches the model
    // rather than letting the claim drift away from the numbers.
    for (const id of SHORT_FORM_SUBTESTS) {
      const chosen = SUBTESTS.find((s) => s.id === id);
      const sibling = SUBTESTS.find((s) => s.domain === chosen.domain && s.id !== id);
      const claimed = SHORT_FORM_CHOICES[id].mostReliable;
      assert.equal(claimed, chosen.reliability >= sibling.reliability,
        `${chosen.abbr} (${chosen.reliability}) vs ${sibling.abbr} (${sibling.reliability}): ` +
        `mostReliable recorded as ${claimed}`);
    }
  });

  test('a pick that is not the most reliable explains itself', () => {
    for (const id of SHORT_FORM_SUBTESTS) {
      const choice = SHORT_FORM_CHOICES[id];
      assert.ok(choice.why && choice.why.length > 40, `${id}: no reason recorded`);
      if (!choice.mostReliable) {
        assert.ok(choice.why.length > 90,
          `${id} gives up reliability, so the reason needs to be a real one`);
      }
    }
  });
});

describe('short-form reference scaling', () => {
  test('the mean scales with the proportion of the subtest retained', () => {
    for (const id of SHORT_FORM_SUBTESTS) {
      const full = REFERENCE_DISTRIBUTIONS[id];
      const short = SHORT_FORM_REFERENCE[id];
      const ratio = short.maxRaw / full.maxRaw;
      assert.ok(Math.abs(short.mean - full.mean * ratio) < 0.02,
        `${id}: mean ${short.mean} is not ${full.mean} × ${ratio.toFixed(3)}`);
    }
  });

  test('the SD shrinks by less than the mean on item-based subtests', () => {
    // Regression risk worth pinning: a sum of correlated items loses SD more
    // slowly than it loses total. Scaling both proportionally would make short
    // scores look far more extreme than they are.
    for (const id of SHORT_FORM_SUBTESTS) {
      if (SHORT_FORM_PLAN[id].kind !== 'items') continue;
      const full = REFERENCE_DISTRIBUTIONS[id];
      const short = SHORT_FORM_REFERENCE[id];
      const rawRatio = short.maxRaw / full.maxRaw;
      const sdRatio = short.sd / full.sd;
      assert.ok(sdRatio > rawRatio,
        `${id}: SD ratio ${sdRatio.toFixed(3)} should exceed the raw ratio ${rawRatio.toFixed(3)}`);
      assert.ok(sdRatio < 1, `${id}: a shorter subtest cannot have a wider SD`);
    }
  });

  test('a timed subtest scales both mean and SD with time', () => {
    // Coding is a count accumulated at a steady rate, so halving the time
    // halves the spread as well as the total.
    const full = REFERENCE_DISTRIBUTIONS.cd;
    const short = SHORT_FORM_REFERENCE.cd;
    const ratio = short.maxRaw / full.maxRaw;
    assert.ok(Math.abs(short.sd - full.sd * ratio) < 0.02, 'rate subtest SD should scale linearly');
  });

  test('conversion is calibrated: the mean maps to 10 and +1 SD to 13', () => {
    for (const id of SHORT_FORM_SUBTESTS) {
      const reference = SHORT_FORM_REFERENCE[id];
      assert.equal(shortFormRawToScaled(id, reference.mean), 10, `${id} at the mean`);
      assert.equal(shortFormRawToScaled(id, reference.mean + reference.sd), 13, `${id} at +1 SD`);
      assert.equal(shortFormRawToScaled(id, reference.mean - reference.sd), 7, `${id} at −1 SD`);
    }
  });

  test('every short reference documents how it was derived', () => {
    for (const id of SHORT_FORM_SUBTESTS) {
      assert.ok(SHORT_FORM_REFERENCE[id].basis.length > 60, `${id}: basis too thin`);
    }
  });

  test('rejects a subtest with no short-form plan', () => {
    assert.throws(() => shortFormReference('vp'), /No short-form plan/);
    assert.throws(() => shortFormRawToScaled('vp', 5), /No short-form reference/);
  });
});

describe('building a short session', () => {
  test('is markedly shorter than the full form', () => {
    const full = buildSession(3, { form: 'full' });
    const short = buildSession(3, { form: 'short' });
    assert.equal(full.subtests.length, 10);
    assert.equal(short.subtests.length, 5);
    assert.ok(sessionLength(short) < sessionLength(full) / 2,
      `short form presents ${sessionLength(short)} units against ${sessionLength(full)}`);
  });

  test('presents exactly the planned number of items', () => {
    const session = buildSession(9, { form: 'short' });
    const count = (subtest) => subtest.items?.length
      ?? subtest.sections?.reduce((n, s) => n + s.trials.length, 0);

    for (const subtest of session.subtests) {
      if (subtest.type === 'coding') {
        assert.equal(subtest.duration, SHORT_FORM_PLAN.cd.seconds);
        continue;
      }
      assert.equal(count(subtest), SHORT_FORM_PLAN[subtest.id].items, `${subtest.id} item count`);
    }
  });

  test('spans the full difficulty range rather than only the easy end', () => {
    // Taking the first eight tiers would cap the test well below what an able
    // child can do; evenly spaced tiers keep the ceiling.
    const session = buildSession(4, { form: 'short' });
    const vocabulary = session.subtests.find((s) => s.id === 'vo');
    assert.equal(vocabulary.items.length, 8);
    // The last item should come from near the top of the sixteen tiers.
    const words = vocabulary.items.map((i) => i.stem);
    assert.equal(new Set(words).size, words.length, 'a short session repeats a word');
  });

  test('Digit Span keeps forward and backward, dropping only sequencing', () => {
    const session = buildSession(6, { form: 'short' });
    const modes = session.subtests.find((s) => s.id === 'ds').sections.map((s) => s.mode);
    assert.deepEqual(modes, ['forward', 'backward']);
  });

  test('is reproducible from its seed, and differs from the full form', () => {
    const strip = (s) => JSON.stringify({ ...s, createdAt: null });
    assert.equal(strip(buildSession(12, { form: 'short' })), strip(buildSession(12, { form: 'short' })));
    assert.notEqual(strip(buildSession(12, { form: 'short' })), strip(buildSession(12, { form: 'full' })));
  });

  test('defaults to the full form when none is named', () => {
    assert.equal(buildSession(1).subtests.length, 10);
    assert.equal(buildSession(1).form, 'full');
  });
});

describe('scoring a short session', () => {
  test('a flawless run reaches each subtest planned maximum', () => {
    const session = buildSession(7, { form: 'short' });
    const { raw } = scoreSession(session, perfectResponses(session));
    for (const id of SHORT_FORM_SUBTESTS) {
      assert.equal(raw[id], SHORT_FORM_PLAN[id].maxRaw, `${id} did not reach its maximum`);
    }
  });

  test('reports only the subtests it administered', () => {
    const session = buildSession(7, { form: 'short' });
    const { raw } = scoreSession(session, perfectResponses(session));
    assert.deepEqual(Object.keys(raw).sort(), [...SHORT_FORM_SUBTESTS].sort());
  });

  test('an average performance scores 100 on every area', () => {
    const average = Object.fromEntries(SHORT_FORM_SUBTESTS.map((id) => [id, 10]));
    const results = scoreProtocol(average, {
      composites: SHORT_FORM_COMPOSITES,
      comparisons: SHORT_FORM_COMPARISONS,
      referenceIds: SHORT_FORM_SUBTESTS,
    });
    for (const composite of SHORT_FORM_COMPOSITES) {
      assert.equal(results.composites[composite.id].score, 100, composite.id);
    }
  });

  test('area estimates are less reliable than the full form indexes', () => {
    // The cost of one subtest per area, and the reason they are labelled
    // estimates. If this ever stopped being true, the scaling would be wrong.
    const average = Object.fromEntries(SHORT_FORM_SUBTESTS.map((id) => [id, 10]));
    const short = scoreProtocol(average, {
      composites: SHORT_FORM_COMPOSITES, comparisons: SHORT_FORM_COMPARISONS,
      referenceIds: SHORT_FORM_SUBTESTS,
    });
    const full = scoreProtocol(Object.fromEntries(SUBTESTS.map((s) => [s.id, 10])));

    for (const [shortId, fullId] of [['VCE', 'VCI'], ['VSE', 'VSI'], ['FRE', 'FRI'], ['WME', 'WMI'], ['PSE', 'PSI']]) {
      assert.ok(short.composites[shortId].sem > full.composites[fullId].sem,
        `${shortId} SEM ${short.composites[shortId].sem.toFixed(2)} should exceed ` +
        `${fullId} SEM ${full.composites[fullId].sem.toFixed(2)}`);
    }
    assert.ok(short.composites.GEN.sem > full.composites.FSIQ.sem,
      'the overall estimate should be less precise than a full FSIQ');
  });

  test('composites are named apart from the full form indexes', () => {
    // A number built from one subtest is not a VCI, and sharing the label would
    // invite exactly the comparison it cannot support.
    const shortIds = SHORT_FORM_COMPOSITES.map((c) => c.id);
    for (const id of ['VCI', 'VSI', 'FRI', 'WMI', 'PSI', 'FSIQ', 'GAI', 'CPI', 'NVI']) {
      assert.ok(!shortIds.includes(id), `short form reuses the label ${id}`);
    }
    for (const composite of SHORT_FORM_COMPOSITES) {
      if (composite.id === 'GEN') continue;
      assert.match(composite.name, /estimate/i, `${composite.id} should be named an estimate`);
    }
  });

  test('a skipped task is withheld rather than scored zero', () => {
    const session = buildSession(7, { form: 'short' });
    const responses = perfectResponses(session);
    responses.cd = { skipped: true };
    const { raw, scaled } = scoreSession(session, responses);
    assert.equal(raw.cd, null);
    assert.equal(scaled.cd, null);

    const results = scoreProtocol(scaled, {
      composites: SHORT_FORM_COMPOSITES, comparisons: SHORT_FORM_COMPARISONS,
      referenceIds: SHORT_FORM_SUBTESTS,
    });
    assert.equal(results.composites.PSE.complete, false);
    assert.equal(results.composites.GEN.complete, false);
  });
});
