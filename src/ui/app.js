/**
 * app.js — UI wiring.
 *
 * Holds the page state, renders it, and hands every calculation to
 * src/core/*. Nothing in here does psychometrics; nothing in core touches the
 * DOM. All data stays in the tab — no network calls, no storage writes.
 */

import {
  SUBTESTS, DOMAINS, COMPOSITES, COMPOSITE_SCALE, SUBTEST_SCALE,
  getComposite, subtestsInDomain,
} from '../core/model.js';
import { scoreProtocol, parseScaledScore, applyOfficialScore } from '../core/scoring.js';
import { formatPercentile, ordinal } from '../core/stats.js';
import {
  validateNorms, rawToScaled, sumToComposite, ageInMonths, formatAge, findAgeBand,
} from '../core/norms.js';
import { renderProfileChart } from './charts.js';

// --- State ------------------------------------------------------------------

const state = {
  examinee: { id: '', examiner: '', dob: '', testDate: '' },
  scaled: Object.fromEntries(SUBTESTS.map((s) => [s.id, null])),
  raw: Object.fromEntries(SUBTESTS.map((s) => [s.id, null])),
  norms: null,
  options: { alpha: 0.05, basis: 'true', swReference: 'fsiq' },
};

const $ = (id) => document.getElementById(id);

// --- Boot -------------------------------------------------------------------

buildEntryGrid();
bindControls();
render();

// --- Entry grid -------------------------------------------------------------

function buildEntryGrid() {
  const grid = $('entry-grid');
  grid.replaceChildren();

  for (const domain of DOMAINS) {
    const card = document.createElement('div');
    card.className = 'domain-card';

    const heading = document.createElement('h3');
    heading.textContent = domain.name;
    const tag = document.createElement('span');
    tag.className = 'index-tag';
    tag.textContent = domain.index;
    card.append(heading, tag);

    for (const subtest of subtestsInDomain(domain.id)) {
      card.append(buildSubtestRow(subtest));
    }
    grid.append(card);
  }
}

function buildSubtestRow(subtest) {
  const row = document.createElement('div');
  row.className = 'subtest-row';
  row.dataset.subtest = subtest.id;

  const name = document.createElement('label');
  name.className = 'subtest-name';
  name.setAttribute('for', `in-${subtest.id}`);
  name.textContent = subtest.name;
  const abbr = document.createElement('span');
  abbr.className = 'subtest-abbr';
  abbr.textContent = subtest.abbr;
  name.append(abbr);

  const rawInput = document.createElement('input');
  rawInput.type = 'number';
  rawInput.id = `raw-${subtest.id}`;
  rawInput.min = '0';
  rawInput.step = '1';
  rawInput.hidden = true;
  rawInput.title = `${subtest.name} raw score`;
  rawInput.setAttribute('aria-label', `${subtest.name} raw score`);
  rawInput.addEventListener('input', () => onRawInput(subtest.id, rawInput.value));

  const scaledInput = document.createElement('input');
  scaledInput.type = 'number';
  scaledInput.id = `in-${subtest.id}`;
  scaledInput.min = String(SUBTEST_SCALE.min);
  scaledInput.max = String(SUBTEST_SCALE.max);
  scaledInput.step = '1';
  scaledInput.inputMode = 'numeric';
  scaledInput.placeholder = '–';
  scaledInput.title = `${subtest.name} scaled score`;
  scaledInput.setAttribute('aria-label', `${subtest.name} scaled score`);
  scaledInput.addEventListener('input', () => onScaledInput(subtest.id, scaledInput));

  row.append(name, rawInput, scaledInput);
  return row;
}

function onScaledInput(subtestId, input) {
  try {
    state.scaled[subtestId] = parseScaledScore(input.value);
    input.removeAttribute('aria-invalid');
    input.title = '';
  } catch (error) {
    // Keep the last good value out of the results rather than scoring a typo.
    state.scaled[subtestId] = null;
    input.setAttribute('aria-invalid', 'true');
    input.title = error.message;
  }
  render();
}

/**
 * Raw-score entry is available only while a norms file supplying a table for
 * that subtest and age is loaded. Anything it can convert flows straight into
 * the scaled-score field, which stays editable.
 */
function onRawInput(subtestId, value) {
  const raw = value.trim() === '' ? null : Number(value);
  state.raw[subtestId] = Number.isFinite(raw) ? raw : null;

  const months = currentAgeInMonths();
  if (state.raw[subtestId] == null || months == null) return;

  const scaled = rawToScaled(state.norms, subtestId, state.raw[subtestId], months);
  if (scaled != null) {
    state.scaled[subtestId] = scaled;
    const input = $(`in-${subtestId}`);
    input.value = String(scaled);
    input.removeAttribute('aria-invalid');
  }
  render();
}

// --- Controls ---------------------------------------------------------------

function bindControls() {
  const bindText = (id, key) => {
    $(id).addEventListener('input', (e) => { state.examinee[key] = e.target.value; render(); });
  };
  bindText('f-examinee', 'id');
  bindText('f-examiner', 'examiner');
  bindText('f-dob', 'dob');
  bindText('f-test-date', 'testDate');

  $('f-alpha').addEventListener('change', (e) => {
    state.options.alpha = Number(e.target.value); render();
  });
  $('f-ci-basis').addEventListener('change', (e) => {
    state.options.basis = e.target.value; render();
  });
  $('f-sw-reference').addEventListener('change', (e) => {
    state.options.swReference = e.target.value; render();
  });

  $('btn-demo').addEventListener('click', loadExample);
  $('btn-clear').addEventListener('click', clearAll);
  $('btn-print').addEventListener('click', () => window.print());
  $('btn-save').addEventListener('click', saveProtocol);
  $('btn-csv').addEventListener('click', exportCsv);
  $('f-open').addEventListener('change', (e) => readJsonFile(e, openProtocol));
  $('f-norms').addEventListener('change', (e) => readJsonFile(e, loadNorms));
  $('btn-clear-norms').addEventListener('click', clearNorms);

  // Default the test date to today; it is the field that is almost always "now".
  const today = new Date().toISOString().slice(0, 10);
  $('f-test-date').value = today;
  state.examinee.testDate = today;
}

function currentAgeInMonths() {
  const { dob, testDate } = state.examinee;
  if (!dob || !testDate) return null;
  return ageInMonths(dob, testDate);
}

// --- Render -----------------------------------------------------------------

function render() {
  const results = scoreProtocol(state.scaled, state.options);
  applyOfficialCompositeTables(results);

  renderAge();
  updateNormsUi();   // the age band, and so which raw fields apply, can change
  renderCompleteness(results);
  renderCompositeCards(results);
  renderCompositeTable(results);
  renderCharts(results);
  renderSubtestTable(results);
  renderStrengthsWeaknesses(results);
  renderComparisons(results);
}

/**
 * When a loaded norms file supplies an official sum-to-composite table, it
 * replaces the model estimate for that composite, along with everything
 * derived from it. See applyOfficialScore in the scoring engine.
 */
function applyOfficialCompositeTables(results) {
  if (!state.norms?.compositeTables) return;
  for (const composite of Object.values(results.composites)) {
    if (!composite.complete) continue;
    const official = sumToComposite(state.norms, composite.id, composite.sumOfScaledScores);
    if (official == null || official === composite.score) continue;

    applyOfficialScore(composite, official, { basis: state.options.basis });
  }
}

function renderAge() {
  const months = currentAgeInMonths();
  const output = $('f-age');
  if (months == null) {
    output.textContent = '—';
    return;
  }
  const band = findAgeBand(state.norms, months);
  output.textContent = formatAge(months) + (band ? ` (band ${band.id})` : '');
}

function renderCompleteness(results) {
  const { entered, total } = results.completeness;
  const complete = Object.values(results.composites).filter((c) => c.complete).length;
  $('completeness').textContent =
    `${entered} of ${total} subtests entered · ${complete} of ${COMPOSITES.length} composites available`;
}

function renderCompositeCards(results) {
  // FSIQ leads the report, then the five indexes, then the ancillary set.
  const indexes = COMPOSITES.filter((c) => c.primary && c.id !== 'FSIQ');
  const ancillary = COMPOSITES.filter((c) => !c.primary);
  fillCards($('fsiq-card'), [getComposite('FSIQ')], results);
  fillCards($('composite-cards'), indexes, results);
  fillCards($('ancillary-cards'), ancillary, results);
}

function fillCards(container, composites, results) {
  container.replaceChildren();
  for (const definition of composites) {
    const composite = results.composites[definition.id];
    const card = document.createElement('div');
    card.className = 'score-card';
    if (definition.id === 'FSIQ') card.classList.add('is-fsiq');
    if (!composite.complete) card.classList.add('is-incomplete');

    card.append(textNode('div', 'card-label', definition.id));

    if (!composite.complete) {
      card.append(textNode('div', 'card-score', '–'));
      card.append(textNode('div', 'card-meta', `Needs ${composite.missing.length} more subtest${composite.missing.length === 1 ? '' : 's'}`));
      card.append(textNode('div', 'card-descriptor', definition.short));
      container.append(card);
      continue;
    }

    const ci = composite.intervals[0.95];
    card.append(textNode('div', 'card-score', String(composite.score)));
    card.append(textNode('div', 'card-meta',
      `${ordinal(Math.round(composite.percentile)) ?? formatPercentile(composite.percentile)} percentile`));
    card.append(textNode('div', 'card-meta', `95% CI ${ci.lower}–${ci.upper}`));
    card.append(textNode('div', 'card-descriptor', composite.descriptor));
    container.append(card);
  }
}

function renderCompositeTable(results) {
  const body = $('composite-table').querySelector('tbody');
  body.replaceChildren();

  const rows = COMPOSITES
    .map((d) => results.composites[d.id])
    .filter((c) => c.complete);

  if (rows.length === 0) {
    body.append(emptyRow(9, 'No composite can be computed yet.'));
    return;
  }

  for (const composite of rows) {
    const tr = document.createElement('tr');
    if (composite.id === 'FSIQ') tr.className = 'is-fsiq-row';
    const ci90 = composite.intervals[0.90];
    const ci95 = composite.intervals[0.95];
    appendCells(tr, [
      [`${composite.id} · ${composite.short}`, ''],
      [composite.sumOfScaledScores, 'num'],
      [composite.score + (composite.source === 'official' ? '*' : ''), 'num'],
      [formatPercentile(composite.percentile), 'num'],
      [`${ci90.lower}–${ci90.upper}`, 'num'],
      [`${ci95.lower}–${ci95.upper}`, 'num'],
      [composite.descriptor, ''],
      [composite.reliability.toFixed(3).slice(1), 'num'],
      [composite.sem.toFixed(2), 'num'],
    ]);
    body.append(tr);
  }
}

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
  }, { showIntervals: true, ariaLabel: 'Index score profile with 95% confidence intervals' });

  const subtestPoints = results.subtests.map((s) => ({ label: s.abbr, score: s.score }));
  renderProfileChart($('chart-subtests'), subtestPoints, {
    min: 1, max: 19, mean: SUBTEST_SCALE.mean, sd: SUBTEST_SCALE.sd, step: 3,
  }, { ariaLabel: 'Subtest scaled score profile' });
}

function renderSubtestTable(results) {
  const body = $('subtest-table').querySelector('tbody');
  body.replaceChildren();

  const domainName = Object.fromEntries(DOMAINS.map((d) => [d.id, d.name]));
  let any = false;

  for (const subtest of results.subtests) {
    if (subtest.score == null) continue;
    any = true;
    const tr = document.createElement('tr');
    appendCells(tr, [
      [domainName[subtest.domain], 'domain-cell'],
      [`${subtest.name} (${subtest.abbr})`, ''],
      [subtest.score, 'num'],
      [formatPercentile(subtest.percentile), 'num'],
      [subtest.descriptor, ''],
      [subtest.reliability.toFixed(2).slice(1), 'num'],
    ]);
    body.append(tr);
  }

  if (!any) body.append(emptyRow(6, 'No scaled scores entered yet.'));
}

function renderStrengthsWeaknesses(results) {
  const { referenceMean, entries, alpha } = results.strengthsAndWeaknesses;
  const body = $('sw-table').querySelector('tbody');
  body.replaceChildren();

  $('sw-note').textContent = referenceMean == null
    ? 'Enter at least two subtests in the reference set.'
    : `Reference mean ${referenceMean.toFixed(2)} across ${entries.length} subtests, tested at p < ${String(alpha).slice(1)}.`;

  if (entries.length === 0) {
    body.append(emptyRow(5, 'Not enough subtests entered for this analysis.'));
    return;
  }

  // Most deviant first: that is the order a reader wants to scan.
  const sorted = [...entries].sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  for (const entry of sorted) {
    const tr = document.createElement('tr');
    const sign = entry.deviation > 0 ? '+' : '';
    appendCells(tr, [
      [`${entry.name} (${entry.abbr})`, ''],
      [entry.score, 'num'],
      [`${sign}${entry.deviation.toFixed(2)}`, 'num'],
      [`±${entry.criticalValue.toFixed(2)}`, 'num'],
    ]);

    const verdictCell = document.createElement('td');
    const tag = document.createElement('span');
    tag.className = 'tag';
    if (entry.verdict === 'Strength') tag.classList.add('tag-strength');
    if (entry.verdict === 'Weakness') tag.classList.add('tag-weakness');
    tag.textContent = entry.verdict;
    verdictCell.append(tag);
    tr.append(verdictCell);

    body.append(tr);
  }
}

function renderComparisons(results) {
  fillComparisonTable(
    $('index-comparison-table').querySelector('tbody'),
    results.indexComparisons.map((c) => ({
      label: `${c.pair[0]} – ${c.pair[1]}`,
      ...c,
    })),
    'Complete at least two indexes to compare them.'
  );

  fillComparisonTable(
    $('subtest-comparison-table').querySelector('tbody'),
    results.subtestComparisons.map((c) => ({
      label: `${c.labels[0]} – ${c.labels[1]}`,
      ...c,
    })),
    'Enter both subtests of a pair to compare them.'
  );
}

function fillComparisonTable(body, comparisons, emptyMessage) {
  body.replaceChildren();
  if (comparisons.length === 0) {
    body.append(emptyRow(6, emptyMessage));
    return;
  }

  for (const comparison of comparisons) {
    const tr = document.createElement('tr');
    const sign = comparison.difference > 0 ? '+' : '';
    appendCells(tr, [
      [comparison.label, ''],
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
    tr.append(cell);

    body.append(tr);
  }
}

// --- Small DOM helpers ------------------------------------------------------

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function appendCells(row, cells) {
  for (const [value, className] of cells) {
    const td = document.createElement('td');
    if (className) td.className = className;
    td.textContent = String(value);
    row.append(td);
  }
}

function emptyRow(colspan, message) {
  const tr = document.createElement('tr');
  tr.className = 'empty-row';
  const td = document.createElement('td');
  td.colSpan = colspan;
  td.textContent = message;
  tr.append(td);
  return tr;
}

// --- Data in and out --------------------------------------------------------

function loadExample() {
  // An illustrative profile: strong verbal reasoning against slow processing
  // speed, the pattern that makes the GAI/CPI split worth looking at.
  const example = { si: 14, vo: 15, bd: 11, vp: 12, mr: 13, fw: 12, ds: 9, pc: 10, cd: 6, ss: 7 };
  for (const [id, value] of Object.entries(example)) {
    state.scaled[id] = value;
    $(`in-${id}`).value = String(value);
    $(`in-${id}`).removeAttribute('aria-invalid');
  }
  state.examinee.id = state.examinee.id || 'EXAMPLE-01';
  $('f-examinee').value = state.examinee.id;
  render();
}

function clearAll() {
  for (const subtest of SUBTESTS) {
    state.scaled[subtest.id] = null;
    state.raw[subtest.id] = null;
    const scaledInput = $(`in-${subtest.id}`);
    scaledInput.value = '';
    scaledInput.removeAttribute('aria-invalid');
    $(`raw-${subtest.id}`).value = '';
  }
  state.examinee.id = '';
  state.examinee.examiner = '';
  $('f-examinee').value = '';
  $('f-examiner').value = '';
  render();
}

function saveProtocol() {
  const payload = {
    format: 'wiscv-calculator-protocol',
    version: 1,
    savedAt: new Date().toISOString(),
    examinee: state.examinee,
    scaledScores: state.scaled,
    rawScores: state.raw,
    options: state.options,
  };
  const name = (state.examinee.id || 'protocol').replace(/[^\w.-]+/g, '_');
  downloadFile(`wiscv-${name}.json`, 'application/json', JSON.stringify(payload, null, 2));
}

function openProtocol(data, fileName) {
  if (data?.format !== 'wiscv-calculator-protocol') {
    showMessages([`${fileName} is not a saved protocol from this app.`], []);
    return;
  }

  Object.assign(state.examinee, data.examinee ?? {});
  $('f-examinee').value = state.examinee.id ?? '';
  $('f-examiner').value = state.examinee.examiner ?? '';
  $('f-dob').value = state.examinee.dob ?? '';
  $('f-test-date').value = state.examinee.testDate ?? '';

  const problems = [];
  for (const subtest of SUBTESTS) {
    const value = data.scaledScores?.[subtest.id] ?? null;
    try {
      state.scaled[subtest.id] = parseScaledScore(value);
    } catch (error) {
      state.scaled[subtest.id] = null;
      problems.push(`${subtest.name}: ${error.message}`);
    }
    $(`in-${subtest.id}`).value = state.scaled[subtest.id] ?? '';

    const raw = data.rawScores?.[subtest.id] ?? null;
    state.raw[subtest.id] = Number.isFinite(raw) ? raw : null;
    $(`raw-${subtest.id}`).value = state.raw[subtest.id] ?? '';
  }

  if (data.options) {
    Object.assign(state.options, data.options);
    $('f-alpha').value = String(state.options.alpha);
    $('f-ci-basis').value = state.options.basis;
    $('f-sw-reference').value = state.options.swReference;
  }

  showMessages(problems, problems.length ? [] : [`Loaded ${fileName}.`]);
  render();
}

function exportCsv() {
  const results = scoreProtocol(state.scaled, state.options);
  applyOfficialCompositeTables(results);

  const rows = [['Section', 'Item', 'Score', 'Percentile', '95% CI', 'Descriptor']];

  for (const subtest of results.subtests) {
    if (subtest.score == null) continue;
    rows.push(['Subtest', `${subtest.name} (${subtest.abbr})`, subtest.score,
      formatPercentile(subtest.percentile), '', subtest.descriptor]);
  }

  for (const definition of COMPOSITES) {
    const composite = results.composites[definition.id];
    if (!composite.complete) continue;
    const ci = composite.intervals[0.95];
    rows.push(['Composite', `${composite.id} (${composite.short})`, composite.score,
      formatPercentile(composite.percentile), `${ci.lower}-${ci.upper}`, composite.descriptor]);
  }

  for (const comparison of results.indexComparisons) {
    rows.push(['Index comparison', `${comparison.pair[0]} - ${comparison.pair[1]}`,
      comparison.difference, '', `critical ${comparison.criticalValue.toFixed(2)}`,
      comparison.significant ? 'Significant' : 'Not significant']);
  }

  for (const entry of results.strengthsAndWeaknesses.entries) {
    if (!entry.significant) continue;
    rows.push(['Strength/weakness', `${entry.name} (${entry.abbr})`, entry.score, '',
      `deviation ${entry.deviation.toFixed(2)}`, entry.verdict]);
  }

  const name = (state.examinee.id || 'results').replace(/[^\w.-]+/g, '_');
  downloadFile(`wiscv-${name}.csv`, 'text/csv', rows.map(toCsvRow).join('\r\n'));
}

/** Quote a CSV field only when it needs it, escaping embedded quotes. */
function toCsvRow(cells) {
  return cells.map((cell) => {
    const text = String(cell ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(',');
}

function downloadFile(fileName, mimeType, contents) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// --- Norms ------------------------------------------------------------------

function loadNorms(data, fileName) {
  const { valid, errors, warnings } = validateNorms(data);
  if (!valid) {
    showMessages(errors, warnings);
    return;
  }
  state.norms = data;
  showMessages([], [`Loaded ${fileName}${data.label ? ` — ${data.label}` : ''}.`, ...warnings]);
  updateNormsUi();
  render();
}

function clearNorms() {
  state.norms = null;
  showMessages([], ['Norms removed. Raw-score conversion is off.']);
  updateNormsUi();
  render();
}

/**
 * Raw-score fields appear only for subtests the loaded norms can actually
 * convert, so the UI never offers a conversion it cannot perform.
 */
function updateNormsUi() {
  const status = $('norms-status');
  const loaded = Boolean(state.norms);
  $('btn-clear-norms').hidden = !loaded;

  const months = currentAgeInMonths();
  const band = loaded && months != null ? findAgeBand(state.norms, months) : null;

  // Say why raw-score entry is unavailable, rather than just not showing it.
  status.classList.toggle('active', Boolean(band));
  if (!loaded) {
    status.textContent = 'Raw‑score conversion is off — no norms loaded.';
  } else if (months == null) {
    status.textContent = 'Norms loaded — enter a date of birth to convert raw scores.';
  } else if (!band) {
    status.textContent =
      `Norms loaded, but no age band covers ${formatAge(months)}. Enter scaled scores directly.`;
  } else {
    status.textContent = `Norms loaded — converting raw scores using band ${band.id}.`;
  }

  for (const subtest of SUBTESTS) {
    const convertible = Boolean(band?.subtests?.[subtest.id]);
    const rawInput = $(`raw-${subtest.id}`);
    rawInput.hidden = !convertible;
    rawInput.placeholder = 'raw';
    document.querySelector(`.subtest-row[data-subtest="${subtest.id}"]`)
      .classList.toggle('has-raw', convertible);
  }
}

// --- File reading and messaging ---------------------------------------------

function readJsonFile(event, handler) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      handler(JSON.parse(String(reader.result)), file.name);
    } catch (error) {
      showMessages([`Could not read ${file.name}: ${error.message}`], []);
    }
  };
  reader.onerror = () => showMessages([`Could not read ${file.name}.`], []);
  reader.readAsText(file);
  event.target.value = '';  // allow re-selecting the same file
}

function showMessages(errors, warnings) {
  const box = $('norms-messages');
  box.replaceChildren();
  if (errors.length === 0 && warnings.length === 0) {
    box.hidden = true;
    return;
  }
  const list = document.createElement('ul');
  for (const message of errors) list.append(textNode('li', 'message-error', message));
  for (const message of warnings) list.append(textNode('li', 'message-warning', message));
  box.append(list);
  box.hidden = false;
}
