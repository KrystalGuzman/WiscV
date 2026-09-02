/**
 * exam-app.js — practice-test administration.
 *
 * Drives the session: presents each subtest's instructions, delivers items,
 * runs the timers, applies discontinue rules, collects responses, and hands
 * everything to the scorer at the end.
 *
 * Item content and scoring live in src/exam/. This file is presentation and
 * flow only, so the two can be reasoned about separately.
 */

import { buildSession, scoreSession, sessionLength, expectedDigitResponse } from '../exam/session.js';
import { TILE_STATES, GLYPHS } from '../exam/generators.js';
import { randomSeed } from '../exam/rng.js';
import {
  EXAMINER_SCRIPT, scriptFor, promptFor, isRepeatable, isAuditory, sampleFor,
  sampleSpoken, teachingFeedback, digitSchedule, DIGIT_INTERVAL_MS,
} from '../exam/administration.js';
import * as speech from './speech.js';
import {
  renderMatrix, renderMatrixCell, renderScale, renderShapeGroup,
  renderTileGrid, renderPuzzlePiece, renderPuzzleTarget, renderGlyph,
} from './exam-render.js';

const root = document.getElementById('exam-root');
const bar = document.getElementById('exam-bar');
const $ = (id) => document.getElementById(id);

const state = {
  session: null,
  responses: {},
  subtestIndex: 0,
  itemIndex: 0,
  completed: 0,     // units presented so far, for the progress bar
  total: 0,
  timers: [],       // every pending timeout/interval, so they can all be cleared
  captions: true,   // show what the examiner says, as well as saying it
  lastSpoken: '',   // for "Say that again"
  speaking: null,   // an in-flight scheduled presentation, so it can be cancelled
};

// ---------------------------------------------------------------------------
// Timer bookkeeping
//
// A stray interval from an abandoned subtest would keep firing into a screen
// that no longer exists, so every timer is registered and cleared on each
// screen change.
// ---------------------------------------------------------------------------

function later(fn, ms) {
  const id = setTimeout(fn, ms);
  state.timers.push({ id, kind: 'timeout' });
  return id;
}

function every(fn, ms) {
  const id = setInterval(fn, ms);
  state.timers.push({ id, kind: 'interval' });
  return id;
}

function clearTimers() {
  for (const timer of state.timers) {
    if (timer.remove) timer.remove();
    else if (timer.kind === 'interval') clearInterval(timer.id);
    else clearTimeout(timer.id);
  }
  state.timers = [];
}

// ---------------------------------------------------------------------------
// The examiner's voice
// ---------------------------------------------------------------------------

/**
 * Say a line as the examiner would, and caption it.
 *
 * Never awaited by anything that gates the test: a machine with no voices fails
 * an utterance immediately, so item pacing stays on its own timers and speech
 * rides alongside.
 */
function say(line, { remember = true } = {}) {
  const text = String(line ?? '').trim();
  if (!text) return Promise.resolve('skipped');

  if (remember) state.lastSpoken = text;
  showCaption(text);
  updateRepeatButton();
  return speech.speak(text);
}

function showCaption(text) {
  const node = $('examiner-caption');
  if (!node) return;
  if (!state.captions || !text) { node.hidden = true; return; }
  node.textContent = text;
  node.hidden = false;
}

/**
 * "Say that again" is offered only where repeating is legitimate. Digit Span
 * refuses it: hearing a sequence twice measures something other than span, so
 * the control is hidden rather than merely inert.
 */
function updateRepeatButton() {
  const button = $('btn-repeat');
  if (!button) return;
  const subtest = currentSubtest();
  const allowed = Boolean(state.lastSpoken) && subtest && isRepeatable(subtest.id);
  button.hidden = !allowed;
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------

function screen(templateId) {
  clearTimers();
  speech.cancel();
  const template = document.getElementById(templateId);
  const node = template.content.cloneNode(true);
  root.replaceChildren(node);
  window.scrollTo({ top: 0 });
  return root;
}

function showWelcome() {
  bar.hidden = true;
  screen('tpl-welcome');

  // A seed in the URL replays an identical test, which makes a result
  // reproducible and lets a specific item be looked at again.
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('seed');
  const seed = requested && /^\d+$/.test(requested) ? Number(requested) : randomSeed();

  document.getElementById('seed-note').textContent =
    `Session seed ${seed}. Adding ?seed=${seed} to this page's address reproduces exactly this test.`;

  document.getElementById('btn-start').addEventListener('click', () => startSession(seed));

  $('f-captions').addEventListener('change', (event) => {
    state.captions = event.target.checked;
  });

  $('btn-test-voice').addEventListener('click', async () => {
    const outcome = await speech.speak(
      "Hello. I'll be reading the instructions and questions aloud as we go.");
    reportAudio(outcome);
  });

  // Voices load asynchronously, and on some browsers never announce themselves,
  // so this resolves either way rather than leaving the notice hanging.
  speech.ready().then((hasVoice) => reportAudio(hasVoice ? 'ready' : 'none'));
}

/** Say plainly what audio this browser can manage, and what changes without it. */
function reportAudio(outcome) {
  const status = $('audio-status');
  if (!status) return;

  status.classList.remove('is-ok', 'is-warn');
  if (outcome === 'ready' || outcome === 'spoken' || outcome === 'timeout') {
    status.classList.add('is-ok');
    const voice = speech.voiceName();
    status.textContent = voice
      ? `Ready to speak, using the "${voice}" voice. Press the button to hear it.`
      : 'Ready to speak. Press the button to hear it.';
  } else {
    status.classList.add('is-warn');
    status.textContent =
      'This browser has no speech voice installed, so the examiner cannot read aloud. ' +
      'Everything will be shown as text instead. Digit Span will show its numbers on ' +
      'screen rather than speaking them, which makes it easier than the listening task ' +
      'it is meant to be — that subtest will be marked as visually presented.';
  }
}

function startSession(seed) {
  state.session = buildSession(seed);
  state.responses = {};
  state.subtestIndex = 0;
  state.completed = 0;
  state.total = sessionLength(state.session);

  bar.hidden = false;

  $('btn-voice').addEventListener('click', () => {
    const on = !speech.isEnabled();
    speech.setEnabled(on);
    const button = $('btn-voice');
    button.textContent = on ? 'Voice on' : 'Voice off';
    button.setAttribute('aria-pressed', String(on));
    // Captions carry the whole script when the voice is off, so turning it off
    // never removes information.
    if (!on) { state.captions = true; showCaption(state.lastSpoken); }
  });

  $('btn-repeat').addEventListener('click', () => {
    if (!isRepeatable(currentSubtest()?.id)) return;
    say(state.lastSpoken, { remember: false });
  });

  document.getElementById('btn-skip').addEventListener('click', skipSubtest);
  document.getElementById('btn-quit').addEventListener('click', () => {
    if (confirm('End the test now? Subtests you have not reached will be left out of the profile.')) {
      finish();
    }
  });

  say(EXAMINER_SCRIPT.opening);
  showIntro();
}

function currentSubtest() {
  return state.session.subtests[state.subtestIndex];
}

function updateBar({ label, progress, timer } = {}) {
  const subtest = currentSubtest();
  document.getElementById('bar-subtest').textContent = subtest ? subtest.name : '';
  document.getElementById('bar-progress').textContent = label ?? '';
  document.getElementById('bar-fill').style.width =
    `${Math.min(100, (100 * (progress ?? state.completed)) / state.total)}%`;

  const timerNode = document.getElementById('bar-timer');
  if (timer == null) {
    timerNode.hidden = true;
  } else {
    timerNode.hidden = false;
    timerNode.textContent = `${timer}s`;
    timerNode.classList.toggle('is-urgent', timer <= 10);
  }
}

// ---------------------------------------------------------------------------
// Subtest instructions
// ---------------------------------------------------------------------------

/** Instruction copy and a worked example for each subtest. */
const INTRODUCTIONS = {
  si: {
    lede: 'You will see two things. Choose the answer that best says how they are alike.',
    rules: [
      'Some answers are true but only describe a detail — the best answer names what kind of thing they both are.',
      'There is no time limit.',
      'The test moves on if you miss several in a row.',
    ],
    demo: () => textDemo('How are a hammer and a saw alike?',
      'Best answer: “They are both tools.” — “They are both heavy” is true of some, but it is not what they have in common.'),
  },
  vo: {
    lede: 'You will see a word. Choose the answer that best gives its meaning.',
    rules: [
      'Several answers may be close. Pick the most precise one.',
      'There is no time limit.',
    ],
    demo: () => textDemo('ancient',
      'Best answer: “Belonging to the very distant past.” — “Old” is not wrong, but it is vaguer.'),
  },
  bd: {
    lede: 'Rebuild the pattern shown on the left using the tiles on the right. Click a tile to change its face.',
    rules: [
      'Each click cycles a tile through its six faces.',
      'Every item is timed. On the larger patterns, finishing faster earns more.',
      'Press Done as soon as your pattern matches.',
    ],
    demo: () => blockDemo(),
  },
  vp: {
    lede: 'A completed shape is shown. Choose the three pieces that fit together to make exactly that shape.',
    rules: [
      'Pieces are never rotated or flipped — they fit as shown.',
      'The three pieces must fill the shape with no gaps and no overlaps.',
      'Each item is timed at 30 seconds.',
    ],
    demo: () => puzzleDemo(),
  },
  mr: {
    lede: 'Part of a pattern is missing. Choose the option that completes it.',
    rules: [
      'Look across the rows and down the columns for what is changing.',
      'One thing may change while others stay fixed, or several may change at once.',
      'There is no time limit.',
    ],
    demo: () => matrixDemo(),
  },
  fw: {
    lede: 'The scales balance. Work out what goes on the empty side of the last one.',
    rules: [
      'The first scale, and sometimes a second, tell you how the shapes trade against each other.',
      'Later items need you to chain both scales together.',
      'There is no time limit.',
    ],
    demo: () => weightsDemo(),
  },
  ds: {
    lede: 'Digits appear one at a time. When they stop, type them back.',
    rules: [
      'Three parts: same order, then reverse order, then increasing numerical order.',
      'The sequences get longer until you miss both tries at a length.',
      'Type the digits with no spaces, then press Enter.',
    ],
    demo: () => textDemo('Reverse order: you see 4 — 1 — 7',
      'You would type 714.'),
  },
  pc: {
    lede: 'Some pictures appear briefly. Then pick them out, in the order you saw them.',
    rules: [
      'The pictures show for a few seconds, then disappear.',
      'The choices include pictures you did not see.',
      'Order matters, but you still get partial credit for the right pictures in the wrong order.',
    ],
    demo: () => textDemo('You see 🍎 then 🔑',
      'You would click 🍎 first, then 🔑 — even though the choices also show 🌳 and ⚽.'),
  },
  cd: {
    lede: 'Each symbol stands for a digit. Using the key, type the digit for each symbol as fast as you can.',
    rules: [
      'The key stays on screen the whole time — but looking less means going faster.',
      'You have 120 seconds.',
      'Typing a digit moves straight to the next symbol.',
    ],
    demo: () => codingDemo(),
  },
  ss: {
    lede: 'Two target symbols are shown on the left. Say whether either appears in the group on the right.',
    rules: [
      'Press Y for yes and N for no, or click the buttons.',
      'You have 120 seconds.',
      'Wrong answers are subtracted, so guessing does not pay.',
    ],
    demo: () => searchDemo(),
  },
};

function showIntro() {
  const subtest = currentSubtest();
  if (!subtest) { finish(); return; }

  screen('tpl-intro');
  const intro = INTRODUCTIONS[subtest.id];

  document.getElementById('intro-eyebrow').textContent =
    `Subtest ${state.subtestIndex + 1} of ${state.session.subtests.length}`;
  document.getElementById('intro-title').textContent = subtest.name;
  document.getElementById('intro-lede').textContent = intro.lede;

  const rules = document.getElementById('intro-rules');
  for (const rule of intro.rules) {
    const li = document.createElement('li');
    li.textContent = rule;
    rules.append(li);
  }

  const demo = document.getElementById('intro-demo');
  if (intro.demo) demo.append(intro.demo());
  else demo.remove();

  updateBar({ label: 'Instructions' });

  // The examiner reads the standardised instructions for this subtest aloud.
  const script = scriptFor(subtest.id);
  if (script?.intro) say(script.intro);

  const sample = sampleFor(subtest.id);
  if (sample) {
    renderSample(subtest, sample);
    // Spoken after the instructions, so the two do not overlap.
    later(() => say(sampleSpoken(subtest.id)), 400);
  }

  document.getElementById('btn-begin').addEventListener('click', beginSubtest);
  document.getElementById('btn-skip-intro').addEventListener('click', skipSubtest);
}

/**
 * A teaching item: answered, told the answer, and not scored.
 *
 * Real administration works this way for good reason — an examinee who
 * misunderstands the task fails the first real items for a reason that has
 * nothing to do with ability.
 */
function renderSample(subtest, sample) {
  const host = $('intro-sample');
  host.hidden = false;
  host.replaceChildren();

  host.append(textNode('p', 'sample-label', 'Try this one first'));
  host.append(textNode('p', 'sample-stem', sample.stem));

  const options = document.createElement('div');
  options.className = 'sample-options';
  const shuffled = [...sample.options];

  shuffled.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    button.textContent = option.text;
    button.addEventListener('click', () => {
      for (const other of options.querySelectorAll('.option')) {
        other.disabled = true;
        other.classList.add('is-locked');
      }
      button.classList.add(option.credit === 2 ? 'is-answer' : 'is-mistake');
      const highest = shuffled.find((o) => o.credit === 2);
      const best = [...options.querySelectorAll('.option')]
        .find((node) => node.textContent === highest.text);
      best?.classList.add('is-answer');

      const feedback = teachingFeedback(subtest.id, option.credit);
      const note = textNode('p', 'sample-teach', feedback);
      if (option.credit === 2) note.classList.add('is-right');
      // Into its own slot, directly under the options — appending to the host
      // would put the feedback below the footnote, away from what it explains.
      feedbackSlot.replaceChildren(note);
      say(feedback);
    });
    options.append(button);
  });

  const feedbackSlot = document.createElement('div');

  host.append(options, feedbackSlot);
  host.append(textNode('p', 'sample-footnote', 'This one does not count. Press Begin when ready.'));
}

// --- Worked examples for the instruction screens ---------------------------

function textDemo(stem, explanation) {
  const wrap = document.createElement('div');
  const question = document.createElement('p');
  question.style.fontWeight = '600';
  question.style.margin = '0';
  question.textContent = stem;
  const answer = document.createElement('p');
  answer.className = 'demo-caption';
  answer.style.margin = '0';
  answer.textContent = explanation;
  wrap.append(question, answer);
  return wrap;
}

function blockDemo() {
  const wrap = document.createElement('div');
  wrap.append(renderTileGrid([['diag-ab-tl', 'full-a'], ['full-b', 'diag-ab-br']], { size: 40 }));
  wrap.append(caption('Click a tile to cycle its face until your grid matches the target.'));
  return wrap;
}

function puzzleDemo() {
  const wrap = document.createElement('div');
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '14px';
  row.style.alignItems = 'center';
  row.append(renderPuzzleTarget(3, { pixels: 74 }));
  const equals = document.createElement('span');
  equals.textContent = '=';
  row.append(equals);
  for (const piece of [[0, 1, 2], [3, 4, 5], [6, 7, 8]]) {
    row.append(renderPuzzlePiece(piece, 3, { pixels: 52 }));
  }
  wrap.append(row, caption('Three pieces, fitting together with no gaps or overlaps.'));
  return wrap;
}

function matrixDemo() {
  const wrap = document.createElement('div');
  const cell = (shape, count) => ({ shape, count, fill: 'solid', rotation: 0 });
  wrap.append(renderMatrix([
    [cell('circle', 1), cell('circle', 2), cell('circle', 3)],
    [cell('square', 1), cell('square', 2), null],
    [cell('triangle', 1), cell('triangle', 2), cell('triangle', 3)],
  ]));
  wrap.append(caption('The shape is fixed along each row; the count grows across. The missing cell is two squares… then three.'));
  return wrap;
}

function weightsDemo() {
  const wrap = document.createElement('div');
  wrap.append(scaleRow('Given',
    renderScale({ shape: 'circle', color: 'red', count: 1 }, { shape: 'square', color: 'blue', count: 2 })));
  wrap.append(scaleRow('Then',
    renderScale({ shape: 'circle', color: 'red', count: 2 }, null, { unknown: true })));
  wrap.append(caption('One red circle is worth two blue squares, so two red circles need four.'));
  return wrap;
}

function codingDemo() {
  const wrap = document.createElement('div');
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '14px';
  row.style.alignItems = 'center';
  for (const [i, digit] of [[0, 1], [1, 2], [2, 3]]) {
    const cell = document.createElement('div');
    cell.className = 'coding-key-cell';
    cell.append(renderGlyph(GLYPHS[i], { size: 30 }));
    const label = document.createElement('span');
    label.className = 'coding-key-digit';
    label.textContent = String(digit);
    cell.append(label);
    row.append(cell);
  }
  wrap.append(row, caption('If that is the key, then this symbol means 2 — type 2.'));
  return wrap;
}

function searchDemo() {
  const wrap = document.createElement('div');
  const row = document.createElement('div');
  row.className = 'search-row';
  row.append(glyphGroup([0, 1], 'search-group search-targets'));
  const divider = document.createElement('div');
  divider.className = 'search-divider';
  row.append(divider);
  row.append(glyphGroup([3, 1, 5, 7, 9], 'search-group'));
  wrap.append(row, caption('The second target appears in the group, so the answer is yes.'));
  return wrap;
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

/** A text element with a class — the same shape the other UI modules use. */
function textNode(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function caption(text) {
  const node = document.createElement('p');
  node.className = 'demo-caption';
  node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// Subtest flow
// ---------------------------------------------------------------------------

function beginSubtest() {
  const subtest = currentSubtest();
  state.itemIndex = 0;
  state.spanPosition = { section: 0, trial: 0 };
  state.responses[subtest.id] = blankResponses(subtest);
  presentNext();
}

function blankResponses(subtest) {
  switch (subtest.type) {
    case 'digit-span':
      return {
        answers: subtest.sections.map((s) => s.trials.map(() => null)),
        presentation: null,   // 'auditory' or 'visual', set at the first trial
      };
    case 'coding':
      return { correct: 0, attempted: 0 };
    case 'symbol-search':
      return { correct: 0, incorrect: 0, attempted: 0 };
    default:
      return { answers: [] };
  }
}

function skipSubtest() {
  const subtest = currentSubtest();
  if (!subtest) return;
  state.responses[subtest.id] = { skipped: true };
  advanceSubtest();
}

function advanceSubtest() {
  state.subtestIndex += 1;
  if (state.subtestIndex >= state.session.subtests.length) finish();
  else showIntro();
}

function presentNext() {
  const subtest = currentSubtest();
  switch (subtest.type) {
    case 'verbal-choice':   return presentChoiceItem(subtest, renderVerbalStem, textOptions);
    case 'matrix':          return presentChoiceItem(subtest, renderMatrixStem, figureOptions);
    case 'figure-weights':  return presentChoiceItem(subtest, renderWeightsStem, figureOptions);
    case 'visual-puzzle':   return presentPuzzleItem(subtest);
    case 'block-design':    return presentBlockItem(subtest);
    case 'digit-span':      return presentDigitSpan(subtest);
    case 'picture-span':    return presentPictureSpan(subtest);
    case 'coding':          return presentCoding(subtest);
    case 'symbol-search':   return presentSymbolSearch(subtest);
    default: throw new Error(`Cannot present subtest type: ${subtest.type}`);
  }
}

/**
 * Whether the discontinue rule has been met: a run of consecutive zero-credit
 * responses at the end of what has been administered.
 */
function shouldDiscontinue(subtest, answers) {
  const limit = subtest.discontinue;
  if (!limit || answers.length < limit) return false;

  const creditOf = (item, answer) => {
    if (subtest.type === 'verbal-choice') return item.options[answer]?.credit ?? 0;
    if (subtest.type === 'visual-puzzle') {
      if (!Array.isArray(answer) || answer.length !== 3) return 0;
      const sorted = [...answer].sort((a, b) => a - b);
      return sorted.every((v, i) => v === item.answerIndices[i]) ? 1 : 0;
    }
    if (subtest.type === 'block-design') return answer?.correct ? 1 : 0;
    return answer === item.answerIndex ? 1 : 0;
  };

  return answers.slice(-limit).every((answer, i) =>
    creditOf(subtest.items[answers.length - limit + i], answer) === 0);
}

function recordAndAdvance(subtest, answer) {
  const responses = state.responses[subtest.id];
  responses.answers.push(answer);
  state.completed += 1;
  state.itemIndex += 1;

  if (state.itemIndex >= subtest.items.length || shouldDiscontinue(subtest, responses.answers)) {
    // Items never reached count as zero, which the discontinue rule presumes.
    advanceSubtest();
  } else {
    presentNext();
  }
}

// ---------------------------------------------------------------------------
// Multiple-choice items
// ---------------------------------------------------------------------------

function presentChoiceItem(subtest, renderStem, renderOptions) {
  const item = subtest.items[state.itemIndex];
  screen('tpl-item');

  document.getElementById('item-eyebrow').textContent =
    `${subtest.name} · item ${state.itemIndex + 1} of ${subtest.items.length}`;
  document.getElementById('item-prompt').textContent = subtest.prompt;
  document.getElementById('item-stimulus').append(renderStem(item));

  const container = document.getElementById('item-options');
  renderOptions(container, item, (choice) => recordAndAdvance(subtest, choice));

  document.getElementById('item-hint').textContent = 'Choose one.';
  updateBar({ label: `Item ${state.itemIndex + 1} of ${subtest.items.length}` });
  say(promptFor(subtest.id, item));
}

function renderVerbalStem(item) {
  const node = document.createElement('p');
  node.style.fontSize = '1.25rem';
  node.style.fontWeight = '600';
  node.style.textAlign = 'center';
  node.style.margin = '0';
  node.textContent = item.stem;
  return node;
}

function renderMatrixStem(item) {
  return renderMatrix(item.matrix);
}

function renderWeightsStem(item) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.gap = '14px';
  wrap.style.width = '100%';

  item.premises.forEach((premise, i) => {
    wrap.append(scaleRow(i === 0 ? 'Given' : 'And', renderScale(premise.left, premise.right)));
  });
  wrap.append(scaleRow('Balance this',
    renderScale(item.question.left, null, { unknown: true })));
  return wrap;
}

function textOptions(container, item, onChoose) {
  container.className = 'item-options options-text';
  item.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option';
    const key = document.createElement('span');
    key.className = 'option-key';
    key.textContent = String.fromCharCode(65 + index);
    const text = document.createElement('span');
    text.textContent = option.text;
    button.append(key, text);
    button.addEventListener('click', () => onChoose(index));
    container.append(button);
  });
}

function figureOptions(container, item, onChoose) {
  container.className = 'item-options options-tiles';
  item.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option option-figure';
    button.append(option.shape && option.count !== undefined && option.color
      ? renderShapeGroup(option, { size: 28 })
      : renderMatrixCell(option, { size: 70 }));
    const key = document.createElement('span');
    key.className = 'option-key';
    key.textContent = String.fromCharCode(65 + index);
    button.append(key);
    button.addEventListener('click', () => onChoose(index));
    container.append(button);
  });
}

// ---------------------------------------------------------------------------
// Visual puzzles
// ---------------------------------------------------------------------------

function presentPuzzleItem(subtest) {
  const item = subtest.items[state.itemIndex];
  screen('tpl-item');

  document.getElementById('item-eyebrow').textContent =
    `${subtest.name} · item ${state.itemIndex + 1} of ${subtest.items.length}`;
  document.getElementById('item-prompt').textContent = subtest.prompt;

  const stimulus = document.getElementById('item-stimulus');
  const target = document.createElement('div');
  target.className = 'puzzle-target';
  target.append(renderPuzzleTarget(item.size, { pixels: 116 }));
  stimulus.append(target);

  const chosen = [];
  const container = document.getElementById('item-options');
  container.className = 'item-options options-wide';
  const hint = document.getElementById('item-hint');

  const submit = () => recordAndAdvance(subtest, [...chosen]);

  item.options.forEach((piece, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'option option-figure';
    button.append(renderPuzzlePiece(piece, item.size, { pixels: 74 }));
    button.addEventListener('click', () => {
      const at = chosen.indexOf(index);
      if (at >= 0) chosen.splice(at, 1);
      else if (chosen.length < 3) chosen.push(index);

      button.classList.toggle('is-chosen', chosen.includes(index));
      hint.textContent = `${chosen.length} of 3 pieces chosen.`;
      if (chosen.length === 3) submit();
    });
    container.append(button);
  });

  hint.textContent = '0 of 3 pieces chosen.';
  updateBar({ label: `Item ${state.itemIndex + 1} of ${subtest.items.length}`, timer: item.timeLimit });
  say(promptFor(subtest.id, item));
  runCountdown(item.timeLimit, submit);
}

/** A ticking countdown that fires `onExpire` at zero. */
function runCountdown(seconds, onExpire) {
  let remaining = seconds;
  every(() => {
    remaining -= 1;
    updateBar({
      label: document.getElementById('bar-progress').textContent,
      timer: Math.max(0, remaining),
    });
    if (remaining <= 0) { clearTimers(); onExpire(); }
  }, 1000);
}

// ---------------------------------------------------------------------------
// Block design
// ---------------------------------------------------------------------------

function presentBlockItem(subtest) {
  const item = subtest.items[state.itemIndex];
  screen('tpl-item');

  document.getElementById('item-eyebrow').textContent =
    `${subtest.name} · item ${state.itemIndex + 1} of ${subtest.items.length}`;
  document.getElementById('item-prompt').textContent = subtest.prompt;

  // The examinee's grid starts blank, so no item begins part-solved.
  const working = item.grid.map((row) => row.map(() => 'full-b'));
  const startedAt = Date.now();
  let done = false;

  const stimulus = document.getElementById('item-stimulus');
  const workspace = document.createElement('div');
  workspace.className = 'block-workspace';

  const targetPanel = panel('Target', renderTileGrid(item.grid, { size: item.size === 2 ? 54 : 44 }));
  const buildPanel = document.createElement('div');
  buildPanel.className = 'block-panel';
  const buildLabel = document.createElement('span');
  buildLabel.className = 'block-panel-label';
  buildLabel.textContent = 'Your build';
  buildPanel.append(buildLabel);

  const gridHost = document.createElement('div');
  buildPanel.append(gridHost);
  workspace.append(targetPanel, buildPanel);
  stimulus.append(workspace);

  const drawGrid = () => {
    gridHost.replaceChildren(renderTileGrid(working, {
      size: item.size === 2 ? 54 : 44,
      label: 'Your build',
      onTileClick: (row, col) => {
        const next = (TILE_STATES.indexOf(working[row][col]) + 1) % TILE_STATES.length;
        working[row][col] = TILE_STATES[next];
        drawGrid();
      },
    }));
  };
  drawGrid();

  const finishItem = () => {
    if (done) return;
    done = true;
    clearTimers();
    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    const correct = working.flat().every((tile, i) => tile === item.grid.flat()[i]);
    recordAndAdvance(subtest, {
      grid: working.map((row) => [...row]),
      elapsedSeconds,
      correct,
    });
  };

  const container = document.getElementById('item-options');
  container.className = 'item-options options-single';
  const doneButton = document.createElement('button');
  doneButton.type = 'button';
  doneButton.className = 'btn btn-primary btn-large';
  doneButton.textContent = 'Done';
  doneButton.addEventListener('click', finishItem);
  container.append(doneButton);

  document.getElementById('item-hint').textContent =
    item.speedBonus ? 'Finishing sooner scores higher on this size.' : 'Click tiles to match the target.';
  updateBar({ label: `Item ${state.itemIndex + 1} of ${subtest.items.length}`, timer: item.timeLimit });
  say(promptFor(subtest.id, item));
  runCountdown(item.timeLimit, finishItem);
}

function panel(label, content) {
  const wrap = document.createElement('div');
  wrap.className = 'block-panel';
  const tag = document.createElement('span');
  tag.className = 'block-panel-label';
  tag.textContent = label;
  wrap.append(tag, content);
  return wrap;
}

// ---------------------------------------------------------------------------
// Digit span
// ---------------------------------------------------------------------------

function presentDigitSpan(subtest) {
  // Position is set by beginSubtest and advanced by recordSpanTrial; this walk
  // spans three sections, so it cannot be derived from a single item index.
  const { section: sectionIndex, trial: trialIndex } = state.spanPosition;
  const section = subtest.sections[sectionIndex];
  if (!section) { advanceSubtest(); return; }

  const trial = section.trials[trialIndex];
  screen('tpl-item');

  document.getElementById('item-eyebrow').textContent =
    `${subtest.name} · ${section.label} · span ${trial.span}`;
  document.getElementById('item-prompt').textContent = section.instruction;

  const stage = document.createElement('div');
  stage.className = 'span-stage';
  document.getElementById('item-stimulus').append(stage);

  const options = document.getElementById('item-options');
  options.className = 'item-options options-text';
  updateBar({ label: `${section.label}, span ${trial.span}` });

  // Digit Span is a listening task. When the browser can speak, the digits are
  // read aloud one per second and never shown — which is what the subtest is
  // actually for. Only when there is no voice do they appear on screen, and
  // that substitution is recorded, because seeing the digits makes the task
  // materially easier than hearing them.
  const spoken = speech.isSpeaking();
  state.responses[subtest.id].presentation = spoken ? 'auditory' : 'visual';

  const presentDigits = spoken ? presentAloud : presentOnScreen;

  function presentAloud() {
    stage.replaceChildren(listeningStage(trial.digits.length));
    const dots = [...stage.querySelectorAll('.listening-dot')];

    const schedule = digitSchedule(trial.digits);
    const run = speech.speakSchedule(schedule, (_entry, index) => {
      dots[index]?.classList.add('is-done');
    }, { intervalMs: DIGIT_INTERVAL_MS });

    state.speaking = run;
    state.timers.push({ kind: 'listener', id: 0, remove: () => run.cancel() });
    run.finished.then(() => { if (!stage.isConnected) return; collect(); });
  }

  function presentOnScreen() {
    let index = 0;
    const showNext = () => {
      if (index >= trial.digits.length) { collect(); return; }
      stage.replaceChildren(digitNode(trial.digits[index]));
      index += 1;
      later(() => { stage.replaceChildren(); later(showNext, 300); }, 800);
    };
    later(showNext, 700);
  }

  const collect = () => {
    stage.replaceChildren(waitingNode('Now type the digits.'));
    say('Now type them.', { remember: false });

    const form = document.createElement('form');
    form.className = 'span-entry';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'span-input';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Type the digits you saw');
    input.placeholder = '…';
    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn-primary';
    submit.textContent = 'Enter';
    form.append(input, submit);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const digits = input.value.replace(/\D/g, '').split('').map(Number);
      recordSpanTrial(subtest, sectionIndex, trialIndex, digits);
    });

    options.replaceChildren(form);
    input.focus();
  };

  // The examiner names the condition before each run, and this line may be
  // repeated; the digits themselves may not.
  say(promptFor('ds', { mode: section.mode }));
  later(presentDigits, 900);
}

/** The listening stage: no digits, just a signal that something is being said. */
function listeningStage(count) {
  const wrap = document.createElement('div');
  wrap.className = 'listening-stage';

  const icon = document.createElement('div');
  icon.className = 'listening-icon is-active';
  icon.textContent = '🔊';
  icon.setAttribute('role', 'img');
  icon.setAttribute('aria-label', 'The examiner is reading the numbers aloud');

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

function recordSpanTrial(subtest, sectionIndex, trialIndex, digits) {
  const responses = state.responses[subtest.id];
  responses.answers[sectionIndex][trialIndex] = digits;
  state.completed += 1;

  const section = subtest.sections[sectionIndex];
  const trial = section.trials[trialIndex];
  const correct = arraysEqual(digits, expectedDigitResponse(section.mode, trial.digits));

  // Discontinue a section when both trials at one span fail, then move to the
  // next section rather than ending the subtest.
  const isSecondTrial = trial.trial === 1;
  const firstTrialAnswer = isSecondTrial ? responses.answers[sectionIndex][trialIndex - 1] : null;
  const firstFailed = firstTrialAnswer
    ? !arraysEqual(firstTrialAnswer, expectedDigitResponse(section.mode, section.trials[trialIndex - 1].digits))
    : false;

  const sectionDone = (isSecondTrial && firstFailed && !correct) ||
                      trialIndex + 1 >= section.trials.length;

  if (sectionDone) {
    state.spanPosition = { section: sectionIndex + 1, trial: 0 };
    if (sectionIndex + 1 >= subtest.sections.length) { advanceSubtest(); return; }
  } else {
    state.spanPosition = { section: sectionIndex, trial: trialIndex + 1 };
  }
  presentDigitSpan(subtest);
}

function digitNode(digit) {
  const node = document.createElement('span');
  node.className = 'span-digit';
  node.textContent = String(digit);
  return node;
}

function waitingNode(text) {
  const node = document.createElement('span');
  node.className = 'span-waiting';
  node.textContent = text;
  return node;
}

// ---------------------------------------------------------------------------
// Picture span
// ---------------------------------------------------------------------------

function presentPictureSpan(subtest) {
  const trial = subtest.trials[state.itemIndex];
  if (!trial) { advanceSubtest(); return; }

  screen('tpl-item');
  document.getElementById('item-eyebrow').textContent =
    `${subtest.name} · trial ${state.itemIndex + 1} of ${subtest.trials.length}`;
  document.getElementById('item-prompt').textContent = 'Remember these, in order.';

  const stage = document.createElement('div');
  stage.className = 'span-stage';
  const strip = document.createElement('div');
  strip.className = 'span-symbols';
  for (const symbol of trial.stimulus) {
    const node = document.createElement('span');
    node.textContent = symbol;
    strip.append(node);
  }
  stage.append(strip);
  document.getElementById('item-stimulus').append(stage);

  updateBar({ label: `Trial ${state.itemIndex + 1} of ${subtest.trials.length}` });
  say(promptFor(subtest.id));

  later(() => {
    document.getElementById('item-prompt').textContent =
      'Now click them in the order you saw them.';
    stage.replaceChildren(waitingNode(`Pick ${trial.stimulus.length}, in order.`));
    collectPictureResponse(subtest, trial, stage);
  }, trial.exposureMs);
}

function collectPictureResponse(subtest, trial, stage) {
  const chosen = [];
  const options = document.getElementById('item-options');
  options.className = 'item-options options-single';

  const strip = document.createElement('div');
  strip.className = 'chosen-strip';
  const placeholder = document.createElement('span');
  placeholder.className = 'placeholder';
  placeholder.textContent = `Choose ${trial.stimulus.length}, in the order you saw them.`;
  strip.append(placeholder);
  stage.replaceChildren(strip);

  const picker = document.createElement('div');
  picker.className = 'symbol-picker';

  const hint = document.getElementById('item-hint');
  const refresh = () => {
    // The "pick N" instruction is replaced by the answer strip, so the count
    // has to live somewhere permanent or the examinee loses track of it.
    hint.textContent =
      `Pick ${trial.stimulus.length} in order — ${chosen.length} of ${trial.stimulus.length} chosen. ` +
      'Click a choice again to undo it.';
    strip.replaceChildren();
    if (chosen.length === 0) strip.append(placeholder);
    for (const index of chosen) {
      const node = document.createElement('span');
      node.textContent = trial.response[index];
      strip.append(node);
    }
    for (const [index, button] of buttons.entries()) {
      const order = chosen.indexOf(index);
      button.classList.toggle('is-chosen', order >= 0);
      const badge = button.querySelector('.symbol-order');
      if (badge) badge.remove();
      if (order >= 0) {
        const marker = document.createElement('span');
        marker.className = 'symbol-order';
        marker.textContent = String(order + 1);
        button.append(marker);
      }
    }
  };

  const buttons = trial.response.map((symbol, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'symbol-button';
    button.textContent = symbol;
    button.setAttribute('aria-label', `Symbol ${index + 1}`);
    button.addEventListener('click', () => {
      const at = chosen.indexOf(index);
      if (at >= 0) chosen.splice(at, 1);
      else if (chosen.length < trial.stimulus.length) chosen.push(index);
      refresh();

      if (chosen.length === trial.stimulus.length) {
        const answer = chosen.map((i) => trial.response[i]);
        state.responses[subtest.id].answers.push(answer);
        state.completed += 1;
        state.itemIndex += 1;
        if (state.itemIndex >= subtest.trials.length) advanceSubtest();
        else presentPictureSpan(subtest);
      }
    });
    picker.append(button);
    return button;
  });

  options.replaceChildren(picker);
  refresh();
}

// ---------------------------------------------------------------------------
// Coding
// ---------------------------------------------------------------------------

function presentCoding(subtest) {
  screen('tpl-item');
  document.getElementById('item-eyebrow').textContent = subtest.name;
  document.getElementById('item-prompt').textContent = subtest.prompt;

  const stimulus = document.getElementById('item-stimulus');

  // The key stays visible throughout, as it does on the paper task.
  const key = document.createElement('div');
  key.className = 'coding-key';
  const glyphFor = new Map(subtest.key.map((entry) => [entry.digit, GLYPHS[entry.glyphIndex]]));
  for (const entry of subtest.key) {
    const cell = document.createElement('div');
    cell.className = 'coding-key-cell';
    cell.append(renderGlyph(GLYPHS[entry.glyphIndex], { size: 30 }));
    const digit = document.createElement('span');
    digit.className = 'coding-key-digit';
    digit.textContent = String(entry.digit);
    cell.append(digit);
    key.append(cell);
  }
  stimulus.append(key);

  const target = document.createElement('div');
  target.className = 'coding-target';
  stimulus.append(target);

  const stats = document.createElement('div');
  stats.className = 'speed-stats';
  stimulus.append(stats);

  const responses = state.responses[subtest.id];
  let position = 0;

  const showCurrent = () => {
    target.replaceChildren(renderGlyph(glyphFor.get(subtest.sequence[position]), { size: 84 }));
    stats.replaceChildren();
    const done = document.createElement('span');
    done.innerHTML = `Completed <strong>${responses.correct}</strong>`;
    stats.append(done);
  };

  const options = document.getElementById('item-options');
  options.className = 'item-options options-single';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'coding-input';
  input.inputMode = 'numeric';
  input.autocomplete = 'off';
  input.setAttribute('aria-label', 'Digit for this symbol');
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.justifyContent = 'center';
  wrap.append(input);
  options.replaceChildren(wrap);

  input.addEventListener('input', () => {
    const typed = input.value.replace(/\D/g, '').slice(-1);
    if (!typed) { input.value = ''; return; }
    responses.attempted += 1;
    if (Number(typed) === subtest.sequence[position]) responses.correct += 1;
    position += 1;
    input.value = '';
    if (position >= subtest.sequence.length) { finishSpeeded(); return; }
    showCurrent();
  });

  showCurrent();
  input.focus();
  document.getElementById('item-hint').textContent = 'Type the matching digit. It advances automatically.';
  updateBar({ label: 'Timed block', timer: subtest.duration });
  say(promptFor(subtest.id));
  runCountdown(subtest.duration, () => finishSpeeded());
}

// ---------------------------------------------------------------------------
// Symbol search
// ---------------------------------------------------------------------------

function presentSymbolSearch(subtest) {
  screen('tpl-item');
  document.getElementById('item-eyebrow').textContent = subtest.name;
  document.getElementById('item-prompt').textContent = subtest.prompt;

  const stimulus = document.getElementById('item-stimulus');
  const rowHost = document.createElement('div');
  rowHost.style.width = '100%';
  stimulus.append(rowHost);

  const stats = document.createElement('div');
  stats.className = 'speed-stats';
  stimulus.append(stats);

  const flash = document.createElement('div');
  flash.className = 'feedback-flash';
  stimulus.append(flash);

  const responses = state.responses[subtest.id];
  let position = 0;

  const draw = () => {
    const row = subtest.rows[position];
    const node = document.createElement('div');
    node.className = 'search-row';
    node.append(glyphGroup(row.targets, 'search-group search-targets'));
    const divider = document.createElement('div');
    divider.className = 'search-divider';
    node.append(divider, glyphGroup(row.search, 'search-group'));
    rowHost.replaceChildren(node);

    stats.replaceChildren();
    const correct = document.createElement('span');
    correct.innerHTML = `Correct <strong>${responses.correct}</strong>`;
    const wrong = document.createElement('span');
    wrong.innerHTML = `Wrong <strong>${responses.incorrect}</strong>`;
    stats.append(correct, wrong);
  };

  const answer = (said) => {
    const row = subtest.rows[position];
    responses.attempted += 1;
    if (said === row.isMatch) responses.correct += 1;
    else responses.incorrect += 1;

    position += 1;
    if (position >= subtest.rows.length) { finishSpeeded(); return; }
    draw();
  };

  const options = document.getElementById('item-options');
  options.className = 'item-options options-single';
  const buttons = document.createElement('div');
  buttons.className = 'yesno';
  for (const [label, value] of [['Yes (Y)', true], ['No (N)', false]]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', () => answer(value));
    buttons.append(button);
  }
  options.replaceChildren(buttons);

  const onKey = (event) => {
    const pressed = event.key.toLowerCase();
    if (pressed === 'y') answer(true);
    else if (pressed === 'n') answer(false);
  };
  document.addEventListener('keydown', onKey);
  state.timers.push({ kind: 'listener', id: 0, remove: () => document.removeEventListener('keydown', onKey) });

  draw();
  document.getElementById('item-hint').textContent = 'Press Y or N.';
  updateBar({ label: 'Timed block', timer: subtest.duration });
  say(promptFor(subtest.id));
  runCountdown(subtest.duration, () => finishSpeeded());
}

function finishSpeeded() {
  clearTimers();
  state.completed += 1;
  advanceSubtest();
}

// ---------------------------------------------------------------------------
// Finishing
// ---------------------------------------------------------------------------

function finish() {
  clearTimers();
  bar.hidden = true;
  screen('tpl-done');
  say(EXAMINER_SCRIPT.closing);

  const { raw, scaled } = scoreSession(state.session, state.responses);

  // Hand the result to the report page. sessionStorage keeps it in this tab
  // only; nothing is uploaded and nothing persists beyond the browser session.
  const payload = {
    format: 'wiscv-practice-result',
    version: 1,
    seed: state.session.seed,
    completedAt: new Date().toISOString(),
    raw,
    scaled,
    // Digit Span falls back to on-screen digits where no voice exists. That
    // makes it easier than the listening task it models, so the report says so
    // rather than presenting the score as comparable.
    presentation: { ds: state.responses.ds?.presentation ?? null },
  };

  try {
    sessionStorage.setItem('wiscv-practice-result', JSON.stringify(payload));
  } catch {
    // Private browsing can refuse storage; the URL fallback below still works.
  }

  const encoded = encodeURIComponent(btoa(JSON.stringify({
    seed: payload.seed, raw, scaled, presentation: payload.presentation,
  })));
  window.location.href = `results.html?r=${encoded}`;
}

function arraysEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) &&
         a.length === b.length && a.every((v, i) => v === b[i]);
}

// --- Boot -------------------------------------------------------------------

showWelcome();
