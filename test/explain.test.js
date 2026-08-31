import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/exam/rng.js';
import {
  generateMatrixItem, generateFigureWeightsItem, generateVisualPuzzleItem,
  generateBlockDesignItem, generateSymbolSearchRow,
} from '../src/exam/generators.js';
import {
  explainMatrix, explainFigureWeights, explainVerbal, explainVisualPuzzle,
  explainBlockDesign, explainDigitSpan, explainPictureSpan, explainCoding,
  explainSymbolSearch, asFraction, letterFor,
} from '../src/exam/explain.js';
import { SIMILARITIES_ITEMS, VOCABULARY_ITEMS } from '../src/exam/verbal-items.js';

/** Faults that make an explanation read as broken rather than merely terse. */
function proseProblems(text) {
  const problems = [];
  if (!text || text.length < 20) problems.push('too short');
  if (/\d{6,}/.test(text)) problems.push('runaway number');
  if (/\ba [aeiou]/i.test(text)) problems.push('"a" before a vowel');
  if (/\ban [^aeiou]/i.test(text)) problems.push('"an" before a consonant');
  if (/\b1 \w+ balance\b/.test(text)) problems.push('subject-verb disagreement');
  if (/\bundefined\b|\bNaN\b|\bnull\b/.test(text)) problems.push('unrendered value');
  if (/\s{2,}/.test(text)) problems.push('double space');
  if (/\.\./.test(text)) problems.push('double period');
  return problems;
}

describe('asFraction', () => {
  test('reduces to lowest terms and drops a unit denominator', () => {
    assert.equal(asFraction(6, 3), '2');
    assert.equal(asFraction(3, 2), '3/2');
    assert.equal(asFraction(4, 8), '1/2');
    assert.equal(asFraction(5, 1), '5');
    assert.equal(asFraction(2, 3), '2/3');
  });

  test('refuses a float rather than emitting nonsense', () => {
    // Regression: passing 2/3 as a float once produced
    // "5864062014805333/8796093022208000". A division has already lost the
    // exact ratio, so the only safe answer is to refuse it.
    assert.throws(() => asFraction(0.6666666666666666, 1), RangeError);
    assert.throws(() => asFraction(2 / 3, 1), RangeError);
    assert.throws(() => asFraction(1, 0), RangeError);
  });
});

describe('explainMatrix', () => {
  test('reads as clean prose across many generated items', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1 + (seed % 3));
      const text = explainMatrix(item);
      assert.deepEqual(proseProblems(text), [], `seed ${seed}: "${text}"`);
    }
  });

  test('names every rule that governs the matrix', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 2);
      const text = explainMatrix(item);
      assert.equal(item.rules.length, 2);
      // Both varying attributes must be mentioned, or the explanation is partial.
      for (const { attribute } of item.rules) {
        const phrase = { shape: 'shape', fill: 'shading', count: 'number of shapes', rotation: 'angle' }[attribute];
        assert.ok(text.includes(phrase), `seed ${seed}: "${phrase}" missing from "${text}"`);
      }
    }
  });

  test('describes the answer that is actually keyed', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 2);
      const answer = item.options[item.answerIndex];
      const text = explainMatrix(item);
      assert.ok(text.includes(String(answer.count)), `seed ${seed}: count missing`);
      assert.ok(text.includes(answer.shape), `seed ${seed}: shape missing`);
    }
  });
});

describe('explainFigureWeights', () => {
  test('reads as clean prose for simple and chained items alike', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (const chained of [false, true]) {
        const item = generateFigureWeightsItem(createRng(seed), { chained });
        const text = explainFigureWeights(item);
        assert.deepEqual(proseProblems(text), [],
          `seed ${seed} chained=${chained}: "${text}"`);
      }
    }
  });

  test('states the keyed answer', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const item = generateFigureWeightsItem(createRng(seed), { chained: seed % 2 === 0 });
      const text = explainFigureWeights(item);
      assert.ok(text.includes(String(item.answer)),
        `seed ${seed}: answer ${item.answer} missing from "${text}"`);
    }
  });

  test('restates every premise it was given', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateFigureWeightsItem(createRng(seed), { chained: true });
      const text = explainFigureWeights(item);
      for (const premise of item.premises) {
        assert.ok(text.includes(premise.left.color), `seed ${seed}: premise colour missing`);
        assert.ok(text.includes(premise.right.color), `seed ${seed}: premise colour missing`);
      }
    }
  });

  test('uses a fraction, never a long decimal, for a partial ratio', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const text = explainFigureWeights(generateFigureWeightsItem(createRng(seed), { chained: true }));
      assert.ok(!/\d\.\d{3,}/.test(text), `seed ${seed}: long decimal in "${text}"`);
    }
  });
});

describe('explainVerbal', () => {
  test('always quotes the full-credit answer', () => {
    for (const [bank, kind] of [[SIMILARITIES_ITEMS, 'similarities'], [VOCABULARY_ITEMS, 'vocabulary']]) {
      for (const source of bank) {
        const item = { ...source, options: [...source.responses] };
        const best = item.options.find((o) => o.credit === 2);
        const text = explainVerbal(item, 0, kind);
        assert.ok(text.includes(best.text), `missing best answer: "${text}"`);
        assert.deepEqual(proseProblems(text), [], text);
      }
    }
  });

  test('tells the reader what their own choice scored', () => {
    const source = SIMILARITIES_ITEMS[0];
    const item = { ...source, options: [...source.responses] };
    const zeroIndex = item.options.findIndex((o) => o.credit === 0);
    const partialIndex = item.options.findIndex((o) => o.credit === 1);
    const bestIndex = item.options.findIndex((o) => o.credit === 2);

    assert.ok(explainVerbal(item, zeroIndex, 'similarities').includes('scores nothing'));
    assert.ok(explainVerbal(item, partialIndex, 'similarities').includes('partial credit'));
    // Choosing the best answer needs no correction.
    const onBest = explainVerbal(item, bestIndex, 'similarities');
    assert.ok(!onBest.includes('scores nothing'));
  });
});

describe('explainVisualPuzzle', () => {
  test('names the correct pieces by their option letters', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const item = generateVisualPuzzleItem(createRng(seed), 4);
      const text = explainVisualPuzzle(item, [0, 1, 2]);
      for (const index of item.answerIndices) {
        assert.ok(text.includes(letterFor(index)), `seed ${seed}: piece ${letterFor(index)} missing`);
      }
      assert.deepEqual(proseProblems(text), [], text);
    }
  });

  test('gives a nearly-right attempt a more specific nudge', () => {
    const item = generateVisualPuzzleItem(createRng(5), 4);
    const [a, b] = item.answerIndices;
    const wrongThird = [0, 1, 2, 3, 4, 5].find((i) => !item.answerIndices.includes(i));
    const nearMiss = explainVisualPuzzle(item, [a, b, wrongThird]);
    assert.ok(nearMiss.includes('two of the three'), nearMiss);
  });
});

describe('explainBlockDesign', () => {
  const item = { ...generateBlockDesignItem(createRng(3), 3), speedBonus: true, baseCredit: 4 };

  test('confirms a correct build and explains the speed bands', () => {
    const text = explainBlockDesign(item, { grid: item.grid, elapsedSeconds: 18 });
    assert.ok(text.includes('18 seconds'), text);
    assert.ok(text.includes('20 seconds'), text);
  });

  test('counts how many tiles are still wrong', () => {
    const wrong = item.grid.map((row) => row.map(() => 'full-a'));
    const text = explainBlockDesign(item, { grid: wrong, elapsedSeconds: 30 });
    assert.match(text, /^\d+ of the 9 tiles do not match/, text);
  });

  test('handles an abandoned item', () => {
    assert.ok(explainBlockDesign(item, null).length > 10);
  });
});

describe('explainDigitSpan', () => {
  test('states the expected transformation for each mode', () => {
    assert.ok(explainDigitSpan('forward', [3, 1, 4], [3, 1, 4], [3, 1, 4]).includes('same order'));
    assert.ok(explainDigitSpan('backward', [3, 1, 4], [4, 1, 3], [4, 1, 3]).includes('reverse order'));
    assert.ok(explainDigitSpan('sequencing', [3, 1, 4], [1, 3, 4], [1, 3, 4]).includes('increasing'));
  });

  test('reports back what was typed only when it was wrong', () => {
    const right = explainDigitSpan('forward', [3, 1, 4], [3, 1, 4], [3, 1, 4]);
    const wrong = explainDigitSpan('forward', [3, 1, 4], [3, 1, 4], [3, 4, 1]);
    assert.ok(!right.includes('You typed'), right);
    assert.ok(wrong.includes('You typed 341'), wrong);
  });
});

describe('explainPictureSpan', () => {
  const trial = { stimulus: ['A', 'B', 'C'] };

  test('shows the order that was presented', () => {
    assert.ok(explainPictureSpan(trial, ['A', 'B', 'C']).includes('A B C'));
  });

  test('distinguishes a wrong order from a wrong set', () => {
    assert.ok(explainPictureSpan(trial, ['C', 'B', 'A']).includes('not in the right order'));
    assert.ok(explainPictureSpan(trial, ['A', 'B', 'X']).includes('You picked'));
  });
});

describe('explainCoding and explainSymbolSearch', () => {
  test('coding states the mapping, and the mistake when there is one', () => {
    assert.ok(explainCoding(4, 4).includes('stands for 4'));
    assert.ok(explainCoding(4, 7).includes('stands for 4'));
    assert.ok(explainCoding(4, 7).includes('not 7'));
  });

  test('explanations state facts without echoing the verdict', () => {
    // The feedback panel already says "Correct." above the explanation; an
    // explanation that repeats it reads as a stutter.
    assert.ok(!explainCoding(4, 4).startsWith('Correct'), explainCoding(4, 4));
    const row = generateSymbolSearchRow(createRng(1));
    assert.ok(!explainSymbolSearch(row).startsWith('Correct'), explainSymbolSearch(row));
    const blocks = { ...generateBlockDesignItem(createRng(3), 3), speedBonus: true, baseCredit: 4 };
    const solved = explainBlockDesign(blocks, { grid: blocks.grid, elapsedSeconds: 18 });
    assert.ok(!solved.startsWith('Correct'), solved);
  });

  test('symbol search states the truth of the row', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const row = generateSymbolSearchRow(createRng(seed));
      const text = explainSymbolSearch(row);
      assert.equal(text.includes('does appear'), row.isMatch, `seed ${seed}: ${text}`);
      assert.deepEqual(proseProblems(text), [], text);
    }
  });
});
