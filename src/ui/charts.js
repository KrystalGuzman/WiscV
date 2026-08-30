/**
 * charts.js — SVG profile charts, built by hand.
 *
 * Two charts, one shape: a categorical axis of subtests or indexes, a
 * continuous score axis, a shaded average band, and a connected line of
 * points. Colours come from CSS custom properties, so both charts follow the
 * page theme and print correctly without a second implementation.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Render a profile chart into `container`.
 *
 * @param {HTMLElement} container
 * @param {Array<{label: string, score: number|null, lower?: number, upper?: number}>} points
 * @param {Object} scale  { min, max, mean, sd, step } for the score axis
 * @param {Object} [options]  { showIntervals }
 */
export function renderProfileChart(container, points, scale, options = {}) {
  container.replaceChildren();

  const scored = points.filter((p) => p.score != null);
  const width = 760;
  const height = 260;
  const margin = { top: 16, right: 16, bottom: 46, left: 44 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const svg = el('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': options.ariaLabel ?? 'Score profile chart',
  });

  if (scored.length === 0) {
    svg.append(el('text', {
      x: width / 2, y: height / 2, 'text-anchor': 'middle', class: 'chart-empty',
    }, 'Enter scaled scores to see the profile'));
    container.append(svg);
    return;
  }

  const y = (value) =>
    margin.top + plotHeight * (1 - (value - scale.min) / (scale.max - scale.min));

  // Categorical x positions, one slot per point, centred in its slot.
  const slot = plotWidth / points.length;
  const x = (index) => margin.left + slot * (index + 0.5);

  // Average band: mean +/- 1 SD, the region a score is unremarkable in.
  const bandTop = y(scale.mean + scale.sd);
  const bandBottom = y(scale.mean - scale.sd);
  svg.append(el('rect', {
    x: margin.left, y: bandTop,
    width: plotWidth, height: bandBottom - bandTop,
    class: 'band',
  }));

  // Horizontal gridlines and the score axis.
  for (let value = scale.min; value <= scale.max; value += scale.step) {
    const yPos = y(value);
    svg.append(el('line', {
      x1: margin.left, y1: yPos, x2: margin.left + plotWidth, y2: yPos,
      class: value === scale.mean ? 'mean-line' : 'grid-line',
    }));
    svg.append(el('text', {
      x: margin.left - 8, y: yPos + 3.5,
      'text-anchor': 'end', class: 'axis-label',
    }, String(value)));
  }

  // Confidence-interval whiskers, drawn under the series line.
  if (options.showIntervals) {
    points.forEach((point, i) => {
      if (point.score == null || point.lower == null || point.upper == null) return;
      const cx = x(i);
      svg.append(el('line', {
        x1: cx, y1: y(point.lower), x2: cx, y2: y(point.upper), class: 'ci-bar',
      }));
      for (const cap of [point.lower, point.upper]) {
        svg.append(el('line', {
          x1: cx - 4, y1: y(cap), x2: cx + 4, y2: y(cap), class: 'ci-bar',
        }));
      }
    });
  }

  // Series line, broken across any gap where a score is missing.
  for (const run of contiguousRuns(points)) {
    if (run.length < 2) continue;
    const d = run.map(({ index, point }, i) =>
      `${i === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.score).toFixed(1)}`).join(' ');
    svg.append(el('path', { d, class: 'series-line' }));
  }

  // Points and their value labels.
  points.forEach((point, i) => {
    if (point.score == null) return;
    const cx = x(i);
    const cy = y(point.score);
    svg.append(el('circle', { cx, cy, r: 4, class: 'series-point' }));
    svg.append(el('text', {
      x: cx, y: cy - 10, 'text-anchor': 'middle', class: 'point-label',
    }, String(point.score)));
  });

  // Category labels, rotated when they would otherwise collide.
  const rotate = slot < 54;
  points.forEach((point, i) => {
    const cx = x(i);
    const label = el('text', {
      x: cx,
      y: margin.top + plotHeight + (rotate ? 14 : 16),
      'text-anchor': rotate ? 'end' : 'middle',
      class: 'axis-label',
    }, point.label);
    if (rotate) {
      label.setAttribute('transform', `rotate(-40 ${cx} ${margin.top + plotHeight + 14})`);
    }
    svg.append(label);
  });

  container.append(svg);
}

/**
 * Split the series into runs of consecutive scored points, so the line breaks
 * at gaps instead of drawing a straight segment across missing data.
 */
function contiguousRuns(points) {
  const runs = [];
  let current = [];
  points.forEach((point, index) => {
    if (point.score == null) {
      if (current.length > 0) runs.push(current);
      current = [];
    } else {
      current.push({ index, point });
    }
  });
  if (current.length > 0) runs.push(current);
  return runs;
}
