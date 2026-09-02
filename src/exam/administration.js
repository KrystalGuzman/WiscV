/**
 * administration.js — the examiner script.
 *
 * The WISC-V is individually administered: a qualified examiner sits with the
 * child and reads standardised instructions and prompts aloud. That is not
 * incidental. Several subtests are *auditory* by design — Digit Span presents
 * its numbers by voice, one per second, and never shows them — so a version
 * that puts everything on screen is measuring something different.
 *
 * This module holds the spoken script: what the examiner says, where a teaching
 * item comes before the scored ones, and which prompts may be repeated on
 * request. It is data and pure helpers only; src/ui/speech.js does the talking.
 *
 * The wording here is written for this project. Published manuals specify their
 * instructions verbatim and that text is copyrighted, so none of it is
 * reproduced; these serve the same function in the same register.
 */

/** Words per minute a synthetic voice manages at rate 1.0, near enough. */
const WORDS_PER_MINUTE = 150;

/**
 * How long a phrase should take to speak, in milliseconds.
 *
 * Used as a settlement deadline, never as the sole source of truth: browsers
 * with no voices installed fail an utterance instantly, and some fire no events
 * at all, so anything waiting on speech needs a timer that cannot hang. A
 * generous margin is deliberate — finishing the wait early cuts the examiner
 * off mid-sentence, which is worse than a short pause.
 */
export function estimateSpeechMs(text, rate = 1) {
  if (text === null || text === undefined) return 0;
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const speaking = (words / WORDS_PER_MINUTE) * 60000 / Math.max(0.1, rate);
  return Math.round(400 + speaking * 1.35);
}

/**
 * Digit Span pacing. Real administration reads digits at about one per second,
 * evenly, with no grouping — grouping them would do the examinee's chunking for
 * them and inflate the span.
 */
export const DIGIT_INTERVAL_MS = 1000;

/** Each digit as its own utterance, so the cadence is the app's, not the voice's. */
export function digitSchedule(digits, { intervalMs = DIGIT_INTERVAL_MS } = {}) {
  return digits.map((digit, index) => ({
    digit,
    text: String(digit),
    atMs: index * intervalMs,
  }));
}

/**
 * The examiner script, per subtest.
 *
 *   intro       spoken once, before the subtest begins
 *   prompt      spoken for each item; a function where it varies by item
 *   sample      an optional teaching item, answered with feedback and not scored
 *   repeatable  whether "Say that again" is offered
 *   auditory    whether the stimulus itself is spoken rather than shown
 */
export const EXAMINER_SCRIPT = Object.freeze({
  opening:
    "We're going to do a number of different things together. Some will be easy " +
    'and some will get harder. Nobody is expected to get everything right, so ' +
    'just do your best on each one.',

  closing:
    "That's everything. Thank you for working through it.",

  si: {
    intro:
      "I'm going to say two things, and I'd like you to tell me how they are " +
      'alike — what they have in common.',
    prompt: (item) => item.stem,
    repeatable: true,
    auditory: false,
    sample: {
      stem: 'In what way are a cup and a glass alike?',
      spoken: 'In what way are a cup and a glass alike?',
      options: [
        { text: 'They are both things you drink from.', credit: 2 },
        { text: 'They both hold water.', credit: 1 },
        { text: 'They are both made of glass.', credit: 0 },
        { text: 'They are both round.', credit: 0 },
      ],
      teach:
        'The best answer is that they are both things you drink from — it says ' +
        'what kind of thing they both are. Look for that sort of answer.',
    },
  },

  vo: {
    intro: "I'm going to say a word, and I'd like you to tell me what it means.",
    prompt: (item) => `What does ${item.stem} mean?`,
    repeatable: true,
    auditory: false,
    sample: {
      stem: 'chair',
      spoken: 'What does chair mean?',
      options: [
        { text: 'A seat for one person, with a back.', credit: 2 },
        { text: 'Something you sit on.', credit: 1 },
        { text: 'A table you eat at.', credit: 0 },
        { text: 'A room in a house.', credit: 0 },
      ],
      teach:
        'Both of the first two are true, but the first one is more exact. When ' +
        'two answers are both right, choose the more precise one.',
    },
  },

  bd: {
    intro:
      "I'm going to show you a pattern. Use the tiles beside it to make the same " +
      'pattern. Work as quickly as you can, and press Check as soon as you have finished.',
    prompt: () => 'Make this pattern.',
    repeatable: true,
    auditory: false,
  },

  vp: {
    intro:
      "I'm going to show you a complete shape, and some pieces below it. Choose " +
      'the three pieces that fit together to make that shape exactly.',
    prompt: () => 'Which three pieces make this shape?',
    repeatable: true,
    auditory: false,
  },

  mr: {
    intro:
      "I'm going to show you a pattern with one part missing. Look at the whole " +
      'pattern, then choose the piece that belongs in the empty space.',
    prompt: () => 'Which one goes here?',
    repeatable: true,
    auditory: false,
  },

  fw: {
    intro:
      "I'm going to show you some scales that balance. Work out what needs to go " +
      'on the empty side of the last one so that it balances too.',
    prompt: () => 'What makes this one balance?',
    repeatable: true,
    auditory: false,
  },

  ds: {
    intro:
      "Now I'm going to say some numbers out loud. Listen carefully, because I " +
      'can only say them once. When I stop, type them back.',
    prompt: (context) => ({
      forward: 'Listen, then type the numbers in the same order.',
      backward: 'This time, type the numbers backwards — start with the last one.',
      sequencing: 'This time, type the numbers in order, smallest first.',
    }[context.mode]),
    // Repetition is refused here, not merely unsupported: hearing a sequence
    // twice measures something other than span.
    repeatable: false,
    auditory: true,
  },

  pc: {
    intro:
      "I'm going to show you some pictures for a few seconds. When they " +
      'disappear, find them again and choose them in the order you saw them.',
    prompt: () => 'Remember these, in order.',
    repeatable: false,
    auditory: false,
  },

  cd: {
    intro:
      'Each symbol goes with a number. The key stays on the screen the whole time. ' +
      'Type the number that goes with each symbol, working as quickly as you can ' +
      'without missing any. You have two minutes.',
    prompt: () => 'Which number goes with this symbol?',
    repeatable: true,
    auditory: false,
  },

  ss: {
    intro:
      "I'm going to show you two symbols on the left, and a group of symbols on " +
      'the right. If either of the two appears in the group, answer yes. If neither ' +
      'is there, answer no. Work as quickly as you can. You have two minutes.',
    prompt: () => 'Is either symbol in the group?',
    repeatable: true,
    auditory: false,
  },
});

/** The script for one subtest, or null if it has none. */
export function scriptFor(subtestId) {
  return EXAMINER_SCRIPT[subtestId] ?? null;
}

/** What the examiner says for an item. `context` carries anything item-specific. */
export function promptFor(subtestId, context = {}) {
  const script = scriptFor(subtestId);
  if (!script?.prompt) return '';
  return typeof script.prompt === 'function' ? script.prompt(context) : script.prompt;
}

/** Whether a subtest allows the examinee to ask for the prompt again. */
export function isRepeatable(subtestId) {
  return scriptFor(subtestId)?.repeatable !== false;
}

/** Whether the stimulus itself is spoken rather than shown. */
export function isAuditory(subtestId) {
  return scriptFor(subtestId)?.auditory === true;
}

/** The teaching item for a subtest, if it has one. */
export function sampleFor(subtestId) {
  return scriptFor(subtestId)?.sample ?? null;
}

/**
 * What the examiner says for a teaching item.
 *
 * Kept separate from what is shown: Vocabulary displays a bare word, as the
 * scored items do, but the examiner still asks a whole question.
 */
export function sampleSpoken(subtestId) {
  const sample = sampleFor(subtestId);
  if (!sample) return '';
  return sample.spoken ?? sample.stem ?? '';
}

/**
 * Feedback on a teaching item. Sample items are taught, not scored: the point
 * is that the examinee starts the real items understanding the task.
 */
export function teachingFeedback(subtestId, chosenCredit) {
  const sample = sampleFor(subtestId);
  if (!sample) return '';
  const opening = chosenCredit === 2
    ? "That's right."
    : chosenCredit === 1
      ? "That's partly right."
      : 'Not quite.';
  return `${opening} ${sample.teach}`;
}
