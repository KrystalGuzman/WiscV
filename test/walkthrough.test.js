import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/exam/rng.js';
import {
  generateMatrixItem, generateFigureWeightsItem, generateVisualPuzzleItem,
  generateBlockDesignItem,
} from '../src/exam/generators.js';
import {
  walkMatrix, walkFigureWeights, walkSimilarities, walkVocabulary,
  walkVisualPuzzle, walkBlockDesign, walkDigitSpan, walkPictureSpan,
  walkCoding, walkSymbolSearch,
} from '../src/exam/walkthrough.js';
import { SIMILARITIES_ITEMS, VOCABULARY_ITEMS } from '../src/exam/verbal-items.js';

/** Faults that make a step read as broken rather than merely terse. */
function proseProblems(text) {
  const problems = [];
  if (!text || text.length < 25) problems.push('too short');
  if (/\d{6,}/.test(text)) problems.push('runaway number');
  if (/\ba [aeiou]/i.test(text)) problems.push('"a" before a vowel');
  if (/\ban [^aeiou]/i.test(text)) problems.push('"an" before a consonant');
  if (/\bundefined\b|\bNaN\b|\bnull\b/.test(text)) problems.push('unrendered value');
  if (/\s{2,}/.test(text)) problems.push('double space');
  if (/\.\./.test(text)) problems.push('double period');
  return problems;
}

function checkShape(walkthrough, label) {
  assert.ok(Array.isArray(walkthrough.steps), `${label}: steps must be an array`);
  assert.ok(walkthrough.steps.length >= 2, `${label}: a one-step walkthrough is just the answer`);
  assert.equal(typeof walkthrough.revealsAnswer, 'boolean', `${label}: revealsAnswer must be set`);
  walkthrough.steps.forEach((step, i) => {
    assert.deepEqual(proseProblems(step), [], `${label} step ${i + 1}: "${step}"`);
  });
}

describe('walkthrough shape', () => {
  test('every task produces well-formed steps', () => {
    const rng = () => createRng(11);
    checkShape(walkMatrix(generateMatrixItem(rng(), 2)), 'matrix');
    checkShape(walkFigureWeights(generateFigureWeightsItem(rng(), { chained: false })), 'weights');
    checkShape(walkSimilarities(SIMILARITIES_ITEMS[0]), 'similarities');
    checkShape(walkVocabulary(VOCABULARY_ITEMS[0]), 'vocabulary');
    checkShape(walkVisualPuzzle(generateVisualPuzzleItem(rng(), 4)), 'puzzle');
    checkShape(walkBlockDesign(generateBlockDesignItem(rng(), 3), null), 'blocks');
    checkShape(walkDigitSpan('backward'), 'digits');
    checkShape(walkPictureSpan(), 'pictures');
    checkShape(walkCoding(), 'coding');
    checkShape(walkSymbolSearch(), 'search');
  });

  test('the answer is never given away in the first step', () => {
    // A walkthrough whose opening line states the answer is just the
    // explanation with extra clicks; the method has to come first.
    for (let seed = 0; seed < 80; seed += 1) {
      const item = generateFigureWeightsItem(createRng(seed), { chained: seed % 2 === 0 });
      const first = walkFigureWeights(item).steps[0];
      assert.ok(!first.includes(`${item.answer} ${item.question.rightShape.color}`),
        `seed ${seed}: first step gives the answer: "${first}"`);
    }
  });
});

describe('which walkthroughs give the answer away', () => {
  test('solution walkthroughs are marked as revealing', () => {
    // These necessarily end at the answer, so the practice area keeps the item
    // out of the accuracy figure.
    assert.equal(walkMatrix(generateMatrixItem(createRng(1), 2)).revealsAnswer, true);
    assert.equal(walkFigureWeights(generateFigureWeightsItem(createRng(1), {})).revealsAnswer, true);
    assert.equal(walkSimilarities(SIMILARITIES_ITEMS[0]).revealsAnswer, true);
    assert.equal(walkVocabulary(VOCABULARY_ITEMS[0]).revealsAnswer, true);
    assert.equal(walkVisualPuzzle(generateVisualPuzzleItem(createRng(1), 4)).revealsAnswer, true);
  });

  test('strategy-only walkthroughs are marked as not revealing', () => {
    // No walkthrough can tell you which digits you just saw, so these give
    // nothing away and must not cost the examinee their score.
    assert.equal(walkDigitSpan('forward').revealsAnswer, false);
    assert.equal(walkPictureSpan().revealsAnswer, false);
    assert.equal(walkCoding().revealsAnswer, false);
    assert.equal(walkSymbolSearch().revealsAnswer, false);
    assert.equal(walkBlockDesign(generateBlockDesignItem(createRng(1), 2), null).revealsAnswer, false);
  });

  test('a strategy walkthrough never names the answer', () => {
    for (const mode of ['forward', 'backward', 'sequencing']) {
      const text = walkDigitSpan(mode).steps.join(' ');
      // The only digits it may mention are those in its own worked example.
      assert.ok(!/you saw/i.test(text), `${mode}: leaks the stimulus`);
    }
  });
});

describe('walkMatrix', () => {
  test('names every governing rule and reaches the keyed answer', () => {
    for (let seed = 0; seed < 150; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1 + (seed % 3));
      const walkthrough = walkMatrix(item);
      const text = walkthrough.steps.join(' ');

      for (const { attribute } of item.rules) {
        const phrase = { shape: 'the shape', fill: 'the shading', count: 'the number of shapes', rotation: 'the angle' }[attribute];
        assert.ok(text.includes(phrase), `seed ${seed}: "${phrase}" never mentioned`);
      }
      const answer = item.options[item.answerIndex];
      assert.ok(text.includes(String(answer.count)), `seed ${seed}: answer count missing`);
      walkthrough.steps.forEach((step, i) =>
        assert.deepEqual(proseProblems(step), [], `seed ${seed} step ${i + 1}: "${step}"`));
    }
  });

  test('states the conclusion once, not once per rule', () => {
    // Regression: the "apply that to the empty cell" sentence was emitted for
    // every rule, so a two-rule item repeated it verbatim.
    for (let seed = 0; seed < 60; seed += 1) {
      const steps = walkMatrix(generateMatrixItem(createRng(seed), 3)).steps;
      const applySteps = steps.filter((s) => s.includes('apply'));
      assert.equal(applySteps.length, 1, `seed ${seed}: ${applySteps.length} apply steps`);
    }
  });

  test('tells the reader what to ignore when something is constant', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1);
      const first = walkMatrix(item).steps[0];
      if (Object.keys(item.fixed ?? {}).length > 0) {
        assert.ok(/rul(e|ing) (it |them |things )?out|ignore/i.test(first), first);
      }
    }
  });
});

describe('walkFigureWeights', () => {
  test('restates each premise as a swap and reaches the answer', () => {
    for (let seed = 0; seed < 150; seed += 1) {
      for (const chained of [false, true]) {
        const item = generateFigureWeightsItem(createRng(seed), { chained });
        const walkthrough = walkFigureWeights(item);
        const text = walkthrough.steps.join(' ');

        assert.equal(walkthrough.steps.filter((s) => s.includes('swap:')).length,
          item.premises.length, `seed ${seed}: one step per premise`);
        assert.ok(text.includes(String(item.answer)), `seed ${seed}: answer missing`);
        walkthrough.steps.forEach((step, i) =>
          assert.deepEqual(proseProblems(step), [], `seed ${seed} step ${i + 1}: "${step}"`));
      }
    }
  });

  test('chained items are told to route through the middle shape', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const text = walkFigureWeights(generateFigureWeightsItem(createRng(seed), { chained: true })).steps.join(' ');
      assert.ok(text.includes('middle shape'), `seed ${seed}: no bridging step`);
    }
  });
});

describe('walkSimilarities and walkVocabulary', () => {
  test('similarities phrases both nouns as the authored stem does', () => {
    // Regression: templating "a {noun}" produced "a north" and "a anger" for
    // the mass-noun pairs. The stem is the single source of that phrasing.
    for (const item of SIMILARITIES_ITEMS) {
      const first = walkSimilarities(item).steps[0];
      assert.deepEqual(proseProblems(first), [], first);
      for (const noun of item.pair) {
        assert.ok(first.includes(noun), `"${noun}" missing from "${first}"`);
      }
      assert.ok(!/\ba (north|west|anger|joy|envy|greed|evolution|erosion)\b/.test(first), first);
    }
  });

  test('both verbal walkthroughs end on the full-credit answer', () => {
    for (const item of SIMILARITIES_ITEMS) {
      const steps = walkSimilarities(item).steps;
      const best = item.responses.find((r) => r.credit === 2).text;
      assert.ok(steps[steps.length - 1].toLowerCase().includes(best.toLowerCase().slice(0, 20)),
        `last step should give the answer: "${steps[steps.length - 1]}"`);
    }
    for (const item of VOCABULARY_ITEMS) {
      const steps = walkVocabulary(item).steps;
      const best = item.responses.find((r) => r.credit === 2).text;
      assert.ok(steps[steps.length - 1].toLowerCase().includes(best.toLowerCase().slice(0, 20)),
        `last step should give the answer: "${steps[steps.length - 1]}"`);
      assert.ok(steps[0].includes(item.word), `should name the word: "${steps[0]}"`);
    }
  });
});

describe('walkVisualPuzzle', () => {
  test('names the square count and the keyed pieces', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateVisualPuzzleItem(createRng(seed), 4);
      const walkthrough = walkVisualPuzzle(item);
      const text = walkthrough.steps.join(' ');
      assert.ok(text.includes('16'), `seed ${seed}: square count missing`);
      for (const index of item.answerIndices) {
        assert.ok(text.includes(String.fromCharCode(65 + index)),
          `seed ${seed}: piece ${String.fromCharCode(65 + index)} missing`);
      }
    }
  });
});

describe('walkBlockDesign', () => {
  const item = generateBlockDesignItem(createRng(3), 3);

  test('points at the first tile that does not match', () => {
    const blank = item.grid.map((row) => row.map(() => 'full-b'));
    const text = walkBlockDesign(item, blank).steps.join(' ');
    assert.match(text, /first tile that does not match is row \d+, column \d+/, text);
  });

  test('says so when the build already matches', () => {
    const text = walkBlockDesign(item, item.grid.map((r) => [...r])).steps.join(' ');
    assert.ok(text.includes('already matches'), text);
  });

  test('works with no build yet, and never reveals the whole target', () => {
    const walkthrough = walkBlockDesign(item, null);
    assert.equal(walkthrough.revealsAnswer, false);
    const text = walkthrough.steps.join(' ');
    assert.ok(!text.includes('row 2, column'), 'should not enumerate the grid');
    walkthrough.steps.forEach((step) => assert.deepEqual(proseProblems(step), [], step));
  });
});

describe('strategy walkthroughs', () => {
  test('digit span advice differs by condition', () => {
    const forward = walkDigitSpan('forward').steps.join(' ');
    const backward = walkDigitSpan('backward').steps.join(' ');
    const sequencing = walkDigitSpan('sequencing').steps.join(' ');
    assert.notEqual(forward, backward);
    assert.notEqual(backward, sequencing);
    assert.ok(backward.includes('revers'), backward);
    assert.ok(sequencing.includes('Sort as you go'), sequencing);
  });

  test('an unknown condition still returns the shared advice', () => {
    const walkthrough = walkDigitSpan('nonsense');
    assert.ok(walkthrough.steps.length >= 2);
    walkthrough.steps.forEach((step) => assert.deepEqual(proseProblems(step), [], step));
  });
});
