/**
 * exam-render.js — SVG for the practice-test stimuli.
 *
 * Every stimulus is drawn from the item data, so what the examinee sees is
 * generated from the same structure the scorer reads. Colours come from CSS
 * custom properties so the stimuli follow the page theme.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
let uniqueId = 0;

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function svg(viewBox, className) {
  const node = el('svg', { viewBox, class: className ?? '' });
  node.setAttribute('aria-hidden', 'true');
  return node;
}

// ---------------------------------------------------------------------------
// Matrix reasoning
// ---------------------------------------------------------------------------

/** Outlines for each shape, on a 100x100 canvas centred at (50,50). */
const SHAPE_PATHS = {
  circle:   'M50,14 A36,36 0 1,1 49.9,14 Z',
  square:   'M18,18 H82 V82 H18 Z',
  triangle: 'M50,14 L84,80 H16 Z',
  diamond:  'M50,12 L86,50 L50,88 L14,50 Z',
  hexagon:  'M50,13 L82,31 V69 L50,87 L18,69 V31 Z',
};

/** Where `count` copies of a shape sit, and how big each is. */
const LAYOUTS = {
  1: [{ x: 50, y: 50, scale: 1 }],
  2: [{ x: 31, y: 50, scale: 0.56 }, { x: 69, y: 50, scale: 0.56 }],
  3: [{ x: 50, y: 30, scale: 0.46 }, { x: 31, y: 66, scale: 0.46 }, { x: 69, y: 66, scale: 0.46 }],
};

/** Render one matrix cell: `count` shapes with a fill style and rotation. */
export function renderMatrixCell(cell, { size = 92 } = {}) {
  const node = svg('0 0 100 100', 'stim-cell');
  node.setAttribute('width', size);
  node.setAttribute('height', size);
  if (!cell) {
    node.append(el('text', {
      x: 50, y: 50, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'stim-question',
    }, '?'));
    return node;
  }

  for (const spot of LAYOUTS[cell.count] ?? LAYOUTS[1]) {
    const group = el('g', {
      transform: `translate(${spot.x} ${spot.y}) rotate(${cell.rotation}) ` +
                 `scale(${spot.scale}) translate(-50 -50)`,
    });
    group.append(...shapeParts(cell.shape, cell.fill));
    node.append(group);
  }
  return node;
}

/**
 * A shape in one of three fill styles. 'half' is drawn as an outline plus a
 * filled copy clipped to the left half, which reads clearly at small sizes.
 */
function shapeParts(shape, fill) {
  const d = SHAPE_PATHS[shape] ?? SHAPE_PATHS.circle;

  if (fill === 'solid') return [el('path', { d, class: 'stim-shape stim-solid' })];
  if (fill === 'outline') return [el('path', { d, class: 'stim-shape stim-outline' })];

  const clipId = `half-${uniqueId += 1}`;
  const clip = el('clipPath', { id: clipId });
  clip.append(el('rect', { x: 0, y: 0, width: 50, height: 100 }));
  return [
    clip,
    el('path', { d, class: 'stim-shape stim-solid', 'clip-path': `url(#${clipId})` }),
    el('path', { d, class: 'stim-shape stim-outline' }),
  ];
}

/** The 3x3 matrix with its missing cell. */
export function renderMatrix(matrix) {
  const grid = document.createElement('div');
  grid.className = 'matrix-grid';
  for (const row of matrix) {
    for (const cell of row) {
      const box = document.createElement('div');
      box.className = cell ? 'matrix-cell' : 'matrix-cell matrix-cell-missing';
      box.append(renderMatrixCell(cell));
      grid.append(box);
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// Figure weights
// ---------------------------------------------------------------------------

/** A row of `count` identical shapes, used on the scale pans and in options. */
export function renderShapeGroup(spec, { size = 34 } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'shape-group';
  const count = spec.count ?? 1;
  for (let i = 0; i < count; i += 1) {
    const node = svg('0 0 100 100', `stim-shape-solo tint-${spec.color}`);
    node.setAttribute('width', size);
    node.setAttribute('height', size);
    node.append(el('path', { d: SHAPE_PATHS[spec.shape] ?? SHAPE_PATHS.circle, class: 'stim-shape stim-solid' }));
    wrap.append(node);
  }
  return wrap;
}

/** A balance scale. `right` may be null, which draws a question mark instead. */
export function renderScale(left, right, { unknown = false } = {}) {
  const scale = document.createElement('div');
  scale.className = 'scale';

  const beam = document.createElement('div');
  beam.className = 'scale-beam';

  const leftPan = document.createElement('div');
  leftPan.className = 'scale-pan';
  leftPan.append(renderShapeGroup(left));

  const rightPan = document.createElement('div');
  rightPan.className = 'scale-pan';
  if (unknown) {
    const mark = document.createElement('span');
    mark.className = 'scale-unknown';
    mark.textContent = '?';
    rightPan.append(mark);
  } else {
    rightPan.append(renderShapeGroup(right));
  }

  beam.append(leftPan, spacer('scale-fulcrum'), rightPan);
  scale.append(beam);
  return scale;
}

function spacer(className) {
  const node = document.createElement('div');
  node.className = className;
  return node;
}

// ---------------------------------------------------------------------------
// Block design
// ---------------------------------------------------------------------------

/** Which region of a tile carries colour A, as a polygon on a 100x100 tile. */
const TILE_POLYGONS = {
  'diag-ab-tl': '0,0 100,0 0,100',
  'diag-ab-tr': '0,0 100,0 100,100',
  'diag-ab-br': '100,0 100,100 0,100',
  'diag-ab-bl': '0,0 100,100 0,100',
};

/** One block face. */
export function renderTile(state, { size = 46 } = {}) {
  const node = svg('0 0 100 100', 'block-tile');
  node.setAttribute('width', size);
  node.setAttribute('height', size);

  node.append(el('rect', { x: 0, y: 0, width: 100, height: 100, class: 'tile-b' }));
  if (state === 'full-a') {
    node.append(el('rect', { x: 0, y: 0, width: 100, height: 100, class: 'tile-a' }));
  } else if (state !== 'full-b') {
    node.append(el('polygon', { points: TILE_POLYGONS[state], class: 'tile-a' }));
  }
  node.append(el('rect', { x: 0, y: 0, width: 100, height: 100, class: 'tile-edge' }));
  return node;
}

/**
 * A grid of tiles. When `onTileClick` is supplied the tiles are buttons that
 * cycle through the available faces; otherwise the grid is a static target.
 */
export function renderTileGrid(grid, { size = 46, onTileClick = null, label = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = onTileClick ? 'tile-grid tile-grid-interactive' : 'tile-grid';
  wrap.style.setProperty('--tile-columns', String(grid.length));
  if (label) wrap.setAttribute('aria-label', label);

  grid.forEach((row, rowIndex) => {
    row.forEach((state, colIndex) => {
      if (!onTileClick) {
        const cell = document.createElement('span');
        cell.className = 'tile-cell';
        cell.append(renderTile(state, { size }));
        wrap.append(cell);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tile-cell tile-button';
      button.setAttribute('aria-label', `Row ${rowIndex + 1}, column ${colIndex + 1}: ${state}`);
      button.append(renderTile(state, { size }));
      button.addEventListener('click', () => onTileClick(rowIndex, colIndex));
      wrap.append(button);
    });
  });
  return wrap;
}

// ---------------------------------------------------------------------------
// Visual puzzles
// ---------------------------------------------------------------------------

/** A polyomino piece: its cells filled on an otherwise empty grid. */
export function renderPuzzlePiece(cells, size, { pixels = 74, ghost = true } = {}) {
  const node = svg(`0 0 ${size * 10} ${size * 10}`, 'puzzle-piece');
  node.setAttribute('width', pixels);
  node.setAttribute('height', pixels);

  const filled = new Set(cells);
  for (let cell = 0; cell < size * size; cell += 1) {
    const x = (cell % size) * 10;
    const y = Math.floor(cell / size) * 10;
    if (filled.has(cell)) {
      node.append(el('rect', { x, y, width: 10, height: 10, class: 'piece-fill' }));
    } else if (ghost) {
      node.append(el('rect', { x, y, width: 10, height: 10, class: 'piece-ghost' }));
    }
  }
  return node;
}

/** The completed square the pieces must reconstruct. */
export function renderPuzzleTarget(size, { pixels = 116 } = {}) {
  return renderPuzzlePiece([...Array(size * size).keys()], size, { pixels, ghost: false });
}

// ---------------------------------------------------------------------------
// Processing speed glyphs
// ---------------------------------------------------------------------------

/** One abstract glyph from the shared set. */
export function renderGlyph(path, { size = 34 } = {}) {
  const node = svg('0 0 18 18', 'glyph');
  node.setAttribute('width', size);
  node.setAttribute('height', size);
  node.append(el('path', { d: path, class: 'glyph-stroke' }));
  return node;
}
