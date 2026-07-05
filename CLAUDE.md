# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

No build step. Open directly or serve statically:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or
open index.html               # macOS direct open
```

## Architecture

Three files, no dependencies, no bundler.

- **`index.html`** — DOM structure: `<canvas id="board">` (300×600px), side panel with score/lines/level/next-piece preview, and a shared overlay for pause and game-over states.
- **`style.css`** — Dark/retro arcade theme; no logic.
- **`game.js`** — All game logic (~300 lines, `'use strict'`):
  - **State**: `board` (10×20 matrix, `0`=empty, `1–7`=piece color index), `current`/`next` piece objects `{type, shape, x, y}`.
  - **Loop**: `requestAnimationFrame`-based. `loop()` accumulates `dropAccum`; when it exceeds `dropInterval` the piece drops one row or locks.
  - **Piece locking**: `lockPiece()` → `merge()` (writes piece into board) → `clearLines()` → `spawn()` (next becomes current; new next generated).
  - **Game over**: triggered inside `spawn()` if the new `current` immediately collides.
  - **Rotation**: `rotateCW()` (transpose + reverse rows); `tryRotate()` applies wall kicks `[0, -1, 1, -2, 2]`.
  - **Ghost piece**: `ghostY()` projects current piece downward; drawn at `alpha=0.2`.
  - **Speed formula**: `dropInterval = max(100, 1000 − (level−1) × 90)` ms; level increments every 10 lines.

## Key tunable constants (`game.js` top)

| Constant | Default | Note |
|---|---|---|
| `COLS` / `ROWS` | 10 / 20 | Change canvas `width`/`height` in `index.html` too (`COLS×BLOCK` / `ROWS×BLOCK`) |
| `BLOCK` | 30px | Cell size in pixels |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points for 1–4 line clears (multiplied by level) |
