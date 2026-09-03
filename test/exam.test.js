import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/exam/rng.js';
import {
  generateMatrixItem, generateFigureWeightsItem, generateBlockDesignItem,
  generateVisualPuzzleItem, generateCodingKey, generateSymbolSearchRow, TILE_STATES,
  matrixVisualKey,
} from '../src/exam/generators.js';
import {
  buildSession, scoreSubtest, scoreSession, scoreBlockDesignItem,
  expectedDigitResponse, sessionLength,
} from '../src/exam/session.js';
import {
  REFERENCE_DISTRIBUTIONS, rawToScaledScore, scaledToRawScore, scaledCeilings,
} from '../src/exam/reference.js';
import { SIMILARITIES_ITEMS, VOCABULARY_ITEMS } from '../src/exam/verbal-items.js';
import { SUBTESTS } from '../src/core/model.js';

describe('seeded rng', () => {
  test('is reproducible for a given seed and differs across seeds', () => {
    const draw = (seed) => { const r = createRng(seed); return Array.from({ length: 20 }, () => r.int(0, 999)); };
    assert.deepEqual(draw(42), draw(42));
    assert.notDeepEqual(draw(42), draw(43));
  });

  test('shuffle and sample do not mutate the source', () => {
    const rng = createRng(1);
    const source = [1, 2, 3, 4, 5];
    rng.shuffle(source);
    rng.sample(source, 3);
    assert.deepEqual(source, [1, 2, 3, 4, 5]);
  });

  test('sample returns the requested count, without repeats', () => {
    const rng = createRng(9);
    const drawn = rng.sample([...Array(20).keys()], 6);
    assert.equal(drawn.length, 6);
    assert.equal(new Set(drawn).size, 6);
  });
});

describe('matrix reasoning generator', () => {
  test('produces well-formed items across many seeds', () => {
    for (let seed = 0; seed < 150; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1 + (seed % 3));
      assert.equal(item.options.length, 5, `seed ${seed}: option count`);
      assert.ok(item.answerIndex >= 0 && item.answerIndex < 5, `seed ${seed}: answer index`);
      assert.equal(item.matrix[2][2], null, `seed ${seed}: target cell must be blank`);
      assert.equal(item.matrix.flat().filter(Boolean).length, 8, `seed ${seed}: eight cells shown`);
    }
  });

  test('every option is distinct, so exactly one can be keyed correct', () => {
    for (let seed = 0; seed < 150; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 2);
      const keys = item.options.map((o) => `${o.shape}/${o.fill}/${o.count}/${o.rotation}`);
      assert.equal(new Set(keys).size, 5, `seed ${seed}: duplicate options`);
    }
  });

  test('no two options look alike, whatever their attributes say', () => {
    // Regression: a square at 0 and at 90 degrees are the same picture, and a
    // circle's rotation is invisible at every angle. Comparing attributes alone
    // let the generator emit two identical-looking options with one of them
    // keyed correct, and matrices whose rule could not be seen.
    for (let seed = 0; seed < 300; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1 + (seed % 3));
      const keys = item.options.map(matrixVisualKey);
      assert.equal(new Set(keys).size, 5,
        `seed ${seed}: two options are visually identical`);
    }
  });

  test('every distinction the rules make is actually visible', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1 + (seed % 3));
      const shown = item.matrix.flat().filter(Boolean);
      const answer = item.options[item.answerIndex];
      const cells = [...shown, answer];
      // A rotation that a shape's symmetry hides must never be the only thing
      // separating two cells of the matrix.
      const bySpec = new Set(cells.map((c) => `${c.shape}/${c.fill}/${c.count}/${c.rotation}`));
      const byLook = new Set(cells.map(matrixVisualKey));
      assert.equal(byLook.size, bySpec.size,
        `seed ${seed}: the matrix makes a distinction that cannot be seen`);
    }
  });

  test('a circle never carries a rotation-only distinction', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 1 + (seed % 3));
      const circles = [...item.matrix.flat().filter(Boolean), ...item.options]
        .filter((c) => c.shape === 'circle');
      const byLook = new Set(circles.map(matrixVisualKey));
      const bySpec = new Set(circles.map((c) => `${c.fill}/${c.count}/${c.rotation}`));
      assert.ok(byLook.size >= new Set(circles.map((c) => `${c.fill}/${c.count}`)).size,
        `seed ${seed}: circles distinguished only by an invisible rotation`);
      assert.ok(bySpec.size >= byLook.size);
    }
  });

  test('distractors differ from the answer in exactly one attribute', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateMatrixItem(createRng(seed), 2);
      const answer = item.options[item.answerIndex];
      item.options.forEach((option, i) => {
        if (i === item.answerIndex) return;
        const differences = ['shape', 'fill', 'count', 'rotation']
          .filter((attribute) => option[attribute] !== answer[attribute]);
        assert.equal(differences.length, 1, `seed ${seed}: distractor should differ in one attribute`);
      });
    }
  });
});

describe('figure weights generator', () => {
  /** Re-derive the answer from the premises, independently of the generator. */
  function solve(item) {
    const key = (o) => `${o.shape}:${o.color}`;
    const weights = new Map([[key(item.premises[0].left), 1]]);
    // Propagate ratios until every shape in the chain is known.
    for (let pass = 0; pass < 4; pass += 1) {
      for (const premise of item.premises) {
        const left = key(premise.left);
        const right = key(premise.right);
        if (weights.has(left) && !weights.has(right)) {
          weights.set(right, (weights.get(left) * premise.left.count) / premise.right.count);
        } else if (weights.has(right) && !weights.has(left)) {
          weights.set(left, (weights.get(right) * premise.right.count) / premise.left.count);
        }
      }
    }
    const question = key(item.question.left);
    const target = key(item.question.rightShape);
    return (item.question.left.count * weights.get(question)) / weights.get(target);
  }

  test('the keyed answer actually balances the scale', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      for (const chained of [false, true]) {
        const item = generateFigureWeightsItem(createRng(seed), { chained });
        assert.ok(Math.abs(solve(item) - item.answer) < 1e-9,
          `seed ${seed} chained=${chained}: keyed ${item.answer}, solves to ${solve(item)}`);
        assert.equal(item.options[item.answerIndex].count, item.answer,
          `seed ${seed}: answerIndex points at the wrong option`);
      }
    }
  });

  test('options are distinct whole quantities, so only one balances', () => {
    for (let seed = 0; seed < 120; seed += 1) {
      const item = generateFigureWeightsItem(createRng(seed), { chained: seed % 2 === 0 });
      assert.equal(item.options.length, 5);
      const counts = item.options.map((o) => o.count);
      assert.equal(new Set(counts).size, 5, `seed ${seed}: duplicate option quantities`);
      for (const count of counts) {
        assert.ok(Number.isInteger(count) && count >= 1, `seed ${seed}: bad quantity ${count}`);
      }
    }
  });

  test('chained items give two premises, simple items give one', () => {
    assert.equal(generateFigureWeightsItem(createRng(3), { chained: false }).premises.length, 1);
    assert.equal(generateFigureWeightsItem(createRng(3), { chained: true }).premises.length, 2);
  });
});

describe('visual puzzle generator', () => {
  test('the keyed pieces tile the square exactly', () => {
    for (let seed = 0; seed < 80; seed += 1) {
      const item = generateVisualPuzzleItem(createRng(seed), 4);
      const chosen = item.answerIndices.map((i) => item.options[i]);
      const cells = chosen.reduce((total, piece) => total + piece.length, 0);
      const union = new Set(chosen.flat());
      assert.equal(cells, 16, `seed ${seed}: pieces cover ${cells} cells`);
      assert.equal(union.size, 16, `seed ${seed}: pieces overlap`);
    }
  });

  test('exactly one of the twenty possible triples tiles the square', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateVisualPuzzleItem(createRng(seed), 4);
      let tilings = 0;
      for (let i = 0; i < 6; i += 1) {
        for (let j = i + 1; j < 6; j += 1) {
          for (let k = j + 1; k < 6; k += 1) {
            const triple = [item.options[i], item.options[j], item.options[k]];
            const cells = triple.reduce((total, p) => total + p.length, 0);
            if (cells === 16 && new Set(triple.flat()).size === 16) tilings += 1;
          }
        }
      }
      assert.equal(tilings, 1, `seed ${seed}: ${tilings} valid triples, want exactly 1`);
    }
  });

  test('offers six options and no trivial single-cell pieces', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const item = generateVisualPuzzleItem(createRng(seed), 4);
      assert.equal(item.options.length, 6);
      for (const piece of item.options) assert.ok(piece.length >= 2, `seed ${seed}: sliver piece`);
    }
  });
});

describe('block design and speeded stimuli', () => {
  test('patterns use the defined tile states and are not near-uniform', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      for (const size of [2, 3]) {
        const item = generateBlockDesignItem(createRng(seed), size);
        assert.equal(item.grid.length, size);
        const flat = item.grid.flat();
        assert.equal(flat.length, size * size);
        for (const tile of flat) assert.ok(TILE_STATES.includes(tile), `bad tile ${tile}`);
        assert.ok(new Set(flat).size >= 3, `seed ${seed}: pattern too uniform`);
      }
    }
  });

  test('a coding key maps digits 1-9 to nine distinct glyphs', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const key = generateCodingKey(createRng(seed));
      assert.deepEqual(key.map((k) => k.digit), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
      assert.equal(new Set(key.map((k) => k.glyphIndex)).size, 9);
    }
  });

  test('symbol search rows are labelled to match their contents', () => {
    for (let seed = 0; seed < 400; seed += 1) {
      const row = generateSymbolSearchRow(createRng(seed));
      const actual = row.search.some((glyph) => row.targets.includes(glyph));
      assert.equal(row.isMatch, actual, `seed ${seed}: isMatch disagrees with the row`);
      assert.equal(row.targets.length, 2);
      assert.equal(row.search.length, 5);
    }
  });
});

describe('verbal item banks', () => {
  test('every item offers one 2-credit, one 1-credit and two 0-credit responses', () => {
    for (const [name, bank] of [['Similarities', SIMILARITIES_ITEMS], ['Vocabulary', VOCABULARY_ITEMS]]) {
      bank.forEach((item, i) => {
        const credits = item.responses.map((r) => r.credit).sort();
        assert.deepEqual(credits, [0, 0, 1, 2], `${name} item ${i}`);
        assert.equal(new Set(item.responses.map((r) => r.text)).size, 4, `${name} item ${i}: duplicate text`);
      });
    }
  });

  test('every Similarities item carries a grammatical authored stem', () => {
    // The stem is authored per item rather than templated: several pairs are
    // mass nouns that take no article ("How are anger and joy alike?").
    for (const [i, item] of SIMILARITIES_ITEMS.entries()) {
      assert.ok(item.stem, `item ${i} has no stem`);
      assert.ok(item.stem.endsWith('alike?'), `item ${i}: unexpected stem shape`);
      assert.ok(!/\ba (?=[aeiou])/i.test(item.stem), `item ${i}: "a" before a vowel in "${item.stem}"`);
      for (const word of item.pair) {
        assert.ok(item.stem.includes(word), `item ${i}: stem omits "${word}"`);
      }
    }
  });

  test('bank sizes match the declared maximum raw scores', () => {
    assert.equal(SIMILARITIES_ITEMS.length * 2, REFERENCE_DISTRIBUTIONS.si.maxRaw);
    assert.equal(VOCABULARY_ITEMS.length * 2, REFERENCE_DISTRIBUTIONS.vo.maxRaw);
  });
});

describe('session construction', () => {
  test('is fully reproducible from its seed', () => {
    const a = buildSession(2024);
    const b = buildSession(2024);
    const strip = (s) => JSON.stringify({ ...s, createdAt: null });
    assert.equal(strip(a), strip(b));
    assert.notEqual(strip(buildSession(2025)), strip(a));
  });

  test('covers all ten primary subtests exactly once', () => {
    const session = buildSession(1);
    const ids = session.subtests.map((s) => s.id);
    assert.equal(ids.length, 10);
    assert.deepEqual([...ids].sort(), SUBTESTS.map((s) => s.id).sort());
  });

  test('shuffles verbal response options so position carries no information', () => {
    // Across sessions the correct option should not sit in one place.
    const positions = new Set();
    for (let seed = 0; seed < 25; seed += 1) {
      const session = buildSession(seed);
      const similarities = session.subtests.find((s) => s.id === 'si');
      positions.add(similarities.items[0].options.findIndex((o) => o.credit === 2));
    }
    assert.ok(positions.size > 1, 'the 2-credit response always appears in the same position');
  });

  test('digit runs avoid repeats and straight ascending or descending runs', () => {
    const session = buildSession(77);
    const digitSpan = session.subtests.find((s) => s.id === 'ds');
    for (const section of digitSpan.sections) {
      for (const trial of section.trials) {
        assert.equal(trial.digits.length, trial.span);
        for (let i = 1; i < trial.digits.length; i += 1) {
          assert.notEqual(trial.digits[i], trial.digits[i - 1], 'immediate repeat');
        }
        if (trial.span >= 3) {
          const ascending = trial.digits.every((d, i) => i === 0 || d === trial.digits[i - 1] + 1);
          const descending = trial.digits.every((d, i) => i === 0 || d === trial.digits[i - 1] - 1);
          assert.ok(!ascending && !descending, `monotonic run: ${trial.digits}`);
        }
      }
    }
  });

  test('picture span response arrays contain every stimulus plus distractors', () => {
    const session = buildSession(5);
    const pictureSpan = session.subtests.find((s) => s.id === 'pc');
    for (const trial of pictureSpan.trials) {
      assert.equal(trial.stimulus.length, trial.span);
      for (const symbol of trial.stimulus) {
        assert.ok(trial.response.includes(symbol), 'a stimulus symbol is missing from the response array');
      }
      assert.ok(trial.response.length > trial.stimulus.length, 'no distractors offered');
    }
  });

  test('never presents the same item twice within one subtest', () => {
    // Regression: a 3x3 visual puzzle can only be tiled ten ways once every
    // piece must have three cells, so more than half of all sessions showed the
    // same puzzle twice. A second sighting tests memory, not reasoning, and is
    // obvious to the examinee.
    const fingerprint = (subtest, item) => {
      switch (subtest.type) {
        case 'matrix': return JSON.stringify(item.matrix);
        case 'figure-weights': return JSON.stringify(item.premises) + JSON.stringify(item.question);
        case 'visual-puzzle': return JSON.stringify(item.answerIndices.map((i) => item.options[i]).sort());
        case 'block-design': return JSON.stringify(item.grid);
        default: return null;
      }
    };

    for (let seed = 0; seed < 120; seed += 1) {
      for (const subtest of buildSession(seed).subtests) {
        if (!subtest.items) continue;
        const marks = subtest.items.map((item) => fingerprint(subtest, item)).filter(Boolean);
        if (marks.length === 0) continue;
        assert.equal(new Set(marks).size, marks.length,
          `seed ${seed}: ${subtest.id} repeats an item within the session`);
      }
    }
  });

  test('the smallest generated pool still exceeds what a session draws from it', () => {
    // Visual Puzzles draws four 3x3 items. If that pool were not comfortably
    // larger, deduplication would be exhausting its attempts every session.
    const seen = new Set();
    for (let seed = 0; seed < 400; seed += 1) {
      const item = generateVisualPuzzleItem(createRng(seed), 3);
      seen.add(JSON.stringify(item.answerIndices.map((i) => item.options[i]).sort()));
    }
    assert.ok(seen.size > 20,
      `only ${seen.size} distinct 3x3 puzzles exist; a session draws 4 of them`);
  });

  test('reports how many units the test presents', () => {
    assert.ok(sessionLength(buildSession(1)) > 100);
  });
});

describe('raw scoring', () => {
  const session = buildSession(4242);
  const find = (id) => session.subtests.find((s) => s.id === id);

  test('verbal subtests award 2, 1 and 0 credit as keyed', () => {
    const similarities = find('si');
    const best = { answers: similarities.items.map((i) => i.options.findIndex((o) => o.credit === 2)) };
    const partial = { answers: similarities.items.map((i) => i.options.findIndex((o) => o.credit === 1)) };
    const wrong = { answers: similarities.items.map((i) => i.options.findIndex((o) => o.credit === 0)) };
    assert.equal(scoreSubtest(similarities, best), similarities.items.length * 2);
    assert.equal(scoreSubtest(similarities, partial), similarities.items.length);
    assert.equal(scoreSubtest(similarities, wrong), 0);
  });

  test('matrix and figure weights award one point per correct answer', () => {
    for (const id of ['mr', 'fw']) {
      const subtest = find(id);
      const perfect = { answers: subtest.items.map((i) => i.answerIndex) };
      assert.equal(scoreSubtest(subtest, perfect), subtest.items.length, id);
      const wrong = { answers: subtest.items.map((i) => (i.answerIndex + 1) % 5) };
      assert.equal(scoreSubtest(subtest, wrong), 0, id);
    }
  });

  test('visual puzzles accept the correct pieces in any order', () => {
    const puzzles = find('vp');
    const inOrder = { answers: puzzles.items.map((i) => [...i.answerIndices]) };
    const reversed = { answers: puzzles.items.map((i) => [...i.answerIndices].reverse()) };
    assert.equal(scoreSubtest(puzzles, inOrder), 10);
    assert.equal(scoreSubtest(puzzles, reversed), 10);
  });

  test('visual puzzles reject an incomplete or wrong selection', () => {
    const puzzles = find('vp');
    assert.equal(scoreSubtest(puzzles, { answers: puzzles.items.map((i) => i.answerIndices.slice(0, 2)) }), 0);
    assert.equal(scoreSubtest(puzzles, { answers: puzzles.items.map(() => [0, 1, 2]) }) <= 10, true);
  });

  test('block design credits an exact build, with a speed bonus on larger items', () => {
    const blocks = find('bd');
    const small = blocks.items.find((i) => i.size === 2);
    const large = blocks.items.find((i) => i.size === 3);

    const build = (item, seconds) => ({ grid: item.grid.map((r) => [...r]), elapsedSeconds: seconds });
    assert.equal(scoreBlockDesignItem(small, build(small, 10)), 4, 'small item has no bonus');
    assert.equal(scoreBlockDesignItem(large, build(large, 15)), 8, 'fastest band');
    assert.equal(scoreBlockDesignItem(large, build(large, 25)), 7);
    assert.equal(scoreBlockDesignItem(large, build(large, 35)), 6);
    assert.equal(scoreBlockDesignItem(large, build(large, 45)), 5);
    assert.equal(scoreBlockDesignItem(large, build(large, 58)), 4, 'correct but slow');
  });

  test('block design gives nothing for a wrong build or an overrun', () => {
    const blocks = find('bd');
    const large = blocks.items.find((i) => i.size === 3);
    const wrong = { grid: large.grid.map((r) => r.map(() => 'full-a')), elapsedSeconds: 10 };
    // A pattern of all one tile cannot match, since generation requires variety.
    assert.equal(scoreBlockDesignItem(large, wrong), 0);
    assert.equal(scoreBlockDesignItem(large, { grid: large.grid, elapsedSeconds: 999 }), 0);
    assert.equal(scoreBlockDesignItem(large, null), 0);
  });

  test('digit span expects the right transformation per section', () => {
    assert.deepEqual(expectedDigitResponse('forward', [3, 1, 4]), [3, 1, 4]);
    assert.deepEqual(expectedDigitResponse('backward', [3, 1, 4]), [4, 1, 3]);
    assert.deepEqual(expectedDigitResponse('sequencing', [3, 1, 4]), [1, 3, 4]);
  });

  test('digit span scores one point per correctly recalled trial', () => {
    const digitSpan = find('ds');
    const perfect = {
      answers: digitSpan.sections.map((section) =>
        section.trials.map((trial) => expectedDigitResponse(section.mode, trial.digits))),
    };
    const total = digitSpan.sections.reduce((n, s) => n + s.trials.length, 0);
    assert.equal(scoreSubtest(digitSpan, perfect), total);
    assert.equal(scoreSubtest(digitSpan, { answers: [[], [], []] }), 0);
  });

  test('picture span gives partial credit for the right symbols in the wrong order', () => {
    const pictureSpan = find('pc');
    const exact = { answers: pictureSpan.trials.map((t) => [...t.stimulus]) };
    assert.equal(scoreSubtest(pictureSpan, exact), pictureSpan.trials.length * 2);

    // Reversing a span of 2 or more changes the order but not the set, except
    // where the span is 1 (there are none here).
    const reversed = { answers: pictureSpan.trials.map((t) => [...t.stimulus].reverse()) };
    assert.equal(scoreSubtest(pictureSpan, reversed), pictureSpan.trials.length);
  });

  test('symbol search subtracts errors and never goes below zero', () => {
    const search = find('ss');
    assert.equal(scoreSubtest(search, { correct: 30, incorrect: 5 }), 25);
    assert.equal(scoreSubtest(search, { correct: 3, incorrect: 40 }), 0);
  });

  test('a skipped subtest scores null rather than zero', () => {
    const session2 = buildSession(11);
    const { raw, scaled } = scoreSession(session2, { si: { skipped: true } });
    assert.equal(raw.si, null);
    assert.equal(scaled.si, null);
  });

  test('a speeded subtest attempted with nothing correct scores 0, not null', () => {
    // Coding and Symbol Search carry an `attempted` count. A zero count must
    // not be mistaken for the skip flag, or a genuine floor performance would
    // disappear from the profile instead of being reported.
    const session2 = buildSession(11);
    const coding = session2.subtests.find((s) => s.id === 'cd');
    const search = session2.subtests.find((s) => s.id === 'ss');
    assert.equal(scoreSubtest(coding, { correct: 0, attempted: 0 }), 0);
    assert.equal(scoreSubtest(search, { correct: 0, incorrect: 0, attempted: 0 }), 0);

    const { raw, scaled } = scoreSession(session2, {
      cd: { correct: 0, attempted: 0 },
      ss: { correct: 0, incorrect: 0, attempted: 0 },
    });
    assert.equal(raw.cd, 0);
    assert.equal(raw.ss, 0);
    assert.ok(scaled.cd >= 1, 'a floor performance still yields a scaled score');
  });

  test('every primary subtest appears in a scored session', () => {
    const { raw, scaled } = scoreSession(buildSession(12), {});
    for (const subtest of SUBTESTS) {
      assert.ok(subtest.id in raw, `${subtest.id} missing from raw scores`);
      assert.ok(subtest.id in scaled, `${subtest.id} missing from scaled scores`);
    }
  });

  test('a perfect session produces above-average scaled scores throughout', () => {
    const session2 = buildSession(808);
    const responses = {};
    for (const subtest of session2.subtests) {
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
          responses[subtest.id] = { answers: subtest.sections.map((s) => s.trials.map((t) => expectedDigitResponse(s.mode, t.digits))) };
          break;
        case 'picture-span':
          responses[subtest.id] = { answers: subtest.trials.map((t) => [...t.stimulus]) };
          break;
        case 'coding':
          responses[subtest.id] = { correct: REFERENCE_DISTRIBUTIONS.cd.maxRaw };
          break;
        case 'symbol-search':
          responses[subtest.id] = { correct: REFERENCE_DISTRIBUTIONS.ss.maxRaw, incorrect: 0 };
          break;
      }
    }
    const { raw, scaled } = scoreSession(session2, responses);
    for (const subtest of SUBTESTS) {
      assert.equal(raw[subtest.id], REFERENCE_DISTRIBUTIONS[subtest.id].maxRaw,
        `${subtest.id} should reach its maximum raw score`);
      assert.ok(scaled[subtest.id] >= 13, `${subtest.id} scaled ${scaled[subtest.id]} should be well above average`);
    }
  });
});

describe('reference distribution', () => {
  test('the reference mean maps to 10 and +1 SD to 13', () => {
    for (const [id, reference] of Object.entries(REFERENCE_DISTRIBUTIONS)) {
      assert.equal(rawToScaledScore(id, reference.mean), 10, `${id} at the mean`);
      assert.equal(rawToScaledScore(id, reference.mean + reference.sd), 13, `${id} at +1 SD`);
      assert.equal(rawToScaledScore(id, reference.mean - reference.sd), 7, `${id} at -1 SD`);
    }
  });

  test('conversion is monotonic and stays within 1-19', () => {
    for (const [id, reference] of Object.entries(REFERENCE_DISTRIBUTIONS)) {
      let previous = 0;
      for (let raw = 0; raw <= reference.maxRaw; raw += 1) {
        const scaled = rawToScaledScore(id, raw);
        assert.ok(scaled >= previous, `${id} decreased at raw ${raw}`);
        assert.ok(scaled >= 1 && scaled <= 19, `${id} out of range at raw ${raw}`);
        previous = scaled;
      }
    }
  });

  test('round-trips through the raw metric', () => {
    for (const id of Object.keys(REFERENCE_DISTRIBUTIONS)) {
      assert.equal(rawToScaledScore(id, scaledToRawScore(id, 13)), 13, id);
    }
  });

  test('every subtest declares the basis for its estimate', () => {
    for (const [id, reference] of Object.entries(REFERENCE_DISTRIBUTIONS)) {
      assert.ok(reference.basis && reference.basis.length > 30, `${id} needs a documented basis`);
      assert.ok(reference.mean > 0 && reference.mean < reference.maxRaw, `${id} implausible mean`);
      assert.ok(reference.sd > 0, `${id} needs a positive SD`);
    }
  });

  test('exposes the ceiling each subtest can actually reach', () => {
    const ceilings = scaledCeilings();
    for (const subtest of SUBTESTS) {
      assert.ok(ceilings[subtest.id] >= 13,
        `${subtest.id} ceiling ${ceilings[subtest.id]} is too low to be usable`);
      assert.ok(ceilings[subtest.id] <= 19);
    }
    // Short subtests genuinely cannot discriminate at the top of the range.
    assert.ok(ceilings.mr < 19, 'a 14-item subtest should not reach a scaled 19');
  });

  test('rawToScaledScore rejects an unknown subtest', () => {
    assert.throws(() => rawToScaledScore('zz', 10), /No reference distribution/);
  });
});
