// Nightshade — Silent Infiltration
// world.js — loads a level map, answers collision and line-of-sight questions.
// Tiles: '#' wall, 'C' crate (both block movement and sight),
// '.' floor, 'B' bush (walkable, hides), 'I' core, 'E' exit, 'P' start.

import { TILE, COLS, ROWS } from './config.js';

const SOLID = new Set(['#', 'C']); // blocks movement
const SIGHT_BLOCK = new Set(['#', 'C']); // blocks a guard's gaze

export class World {
  constructor(level) {
    this.level = level;
    this.grid = level.map.map((row) => [...row]);
    this.cores = [];
    this.exit = null;
    this.playerStart = { x: TILE * 1.5, y: TILE * 1.5 };
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.grid[r][c];
        if (ch === 'P') this.playerStart = { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
        if (ch === 'I') this.cores.push({ tx: c, ty: r, x: (c + 0.5) * TILE, y: (r + 0.5) * TILE, taken: false });
        if (ch === 'E') this.exit = { tx: c, ty: r, x: (c + 0.5) * TILE, y: (r + 0.5) * TILE };
      }
    }
    this.coresTotal = this.cores.length;
    this.coresGot = 0;
  }

  // Centre of a tile in world pixels — one helper, used by every module.
  static tileCenter(tx, ty) {
    return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
  }

  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
    return this.grid[ty][tx];
  }

  tileAtPx(x, y) {
    return this.tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  isSolidPx(x, y) {
    return SOLID.has(this.tileAtPx(x, y));
  }

  isBushPx(x, y) {
    return this.tileAtPx(x, y) === 'B';
  }

  // Circle-vs-solid-tiles collision. Moves the circle, sliding along walls.
  moveCircle(pos, dx, dy, radius) {
    const nx = pos.x + dx;
    if (!this.circleHitsSolid(nx, pos.y, radius)) pos.x = nx;
    const ny = pos.y + dy;
    if (!this.circleHitsSolid(pos.x, ny, radius)) pos.y = ny;
  }

  circleHitsSolid(x, y, radius) {
    const x0 = Math.floor((x - radius) / TILE);
    const x1 = Math.floor((x + radius) / TILE);
    const y0 = Math.floor((y - radius) / TILE);
    const y1 = Math.floor((y + radius) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!SOLID.has(this.tileAt(tx, ty))) continue;
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        const ddx = x - cx;
        const ddy = y - cy;
        if (ddx * ddx + ddy * ddy < radius * radius) return true;
      }
    }
    return false;
  }

  // Line of sight between two points: true when no wall/crate crosses the line.
  hasLineOfSight(x0, y0, x1, y1) {
    if (Math.floor(x0 / TILE) === Math.floor(x1 / TILE) &&
      Math.floor(y0 / TILE) === Math.floor(y1 / TILE)) return true;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (SIGHT_BLOCK.has(this.tileAtPx(x0 + dx * t, y0 + dy * t))) return false;
    }
    return true;
  }

  // Nearest untaken core within reach of a point, else null.
  coreNear(x, y, radius) {
    for (const core of this.cores) {
      if (core.taken) continue;
      if (Math.hypot(core.x - x, core.y - y) < radius) return core;
    }
    return null;
  }

  takeCore(core) {
    core.taken = true;
    this.coresGot++;
  }

  allCoresGot() {
    return this.coresGot >= this.coresTotal;
  }

  atExit(x, y) {
    if (!this.exit) return false;
    return Math.hypot(this.exit.x - x, this.exit.y - y) < TILE * 0.62;
  }

  // Direction from a point to the exit, for the on-screen exit arrow.
  exitDirection(x, y) {
    if (!this.exit) return 0;
    return Math.atan2(this.exit.y - y, this.exit.x - x);
  }
}
