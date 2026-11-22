// Nightshade — Silent Infiltration
// render.js — draws everything on one canvas: floor, walls, crates, bushes,
// vision cones, guards, player, cores, exit, lighting and the HUD.
// The look: a dark night floor, warm lamp pools, cones you can read at a
// glance — yellow while calm, orange while suspicious, red on alarm.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H, COLORS, VISION_RANGE, VISION_HALF_ANGLE } from './config.js';
import { GUARD_STATE } from './guard.js';

function coneColor(guard) {
  if (guard.state === GUARD_STATE.CHASE) return COLORS.coneAlert;
  if (guard.state === GUARD_STATE.SUSPICIOUS || guard.state === GUARD_STATE.SEARCH) return COLORS.coneSuspicious;
  return COLORS.coneCalm;
}

function guardColor(guard) {
  if (guard.state === GUARD_STATE.CHASE) return COLORS.guard;
  if (guard.state === GUARD_STATE.SUSPICIOUS || guard.state === GUARD_STATE.SEARCH) return COLORS.guardSuspicious;
  return COLORS.guard;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
  }

  draw(game) {
    const ctx = this.ctx;
    const { world, player, guards } = game;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    this._drawFloor(world);
    this._drawExit(world, game.time);
    this._drawCores(world, game.time);
    this._drawBushes(world);
    this._drawWalls(world);
    this._drawCones(guards, world);
    this._drawGuards(guards);
    this._drawPlayer(player, game.time, game);
    this._drawClickTarget(game.input);
    this._drawLighting(player);
    this._drawHUD(game);
  }

  _drawFloor(world) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = world.grid[r][c];
        if (ch === '#') continue;
        ctx.fillStyle = (r + c) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        // faint tile seams so the floor reads as a place, not a void
        ctx.strokeStyle = COLORS.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(c * TILE + 0.5, r * TILE + 0.5, TILE - 1, TILE - 1);
      }
    }
  }

  _drawWalls(world) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = world.grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (ch === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(x, y, TILE, 5);
        } else if (ch === 'C') {
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = COLORS.crateTop;
          ctx.fillRect(x + 3, y + 3, TILE - 6, 5);
          ctx.strokeStyle = '#4a3a22';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(x + 3, y + 3);
          ctx.lineTo(x + TILE - 3, y + TILE - 3);
          ctx.moveTo(x + TILE - 3, y + 3);
          ctx.lineTo(x + 3, y + TILE - 3);
          ctx.stroke();
        }
      }
    }
  }

  _drawBushes(world) {
    const ctx = this.ctx;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (world.grid[r][c] !== 'B') continue;
        const x = c * TILE;
        const y = r * TILE;
        ctx.fillStyle = COLORS.bush;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.bushLeaf;
        for (const [ox, oy, rad] of [[8, 9, 7], [22, 8, 8], [15, 20, 8], [25, 22, 6]]) {
          ctx.beginPath();
          ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _drawExit(world, time) {
    const ctx = this.ctx;
    const e = world.exit;
    if (!e) return;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    const open = world.allCoresGot();
    ctx.save();
    ctx.globalAlpha = open ? 0.55 + 0.35 * pulse : 0.3;
    ctx.fillStyle = open ? COLORS.exit : '#5a6b7a';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = open ? COLORS.exit : '#7a8a9a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    // doorway arrow pointing out
    ctx.fillStyle = open ? '#062b1a' : '#2a343f';
    ctx.beginPath();
    ctx.moveTo(e.x - 6, e.y - 4);
    ctx.lineTo(e.x + 2, e.y);
    ctx.lineTo(e.x - 6, e.y + 4);
    ctx.closePath();
    ctx.fill();
    if (!open) {
      ctx.fillStyle = '#c8d4e2';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LOCKED', e.x, e.y - 22);
    } else {
      ctx.fillStyle = COLORS.exit;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', e.x, e.y - 22);
    }
  }

  _drawCores(world, time) {
    const ctx = this.ctx;
    for (const core of world.cores) {
      if (core.taken) continue;
      const bob = Math.sin(time * 2.5 + core.tx) * 2;
      const glow = 0.5 + 0.5 * Math.sin(time * 4 + core.tx * 2);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.3 * glow;
      ctx.fillStyle = COLORS.core;
      ctx.beginPath();
      ctx.arc(core.x, core.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COLORS.core;
      ctx.beginPath();
      ctx.arc(core.x, core.y + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2a00';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('◆', core.x, core.y + bob + 3);
    }
  }

  _drawCones(guards, world) {
    const ctx = this.ctx;
    for (const g of guards) {
      const steps = 26;
      ctx.fillStyle = coneColor(g);
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      for (let i = 0; i <= steps; i++) {
        const a = g.dir - VISION_HALF_ANGLE + (2 * VISION_HALF_ANGLE * i) / steps;
        // march out until a wall blocks the sight, so the cone hugs cover
        let r = VISION_RANGE;
        for (let d = 14; d <= VISION_RANGE; d += 7) {
          const px = g.x + Math.cos(a) * d;
          const py = g.y + Math.sin(a) * d;
          if (world.isSolidPx(px, py)) {
            r = d - 7;
            break;
          }
        }
        ctx.lineTo(g.x + Math.cos(a) * r, g.y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  _drawGuards(guards) {
    const ctx = this.ctx;
    for (const g of guards) {
      const color = guardColor(g);
      // body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a0d0d';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
      ctx.fill();
      // facing tick
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(g.dir) * 8, g.y + Math.sin(g.dir) * 8);
      ctx.lineTo(g.x + Math.cos(g.dir) * 18, g.y + Math.sin(g.dir) * 18);
      ctx.stroke();
      // detection meter ring above the guard
      if (g.meter > 2) {
        const w = 30;
        const frac = g.meter / 100;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(g.x - w / 2, g.y - 26, w, 5);
        ctx.fillStyle = frac >= 1 ? '#ff4040' : frac >= 0.5 ? '#ffb020' : '#ffd65a';
        ctx.fillRect(g.x - w / 2, g.y - 26, w * frac, 5);
      }
      // "!" when chasing, "?" when suspicious
      if (g.state === GUARD_STATE.CHASE) {
        ctx.fillStyle = '#ff4040';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', g.x, g.y - 30);
      } else if (g.state === GUARD_STATE.SUSPICIOUS || g.state === GUARD_STATE.SEARCH) {
        ctx.fillStyle = '#ffb020';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('?', g.x, g.y - 30);
      }
    }
  }

  _drawPlayer(player, time, game) {
    const ctx = this.ctx;
    // soft glow so the player reads against the dark floor
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = COLORS.playerRing;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // body: a hooded figure, drawn as a circle with a facing wedge
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22303f';
    ctx.beginPath();
    ctx.arc(player.x, player.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.player;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.dir) * 6, player.y + Math.sin(player.dir) * 6);
    ctx.lineTo(player.x + Math.cos(player.dir) * 16, player.y + Math.sin(player.dir) * 16);
    ctx.stroke();
    // sneak ring: a dashed circle while sneaking
    if (player.sneaking) {
      ctx.strokeStyle = 'rgba(127, 212, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // noise ring: while walking, a faint pulsing ring shows how loud you are
    if (player.moving && !player.sneaking) {
      const pulse = (time * 2.2) % 1;
      const loud = Math.min(1, player.speed / 175); // faster steps, wider ring
      ctx.strokeStyle = `rgba(232, 241, 255, ${0.28 * (1 - pulse)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 16 + pulse * (18 + 18 * loud), 0, Math.PI * 2);
      ctx.stroke();
    }
    // exit arrow: once the exit is open, a small green arrow above the
    // player points the way out, so the goal is never a guessing game.
    if (game.world.allCoresGot()) {
      const a = game.world.exitDirection(player.x, player.y);
      const ax = player.x + Math.cos(a) * 26;
      const ay = player.y + Math.sin(a) * 26 - 6;
      ctx.fillStyle = COLORS.exit;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(a) * 8, ay + Math.sin(a) * 8);
      ctx.lineTo(ax + Math.cos(a + 2.5) * 7, ay + Math.sin(a + 2.5) * 7);
      ctx.lineTo(ax + Math.cos(a - 2.5) * 7, ay + Math.sin(a - 2.5) * 7);
      ctx.closePath();
      ctx.fill();
    }
    // hidden in a bush: a leaf mark above the player
    if (player.hidden) {
      ctx.fillStyle = COLORS.bushLeaf;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('❧', player.x, player.y - 20);
    }
    void time;
  }

  _drawClickTarget(input) {
    if (!input.clickTarget) return;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(232, 241, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(input.clickTarget.x, input.clickTarget.y, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(input.clickTarget.x - 12, input.clickTarget.y);
    ctx.lineTo(input.clickTarget.x + 12, input.clickTarget.y);
    ctx.moveTo(input.clickTarget.x, input.clickTarget.y - 12);
    ctx.lineTo(input.clickTarget.x, input.clickTarget.y + 12);
    ctx.stroke();
  }

  _drawLighting(player) {
    const ctx = this.ctx;
    // Darkness everywhere except a pool of light around the player.
    const grad = ctx.createRadialGradient(player.x, player.y, 60, player.x, player.y, 320);
    grad.addColorStop(0, 'rgba(4, 8, 18, 0)');
    grad.addColorStop(0.55, 'rgba(4, 8, 18, 0.28)');
    grad.addColorStop(1, COLORS.dark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  _drawHUD(game) {
    const ctx = this.ctx;
    const { world, guards, levelIndex, score, timeLeft } = game;
    // top bar
    ctx.fillStyle = 'rgba(6, 10, 20, 0.78)';
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.fillStyle = '#e8f1ff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(game.levelName(), 12, 22);
    ctx.fillStyle = COLORS.core;
    ctx.fillText(`◆ ${world.coresGot}/${world.coresTotal} intel`, 300, 22);
    if (world.allCoresGot()) {
      ctx.fillStyle = COLORS.exit;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('· EXIT OPEN', 390, 22);
      ctx.fillStyle = '#e8f1ff';
    }
    ctx.fillStyle = '#e8f1ff';
    ctx.fillText(`Score ${score}`, 470, 22);
    const mm = Math.floor(timeLeft / 60);
    const ss = Math.floor(timeLeft % 60).toString().padStart(2, '0');
    // The timer turns red once par time is gone: no more time bonus to earn.
    ctx.fillStyle = timeLeft <= 0 ? '#ff8080' : '#e8f1ff';
    ctx.fillText(`${mm}:${ss}`, 600, 22);
    ctx.fillStyle = '#e8f1ff';
    ctx.fillStyle = game.audio.muted ? '#ff8080' : '#8a94a8';
    ctx.fillText(game.audio.muted ? 'MUTED (M)' : 'M: mute', 680, 22);
    ctx.fillStyle = '#8a94a8';
    ctx.textAlign = 'right';
    ctx.fillText(`Level ${levelIndex + 1}/3`, VIEW_W - 12, 22);

    // global alarm bar: the highest guard meter in the level
    const worst = Math.max(0, ...guards.map((g) => g.meter));
    const barW = 150;
    const bx = VIEW_W - 320; // cluster anchored so the status word fits on screen
    const by = VIEW_H - 26;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 8, by - 18, 324, 24);
    ctx.fillStyle = '#c8d4e2';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', bx, by - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx + 58, by - 14, barW, 10);
    ctx.fillStyle = worst >= 100 ? '#ff4040' : worst >= 50 ? '#ffb020' : '#ffd65a';
    ctx.fillRect(bx + 58, by - 14, barW * (worst / 100), 10);
    if (worst >= 100) {
      ctx.fillStyle = '#ff4040';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('SPOTTED!', bx + 58 + barW + 10, by - 3);
    } else if (worst >= 50) {
      ctx.fillStyle = '#ffb020';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('SUSPICIOUS', bx + 58 + barW + 10, by - 3);
    }
    void game;
  }

  // Full-screen text screens: title, level clear, caught, victory, paused.
  drawScreen(kind, game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(4, 8, 18, 0.82)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    if (kind === 'title') {
      ctx.fillStyle = '#e8f1ff';
      ctx.font = 'bold 52px Georgia, serif';
      ctx.fillText('NIGHTSHADE', VIEW_W / 2, 150);
      ctx.fillStyle = '#7fd4ff';
      ctx.font = '20px Georgia, serif';
      ctx.fillText('— Silent Infiltration —', VIEW_W / 2, 186);
      ctx.fillStyle = '#c8d4e2';
      ctx.font = '16px sans-serif';
      ctx.fillText('Steal the intel cores. Reach the exit. Never be seen.', VIEW_W / 2, 240);
      ctx.font = '15px sans-serif';
      ctx.fillText('WASD / arrows — move      Shift — sneak (slow, quiet, hard to spot)', VIEW_W / 2, 290);
      ctx.fillText('Mouse click — walk there      P — pause      M — mute', VIEW_W / 2, 316);
      ctx.fillText('Yellow cones are guard vision. Crates block sight. Bushes hide you.', VIEW_W / 2, 342);
      ctx.fillText('A full alarm bar means a guard is chasing you. Break sight to cool off.', VIEW_W / 2, 368);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Press ENTER to begin', VIEW_W / 2, 440);
      ctx.fillStyle = '#8a94a8';
      ctx.font = '13px sans-serif';
      ctx.fillText('3 levels · best played with sound on · an original game by @chunfeng', VIEW_W / 2, 480);
    } else if (kind === 'levelClear') {
      ctx.fillStyle = '#39d98a';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('UNSEEN. UNHEARD.', VIEW_W / 2, 220);
      ctx.fillStyle = '#e8f1ff';
      ctx.font = '18px sans-serif';
      ctx.fillText(game.levelClearLine(), VIEW_W / 2, 270);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Press ENTER for the next level', VIEW_W / 2, 340);
    } else if (kind === 'caught') {
      ctx.fillStyle = '#ff5d5d';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('CAUGHT', VIEW_W / 2, 220);
      ctx.fillStyle = '#e8f1ff';
      ctx.font = '18px sans-serif';
      ctx.fillText('A guard laid hands on you. The archive keeps its secrets — this time.', VIEW_W / 2, 270);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Press ENTER to try the level again', VIEW_W / 2, 340);
    } else if (kind === 'victory') {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('GHOST', VIEW_W / 2, 200);
      ctx.fillStyle = '#e8f1ff';
      ctx.font = '20px Georgia, serif';
      ctx.fillText('Every core stolen. Every guard none the wiser.', VIEW_W / 2, 244);
      ctx.font = '18px sans-serif';
      ctx.fillText(`Final score: ${game.score}`, VIEW_W / 2, 300);
      ctx.fillStyle = '#7fd4ff';
      ctx.font = '16px sans-serif';
      ctx.fillText('Press ENTER to play again', VIEW_W / 2, 360);
    } else if (kind === 'paused') {
      ctx.fillStyle = '#e8f1ff';
      ctx.font = 'bold 40px Georgia, serif';
      ctx.fillText('PAUSED', VIEW_W / 2, 260);
      ctx.fillStyle = '#c8d4e2';
      ctx.font = '16px sans-serif';
      ctx.fillText('Press P to resume', VIEW_W / 2, 310);
    } else if (kind === 'briefing') {
      ctx.fillStyle = '#e8f1ff';
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText(game.levelName(), VIEW_W / 2, 220);
      ctx.fillStyle = '#c8d4e2';
      ctx.font = '16px sans-serif';
      this._wrapText(game.levelBriefing(), VIEW_W / 2, 270, 640, 24);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Press ENTER to start', VIEW_W / 2, 400);
    }
  }

  _wrapText(text, cx, y, maxWidth, lineHeight) {
    const ctx = this.ctx;
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, cx, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }
}
