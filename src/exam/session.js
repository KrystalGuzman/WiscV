/**
 * session.js — practice-test construction and raw scoring.
 *
 * Builds a complete, reproducible test from a single seed: every item on every
 * subtest is generated up front, so a session can be replayed exactly and a
 * reported result can be checked against the items that produced it.
 *
 * Pure: no DOM, no timers, no I/O. The UI drives presentation and timing and
 * hands responses back here to be scored.
 */

import { createRng, randomSeed } from './rng.js';
import {
  generateMatrixItem, generateFigureWeightsItem, generateBlockDesignItem,
  generateVisualPuzzleItem, generateCodingKey, generateCodingSequence,
  generateSymbolSearchRow,
} from './generators.js';
import { SIMILARITIES_ITEMS, VOCABULARY_ITEMS, PICTURE_SYMBOLS } from './verbal-items.js';
import { rawToScaledScore } from './reference.js';
import { SUBTESTS, getSubtest } from '../core/model.js';

/**
 * Discontinue rules.
 *
 * Real Wechsler administration stops a subtest after a run of consecutive
 * failures, on the reasoning that later items are harder and continuing costs
 * time without yielding information. The same logic applies here, and it keeps
 * the practice test to a reasonable length.
 *
 * Items never reached score zero, which is what the rule presumes.
 */
export const DISCONTINUE_RULES = Object.freeze({
  si: 3, vo: 4, mr: 4, fw: 4, vp: 3, bd: 2,
});

/** Per-item time limits in seconds, where the task is timed. */
export const TIME_LIMITS = Object.freeze({
  bd2: 30, bd3: 60, vp: 30, coding: 120, symbolSearch: 120,
});

/**
 * Build a full practice test.
 * @param {number} [seed] omit for a fresh random session
 */
export function buildSession(seed = randomSeed()) {
  const rng = createRng(seed);

  return {
    seed,
    createdAt: new Date().toISOString(),
    subtests: [
      {
        id: 'si', type: 'verbal-choice', name: 'Similarities', domain: 'vc',
        prompt: 'In what way are these two things alike?',
        items: SIMILARITIES_ITEMS.map((item, i) => ({
          index: i,
          stem: item.stem,
          // Options are shuffled per session so position gives nothing away.
          options: rng.shuffle(item.responses),
        })),
        discontinue: DISCONTINUE_RULES.si,
      },
      {
        id: 'vo', type: 'verbal-choice', name: 'Vocabulary', domain: 'vc',
        prompt: 'What does this word mean?',
        items: VOCABULARY_ITEMS.map((item, i) => ({
          index: i,
          stem: item.word,
          options: rng.shuffle(item.responses),
        })),
        discontinue: DISCONTINUE_RULES.vo,
      },
      {
        id: 'bd', type: 'block-design', name: 'Block Design', domain: 'vs',
        prompt: 'Rebuild the pattern by clicking the tiles to rotate them.',
        items: buildBlockDesignItems(rng),
        discontinue: DISCONTINUE_RULES.bd,
      },
      {
        id: 'vp', type: 'visual-puzzle', name: 'Visual Puzzles', domain: 'vs',
        prompt: 'Choose the three pieces that fit together to make the shape.',
        items: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          timeLimit: TIME_LIMITS.vp,
          ...generateVisualPuzzleItem(rng, i < 4 ? 3 : 4),
        })),
        discontinue: DISCONTINUE_RULES.vp,
      },
      {
        id: 'mr', type: 'matrix', name: 'Matrix Reasoning', domain: 'fr',
        prompt: 'Which option completes the pattern?',
        items: Array.from({ length: 14 }, (_, i) => ({
          index: i,
          // Difficulty is the number of attributes varying at once.
          ...generateMatrixItem(rng, i < 4 ? 1 : i < 9 ? 2 : 3),
        })),
        discontinue: DISCONTINUE_RULES.mr,
      },
      {
        id: 'fw', type: 'figure-weights', name: 'Figure Weights', domain: 'fr',
        prompt: 'Which option balances the last scale?',
        items: Array.from({ length: 14 }, (_, i) => ({
          index: i,
          ...generateFigureWeightsItem(rng, { chained: i >= 5 }),
        })),
        discontinue: DISCONTINUE_RULES.fw,
      },
      {
        id: 'ds', type: 'digit-span', name: 'Digit Span', domain: 'wm',
        prompt: 'Watch the digits, then type them back.',
        sections: buildDigitSpanSections(rng),
      },
      {
        id: 'pc', type: 'picture-span', name: 'Picture Span', domain: 'wm',
        prompt: 'Remember the pictures, then pick them in the order you saw them.',
        trials: buildPictureSpanTrials(rng),
      },
      {
        id: 'cd', type: 'coding', name: 'Coding', domain: 'ps',
        prompt: 'Type the digit that matches each symbol, as fast as you can.',
        key: generateCodingKey(rng),
        sequence: generateCodingSequence(rng, 160),
        duration: TIME_LIMITS.coding,
      },
      {
        id: 'ss', type: 'symbol-search', name: 'Symbol Search', domain: 'ps',
        prompt: 'Does either target symbol appear in the search group?',
        rows: Array.from({ length: 80 }, () => generateSymbolSearchRow(rng)),
        duration: TIME_LIMITS.symbolSearch,
      },
    ],
  };
}

function buildBlockDesignItems(rng) {
  // Three 2x2 items to establish the task, then five 3x3 items where the
  // speed bonus produces most of the variance.
  const sizes = [2, 2, 2, 3, 3, 3, 3, 3];
  return sizes.map((size, i) => ({
    index: i,
    timeLimit: size === 2 ? TIME_LIMITS.bd2 : TIME_LIMITS.bd3,
    baseCredit: 4,
    speedBonus: size === 3,
    ...generateBlockDesignItem(rng, size),
  }));
}

function buildDigitSpanSections(rng) {
  const section = (mode, label, instruction, spans) => ({
    mode,
    label,
    instruction,
    trials: spans.flatMap((span) => [0, 1].map((trial) => ({
      span,
      trial,
      digits: buildDigitRun(rng, span),
    }))),
  });

  return [
    section('forward', 'Forward', 'Type the digits in the same order.',
      [2, 3, 4, 5, 6, 7, 8, 9]),
    section('backward', 'Backward', 'Type the digits in reverse order.',
      [2, 3, 4, 5, 6, 7, 8]),
    section('sequencing', 'Sequencing', 'Type the digits in increasing numerical order.',
      [2, 3, 4, 5, 6, 7, 8]),
  ];
}

/**
 * A digit run with no immediate repeats and no straight ascending or
 * descending runs, both of which are far easier to hold than an arbitrary
 * sequence and would make the span misleading.
 */
function buildDigitRun(rng, length) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const digits = [];
    while (digits.length < length) {
      const digit = rng.int(1, 9);
      if (digits.length > 0 && digits[digits.length - 1] === digit) continue;
      digits.push(digit);
    }
    if (length >= 3 && isMonotonicRun(digits)) continue;
    return digits;
  }
  return Array.from({ length }, () => rng.int(1, 9));
}

function isMonotonicRun(digits) {
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  return ascending || descending;
}

function buildPictureSpanTrials(rng) {
  // Spans of 2 to 6 symbols, two trials each.
  return [2, 3, 4, 5, 6].flatMap((span) => [0, 1].map((trial) => {
    const stimulus = rng.sample([...PICTURE_SYMBOLS], span);
    // The response array holds the targets plus distractors, so recognising
    // the set is not enough on its own.
    const distractors = rng.sample(
      PICTURE_SYMBOLS.filter((s) => !stimulus.includes(s)),
      Math.min(4, PICTURE_SYMBOLS.length - span)
    );
    return {
      span,
      trial,
      stimulus,
      response: rng.shuffle([...stimulus, ...distractors]),
      exposureMs: 1000 + span * 700,
    };
  }));
}

// ---------------------------------------------------------------------------
// Raw scoring
// ---------------------------------------------------------------------------

/**
 * Score one subtest from the responses collected for it.
 * Returns null when the subtest was skipped entirely, which keeps a skipped
 * subtest out of the composites rather than scoring it as zero.
 */
export function scoreSubtest(subtest, responses) {
  // `skipped` is deliberately its own flag rather than an absent/zero score:
  // the speeded subtests track an `attempted` *count*, and a taker who tried
  // Coding and got nothing right must score 0, not vanish from the profile.
  if (!responses || responses.skipped === true) return null;

  switch (subtest.type) {
    case 'verbal-choice':
      return sumCredits(subtest.items, responses.answers, (item, answer) =>
        item.options[answer]?.credit ?? 0);

    case 'matrix':
    case 'figure-weights':
      return sumCredits(subtest.items, responses.answers, (item, answer) =>
        (answer === item.answerIndex ? 1 : 0));

    case 'visual-puzzle':
      return sumCredits(subtest.items, responses.answers, (item, answer) => {
        if (!Array.isArray(answer) || answer.length !== 3) return 0;
        const chosen = [...answer].sort((a, b) => a - b);
        return chosen.every((v, i) => v === item.answerIndices[i]) ? 1 : 0;
      });

    case 'block-design':
      return sumCredits(subtest.items, responses.answers, (item, answer) =>
        scoreBlockDesignItem(item, answer));

    case 'digit-span':
      return scoreDigitSpan(subtest, responses);

    case 'picture-span':
      return scorePictureSpan(subtest, responses);

    case 'coding':
      return responses.correct ?? 0;

    case 'symbol-search':
      // Correct minus incorrect, floored at zero, so guessing is not rewarded.
      return Math.max(0, (responses.correct ?? 0) - (responses.incorrect ?? 0));

    default:
      throw new Error(`Unknown subtest type: ${subtest.type}`);
  }
}

function sumCredits(items, answers, creditOf) {
  if (!answers) return 0;
  return items.reduce((total, item, i) => {
    const answer = answers[i];
    return answer === undefined || answer === null ? total : total + creditOf(item, answer);
  }, 0);
}

/**
 * Block design: base credit for an exact reconstruction within the limit, plus
 * a speed bonus on the larger items, where finishing quickly is the main thing
 * that separates performances.
 */
export function scoreBlockDesignItem(item, answer) {
  if (!answer || !answer.grid || answer.elapsedSeconds > item.timeLimit) return 0;

  const target = item.grid.flat();
  const built = answer.grid.flat();
  if (built.length !== target.length) return 0;
  if (!built.every((tile, i) => tile === target[i])) return 0;

  if (!item.speedBonus) return item.baseCredit;

  const elapsed = answer.elapsedSeconds;
  const bonus = elapsed <= 20 ? 4 : elapsed <= 30 ? 3 : elapsed <= 40 ? 2 : elapsed <= 50 ? 1 : 0;
  return item.baseCredit + bonus;
}

/** One point per correctly recalled trial, across all three sections. */
function scoreDigitSpan(subtest, responses) {
  let total = 0;
  subtest.sections.forEach((section, sectionIndex) => {
    section.trials.forEach((trial, trialIndex) => {
      const answer = responses.answers?.[sectionIndex]?.[trialIndex];
      if (!answer) return;
      if (arraysEqual(answer, expectedDigitResponse(section.mode, trial.digits))) total += 1;
    });
  });
  return total;
}

/** What a correct response looks like for each digit-span condition. */
export function expectedDigitResponse(mode, digits) {
  if (mode === 'backward') return [...digits].reverse();
  if (mode === 'sequencing') return [...digits].sort((a, b) => a - b);
  return [...digits];
}

/**
 * Picture span: 2 for the right symbols in the right order, 1 for the right
 * symbols in the wrong order. Partial credit separates a memory failure for
 * the items from a failure for their order.
 */
function scorePictureSpan(subtest, responses) {
  let total = 0;
  subtest.trials.forEach((trial, i) => {
    const answer = responses.answers?.[i];
    if (!Array.isArray(answer) || answer.length !== trial.stimulus.length) return;
    if (arraysEqual(answer, trial.stimulus)) total += 2;
    else if (sameSet(answer, trial.stimulus)) total += 1;
  });
  return total;
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) &&
         a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

/**
 * Score a whole session: raw scores, then scaled scores against the reference
 * distribution, ready to feed the composite scoring engine.
 */
export function scoreSession(session, allResponses) {
  const raw = {};
  const scaled = {};

  for (const subtest of session.subtests) {
    const rawScore = scoreSubtest(subtest, allResponses[subtest.id]);
    raw[subtest.id] = rawScore;
    scaled[subtest.id] = rawScore == null ? null : rawToScaledScore(subtest.id, rawScore);
  }

  // Every primary subtest must appear, so a skipped one reads as absent rather
  // than as missing from the object entirely.
  for (const subtest of SUBTESTS) {
    if (!(subtest.id in raw)) { raw[subtest.id] = null; scaled[subtest.id] = null; }
  }

  return { raw, scaled };
}

/** Total items presented across the whole test, for the progress display. */
export function sessionLength(session) {
  return session.subtests.reduce((total, subtest) => {
    if (subtest.items) return total + subtest.items.length;
    if (subtest.trials) return total + subtest.trials.length;
    if (subtest.sections) return total + subtest.sections.reduce((n, s) => n + s.trials.length, 0);
    return total + 1;   // the two speeded subtests are one timed block each
  }, 0);
}

export { getSubtest };
