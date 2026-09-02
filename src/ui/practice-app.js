/**
 * practice-app.js — the practice areas.
 *
 * Drill any one of the ten tasks on its own, with immediate feedback and an
 * explanation. That feedback is the whole reason this is separate from the
 * test: telling someone the answer mid-test would teach them the pattern and
 * invalidate everything after it, so the test stays silent and practice does
 * the explaining.
 *
 * Nothing here is scored against the reference distribution and nothing is
 * recorded. Session accuracy is shown so you can see whether you are getting
 * the hang of a task, and it resets when you leave.
 */

import { DOMAINS, subtestsInDomain } from '../core/model.js';
import { createRng, randomSeed } from '../exam/rng.js';
import {
  generateMatrixItem, generateFigureWeightsItem, generateBlockDesignItem,
  generateVisualPuzzleItem, generateCodingKey, generateSymbolSearchRow,
  TILE_STATES, GLYPHS,
} from '../exam/generators.js';
import { SIMILARITIES_ITEMS, VOCABULARY_ITEMS, PICTURE_SYMBOLS } from '../exam/verbal-items.js';
import {
  explainMatrix, explainFigureWeights, explainVerbal, explainVisualPuzzle,
  explainBlockDesign, explainDigitSpan, explainPictureSpan, explainCoding,
  explainSymbolSearch, letterFor,
} from '../exam/explain.js';
import {
  walkMatrix, walkFigureWeights, walkSimilarities, walkVocabulary,
  walkVisualPuzzle, walkBlockDesign, walkDigitSpan, walkPictureSpan,
  walkCoding, walkSymbolSearch,
} from '../exam/walkthrough.js';
import { expectedDigitResponse } from '../exam/session.js';
import { digitSchedule, promptFor, DIGIT_INTERVAL_MS } from '../exam/administration.js';
import * as speech from './speech.js';
import {
  renderMatrix, renderMatrixCell, renderScale, renderShapeGroup,
  renderTileGrid, renderPuzzlePiece, renderPuzzleTarget, renderGlyph,
} from './exam-render.js';

const root = document.getElementById('practice-root');
const bar = document.getElementById('practice-bar');
const $ = (id) => document.getElementById(id);

/**
 * What each task drills, and the levels it offers. `levels` are presented in
 * order; the first is the default.
 */
const TASKS = {
  si: {
    what: 'Say what two things have in common.',
    levels: [{ id: 'all', label: 'Mixed' }],
  },
  vo: {
    what: 'Choose the most precise definition of a word.',
    levels: [{ id: 'all', label: 'Mixed' }],
  },
  bd: {
    what: 'Rebuild a tile pattern from its parts.',
    levels: [{ id: '2', label: '2 × 2' }, { id: '3', label: '3 × 3' }],
  },
  vp: {
    what: 'Find the three pieces that assemble a shape.',
    levels: [{ id: '3', label: '3 × 3' }, { id: '4', label: '4 × 4' }],
  },
  mr: {
    what: 'Work out the rule governing a pattern.',
    levels: [
      { id: '1', label: 'One rule' },
      { id: '2', label: 'Two rules' },
      { id: '3', label: 'Three rules' },
    ],
  },
  fw: {
    what: 'Infer quantities from balanced scales.',
    levels: [{ id: 'simple', label: 'One scale' }, { id: 'chained', label: 'Two scales' }],
  },
  ds: {
    what: 'Hold a run of digits and reorder it.',
    levels: [
      { id: 'forward', label: 'Forward' },
      { id: 'backward', label: 'Backward' },
      { id: 'sequencing', label: 'Sequencing' },
    ],
  },
  pc: {
    what: 'Remember pictures in the order they appeared.',
    levels: [{ id: '3', label: '3 pictures' }, { id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' }],
  },
  cd: {
    what: 'Convert symbols to digits using a key.',
    levels: [{ id: 'all', label: 'Standard' }],
  },
  ss: {
    what: 'Spot whether a target appears in a group.',
    levels: [{ id: 'all', label: 'Standard' }],
  },
};

const state = {
  taskId: null,
  level: null,
  rng: createRng(randomSeed()),
  attempted: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  item: null,
  // The walkthrough for the item on screen, and how much of it is revealed.
  walkthrough: null,
  stepsShown: 0,
  usedHelp: false,
  helped: 0,
  // Verbal banks are finite, so they are walked in a shuffled order and
  // reshuffled once exhausted rather than repeating at random.
  queue: [],
  // Digit and picture span adapt: the span grows on success and shrinks on
  // failure, which is what makes drilling them worthwhile.
  span: 3,
  codingKey: null,
};

// --- Menu -------------------------------------------------------------------

function showMenu() {
  bar.hidden = true;
  render('tpl-menu');

  const suggested = suggestedTasks();
  const list = $('area-list');

  for (const domain of DOMAINS) {
    const block = document.createElement('div');
    block.className = 'area-block';

    const heading = document.createElement('h2');
    heading.textContent = domain.name;
    const blurb = document.createElement('p');
    blurb.className = 'area-blurb';
    blurb.textContent = AREA_BLURBS[domain.id];
    block.append(heading, blurb);

    const buttons = document.createElement('div');
    buttons.className = 'task-buttons';
    for (const subtest of subtestsInDomain(domain.id)) {
      buttons.append(taskButton(subtest, suggested.has(subtest.id)));
    }
    block.append(buttons);
    list.append(block);
  }
}

const AREA_BLURBS = {
  vc: 'Putting concepts into words, and seeing what they have in common.',
  vs: 'Taking a shape apart in your head and putting it back together.',
  fr: 'Finding the rule behind a pattern, without being told there is one.',
  wm: 'Holding something in mind while doing something else to it.',
  ps: 'Working accurately at speed on tasks that are easy in themselves.',
};

function taskButton(subtest, isSuggested) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = isSuggested ? 'task-button is-suggested' : 'task-button';

  const name = document.createElement('span');
  name.className = 'task-name';
  name.textContent = subtest.name;
  const what = document.createElement('span');
  what.className = 'task-what';
  what.textContent = TASKS[subtest.id].what;
  button.append(name, what);

  if (isSuggested) {
    const flag = document.createElement('span');
    flag.className = 'task-flag';
    flag.textContent = 'From your last result';
    button.append(flag);
  }

  button.addEventListener('click', () => startTask(subtest.id));
  return button;
}

/**
 * Tasks the most recent practice-test result flagged as relative weaknesses.
 * Read-only and best-effort: no result, or unreadable storage, simply means no
 * suggestions.
 */
function suggestedTasks() {
  const fromUrl = new URLSearchParams(window.location.search).get('focus');
  if (fromUrl) return new Set(fromUrl.split(',').filter((id) => id in TASKS));

  try {
    const stored = sessionStorage.getItem('wiscv-practice-result');
    if (!stored) return new Set();
    const parsed = JSON.parse(stored);
    const scaled = parsed?.scaled ?? {};
    const scores = Object.entries(scaled).filter(([, v]) => v != null);
    if (scores.length < 3) return new Set();

    const mean = scores.reduce((total, [, v]) => total + v, 0) / scores.length;
    return new Set(scores.filter(([, v]) => v <= mean - 2).map(([id]) => id));
  } catch {
    return new Set();
  }
}

// --- Task setup -------------------------------------------------------------

function startTask(taskId, level) {
  state.taskId = taskId;
  state.level = level ?? TASKS[taskId].levels[0].id;
  state.attempted = 0;
  state.correct = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.queue = [];
  state.span = 3;
  state.helped = 0;
  state.codingKey = generateCodingKey(state.rng);

  bar.hidden = false;
  $('bar-task').textContent = subtestName(taskId);

  const select = $('f-difficulty');
  select.replaceChildren();
  for (const level of TASKS[taskId].levels) {
    const option = document.createElement('option');
    option.value = level.id;
    option.textContent = level.label;
    select.append(option);
  }
  select.value = state.level;
  select.disabled = TASKS[taskId].levels.length < 2;
  select.onchange = () => { state.level = select.value; state.span = 3; nextItem(); };

  $('btn-back').onclick = showMenu;
  nextItem();
}

function subtestName(taskId) {
  for (const domain of DOMAINS) {
    const found = subtestsInDomain(domain.id).find((s) => s.id === taskId);
    if (found) return found.name;
  }
  return taskId;
}

/**
 * Accuracy counts only items answered without the answer already in hand.
 * A walkthrough that ends on the key makes the item trivial, so scoring it
 * would quietly turn the accuracy readout into a measure of button-pressing.
 * Strategy-only walkthroughs give nothing away and are not excluded.
 */
function updateStats() {
  const scored = state.attempted - state.helped;
  const accuracy = scored === 0 ? 0 : Math.round((100 * state.correct) / scored);

  const parts = [];
  if (scored > 0) parts.push(`${state.correct} of ${scored} correct · ${accuracy}%`);
  if (state.helped > 0) parts.push(`${state.helped} walked through`);
  if (state.bestStreak > 1) parts.push(`best run ${state.bestStreak}`);

  $('bar-stats').textContent = state.attempted === 0 ? 'No items yet' : parts.join(' · ');
  $('bar-accuracy').style.width = `${accuracy}%`;
}

// --- Drill loop -------------------------------------------------------------

function render(templateId) {
  const node = document.getElementById(templateId).content.cloneNode(true);
  root.replaceChildren(node);
  window.scrollTo({ top: 0 });
}

function nextItem() {
  render('tpl-drill');
  state.walkthrough = null;
  state.stepsShown = 0;
  state.usedHelp = false;
  state.blockWorking = null;
  updateStats();

  $('drill-eyebrow').textContent =
    `${subtestName(state.taskId)} · practice` +
    (state.attempted > 0 ? ` · item ${state.attempted + 1}` : '');

  PRESENTERS[state.taskId]();
  wireWalkthrough();
}

/**
 * Prepare the "Explain this problem" button for whatever is on screen.
 *
 * Steps are revealed one at a time rather than all at once: a walkthrough that
 * hands over the answer in its first sentence is just the explanation with
 * extra clicks. Stopping early is the point.
 */
function wireWalkthrough() {
  // Built once here to decide availability and wording. It is built *again* on
  // click, because Block Design's walkthrough points at the first tile that
  // still differs — which depends on what has been clicked since.
  const preview = buildWalkthrough();

  const button = $('btn-explain');
  const note = $('help-note');
  if (!preview || preview.steps.length === 0) {
    button.hidden = true;
    return;
  }

  button.hidden = false;
  note.textContent = preview.revealsAnswer
    ? 'Walks up to the answer, a step at a time — items you use it on are kept out of your accuracy.'
    : 'How to approach this kind of task. It gives nothing away, so your accuracy still counts.';

  button.onclick = () => {
    showWalkthrough();
    button.hidden = true;
    note.textContent = '';
  };

  $('btn-next-step').onclick = revealStep;
  $('btn-hide-steps').onclick = () => {
    $('drill-walkthrough').hidden = true;
    button.hidden = false;
    button.textContent = 'Show the walkthrough again';
    note.textContent = '';
  };
}

/**
 * Open the panel, showing as much as was already revealed — reopening should
 * redisplay what you had, not advance past it.
 *
 * The steps are rebuilt and re-rendered rather than left in place, because
 * Block Design's walkthrough names the first tile still wrong, and that moves
 * as you click.
 */
function showWalkthrough() {
  state.walkthrough = buildWalkthrough();
  const wanted = Math.min(Math.max(1, state.stepsShown), state.walkthrough.steps.length);

  state.stepsShown = 0;
  $('walkthrough-steps').replaceChildren();
  $('drill-walkthrough').querySelector('.walkthrough-done')?.remove();
  $('btn-next-step').hidden = false;
  $('drill-walkthrough').hidden = false;

  for (let i = 0; i < wanted; i += 1) revealStep();
}

function revealStep() {
  const { steps, revealsAnswer } = state.walkthrough;
  if (state.stepsShown >= steps.length) return;

  const list = $('walkthrough-steps');
  for (const previous of list.children) previous.classList.remove('is-latest');

  const item = document.createElement('li');
  item.className = 'is-latest';
  item.textContent = steps[state.stepsShown];
  list.append(item);
  state.stepsShown += 1;

  // Only the step that actually names the answer costs the item its scoring.
  if (revealsAnswer && state.stepsShown === steps.length) state.usedHelp = true;

  if (state.stepsShown >= steps.length) {
    $('btn-next-step').hidden = true;
    $('btn-hide-steps').textContent = 'Hide these steps';
    const done = document.createElement('p');
    done.className = 'walkthrough-done';
    done.textContent = revealsAnswer
      ? 'That is the whole method. Pick your answer to confirm it.'
      : 'That is the approach — now give it a go.';
    $('drill-walkthrough').append(done);
  }
}

/** The walkthrough for the current task and item. */
function buildWalkthrough() {
  const item = state.item;
  switch (state.taskId) {
    case 'mr': return walkMatrix(item);
    case 'fw': return walkFigureWeights(item);
    case 'si': return walkSimilarities(item);
    case 'vo': return walkVocabulary(item);
    case 'vp': return walkVisualPuzzle(item);
    case 'bd': return walkBlockDesign(item, state.blockWorking);
    case 'ds': return walkDigitSpan(state.level);
    case 'pc': return walkPictureSpan();
    case 'cd': return walkCoding();
    case 'ss': return walkSymbolSearch();
    default: return null;
  }
}

/**
 * Record an outcome and reveal the explanation.
 * `outcome` is 'correct', 'partial' or 'wrong'; partial counts as incorrect for
 * accuracy but is called out, because on the verbal tasks it is a real
 * distinction rather than a near miss.
 */
function reveal(outcome, why) {
  state.attempted += 1;

  if (state.usedHelp) {
    // Answered with the key already on screen: not a result either way, so it
    // breaks the streak rather than extending it on a technicality.
    state.helped += 1;
    state.streak = 0;
  } else if (outcome === 'correct') {
    state.correct += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
  }
  updateStats();

  // The full explanation now covers everything the walkthrough would.
  $('btn-explain').hidden = true;
  $('help-note').textContent = '';

  const box = $('drill-feedback');
  box.hidden = false;
  box.classList.add(
    outcome === 'correct' ? 'is-correct' : outcome === 'partial' ? 'is-partial' : 'is-wrong');

  $('feedback-verdict').textContent =
    outcome === 'correct'
      ? (state.usedHelp ? 'Correct, with the walkthrough.'
        : state.streak > 2 ? `Correct — ${state.streak} in a row.` : 'Correct.')
      : outcome === 'partial' ? 'Partly right.'
      : 'Not quite.';
  $('feedback-why').textContent = why;

  const next = $('btn-next-item');
  next.onclick = nextItem;
  next.focus();
}

/** Lock the options after an answer, marking the key and the mistake. */
function lockOptions(container, answerIndex, chosenIndex) {
  const options = [...container.querySelectorAll('.option')];
  options.forEach((option, index) => {
    option.classList.add('is-locked');
    option.disabled = true;
    if (index === answerIndex) option.classList.add('is-answer');
    if (index === chosenIndex && index !== answerIndex) option.classList.add('is-mistake');
  });
}

// --- Presenters -------------------------------------------------------------

const PRESENTERS = {
  si: () => presentVerbal('si', SIMILARITIES_ITEMS, 'similarities',
    'In what way are these two things alike?'),
  vo: () => presentVerbal('vo', VOCABULARY_ITEMS, 'vocabulary',
    'What does this word mean?'),
  mr: presentMatrix,
  fw: presentFigureWeights,
  vp: presentVisualPuzzle,
  bd: presentBlockDesign,
  ds: presentDigitSpan,
  pc: presentPictureSpan,
  cd: presentCoding,
  ss: presentSymbolSearch,
};

/** Draw the next item from a finite bank, reshuffling when it runs out. */
function drawFromBank(bank) {
  if (state.queue.length === 0) {
    state.queue = state.rng.shuffle([...bank.keys()]);
  }
  return bank[state.queue.pop()];
}

function presentVerbal(taskId, bank, kind, prompt) {
  const source = drawFromBank(bank);
  const item = { ...source, options: state.rng.shuffle(source.responses) };
  state.item = item;

  $('drill-prompt').textContent = prompt;
  const stem = document.createElement('p');
  stem.style.fontSize = '1.25rem';
  stem.style.fontWeight = '600';
  stem.style.textAlign = 'center';
  stem.style.margin = '0';
  stem.textContent = kind === 'similarities' ? source.stem : source.word;
  $('drill-stimulus').append(stem);

  const container = $('drill-options');
  container.className = 'item-options options-text';
  const answerIndex = item.options.findIndex((o) => o.credit === 2);

  item.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    const key = document.createElement('span');
    key.className = 'option-key';
    key.textContent = letterFor(index);
    const text = document.createElement('span');
    text.textContent = option.text;
    button.append(key, text);
    button.addEventListener('click', () => {
      lockOptions(container, answerIndex, index);
      const outcome = option.credit === 2 ? 'correct' : option.credit === 1 ? 'partial' : 'wrong';
      reveal(outcome, explainVerbal(item, index, kind));
    });
    container.append(button);
  });

  $('drill-hint').textContent = 'Choose one.';
}

function presentMatrix() {
  const item = generateMatrixItem(state.rng, Number(state.level));
  state.item = item;

  $('drill-prompt').textContent = 'Which option completes the pattern?';
  $('drill-stimulus').append(renderMatrix(item.matrix));

  const container = $('drill-options');
  container.className = 'item-options options-tiles';
  item.options.forEach((option, index) => {
    const button = figureOption(renderMatrixCell(option, { size: 70 }), index);
    button.addEventListener('click', () => {
      lockOptions(container, item.answerIndex, index);
      reveal(index === item.answerIndex ? 'correct' : 'wrong', explainMatrix(item));
    });
    container.append(button);
  });
  $('drill-hint').textContent = 'Look across the rows and down the columns.';
}

function presentFigureWeights() {
  const item = generateFigureWeightsItem(state.rng, { chained: state.level === 'chained' });
  state.item = item;

  $('drill-prompt').textContent = 'Which option balances the last scale?';
  const stimulus = $('drill-stimulus');
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;width:100%';
  item.premises.forEach((premise, i) => {
    wrap.append(scaleRow(i === 0 ? 'Given' : 'And', renderScale(premise.left, premise.right)));
  });
  wrap.append(scaleRow('Balance this', renderScale(item.question.left, null, { unknown: true })));
  stimulus.append(wrap);

  const container = $('drill-options');
  container.className = 'item-options options-tiles';
  item.options.forEach((option, index) => {
    const button = figureOption(renderShapeGroup(option, { size: 26 }), index);
    button.addEventListener('click', () => {
      lockOptions(container, item.answerIndex, index);
      reveal(index === item.answerIndex ? 'correct' : 'wrong', explainFigureWeights(item));
    });
    container.append(button);
  });
  $('drill-hint').textContent = 'Work out what one shape is worth in the other.';
}

function presentVisualPuzzle() {
  const size = Number(state.level);
  const item = generateVisualPuzzleItem(state.rng, size);
  state.item = item;

  $('drill-prompt').textContent = 'Choose the three pieces that make the shape.';
  const target = document.createElement('div');
  target.className = 'puzzle-target';
  target.append(renderPuzzleTarget(size, { pixels: 116 }));
  $('drill-stimulus').append(target);

  const chosen = [];
  const container = $('drill-options');
  container.className = 'item-options options-wide';

  item.options.forEach((piece, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option option-figure';
    button.append(renderPuzzlePiece(piece, size, { pixels: 74 }));
    const key = document.createElement('span');
    key.className = 'option-key';
    key.textContent = letterFor(index);
    button.append(key);

    button.addEventListener('click', () => {
      const at = chosen.indexOf(index);
      if (at >= 0) chosen.splice(at, 1);
      else if (chosen.length < 3) chosen.push(index);
      button.classList.toggle('is-chosen', chosen.includes(index));
      $('drill-hint').textContent = `${chosen.length} of 3 pieces chosen.`;

      if (chosen.length === 3) {
        const sorted = [...chosen].sort((a, b) => a - b);
        const right = sorted.every((v, i) => v === item.answerIndices[i]);
        [...container.querySelectorAll('.option')].forEach((node, i) => {
          node.classList.add('is-locked');
          node.disabled = true;
          if (item.answerIndices.includes(i)) node.classList.add('is-answer');
          else if (chosen.includes(i)) node.classList.add('is-mistake');
        });
        reveal(right ? 'correct' : 'wrong', explainVisualPuzzle(item, chosen));
      }
    });
    container.append(button);
  });
  $('drill-hint').textContent = '0 of 3 pieces chosen.';
}

function presentBlockDesign() {
  const size = Number(state.level);
  const item = { ...generateBlockDesignItem(state.rng, size), speedBonus: size === 3, baseCredit: 4, timeLimit: Infinity };
  state.item = item;

  const working = item.grid.map((row) => row.map(() => 'full-b'));
  state.blockWorking = working;   // the walkthrough reads this to find a mismatch
  const startedAt = Date.now();

  $('drill-prompt').textContent = 'Rebuild the pattern. Click a tile to change its face.';
  const workspace = document.createElement('div');
  workspace.className = 'block-workspace';

  const targetPanel = labelledPanel('Target', renderTileGrid(item.grid, { size: size === 2 ? 54 : 44 }));
  const buildPanel = document.createElement('div');
  buildPanel.className = 'block-panel';
  const buildLabel = document.createElement('span');
  buildLabel.className = 'block-panel-label';
  buildLabel.textContent = 'Your build';
  const gridHost = document.createElement('div');
  buildPanel.append(buildLabel, gridHost);
  workspace.append(targetPanel, buildPanel);
  $('drill-stimulus').append(workspace);

  const draw = () => {
    gridHost.replaceChildren(renderTileGrid(working, {
      size: size === 2 ? 54 : 44,
      label: 'Your build',
      onTileClick: (row, col) => {
        working[row][col] = TILE_STATES[(TILE_STATES.indexOf(working[row][col]) + 1) % TILE_STATES.length];
        draw();
      },
    }));
  };
  draw();

  const container = $('drill-options');
  container.className = 'item-options options-single';
  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'btn btn-primary btn-large';
  done.textContent = 'Check';
  done.addEventListener('click', () => {
    done.disabled = true;
    const answer = { grid: working.map((r) => [...r]), elapsedSeconds: (Date.now() - startedAt) / 1000 };
    const right = working.flat().every((tile, i) => tile === item.grid.flat()[i]);
    reveal(right ? 'correct' : 'wrong', explainBlockDesign(item, answer));
  });
  container.append(done);

  $('drill-hint').textContent = 'Untimed here — the test times this task.';
}

function presentDigitSpan() {
  const mode = state.level;
  const digits = buildRun(state.span);
  const expected = expectedDigitResponse(mode, digits);
  state.item = { mode, digits, expected };

  $('drill-prompt').textContent = {
    forward: 'Type the digits in the same order.',
    backward: 'Type the digits in reverse order.',
    sequencing: 'Type the digits in increasing numerical order.',
  }[mode];

  const stage = document.createElement('div');
  stage.className = 'span-stage';
  $('drill-stimulus').append(stage);

  // Match the test: where a voice exists this is a listening task, and the
  // digits are never shown. Practising it visually would drill a different
  // skill from the one the test measures.
  const spoken = speech.isSpeaking();
  $('drill-hint').textContent =
    `Span ${state.span} — it grows when you get one right.` +
    (spoken ? ' The numbers are read aloud, not shown.' : '');

  const step = spoken ? presentAloud : presentOnScreen;

  function presentAloud() {
    stage.replaceChildren(listeningStage(digits.length));
    const dots = [...stage.querySelectorAll('.listening-dot')];
    const run = speech.speakSchedule(digitSchedule(digits), (_entry, i) => {
      dots[i]?.classList.add('is-done');
    }, { intervalMs: DIGIT_INTERVAL_MS });
    run.finished.then(() => { if (stage.isConnected) collect(); });
  }

  function presentOnScreen() {
    let index = 0;
    const showNext = () => {
      if (index >= digits.length) { collect(); return; }
      const node = document.createElement('span');
      node.className = 'span-digit';
      node.textContent = String(digits[index]);
      stage.replaceChildren(node);
      index += 1;
      setTimeout(() => { stage.replaceChildren(); setTimeout(showNext, 300); }, 800);
    };
    showNext();
  }

  const collect = () => {
    const waiting = document.createElement('span');
    waiting.className = 'span-waiting';
    waiting.textContent = 'Now type them.';
    stage.replaceChildren(waiting);

    const container = $('drill-options');
    container.className = 'item-options options-single';
    const form = document.createElement('form');
    form.className = 'span-entry';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'span-input';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Type the digits you saw');
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = 'Check';
    form.append(input, submit);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const typed = input.value.replace(/\D/g, '').split('').map(Number);
      input.disabled = true;
      submit.disabled = true;
      const right = typed.length === expected.length && typed.every((d, i) => d === expected[i]);
      // Adapt: longer after a success, shorter after a failure, within 2-9.
      state.span = Math.min(9, Math.max(2, state.span + (right ? 1 : -1)));
      reveal(right ? 'correct' : 'wrong', explainDigitSpan(mode, digits, expected, typed));
    });

    container.replaceChildren(form);
    input.focus();
  };

  // As in the test: wait for the spoken instruction to finish, or the digits
  // queue behind it and are cancelled before they are heard.
  speech.speak(promptFor('ds', { mode })).then(() => {
    if (!stage.isConnected) return;   // moved on to another item
    setTimeout(step, 600);
  });
}

/** The listening stage: no digits, just a signal that something is being said. */
function listeningStage(count) {
  const wrap = document.createElement('div');
  wrap.className = 'listening-stage';

  const icon = document.createElement('div');
  icon.className = 'listening-icon is-active';
  icon.textContent = '🔊';
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', 'The numbers are being read aloud');

  const note = document.createElement('p');
  note.className = 'listening-note';
  note.textContent = 'Listen. The numbers are read once and are not shown.';

  const dots = document.createElement('div');
  dots.className = 'listening-dots';
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'listening-dot';
    dots.append(dot);
  }

  wrap.append(icon, note, dots);
  return wrap;
}

/** A digit run with no repeats and no straight ascending or descending runs. */
function buildRun(length) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const digits = [];
    while (digits.length < length) {
      const digit = state.rng.int(1, 9);
      if (digits.length > 0 && digits[digits.length - 1] === digit) continue;
      digits.push(digit);
    }
    const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
    const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
    if (length >= 3 && (ascending || descending)) continue;
    return digits;
  }
  return Array.from({ length }, () => state.rng.int(1, 9));
}

function presentPictureSpan() {
  const span = Number(state.level);
  const stimulus = state.rng.sample([...PICTURE_SYMBOLS], span);
  const distractors = state.rng.sample(PICTURE_SYMBOLS.filter((s) => !stimulus.includes(s)), 4);
  const response = state.rng.shuffle([...stimulus, ...distractors]);
  const trial = { span, stimulus, response };
  state.item = trial;

  $('drill-prompt').textContent = 'Remember these, in order.';
  const stage = document.createElement('div');
  stage.className = 'span-stage';
  const strip = document.createElement('div');
  strip.className = 'span-symbols';
  for (const symbol of stimulus) {
    const node = document.createElement('span');
    node.textContent = symbol;
    strip.append(node);
  }
  stage.append(strip);
  $('drill-stimulus').append(stage);

  setTimeout(() => {
    $('drill-prompt').textContent = 'Now pick them, in the order you saw them.';
    const chosen = [];
    const picker = document.createElement('div');
    picker.className = 'symbol-picker';
    const answerStrip = document.createElement('div');
    answerStrip.className = 'chosen-strip';
    stage.replaceChildren(answerStrip);

    const refresh = () => {
      $('drill-hint').textContent = `Pick ${span} in order — ${chosen.length} of ${span} chosen.`;
      answerStrip.replaceChildren();
      if (chosen.length === 0) {
        const placeholder = document.createElement('span');
        placeholder.className = 'placeholder';
        placeholder.textContent = `Choose ${span}, in order.`;
        answerStrip.append(placeholder);
      }
      for (const index of chosen) {
        const node = document.createElement('span');
        node.textContent = response[index];
        answerStrip.append(node);
      }
      buttons.forEach((button, index) => {
        const order = chosen.indexOf(index);
        button.classList.toggle('is-chosen', order >= 0);
        button.querySelector('.symbol-order')?.remove();
        if (order >= 0) {
          const badge = document.createElement('span');
          badge.className = 'symbol-order';
          badge.textContent = String(order + 1);
          button.append(badge);
        }
      });
    };

    const buttons = response.map((symbol, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'symbol-button';
      button.textContent = symbol;
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const at = chosen.indexOf(index);
        if (at >= 0) chosen.splice(at, 1);
        else if (chosen.length < span) chosen.push(index);
        refresh();

        if (chosen.length === span) {
          buttons.forEach((b) => { b.disabled = true; });
          const answer = chosen.map((i) => response[i]);
          const exact = answer.every((s, i) => s === stimulus[i]);
          const sameSet = [...answer].sort().join() === [...stimulus].sort().join();
          reveal(exact ? 'correct' : sameSet ? 'partial' : 'wrong',
            explainPictureSpan(trial, answer));
        }
      });
      picker.append(button);
      return button;
    });

    const container = $('drill-options');
    container.className = 'item-options options-single';
    container.replaceChildren(picker);
    refresh();
  }, 1000 + span * 700);
}

function presentCoding() {
  const key = state.codingKey;
  const digit = state.rng.int(1, 9);
  const glyphFor = new Map(key.map((entry) => [entry.digit, GLYPHS[entry.glyphIndex]]));
  state.item = { digit };

  $('drill-prompt').textContent = 'Which digit does this symbol stand for?';

  const stimulus = $('drill-stimulus');
  const keyRow = document.createElement('div');
  keyRow.className = 'coding-key';
  for (const entry of key) {
    const cell = document.createElement('div');
    cell.className = 'coding-key-cell';
    cell.append(renderGlyph(GLYPHS[entry.glyphIndex], { size: 30 }));
    const label = document.createElement('span');
    label.className = 'coding-key-digit';
    label.textContent = String(entry.digit);
    cell.append(label);
    keyRow.append(cell);
  }
  const target = document.createElement('div');
  target.className = 'coding-target';
  target.append(renderGlyph(glyphFor.get(digit), { size: 84 }));
  stimulus.append(keyRow, target);

  const container = $('drill-options');
  container.className = 'item-options options-tiles';
  for (let candidate = 1; candidate <= 9; candidate += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option option-figure';
    const label = document.createElement('span');
    label.style.cssText = 'font-size:1.4rem;font-weight:700;font-family:var(--font-num)';
    label.textContent = String(candidate);
    button.append(label);
    button.addEventListener('click', () => {
      lockOptions(container, digit - 1, candidate - 1);
      reveal(candidate === digit ? 'correct' : 'wrong', explainCoding(digit, candidate));
    });
    container.append(button);
  }
  $('drill-hint').textContent = 'The test runs this against a clock; here it does not.';
}

function presentSymbolSearch() {
  const row = generateSymbolSearchRow(state.rng);
  state.item = row;

  $('drill-prompt').textContent = 'Does either target appear in the group?';
  const node = document.createElement('div');
  node.className = 'search-row';
  node.append(glyphGroup(row.targets, 'search-group search-targets'));
  const divider = document.createElement('div');
  divider.className = 'search-divider';
  node.append(divider, glyphGroup(row.search, 'search-group'));
  $('drill-stimulus').append(node);

  const container = $('drill-options');
  container.className = 'item-options options-single';
  const buttons = document.createElement('div');
  buttons.className = 'yesno';
  for (const [label, value] of [['Yes', true], ['No', false]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', () => {
      [...buttons.querySelectorAll('button')].forEach((b) => { b.disabled = true; });
      reveal(value === row.isMatch ? 'correct' : 'wrong', explainSymbolSearch(row));
    });
    buttons.append(button);
  }
  container.replaceChildren(buttons);
  $('drill-hint').textContent = 'The test runs this against a clock; here it does not.';
}

// --- Shared pieces ----------------------------------------------------------

function figureOption(content, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'option option-figure';
  button.append(content);
  const key = document.createElement('span');
  key.className = 'option-key';
  key.textContent = letterFor(index);
  button.append(key);
  return button;
}

function scaleRow(label, scaleNode) {
  const row = document.createElement('div');
  row.className = 'scale-row';
  const tag = document.createElement('span');
  tag.className = 'scale-label';
  tag.textContent = label;
  row.append(tag, scaleNode);
  return row;
}

function glyphGroup(indices, className) {
  const group = document.createElement('div');
  group.className = className;
  for (const index of indices) group.append(renderGlyph(GLYPHS[index], { size: 28 }));
  return group;
}

function labelledPanel(label, content) {
  const wrap = document.createElement('div');
  wrap.className = 'block-panel';
  const tag = document.createElement('span');
  tag.className = 'block-panel-label';
  tag.textContent = label;
  wrap.append(tag, content);
  return wrap;
}

// --- Boot -------------------------------------------------------------------

const requested = new URLSearchParams(window.location.search).get('task');
if (requested && requested in TASKS) startTask(requested);
else showMenu();
