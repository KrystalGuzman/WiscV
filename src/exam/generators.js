/**
 * generators.js — procedural item generation.
 *
 * These build items in the *format* of the corresponding cognitive task
 * (matrix completion, balance-scale inference, block construction, part-whole
 * assembly). The items are original and generated on the fly; none is taken
 * from any published instrument.
 *
 * Everything is driven by a seeded RNG so a session is reproducible, and every
 * generator verifies its own output: an item whose intended answer is not
 * uniquely correct is discarded and regenerated rather than shown.
 */

import { createRng } from './rng.js';

// ---------------------------------------------------------------------------
// Matrix reasoning
// ---------------------------------------------------------------------------

const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon'];
const FILLS = ['solid', 'outline', 'half'];
const COUNTS = [1, 2, 3];
const ROTATIONS = [0, 45, 90, 135];

const ATTRIBUTES = {
  shape:    SHAPES,
  fill:     FILLS,
  count:    COUNTS,
  rotation: ROTATIONS,
};

/**
 * Rotational symmetry of each shape, in degrees.
 *
 * This matters more than it looks. A square turned 90 degrees is
 * indistinguishable from an unturned one, and a circle's rotation is invisible
 * at every angle. Without accounting for that, the generator can produce a
 * matrix whose governing rule cannot be seen, or two options that look
 * identical with only one of them keyed correct.
 *
 * A period of 1 means rotation is entirely invisible for that shape.
 */
const ROTATIONAL_SYMMETRY = {
  circle: 1, square: 90, diamond: 90, triangle: 120, hexagon: 60,
};

/** The rotation as actually seen, collapsing angles a shape's symmetry hides. */
function effectiveRotation(shape, rotation) {
  const period = ROTATIONAL_SYMMETRY[shape] ?? 360;
  return period <= 1 ? 0 : rotation % period;
}

/**
 * What a cell looks like, as opposed to how it is specified. Two cells with the
 * same visual key are indistinguishable on screen however their attributes
 * differ.
 */
function visualKey(cell) {
  return `${cell.shape}/${cell.fill}/${cell.count}/${effectiveRotation(cell.shape, cell.rotation)}`;
}

/**
 * Rules that can govern how one attribute varies across a 3x3 matrix.
 * Each returns the value for cell (row, col) given three chosen values.
 */
const MATRIX_RULES = {
  /** Constant along each row; each row takes a different value. */
  constantInRow: (values, row) => values[row],
  /** Constant down each column; each column takes a different value. */
  constantInColumn: (values, _row, col) => values[col],
  /** Steps through the values across the row, wrapping. */
  progression: (values, row, col) => values[(row + col) % values.length],
  /** Latin square: every value appears once in each row and column. */
  latinSquare: (values, row, col) => values[(row * 2 + col) % values.length],
};

const RULE_NAMES = Object.keys(MATRIX_RULES);

/**
 * Generate one matrix-reasoning item.
 *
 * `varyingAttributes` sets the difficulty: one attribute varies in the easiest
 * items, three in the hardest. Non-varying attributes are held constant across
 * the whole matrix so they cannot be mistaken for the rule.
 *
 * @returns {{ matrix: Array<Array<Object>>, options: Array<Object>, answerIndex: number }}
 */
export function generateMatrixItem(rng, varyingAttributes = 2) {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const item = tryMatrixItem(rng, varyingAttributes);
    if (item) return item;
  }
  throw new Error('generateMatrixItem: could not build a valid item');
}

function tryMatrixItem(rng, varyingAttributes) {
  const names = rng.sample(Object.keys(ATTRIBUTES), Math.min(varyingAttributes, 4));
  // A rule per varying attribute; distinct rules keep the matrix from
  // collapsing into a single visible pattern repeated twice.
  const rules = rng.sample(RULE_NAMES, names.length);

  const plan = names.map((name, i) => ({
    name,
    rule: rules[i],
    values: rng.sample(ATTRIBUTES[name], 3),
  }));

  // Attributes not participating stay fixed for the whole matrix.
  const fixed = {};
  for (const [name, values] of Object.entries(ATTRIBUTES)) {
    if (!names.includes(name)) fixed[name] = rng.pick(values);
  }

  const cellAt = (row, col) => {
    const cell = { ...fixed };
    for (const { name, rule, values } of plan) {
      cell[name] = MATRIX_RULES[rule](values, row, col);
    }
    return cell;
  };

  const matrix = [0, 1, 2].map((row) => [0, 1, 2].map((col) => cellAt(row, col)));
  const answer = matrix[2][2];

  // Every distinction the rules make must be visible. If two cells differ in
  // their attributes but not on screen -- a square at 0 and at 90 degrees, any
  // two rotations of a circle -- the pattern cannot be inferred, so discard it.
  const cells = matrix.flat();
  if (new Set(cells.map(visualKey)).size !== new Set(cells.map(cellKey)).size) return null;

  matrix[2][2] = null;   // the cell to be inferred

  // Reject a matrix whose bottom row repeats an earlier row wholesale: the
  // answer would then be readable by copying rather than by inference.
  const rowKey = (row) => row.map((c) => (c ? visualKey(c) : '?')).join('|');
  if (rowKey(matrix[0]) === rowKey(matrix[1])) return null;

  // Distractors perturb exactly one attribute of the answer, so each is
  // plausible but demonstrably wrong under the rules. They are kept distinct by
  // appearance, not by attributes, so no two options can look alike.
  const distractors = [];
  const seen = new Set([visualKey(answer)]);
  for (const name of rng.shuffle(Object.keys(ATTRIBUTES))) {
    for (const value of rng.shuffle(ATTRIBUTES[name])) {
      if (value === answer[name]) continue;
      const candidate = { ...answer, [name]: value };
      const key = visualKey(candidate);
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(candidate);
      break;
    }
    if (distractors.length === 4) break;
  }
  if (distractors.length < 4) return null;

  const options = rng.shuffle([answer, ...distractors]);
  return {
    matrix,
    options,
    answerIndex: options.findIndex((o) => visualKey(o) === visualKey(answer)),
    // Structured rather than a display string: the practice area turns these
    // into an explanation, so it needs the parts, not a label.
    rules: plan.map(({ name, rule }) => ({ attribute: name, rule })),
    fixed,
  };
}

export { visualKey as matrixVisualKey };

function cellKey(cell) {
  return `${cell.shape}/${cell.fill}/${cell.count}/${cell.rotation}`;
}

// ---------------------------------------------------------------------------
// Figure weights
// ---------------------------------------------------------------------------

const WEIGHT_SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star'];
const WEIGHT_COLORS = ['red', 'blue', 'green', 'amber', 'purple', 'teal'];

/**
 * Generate a balance-scale item.
 *
 * Easy items give one equivalence and ask for a second; harder items give two
 * and require chaining through a middle term. Weights are real integers and
 * the arithmetic is solved, not approximated, so the keyed answer is provably
 * the only balancing quantity.
 */
export function generateFigureWeightsItem(rng, { chained = false } = {}) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const item = chained ? tryChainedWeights(rng) : trySimpleWeights(rng);
    if (item) return item;
  }
  throw new Error('generateFigureWeightsItem: could not build a valid item');
}

function pickShapes(rng, howMany) {
  const shapes = rng.sample(WEIGHT_SHAPES, howMany);
  const colors = rng.sample(WEIGHT_COLORS, howMany);
  return shapes.map((shape, i) => ({ shape, color: colors[i] }));
}

/** a x A  =  b x B ,  then  c x A  =  ? x B */
function trySimpleWeights(rng) {
  const [A, B] = pickShapes(rng, 2);
  const weightA = rng.int(2, 6);
  const weightB = rng.int(1, 5);
  if (weightA === weightB) return null;

  // The premise scale, in lowest terms.
  const divisor = gcd(weightA, weightB);
  const a = weightB / divisor;
  const b = weightA / divisor;
  if (a > 4 || b > 4) return null;

  // The question scale: a multiple that keeps the answer a whole number.
  const multiplier = rng.int(2, 3);
  const c = a * multiplier;
  const answer = b * multiplier;
  if (c > 6 || answer > 6 || answer < 1) return null;

  return finishWeightsItem(rng, {
    premises: [{ left: { ...A, count: a }, right: { ...B, count: b } }],
    question: { left: { ...A, count: c }, rightShape: B },
    answer,
  });
}

/** a x A = b x B ,  c x B = d x C ,  then  e x A = ? x C */
function tryChainedWeights(rng) {
  const [A, B, C] = pickShapes(rng, 3);
  const weightA = rng.int(2, 8);
  const weightB = rng.int(1, 6);
  const weightC = rng.int(1, 6);
  if (new Set([weightA, weightB, weightC]).size < 3) return null;

  const ab = gcd(weightA, weightB);
  const a = weightB / ab;
  const b = weightA / ab;
  const bc = gcd(weightB, weightC);
  const c = weightC / bc;
  const d = weightB / bc;
  if ([a, b, c, d].some((n) => n > 4)) return null;

  // Find a question quantity of A whose equivalent in C is a small integer.
  for (const e of rng.shuffle([2, 3, 4, 5, 6])) {
    const total = e * weightA;
    if (total % weightC !== 0) continue;
    const answer = total / weightC;
    if (answer < 1 || answer > 6) continue;

    return finishWeightsItem(rng, {
      premises: [
        { left: { ...A, count: a }, right: { ...B, count: b } },
        { left: { ...B, count: c }, right: { ...C, count: d } },
      ],
      question: { left: { ...A, count: e }, rightShape: C },
      answer,
    });
  }
  return null;
}

/** Build the five options: the true quantity plus four near misses. */
function finishWeightsItem(rng, { premises, question, answer }) {
  const candidates = [answer - 2, answer - 1, answer + 1, answer + 2, answer + 3]
    .filter((n) => n >= 1 && n <= 8 && n !== answer);
  if (candidates.length < 4) return null;

  const options = rng.shuffle([answer, ...rng.sample(candidates, 4)])
    .map((count) => ({ ...question.rightShape, count }));

  return {
    premises,
    question,
    options,
    answerIndex: options.findIndex((o) => o.count === answer),
    answer,
  };
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// ---------------------------------------------------------------------------
// Block design
// ---------------------------------------------------------------------------

/**
 * Tile states. Each block face is either wholly one colour or split on a
 * diagonal, which is what makes the construction task non-trivial.
 */
export const TILE_STATES = Object.freeze([
  'full-a', 'full-b', 'diag-ab-tl', 'diag-ab-tr', 'diag-ab-br', 'diag-ab-bl',
]);

/**
 * Generate a block-design target pattern.
 * A pattern using only whole-colour tiles is rejected: the diagonal tiles are
 * the point of the task.
 */
export function generateBlockDesignItem(rng, size = 2) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const grid = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => rng.pick(TILE_STATES)));

    const flat = grid.flat();
    const diagonals = flat.filter((t) => t.startsWith('diag')).length;
    if (diagonals < Math.max(2, Math.floor(flat.length / 3))) continue;
    if (new Set(flat).size < 3) continue;   // too uniform to require analysis

    return { size, grid };
  }
  throw new Error('generateBlockDesignItem: could not build a valid pattern');
}

// ---------------------------------------------------------------------------
// Visual puzzles
// ---------------------------------------------------------------------------

/**
 * Generate a part-whole assembly item.
 *
 * A square grid is partitioned into three connected pieces; the examinee picks
 * the three that reconstruct it from six options. The three distractors are
 * perturbed copies of real pieces, so they look like plausible parts.
 *
 * Uniqueness is then verified exhaustively: of the 20 possible triples, exactly
 * one must tile the square. Anything else is regenerated.
 */
export function generateVisualPuzzleItem(rng, size = 4) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const pieces = partitionSquare(rng, size);
    if (!pieces) continue;

    const distractors = [];
    for (const piece of pieces) {
      const perturbed = perturbPiece(rng, piece, size);
      if (perturbed) distractors.push(perturbed);
    }
    if (distractors.length < 3) continue;

    const options = rng.shuffle([...pieces, ...distractors.slice(0, 3)]);
    const answerIndices = pieces.map((piece) =>
      options.findIndex((o) => sameCells(o, piece)));
    if (answerIndices.some((i) => i < 0)) continue;

    if (countTilings(options, size) !== 1) continue;   // must be uniquely solvable

    return { size, options, answerIndices: answerIndices.sort((a, b) => a - b) };
  }
  throw new Error('generateVisualPuzzleItem: could not build a valid item');
}

/**
 * The smallest acceptable piece: about a fifth of the shape, never below two
 * cells. Keeps 4x4 puzzles substantial while letting 3x3 ones exist at all.
 */
function minimumPiece(size) {
  return Math.max(2, Math.floor((size * size) / 5));
}

/** Grow three connected regions from random seeds until every cell is claimed. */
function partitionSquare(rng, size) {
  const total = size * size;
  const owner = new Array(total).fill(-1);
  const frontiers = [[], [], []];

  const seeds = rng.sample([...Array(total).keys()], 3);
  seeds.forEach((cell, piece) => {
    owner[cell] = piece;
    frontiers[piece].push(cell);
  });

  let claimed = 3;
  while (claimed < total) {
    // Grow the smallest piece first, which keeps the three roughly balanced.
    const sizes = [0, 1, 2].map((p) => owner.filter((o) => o === p).length);
    const order = [0, 1, 2].sort((a, b) => sizes[a] - sizes[b]);

    let grew = false;
    for (const piece of order) {
      const options = [];
      for (const cell of frontiers[piece]) {
        for (const neighbour of neighbours(cell, size)) {
          if (owner[neighbour] === -1) options.push(neighbour);
        }
      }
      if (options.length === 0) continue;
      const chosen = rng.pick(options);
      owner[chosen] = piece;
      frontiers[piece].push(chosen);
      claimed += 1;
      grew = true;
      break;
    }
    if (!grew) return null;   // a piece got walled in; start over
  }

  const pieces = [0, 1, 2].map((piece) =>
    owner.map((o, cell) => (o === piece ? cell : -1)).filter((c) => c >= 0));

  // Reject slivers, but scale the floor to the grid. A 3x3 holds nine cells, so
  // demanding three per piece forces all three to be trominoes — of which there
  // are only ten tilings in total, far too few to draw four items from.
  if (pieces.some((p) => p.length < minimumPiece(size))) return null;
  return pieces;
}

/** Move one boundary cell of a piece, keeping it connected. */
function perturbPiece(rng, piece, size) {
  const cells = new Set(piece);
  const candidates = [];
  for (const cell of piece) {
    for (const neighbour of neighbours(cell, size)) {
      if (!cells.has(neighbour)) candidates.push(neighbour);
    }
  }
  for (const added of rng.shuffle(candidates)) {
    for (const removed of rng.shuffle(piece)) {
      const next = new Set(cells);
      next.add(added);
      next.delete(removed);
      if (isConnected([...next], size)) return [...next].sort((a, b) => a - b);
    }
  }
  return null;
}

function neighbours(cell, size) {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const result = [];
  if (row > 0) result.push(cell - size);
  if (row < size - 1) result.push(cell + size);
  if (col > 0) result.push(cell - 1);
  if (col < size - 1) result.push(cell + 1);
  return result;
}

function isConnected(cells, size) {
  if (cells.length === 0) return false;
  const set = new Set(cells);
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  while (queue.length > 0) {
    for (const neighbour of neighbours(queue.pop(), size)) {
      if (set.has(neighbour) && !seen.has(neighbour)) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return seen.size === cells.length;
}

/** How many of the 20 possible triples exactly tile the square. */
function countTilings(options, size) {
  const total = size * size;
  let tilings = 0;
  for (let i = 0; i < options.length; i += 1) {
    for (let j = i + 1; j < options.length; j += 1) {
      for (let k = j + 1; k < options.length; k += 1) {
        const union = new Set([...options[i], ...options[j], ...options[k]]);
        const cellCount = options[i].length + options[j].length + options[k].length;
        if (cellCount === total && union.size === total) tilings += 1;
      }
    }
  }
  return tilings;
}

function sameCells(a, b) {
  return a.length === b.length && a.every((cell, i) => cell === b[i]);
}

// ---------------------------------------------------------------------------
// Processing speed stimuli
// ---------------------------------------------------------------------------

/** Abstract glyphs for the speeded tasks: nameable shapes would let verbal
 *  rehearsal substitute for visual scanning. */
export const GLYPHS = Object.freeze([
  'M4,14 L14,4 M4,4 L14,14',                       // cross
  'M3,9 L9,3 L15,9 L9,15 Z',                       // diamond
  'M4,13 L9,4 L14,13 Z',                           // triangle
  'M4,5 H14 M4,9 H14 M4,13 H14',                   // three bars
  'M9,3 V15 M4,9 H14',                             // plus
  'M4,12 Q9,2 14,12',                              // arch
  'M4,4 H14 V14 Z',                                // half square
  'M9,3 L15,15 H3 Z M9,8 V12',                     // triangle with stem
  'M4,9 A5,5 0 1,1 14,9 A5,5 0 1,1 4,9 M9,4 V14',  // circle with bar
  'M4,4 L14,14 M14,4 L4,14 M9,2 V16',              // starburst
  'M3,6 H15 M6,6 V14 M12,6 V14',                   // gate
  'M4,14 L9,4 L14,14 L9,10 Z',                     // notched triangle
]);

/** A Coding key: digits 1-9 paired with nine distinct glyphs. */
export function generateCodingKey(rng) {
  const glyphs = rng.sample([...GLYPHS.keys()], 9);
  return glyphs.map((glyphIndex, i) => ({ digit: i + 1, glyphIndex }));
}

/** A run of Coding items: the digit shown, whose glyph must be recalled. */
export function generateCodingSequence(rng, length = 140) {
  return Array.from({ length }, () => rng.int(1, 9));
}

/**
 * One Symbol Search row: two targets, five search symbols, and whether any
 * target appears among them. Roughly half of rows are matches.
 */
export function generateSymbolSearchRow(rng) {
  const pool = [...GLYPHS.keys()];
  const targets = rng.sample(pool, 2);
  const isMatch = rng.next() < 0.5;

  const others = pool.filter((g) => !targets.includes(g));
  const search = rng.sample(others, 5);
  if (isMatch) search[rng.int(0, 4)] = rng.pick(targets);

  return { targets, search: rng.shuffle(search), isMatch };
}
