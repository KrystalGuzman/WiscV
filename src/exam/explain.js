/**
 * explain.js — plain-language explanations of why an answer is what it is.
 *
 * The test itself gives no feedback, deliberately: telling someone the answer
 * mid-test would teach them the pattern and invalidate everything after it.
 * The practice area is the opposite — feedback is the entire point — so this
 * module turns an item's internal structure into something a person can read.
 *
 * Pure and testable: given an item and a response, it returns text. It never
 * touches the DOM, and it never has to guess, because it explains from the same
 * data the generator used to build the item.
 */

const ATTRIBUTE_NAMES = {
  shape: 'the shape',
  fill: 'the shading',
  count: 'the number of shapes',
  rotation: 'the angle',
};

const RULE_DESCRIPTIONS = {
  constantInRow: 'stays the same across each row, and changes from row to row',
  constantInColumn: 'stays the same down each column, and changes from column to column',
  progression: 'steps on by one as you move across each row',
  latinSquare: 'appears exactly once in every row and every column',
};

const SHAPE_NAMES = {
  circle: 'circle', square: 'square', triangle: 'triangle',
  diamond: 'diamond', hexagon: 'hexagon', star: 'star',
};

const FILL_NAMES = { solid: 'solid', outline: 'outline', half: 'half-filled' };

/** Pluralise a shape name against a count. */
function shapes(count, shape, colour) {
  const name = SHAPE_NAMES[shape] ?? shape;
  const tinted = colour ? `${colour} ${name}` : name;
  return `${count} ${tinted}${count === 1 ? '' : 's'}`;
}

/** The verb that agrees with a quantity: one shape balances, several balance. */
function balances(count) {
  return count === 1 ? 'balances' : 'balance';
}

/** "a" or "an", by the sound the following word starts with. */
function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/**
 * A quantity of one shape, phrased so fractions read naturally:
 * "2 blue stars", "3/4 of a blue star", "1/2 of an amber square".
 *
 * Takes the ratio as two integers rather than a float. Recovering a fraction
 * from a division is not possible in general -- 2/3 comes back as
 * 0.6666666666666666, and no amount of scaling turns that into "2/3" -- so the
 * exact numerator and denominator have to survive all the way to here.
 */
function quantityOf(numerator, denominator, shape, colour) {
  const name = SHAPE_NAMES[shape] ?? shape;
  const tinted = colour ? `${colour} ${name}` : name;

  if (numerator % denominator === 0) {
    const whole = numerator / denominator;
    return `${whole} ${tinted}${whole === 1 ? '' : 's'}`;
  }
  return `${asFraction(numerator, denominator)} of ${article(tinted)} ${tinted}`;
}

/** A number as a whole value or a reduced fraction — never a long decimal. */
export function asFraction(numerator, denominator) {
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    throw new RangeError(
      `asFraction needs two integers, got ${numerator}/${denominator}. ` +
      'Pass the exact ratio, not a float — a division has already lost it.'
    );
  }
  if (denominator === 0) throw new RangeError('asFraction: denominator is zero');

  const divide = (a, b) => (b === 0 ? a : divide(b, a % b));
  const factor = Math.abs(divide(numerator, denominator)) || 1;
  const top = numerator / factor;
  const bottom = denominator / factor;
  return bottom === 1 ? String(top) : `${top}/${bottom}`;
}

// ---------------------------------------------------------------------------

/**
 * Explain a matrix-reasoning item.
 *
 * The rules that generated the matrix are known exactly, so the explanation
 * states them rather than inferring a pattern after the fact.
 */
export function explainMatrix(item) {
  const clauses = item.rules.map(({ attribute, rule }) =>
    `${ATTRIBUTE_NAMES[attribute] ?? attribute} ${RULE_DESCRIPTIONS[rule] ?? rule}`);

  const held = Object.keys(item.fixed ?? {})
    .map((attribute) => ATTRIBUTE_NAMES[attribute] ?? attribute);

  const answer = item.options[item.answerIndex];
  const description =
    `${shapes(answer.count, answer.shape)}, ${FILL_NAMES[answer.fill] ?? answer.fill}` +
    (answer.rotation ? `, turned ${answer.rotation}°` : '');

  const parts = [`In this matrix, ${joinClauses(clauses, { heavy: true })}.`];
  if (held.length > 0) {
    parts.push(`${sentenceCase(joinClauses(held))} ${held.length === 1 ? 'is' : 'are'} the same in every cell, so ${held.length === 1 ? 'it is' : 'they are'} not part of the pattern.`);
  }
  parts.push(`That makes the missing cell ${description}.`);
  return parts.join(' ');
}

/**
 * Explain a figure-weights item by restating the premises and doing the
 * arithmetic out loud.
 */
export function explainFigureWeights(item) {
  const lines = item.premises.map((premise) =>
    `${sentenceCase(shapes(premise.left.count, premise.left.shape, premise.left.color))} ` +
    `${balances(premise.left.count)} ` +
    `${shapes(premise.right.count, premise.right.shape, premise.right.color)}.`);

  const question = item.question;

  if (item.premises.length === 1) {
    // A single scale scaled up: say by how much.
    const premise = item.premises[0];
    const multiple = question.left.count / premise.left.count;
    const wholeMultiple = Number.isInteger(multiple);
    lines.push(
      `The last scale has ${wholeMultiple ? `${multiple} times` : `${asFraction(question.left.count, premise.left.count)} times`} ` +
      `as many, so it needs ${wholeMultiple ? `${multiple} × ${premise.right.count} = ` : ''}` +
      `${shapes(item.answer, question.rightShape.shape, question.rightShape.color)}.`);
  } else {
    lines.push(
      `Chaining the two scales, one ${question.left.color} ${SHAPE_NAMES[question.left.shape]} ` +
      `is worth ${quantityOf(item.answer, question.left.count, question.rightShape.shape, question.rightShape.color)}. ` +
      `So ${shapes(question.left.count, question.left.shape, question.left.color)} ` +
      `${balances(question.left.count)} ` +
      `${shapes(item.answer, question.rightShape.shape, question.rightShape.color)}.`);
  }
  return lines.join(' ');
}

/** Explain a verbal item by naming what separates full credit from partial. */
export function explainVerbal(item, chosenIndex, kind) {
  const best = item.options.find((o) => o.credit === 2);
  const partial = item.options.find((o) => o.credit === 1);
  const chosen = item.options[chosenIndex];

  const why = kind === 'similarities'
    ? 'Full credit goes to the answer that names the category both things belong to. ' +
      'An answer describing only a shared feature is true, but it is a weaker kind of likeness.'
    : 'Full credit goes to the most precise definition. ' +
      'A vaguer answer that is not wrong still earns partial credit.';

  const parts = [why, `Best answer (2 points): “${best.text}”`];
  if (partial) parts.push(`Partial credit (1 point): “${partial.text}”`);
  if (chosen && chosen.credit === 0) {
    parts.push(`You chose “${chosen.text}”, which scores nothing.`);
  } else if (chosen && chosen.credit === 1) {
    parts.push('You earned partial credit.');
  }
  return parts.join(' ');
}

/** Explain a visual-puzzle item. The UI marks the pieces; this says the rule. */
export function explainVisualPuzzle(item, chosen) {
  const correct = item.answerIndices.map((i) => letterFor(i)).join(', ');
  const parts = [`The three pieces that fill the shape are ${correct}.`];

  if (Array.isArray(chosen) && chosen.length === 3) {
    const overlap = chosen.filter((i) => item.answerIndices.includes(i)).length;
    if (overlap === 2) {
      parts.push('You had two of the three. The pieces must cover every square exactly once — ' +
                 'check which square is left empty or covered twice.');
    } else if (overlap < 2) {
      parts.push('Count the squares: the three pieces together must add up to the whole shape, ' +
                 'with none overlapping.');
    }
  }
  return parts.join(' ');
}

/** Explain a block-design item by counting how many tiles are still wrong. */
export function explainBlockDesign(item, answer) {
  if (!answer || !answer.grid) return 'The pattern was not completed.';

  const target = item.grid.flat();
  const built = answer.grid.flat();
  const wrong = built.filter((tile, i) => tile !== target[i]).length;

  if (wrong === 0) {
    const seconds = Math.round(answer.elapsedSeconds ?? 0);
    return item.speedBonus
      ? `You matched the pattern in ${seconds} seconds. In the test, finishing a grid this ` +
        'size inside 20 seconds earns the full speed bonus, and each band after that earns ' +
        'one point less.'
      : `You matched the pattern in ${seconds} seconds.`;
  }

  return `${wrong} of the ${target.length} tiles do not match the target. ` +
         'Work one tile at a time: decide which two corners are red, then click until that tile matches.';
}

/** Explain a digit-span trial. */
export function explainDigitSpan(mode, digits, expected, answer) {
  const shown = digits.join(' ');
  const want = expected.join('');
  const modeText = {
    forward: 'in the same order',
    backward: 'in reverse order',
    sequencing: 'in increasing numerical order',
  }[mode] ?? mode;

  const parts = [`You saw ${shown}. Typed back ${modeText}, that is ${want}.`];
  if (Array.isArray(answer) && answer.length > 0 && answer.join('') !== want) {
    parts.push(`You typed ${answer.join('')}.`);
  }
  return parts.join(' ');
}

/** Explain a picture-span trial. */
export function explainPictureSpan(trial, answer) {
  const parts = [`The order was ${trial.stimulus.join(' ')}.`];
  if (Array.isArray(answer) && answer.length > 0) {
    const sameSet = answer.length === trial.stimulus.length &&
      [...answer].sort().join() === [...trial.stimulus].sort().join();
    if (sameSet && answer.join() !== trial.stimulus.join()) {
      parts.push('You picked the right pictures, but not in the right order — that is partial credit.');
    } else if (!sameSet) {
      parts.push(`You picked ${answer.join(' ')}.`);
    }
  }
  return parts.join(' ');
}

/** Explain one Coding trial. */
export function explainCoding(digit, typed) {
  return typed === digit
    ? `That symbol stands for ${digit}.`
    : `That symbol stands for ${digit}${typed ? `, not ${typed}` : ''}. Check it against the key above.`;
}

/** Explain one Symbol Search row. */
export function explainSymbolSearch(row) {
  return row.isMatch
    ? 'One of the target symbols does appear in the group.'
    : 'Neither target symbol appears in the group.';
}

// --- helpers ---------------------------------------------------------------

/**
 * Join clauses readably. Rule descriptions contain their own commas, so a
 * comma-and join produces a run-on; semicolons keep the boundaries visible.
 */
function joinClauses(clauses, { heavy = false } = {}) {
  if (clauses.length === 0) return '';
  if (clauses.length === 1) return clauses[0];
  const separator = heavy ? '; ' : ', ';
  return `${clauses.slice(0, -1).join(separator)}${heavy ? '; and ' : ' and '}${clauses[clauses.length - 1]}`;
}

function sentenceCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function letterFor(index) {
  return String.fromCharCode(65 + index);
}
