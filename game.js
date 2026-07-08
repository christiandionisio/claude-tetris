'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#b0bec5', // Tuerca - gris metálico
  '#f06292', // + - rosa
  '#4db6ac', // U - verde azulado
  '#7986cb', // Y - índigo
  '#ffd700', // single - dorado (premio Tetris)
  '#ff6e40', // power-up - naranja brillante
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (hueco central)
  [[0,9,0],[9,9,9],[0,9,0]],                  // + (pentominó plus)
  [[10, 0,10],[10,10,10]],                    // U (pentominó U)
  [[ 0,11],[11,11],[ 0,11],[ 0,11]],          // Y (pentominó Y)
  [[12]],                                      // single 1×1 (premio Tetris)
  [[13]],                                      // power-up 1×1
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const POWERUPS = ['bomb', 'ray', 'dye', 'gravity', 'freeze'];
const POWERUP_LABELS = { bomb: 'BOMBA', ray: 'RAYO', dye: 'TINTE', gravity: 'GRAVEDAD', freeze: 'CONGELAR' };
const POWERUP_COLOR = '#ff6e40';
const POWERUP_LINES = 8;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const menuButtons = document.getElementById('menu-buttons');
const themeToggle = document.getElementById('theme-toggle');
const powerupEl = document.getElementById('powerup');
const freezeTimerEl = document.getElementById('freeze-timer');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId, tetrisReward, powerupPending, frozenUntil, combo, maxCombo, maxLinesCleared;

function applyTheme(isLight) {
  document.body.classList.toggle('light-mode', isLight);
  themeToggle.checked = isLight;
}

function gridLineColor() {
  return getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
}

applyTheme(localStorage.getItem('theme') === 'light');

themeToggle.addEventListener('change', () => {
  const isLight = themeToggle.checked;
  applyTheme(isLight);
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  if (current) draw();
  if (next) drawNext();
});

const HS_KEY = 'tetris-highscores';

function loadScores() {
  try { return JSON.parse(localStorage.getItem(HS_KEY)) || []; }
  catch { return []; }
}

function saveScores(arr) {
  localStorage.setItem(HS_KEY, JSON.stringify(arr));
}

function isTopScore(s) {
  const scores = loadScores();
  return scores.length < 5 || s > (scores[scores.length - 1]?.score ?? 0);
}

function addScore(name, s, cmb, linesMax) {
  const scores = loadScores();
  scores.push({ name, score: s, combo: cmb, linesMax });
  scores.sort((a, b) => b.score - a.score);
  scores.splice(5);
  saveScores(scores);
  return scores;
}

function resetScores() {
  localStorage.removeItem(HS_KEY);
}

function renderScoresTable(scores, highlightScore) {
  if (!scores.length) {
    return '<div class="hs-table-wrap"><p class="hs-empty">Sin récords aún</p></div>';
  }
  const rows = scores.map((e, i) => {
    const cls = (highlightScore !== undefined && e.score === highlightScore) ? ' class="hs-highlight"' : '';
    return `<tr${cls}><td>${i + 1}</td><td>${e.name}</td><td>${e.score.toLocaleString()}</td><td>${e.combo}</td><td>${e.linesMax}</td></tr>`;
  }).join('');
  return `<div class="hs-table-wrap"><p class="hs-title">RÉCORDS</p><table class="hs-table"><thead><tr><th>#</th><th>Nombre</th><th>Score</th><th>Combo</th><th>Líneas</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  let type;
  if (Math.random() < 0.12) {
    type = 9 + Math.floor(Math.random() * 3); // 9,10,11 = +,U,Y (pentominós)
  } else {
    type = Math.floor(Math.random() * 8) + 1; // 1..8 clásicas + Tuerca
  }
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function singlePiece() {
  const shape = PIECES[12].map(row => [...row]);
  return { type: 12, shape, x: Math.floor(COLS / 2), y: 0 };
}

function powerupPiece(kind) {
  const shape = PIECES[13].map(row => [...row]);
  return { type: 13, shape, x: Math.floor(COLS / 2), y: 0, power: kind };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function applyPowerup(kind, x, y) {
  board[y][x] = 0;
  if (kind === 'bomb') {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const ny = y + dy, nx = x + dx;
        if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) board[ny][nx] = 0;
      }
  } else if (kind === 'ray') {
    for (let c = 0; c < COLS; c++) board[y][c] = 0;
    for (let r = 0; r < ROWS; r++) board[r][x] = 0;
  } else if (kind === 'dye') {
    const colors = new Set();
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c]) colors.add(board[r][c]);
    if (!colors.size) return;
    const colorArr = [...colors];
    const target = colorArr[Math.floor(Math.random() * colorArr.length)];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] === target) board[r][c] = 0;
  } else if (kind === 'gravity') {
    for (let c = 0; c < COLS; c++) {
      const cells = [];
      for (let r = 0; r < ROWS; r++) if (board[r][c]) cells.push(board[r][c]);
      for (let r = 0; r < ROWS; r++) board[r][c] = 0;
      for (let i = 0; i < cells.length; i++) board[ROWS - cells.length + i][c] = cells[i];
    }
  } else if (kind === 'freeze') {
    frozenUntil = performance.now() + 5000;
  }
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    if (cleared === 4) tetrisReward = true;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (cleared > maxLinesCleared) maxLinesCleared = cleared;
    const prevLines = lines;
    lines += cleared;
    if (Math.floor(lines / POWERUP_LINES) > Math.floor(prevLines / POWERUP_LINES)) powerupPending = true;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (current.power) applyPowerup(current.power, current.x, current.y);
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  if (tetrisReward) {
    next = singlePiece();
    tetrisReward = false;
  } else if (powerupPending) {
    next = powerupPiece(POWERUPS[Math.floor(Math.random() * POWERUPS.length)]);
    powerupPending = false;
  } else {
    next = randomPiece();
  }
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  updateHUD();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  powerupEl.textContent = (next && next.power) ? POWERUP_LABELS[next.power] : '—';
  const remaining = frozenUntil - performance.now();
  if (remaining > 0) {
    freezeTimerEl.textContent = Math.ceil(remaining / 1000) + 's';
    freezeTimerEl.style.display = '';
  } else {
    freezeTimerEl.textContent = '';
    freezeTimerEl.style.display = 'none';
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  if (current.power) {
    const initials = { bomb: 'B', ray: 'R', dye: 'T', gravity: 'G', freeze: 'C' };
    ctx.font = `bold ${BLOCK - 8}px Courier New`;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials[current.power], (current.x + 0.5) * BLOCK, (current.y + 0.5) * BLOCK);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
  if (next.power) {
    nextCtx.font = 'bold 11px Courier New';
    nextCtx.fillStyle = POWERUP_COLOR;
    nextCtx.textAlign = 'center';
    nextCtx.fillText(POWERUP_LABELS[next.power], nextCanvas.width / 2, nextCanvas.height - 6);
    nextCtx.textAlign = 'left';
  }
}

function endGame(win) {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = win ? '¡GANASTE!' : 'GAME OVER';

  let scoreHtml = `<div class="hs-score-line">Puntuación: ${score.toLocaleString()}</div>`;

  if (!win && isTopScore(score)) {
    scoreHtml += `<div class="name-entry"><input type="text" id="score-name" maxlength="12" placeholder="Tu nombre"><button id="save-score-btn" class="menu-btn">GUARDAR</button></div>`;
    scoreHtml += renderScoresTable(loadScores());
    overlayScore.innerHTML = scoreHtml;
    document.getElementById('save-score-btn').addEventListener('click', () => {
      const name = document.getElementById('score-name')?.value.trim() || 'Anónimo';
      const scores = addScore(name, score, maxCombo, maxLinesCleared);
      overlayScore.innerHTML = `<div class="hs-score-line">Puntuación: ${score.toLocaleString()}</div>` + renderScoresTable(scores, score);
    });
  } else {
    scoreHtml += renderScoresTable(loadScores());
    overlayScore.innerHTML = scoreHtml;
  }

  menuButtons.innerHTML = '<button id="restart-btn" class="menu-btn">REINICIAR</button>';
  document.getElementById('restart-btn').addEventListener('click', init);
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    overlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.innerHTML = '';
    menuButtons.innerHTML = '<button id="restart-btn" class="menu-btn">REINICIAR</button>';
    document.getElementById('restart-btn').addEventListener('click', init);
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  if (gameOver || paused) return;
  const dt = ts - lastTime;
  lastTime = ts;
  if (frozenUntil > 0 && ts < frozenUntil) {
    updateHUD(); // tick freeze timer
  } else {
    if (frozenUntil > 0) { frozenUntil = 0; updateHUD(); }
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  tetrisReward = false;
  powerupPending = false;
  frozenUntil = 0;
  combo = 0;
  maxCombo = 0;
  maxLinesCleared = 0;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

function showMenu() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.innerHTML = renderScoresTable(loadScores());
  menuButtons.innerHTML = `
    <button id="play-btn" class="menu-btn">JUGAR</button>
    <button id="reset-scores-btn" class="menu-btn hs-reset-btn">RESETEAR RÉCORDS</button>
  `;
  overlay.classList.remove('hidden');
  document.getElementById('play-btn').addEventListener('click', init);
  document.getElementById('reset-scores-btn').addEventListener('click', () => {
    resetScores();
    overlayScore.innerHTML = renderScoresTable([]);
  });
}

// Guard keyboard events before the game starts
paused = false;
gameOver = true;
showMenu();
