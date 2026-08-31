/**
 * results-app.js — the practice-test report.
 *
 * Takes the raw and scaled scores a completed session produced and renders the
 * profile, using the same composite scoring engine the calculator uses.
 *
 * The report deliberately shows raw scores next to converted ones. The
 * conversion rests on an estimated reference distribution, so a reader who can
 * see "you got 9 of 14, the reference average is 9" is far better placed to
 * judge the result than one shown only a scaled score.
 */

import {
  SUBTESTS, DOMAINS, COMPOSITES, COMPOSITE_SCALE, SUBTEST_SCALE, getComposite,
} from '../core/model.js';
import { scoreProtocol } from '../core/scoring.js';
import { formatPercentileLabel } from '../core/stats.js';
import { REFERENCE_DISTRIBUTIONS, scaledCeilings } from '../exam/reference.js';
import { renderProfileChart } from './charts.js';

const $ = (id) => document.getElementById(id);

const result = loadResult();
if (!result) {
  $('panel-empty').hidden = false;
} else {
  $('results-content').hidden = false;
  render(result);
}

/**
 * Recover the result, preferring sessionStorage and falling back to the URL.
 * The URL copy makes a report shareable and survives a refresh in a tab where
 * storage is unavailable.
 */
function loadResult() {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('r');
  if (encoded) {
    try {
      const decoded = JSON.parse(atob(decodeURIComponent(encoded)));
      if (decoded && decoded.scaled) return decoded;
    } catch {
      // Fall through to storage.
    }
  }
  try {
    const stored = sessionStorage.getItem('wiscv-practice-result');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.scaled) return parsed;
    }
  } catch {
    // Storage unavailable; nothing to recover.
  }
  return null;
}

function render(data) {
  const scaled = data.scaled ?? {};
  const raw = data.raw ?? {};
  const results = scoreProtocol(scaled, { alpha: 0.05, basis: 'true', swReference: 'fsiq' });

  renderSubtitle(data, results);
  renderCards(results);
  renderCharts(results);
  renderSubtestTable(results, raw, scaled);
  renderStrengthsWeaknesses(results);
  renderComparisons(results);
  renderCaveats(results, scaled);
  wireActions(data, scaled);
}

function renderSubtitle(data, results) {
  const entered = results.completeness.entered;
  const fsiq = results.composites.FSIQ;
  const parts = [`${entered} of 10 tasks completed`];
  if (fsiq.complete) parts.push(`overall ${fsiq.score}`);
  if (data.seed != null) parts.push(`session ${data.seed}`);
  $('result-subtitle').textContent = parts.join(' · ');
}

// --- Composite cards --------------------------------------------------------

function renderCards(results) {
  const indexes = COMPOSITES.filter((c) => c.primary && c.id !== 'FSIQ');
  fillCards($('fsiq-card'), [getComposite('FSIQ')], results);
  fillCards($('composite-cards'), indexes, results);
  fillCards($('ancillary-cards'), COMPOSITES.filter((c) => !c.primary), results);

  const complete = Object.values(results.composites).filter((c) => c.complete).length;
  $('completeness-note').textContent =
    `${complete} of ${COMPOSITES.length} composites could be computed. A composite is ` +
    'left out entirely when any task it depends on was skipped.';
}

function fillCards(container, definitions, results) {
  container.replaceChildren();
  for (const definition of definitions) {
    const composite = results.composites[definition.id];
    const card = document.createElement('div');
    card.className = 'score-card';
    if (definition.id === 'FSIQ') card.classList.add('is-fsiq');
    if (!composite.complete) card.classList.add('is-incomplete');

    card.append(text('div', 'card-label', definition.id === 'FSIQ' ? 'Overall' : definition.id));

    if (!composite.complete) {
      card.append(text('div', 'card-score', '–'));
      card.append(text('div', 'card-meta', 'Task skipped'));
      card.append(text('div', 'card-descriptor', definition.short));
      container.append(card);
      continue;
    }

    const ci = composite.intervals[0.95];
    card.append(text('div', 'card-score', String(composite.score)));
    card.append(text('div', 'card-meta', `${definition.short}`));
    card.append(text('div', 'card-meta',
      `${formatPercentileLabel(composite.percentile)} of the reference`));
    card.append(text('div', 'card-meta', `95% CI ${ci.lower}–${ci.upper}`));
    card.append(text('div', 'card-descriptor', composite.descriptor));
    container.append(card);
  }
}

// --- Charts -----------------------------------------------------------------

function renderCharts(results) {
  const compositePoints = COMPOSITES.filter((c) => c.primary).map((definition) => {
    const composite = results.composites[definition.id];
    const ci = composite.complete ? composite.intervals[0.95] : null;
    return {
      label: definition.id,
      score: composite.complete ? composite.score : null,
      lower: ci?.lower ?? null,
      upper: ci?.upper ?? null,
    };
  });

  renderProfileChart($('chart-composites'), compositePoints, {
    min: 40, max: 160, mean: COMPOSITE_SCALE.mean, sd: COMPOSITE_SCALE.sd, step: 15,
  }, { showIntervals: true, ariaLabel: 'Area score profile with 95% confidence intervals' });

  renderProfileChart($('chart-subtests'),
    results.subtests.map((s) => ({ label: s.abbr, score: s.score })), {
      min: 1, max: 19, mean: SUBTEST_SCALE.mean, sd: SUBTEST_SCALE.sd, step: 3,
    }, { ariaLabel: 'Subtest score profile' });
}

// --- Per-task table ---------------------------------------------------------

function renderSubtestTable(results, raw, scaled) {
  const body = $('subtest-table').querySelector('tbody');
  body.replaceChildren();

  const domainName = Object.fromEntries(DOMAINS.map((d) => [d.id, d.name]));
  const ceilings = scaledCeilings();
  const capped = [];

  for (const subtest of results.subtests) {
    const reference = REFERENCE_DISTRIBUTIONS[subtest.id];
    const row = document.createElement('tr');

    if (subtest.score == null) {
      appendCells(row, [
        [domainName[subtest.domain], 'domain-cell'],
        [subtest.name, ''],
        ['skipped', 'num'],
        [reference.maxRaw, 'num'],
        [reference.mean, 'num'],
        ['–', 'num'],
        ['Not attempted', ''],
      ]);
      body.append(row);
      continue;
    }

    if (raw[subtest.id] === reference.maxRaw) capped.push(subtest.name);

    appendCells(row, [
      [domainName[subtest.domain], 'domain-cell'],
      [subtest.name, ''],
      [raw[subtest.id] ?? '–', 'num'],
      [reference.maxRaw, 'num'],
      [reference.mean, 'num'],
      [subtest.score, 'num'],
    ]);

    const verdict = document.createElement('td');
    const tag = document.createElement('span');
    const difference = subtest.score - SUBTEST_SCALE.mean;
    tag.className = 'tag';
    if (difference >= 3) tag.classList.add('tag-strength');
    if (difference <= -3) tag.classList.add('tag-weakness');
    tag.textContent = describeAgainstReference(subtest.score);
    verdict.append(tag);
    row.append(verdict);
    body.append(row);
  }

  const notes = [
    'A short test cannot separate performances at the very top. The highest scaled ' +
    'score each task can yield here is: ' +
    SUBTESTS.map((s) => `${s.abbr} ${ceilings[s.id]}`).join(', ') + '.',
  ];
  if (capped.length > 0) {
    notes.push(`You reached the maximum raw score on ${capped.join(', ')}, so your score ` +
      'there is a floor on your ability, not a measure of it.');
  }
  $('ceiling-note').textContent = notes.join(' ');
}

function describeAgainstReference(scaledScore) {
  if (scaledScore >= 16) return 'Far above';
  if (scaledScore >= 13) return 'Above';
  if (scaledScore >= 8) return 'Around average';
  if (scaledScore >= 5) return 'Below';
  return 'Far below';
}

// --- Strengths and weaknesses ----------------------------------------------

function renderStrengthsWeaknesses(results) {
  const { referenceMean, entries, alpha } = results.strengthsAndWeaknesses;
  const body = $('sw-table').querySelector('tbody');
  body.replaceChildren();

  if (entries.length === 0) {
    $('sw-note').textContent = 'Not enough tasks completed for this comparison.';
    body.append(emptyRow(5, 'Complete at least two of the core tasks.'));
    return;
  }

  $('sw-note').textContent =
    `Your own average across these ${entries.length} tasks was ${referenceMean.toFixed(2)}. ` +
    `A task is flagged when it differs from that by more than chance would explain (p < ${String(alpha).slice(1)}).`;

  const sorted = [...entries].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  for (const entry of sorted) {
    const row = document.createElement('tr');
    const sign = entry.deviation > 0 ? '+' : '';
    appendCells(row, [
      [entry.name, ''],
      [entry.score, 'num'],
      [`${sign}${entry.deviation.toFixed(2)}`, 'num'],
      [`±${entry.criticalValue.toFixed(2)}`, 'num'],
    ]);

    const cell = document.createElement('td');
    const tag = document.createElement('span');
    tag.className = 'tag';
    if (entry.verdict === 'Strength') tag.classList.add('tag-strength');
    if (entry.verdict === 'Weakness') tag.classList.add('tag-weakness');
    tag.textContent = entry.verdict === 'Within normal limits' ? 'Typical for you' : entry.verdict;
    cell.append(tag);
    row.append(cell);

    // A weakness with nowhere to go is just a label; link it to its drill.
    const practice = document.createElement('td');
    practice.className = 'no-print';
    const link = document.createElement('a');
    link.href = `practice.html?task=${entry.subtestId}`;
    link.textContent = 'Practise';
    practice.append(link);
    row.append(practice);

    body.append(row);
  }

  // Carry the flagged weaknesses into the practice menu so it can mark them.
  const weak = entries.filter((e) => e.verdict === 'Weakness').map((e) => e.subtestId);
  const button = $('btn-practice-weak');
  if (button) {
    button.href = weak.length > 0 ? `practice.html?focus=${weak.join(',')}` : 'practice.html';
    button.textContent = weak.length > 0
      ? `Practise your ${weak.length === 1 ? 'weakest task' : `${weak.length} weakest tasks`}`
      : 'Practise any task';
  }
}

// --- Area comparisons -------------------------------------------------------

function renderComparisons(results) {
  const body = $('comparison-table').querySelector('tbody');
  body.replaceChildren();

  if (results.indexComparisons.length === 0) {
    body.append(emptyRow(6, 'Complete at least two areas to compare them.'));
    return;
  }

  for (const comparison of results.indexComparisons) {
    const row = document.createElement('tr');
    const sign = comparison.difference > 0 ? '+' : '';
    appendCells(row, [
      [`${comparison.pair[0]} – ${comparison.pair[1]}`, ''],
      [comparison.scores[0], 'num'],
      [comparison.scores[1], 'num'],
      [`${sign}${comparison.difference}`, 'num'],
      [`±${comparison.criticalValue.toFixed(2)}`, 'num'],
    ]);

    const cell = document.createElement('td');
    const tag = document.createElement('span');
    tag.className = comparison.significant ? 'tag tag-yes' : 'tag';
    tag.textContent = comparison.significant ? 'Yes' : 'No';
    cell.append(tag);
    row.append(cell);
    body.append(row);
  }
}

// --- Caveats ----------------------------------------------------------------

function renderCaveats(results, scaled) {
  const host = $('caveats');
  host.replaceChildren();

  const points = [
    ['No norms behind these numbers.',
     'A real test compares you with thousands of people of your own age. This one ' +
     'compares you with an estimated distribution written into the source code. If ' +
     'an estimate is off, every score on that task shifts with it.'],
    ['No age correction.',
     'One reference is applied to everyone, so these scores are not comparable across ' +
     'ages the way real scaled scores are.'],
    ['Recognition, not recall.',
     'The verbal tasks give you answers to choose between. Being able to pick the best ' +
     'definition is easier than producing one, so those scores run higher than the ' +
     'open-ended format they are modelled on would give.'],
    ['One sitting, no examiner.',
     'Distraction, a misread instruction, a slow connection or a bad night all land in ' +
     'the score with nothing to catch them.'],
    ['The shape beats the numbers.',
     'Which areas came out higher or lower relative to each other is the most robust ' +
     'thing here, because it does not depend on the reference distribution being right.'],
  ];

  // Point at the actual pattern in front of the reader, when there is one.
  const spread = spreadOf(scaled);
  if (spread != null && spread >= 6) {
    points.push(['Your profile is uneven.',
      `Your highest and lowest task scores differ by ${spread} scaled points. On a real ` +
      'assessment that would prompt a closer look; here it may equally reflect that some ' +
      'of these tasks suit the format better than others.']);
  }

  for (const [heading, body] of points) {
    const item = document.createElement('div');
    item.className = 'caveat';
    item.append(text('strong', 'caveat-heading', heading));
    item.append(text('p', 'caveat-body', body));
    host.append(item);
  }
}

function spreadOf(scaled) {
  const scores = Object.values(scaled).filter((v) => v != null);
  if (scores.length < 2) return null;
  return Math.max(...scores) - Math.min(...scores);
}

// --- Actions ----------------------------------------------------------------

function wireActions(data, scaled) {
  $('btn-print').addEventListener('click', () => window.print());

  $('btn-save').addEventListener('click', () => {
    const payload = {
      format: 'wiscv-calculator-protocol',
      version: 1,
      savedAt: new Date().toISOString(),
      source: 'practice-test',
      seed: data.seed ?? null,
      examinee: { id: `practice-${data.seed ?? 'session'}`, examiner: '', dob: '', testDate: '' },
      scaledScores: scaled,
      rawScores: data.raw ?? {},
      options: { alpha: 0.05, basis: 'true', swReference: 'fsiq' },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `practice-result-${data.seed ?? 'session'}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // Carry the scores into the calculator, which can then vary the analysis
  // settings the report fixes.
  const query = SUBTESTS
    .filter((s) => scaled[s.id] != null)
    .map((s) => `${s.id}=${scaled[s.id]}`)
    .join('&');
  $('btn-calculator').href = query ? `index.html?${query}` : 'index.html';
}

// --- Small DOM helpers ------------------------------------------------------

function text(tag, className, content) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}

function appendCells(row, cells) {
  for (const [value, className] of cells) {
    const cell = document.createElement('td');
    if (className) cell.className = className;
    cell.textContent = String(value);
    row.append(cell);
  }
}

function emptyRow(colspan, message) {
  const row = document.createElement('tr');
  row.className = 'empty-row';
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.textContent = message;
  row.append(cell);
  return row;
}
