/**
 * walkthrough.js — how to work through a problem, before you answer it.
 *
 * This is the counterpart to explain.js, and the difference matters:
 *
 *   explain.js    runs AFTER an answer. It says what the answer was and why.
 *   walkthrough.js runs BEFORE. It teaches the method, one step at a time,
 *                 so you can stop as soon as you see it and finish yourself.
 *
 * Steps are returned as a list and revealed one at a time by the UI, rather
 * than dumped at once — a walkthrough that hands over the answer in its first
 * sentence is just the explanation with extra clicks.
 *
 * `revealsAnswer` is the honest part. Some walkthroughs necessarily end at the
 * answer (a matrix rule, once stated, determines the missing cell). Others are
 * pure strategy that gives nothing away: no walkthrough can tell you which
 * digits you just saw. The practice area uses this flag to decide whether an
 * item still counts toward your accuracy, so strategy advice is never penalised.
 *
 * Pure: takes item data, returns text. No DOM, no I/O.
 */

const ATTRIBUTE_NAMES = {
  shape: 'the shape',
  fill: 'the shading',
  count: 'the number of shapes',
  rotation: 'the angle',
};

const SHAPE_NAMES = {
  circle: 'circle', square: 'square', triangle: 'triangle',
  diamond: 'diamond', hexagon: 'hexagon', star: 'star',
};

const FILL_NAMES = { solid: 'solid', outline: 'outline', half: 'half-filled' };

/** How to *look* for each rule, phrased as an instruction rather than a fact. */
const RULE_METHOD = {
  constantInRow:
    'read along one row — it never changes. Then compare that row with the next one, ' +
    'where it is different. So it is fixed by which row you are in.',
  constantInColumn:
    'read down one column — it never changes. Then compare that column with the next, ' +
    'where it is different. So it is fixed by which column you are in.',
  progression:
    'read along a row — it moves on one step each time you go right, wrapping back ' +
    'round at the end.',
  latinSquare:
    'each of its three values appears exactly once in every row and once in every ' +
    'column, like a sudoku. So the missing cell takes whichever value its row and ' +
    'column do not already have.',
};

/**
 * An attribute value as a reader would say it, article included where one is
 * needed: "a triangle", "an outline", "45°", "2".
 */
function valueOf(attribute, value) {
  if (attribute === 'shape') {
    const name = SHAPE_NAMES[value] ?? value;
    return `${aOrAn(name)} ${name}`;
  }
  if (attribute === 'fill') return FILL_NAMES[value] ?? value;
  if (attribute === 'rotation') return `${value}°`;
  return String(value);
}

function shapes(count, shape, colour) {
  const name = SHAPE_NAMES[shape] ?? shape;
  const tinted = colour ? `${colour} ${name}` : name;
  return `${count} ${tinted}${count === 1 ? '' : 's'}`;
}

function list(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------------------

/** Matrix Reasoning: eliminate what is constant, name the rules, apply them. */
export function walkMatrix(item) {
  const steps = [];

  const held = Object.keys(item.fixed ?? {});
  if (held.length > 0) {
    steps.push(
      `Start by ruling things out. ${sentenceCase(list(held.map((a) => ATTRIBUTE_NAMES[a])))} ` +
      `${held.length === 1 ? 'is' : 'are'} the same in all eight cells, so ` +
      `${held.length === 1 ? 'it tells' : 'they tell'} you nothing. Ignore ` +
      `${held.length === 1 ? 'it' : 'them'} and look only at what varies.`);
  } else {
    steps.push('Every feature varies here, so take them one at a time rather than ' +
               'trying to see the whole pattern at once.');
  }

  for (const { attribute, rule } of item.rules) {
    steps.push(`Take ${ATTRIBUTE_NAMES[attribute]}: ${RULE_METHOD[rule] ?? rule}`);
  }

  const answer = item.options[item.answerIndex];
  const conclusions = item.rules.map(({ attribute }) =>
    `${ATTRIBUTE_NAMES[attribute]} must be ${valueOf(attribute, answer[attribute])}`);
  steps.push(
    `Now apply ${item.rules.length === 1 ? 'that' : 'both'} to the empty cell — bottom ` +
    `row, right column. There, ${list(conclusions)}.`);

  steps.push(
    `Now find the option that matches on every count: ` +
    `${shapes(answer.count, answer.shape)}, ${FILL_NAMES[answer.fill] ?? answer.fill}` +
    `${answer.rotation ? `, turned ${answer.rotation}°` : ''}. ` +
    'Check each option against all of them — the wrong ones differ in exactly one.');

  return { revealsAnswer: true, steps };
}

/** Figure Weights: read each scale as a swap you are allowed to make. */
export function walkFigureWeights(item) {
  const steps = [];
  const question = item.question;

  steps.push(
    'Read a balanced scale as a swap you are allowed to make: whatever is on one ' +
    'side can always be replaced by whatever is on the other, however many times ' +
    'you like.');

  item.premises.forEach((premise, index) => {
    steps.push(
      `${index === 0 ? 'Your first swap' : 'Your second swap'}: ` +
      `${shapes(premise.left.count, premise.left.shape, premise.left.color)} ` +
      `↔ ${shapes(premise.right.count, premise.right.shape, premise.right.color)}.`);
  });

  if (item.premises.length === 1) {
    const premise = item.premises[0];
    const multiple = question.left.count / premise.left.count;
    steps.push(
      `The question has ${shapes(question.left.count, question.left.shape, question.left.color)}. ` +
      `That is the left side of your swap ${formatMultiple(multiple)} over.`);
    steps.push(
      `So apply the swap ${formatMultiple(multiple)}: ` +
      `${shapes(item.answer, question.rightShape.shape, question.rightShape.color)}.`);
  } else {
    const [first, second] = item.premises;
    steps.push(
      `Neither swap alone gets you from ${question.left.color} to ` +
      `${question.rightShape.color}. Go through the middle shape: ` +
      `${first.right.color} ${SHAPE_NAMES[first.right.shape]}s appear in both swaps.`);
    steps.push(
      `Convert the question's ${shapes(question.left.count, question.left.shape, question.left.color)} ` +
      `into ${second.left.color} ${SHAPE_NAMES[second.left.shape]}s first, then convert those ` +
      `into ${question.rightShape.color} ${SHAPE_NAMES[question.rightShape.shape]}s.`);
    steps.push(
      `Following it through gives ` +
      `${shapes(item.answer, question.rightShape.shape, question.rightShape.color)}.`);
  }

  steps.push('Then just count the shapes in each option and pick the one that matches.');
  return { revealsAnswer: true, steps };
}

function formatMultiple(multiple) {
  if (multiple === 2) return 'twice';
  if (multiple === 3) return 'three times';
  if (multiple === 1) return 'once';
  return `${multiple} times`;
}

/**
 * The two things being compared, phrased as the item's authored stem phrases
 * them — with an article where one belongs and without where it does not.
 *
 * Deriving this from the stem rather than re-deciding it keeps one source of
 * truth: several pairs are mass nouns ("How are north and west alike?"), and
 * prefixing an article to those produces "a north".
 */
function nounPhrases(item) {
  const match = /^How are (.+?) and (.+?) alike\?$/.exec(item.stem ?? '');
  return match ? [match[1], match[2]] : item.pair;
}

/** Similarities: push for a category, not a shared feature. */
export function walkSimilarities(item) {
  const [first, second] = nounPhrases(item);
  const best = item.responses.find((r) => r.credit === 2);

  return {
    revealsAnswer: true,
    steps: [
      `Ask the question in two halves: what kind of thing is ${first}? ` +
      `And what kind of thing is ${second}?`,

      'Then look for the answer that names a category covering both of them. ' +
      'A category beats a shared feature: "both have wheels" is true, but "both are ' +
      'vehicles" says what they are.',

      'Rule out anything true of only one of the two, or true of both only by ' +
      'coincidence. That usually leaves two answers standing.',

      'Of the two left, one names the category and one describes a property. ' +
      'The category is the full-credit answer.',

      `Here that category is: ${lowerFirst(best.text)}`,
    ],
  };
}

/** Vocabulary: rank by precision, not plausibility. */
export function walkVocabulary(item) {
  const best = item.responses.find((r) => r.credit === 2);

  return {
    revealsAnswer: true,
    steps: [
      `Before reading the options, try to define "${item.word}" in your own words. ` +
      'Going in with an answer stops a plausible-sounding option pulling you off it.',

      'Now eliminate. Cross out anything simply wrong — usually two of the four ' +
      'are wrong rather than merely vague.',

      'Of what is left, one answer is vaguer and one is precise. Both may be ' +
      'defensible; the question is which one pins the meaning down rather than ' +
      'gesturing at it.',

      `The precise definition here is: ${lowerFirst(best.text)}`,
    ],
  };
}

/** Visual Puzzles: count first, then anchor on a corner. */
export function walkVisualPuzzle(item) {
  const total = item.size * item.size;
  const letters = item.answerIndices.map((i) => String.fromCharCode(65 + i));

  return {
    revealsAnswer: true,
    steps: [
      `The target is ${total} squares. Your three pieces have to add up to exactly ` +
      `${total} — so start by counting squares and discard any three that cannot total ${total}.`,

      'Each piece is shown in the position it occupies, and pieces are never rotated ' +
      'or flipped. So this is not a mental-rotation puzzle: it is about which pieces ' +
      'slot together without clashing.',

      'Anchor on a corner. A corner square can usually be covered by only one or two ' +
      'of the pieces, which fixes your first choice quickly.',

      'With that piece fixed, look at which squares are still empty and find a piece ' +
      'covering one of them without overlapping what you have already placed. Repeat.',

      `The three that fit here are ${letters.join(', ')}.`,
    ],
  };
}

/**
 * Block Design: tile by tile, never the whole pattern at once.
 * Given the current build, this points at the first tile that differs.
 */
export function walkBlockDesign(item, working) {
  const steps = [
    'Do not try to see the whole pattern at once. Work one tile at a time, left to ' +
    'right along the top row, then the next row down.',

    'For each tile of the target ask three questions: is it entirely red, entirely ' +
    'white, or split on a diagonal? If it is split, which corner holds the red half?',

    'Then click the matching tile in your grid until it shows that face, and move on. ' +
    'Each click steps through the six faces in the same order, so if you overshoot, ' +
    'keep clicking round.',
  ];

  const mismatch = firstMismatch(item.grid, working);
  if (mismatch) {
    steps.push(
      `Right now, the first tile that does not match is row ${mismatch.row + 1}, ` +
      `column ${mismatch.column + 1}. The target has ${describeTile(mismatch.target)} there.`);
  } else if (working) {
    steps.push('Your grid already matches the target on every tile.');
  }

  steps.push(
    'When every tile matches, press Check. In the test this task is timed and speed ' +
    'earns extra credit, so building a rhythm matters as much as being right.');

  return { revealsAnswer: false, steps };
}

function firstMismatch(target, working) {
  if (!working) return null;
  for (let row = 0; row < target.length; row += 1) {
    for (let column = 0; column < target[row].length; column += 1) {
      if (target[row][column] !== working[row][column]) {
        return { row, column, target: target[row][column] };
      }
    }
  }
  return null;
}

function describeTile(state) {
  const corners = {
    'diag-ab-tl': 'red in the top-left half',
    'diag-ab-tr': 'red in the top-right half',
    'diag-ab-br': 'red in the bottom-right half',
    'diag-ab-bl': 'red in the bottom-left half',
  };
  if (state === 'full-a') return 'a fully red tile';
  if (state === 'full-b') return 'a fully white tile';
  return `a split tile with ${corners[state] ?? state}`;
}

/**
 * Digit Span: strategy only. No walkthrough can tell you which digits you just
 * saw, so this gives nothing away and does not count as help.
 */
export function walkDigitSpan(mode) {
  const common = [
    'Chunk as they appear. Four digits held as two pairs is far easier than four ' +
    'held separately — "7 2" then "9 4", not "7, 2, 9, 4".',

    'Say them to yourself as they come up. Sub-vocal rehearsal is what keeps a span ' +
    'alive; watching passively loses it.',
  ];

  const perMode = {
    forward: [
      'Keep rehearsing the whole run in a loop until the last digit appears, then ' +
      'type it straight out before the loop decays.',
    ],
    backward: [
      'Do not wait until the end to reverse it. Rehearse in chunks, then read the ' +
      'chunks out from the last one — reversing two pairs is much easier than ' +
      'reversing four separate digits.',
      'If it helps, picture the digits written left to right and read the picture ' +
      'backwards rather than the sound.',
    ],
    sequencing: [
      'Sort as you go rather than at the end. Hold the smallest digit you have seen ' +
      'so far, and slot each new one in relative to it.',
      'Because the answer is sorted, you only need the *set* of digits, not their ' +
      'order — which is one less thing to hold.',
    ],
  };

  return {
    revealsAnswer: false,
    steps: [...common, ...(perMode[mode] ?? [])],
  };
}

/** Picture Span: strategy only — the pictures are already gone. */
export function walkPictureSpan() {
  return {
    revealsAnswer: false,
    steps: [
      'Name each picture out loud, or in your head, as it appears. A picture you have ' +
      'named is held as a word, and words rehearse far better than images.',

      'Link the names into one silly sentence in the order they appear — "the key ' +
      'rode the bird into the mirror". A single story is one thing to hold instead ' +
      'of five.',

      'When the choices come up, walk your sentence from the start rather than ' +
      'scanning the grid for anything familiar. Scanning gets you the right pictures ' +
      'in the wrong order, which only earns partial credit.',
    ],
  };
}

/** Coding: strategy only — the key is on screen, so nothing is given away. */
export function walkCoding() {
  return {
    revealsAnswer: false,
    steps: [
      'Look at the symbol first and hold its shape, then find that shape in the key. ' +
      'Reading the key from left to right every time is what makes this slow.',

      'Group the key by feature as you go — which symbols have a circle in them, ' +
      'which have crossing lines, which are made of straight bars. Then a symbol ' +
      'sends you to a small part of the key rather than all nine.',

      'Pairs you use often will start to come without looking. In the timed version ' +
      'that is most of the score: everyone can do the lookup, so speed is what varies.',
    ],
  };
}

/** Symbol Search: strategy only. */
export function walkSymbolSearch() {
  return {
    revealsAnswer: false,
    steps: [
      'Fix both targets in mind before you look right at all. Glancing back and forth ' +
      'between the two panels is the main thing that costs time here.',

      'Then sweep the group once, left to right, and stop the moment you hit a match. ' +
      'You do not need to check the rest — one match is enough for yes.',

      'Only answer no once you have been past every symbol. Wrong answers are ' +
      'subtracted in the test, so a guess costs you more than the second it saves.',
    ],
  };
}

// --- helpers ---------------------------------------------------------------

function sentenceCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowerFirst(text) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function aOrAn(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}
