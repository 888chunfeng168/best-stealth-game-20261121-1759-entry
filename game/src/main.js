// Nightshade — Silent Infiltration
// main.js — the game itself: state machine, loop, scoring, win/lose.
// States: title → briefing → play ⇄ paused → levelClear → briefing…
// → victory, and play → caught → retry. One level at a time, three in all.
// `?shot=1..4` stages a fixed scene for screenshots (a real render of the
// game code, frozen in place): 1 cover, 2 suspicious, 3 alarm, 4 title.

import { TILE, SCORE_CORE, SCORE_LEVEL_CLEAR, SCORE_UNSEEN_BONUS, SCORE_TIME_BONUS_PER_SEC, ALERT_PROPAGATION_RADIUS, ALERT_PROPAGATION_RATE } from './config.js';
import { LEVELS } from './levels.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Guard, GUARD_STATE } from './guard.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Renderer } from './render.js';

const STATES = {
  TITLE: 'title',
  BRIEFING: 'briefing',
  PLAY: 'play',
  PAUSED: 'paused',
  LEVEL_CLEAR: 'levelClear',
  CAUGHT: 'caught',
  VICTORY: 'victory',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.state = STATES.TITLE;
    this.levelIndex = 0;
    this.score = 0;
    this.time = 0; // global animation clock, seconds
    this.elapsed = 0; // seconds in the current level
    this.timeLeft = 0;
    this.spottedThisLevel = false;
    this.frozen = false; // screenshot staging: render but never update
    this.world = null;
    this.player = null;
    this.guards = [];
    this.clearLine = '';
    this._lastTs = 0;
    this._shot = new URLSearchParams(window.location.search).get('shot');

    this.input.onPause = () => this._togglePause();
    this.input.onMute = () => this.audio.toggleMute();
    this.input.onConfirm = () => this._confirm();
    this.input.onRestart = () => {
      if (this.state === STATES.PLAY || this.state === STATES.CAUGHT || this.state === STATES.PAUSED) {
        this.loadLevel(this.levelIndex);
        this.state = STATES.PLAY;
      } else if (this.state === STATES.VICTORY) {
        this.score = 0;
        this.loadLevel(0);
        this.state = STATES.BRIEFING;
      }
    };
    this.loadLevel(0);

    if (this._shot) this._stageShot(this._shot);
  }

  levelName() {
    return LEVELS[this.levelIndex].name;
  }

  levelBriefing() {
    return LEVELS[this.levelIndex].briefing;
  }

  levelClearLine() {
    return this.clearLine;
  }

  loadLevel(index) {
    this.levelIndex = index;
    const level = LEVELS[index];
    this.world = new World(level);
    this.player = new Player(this.world.playerStart);
    this.guards = level.guards.map((def) => new Guard(def, this.world));
    this.elapsed = 0;
    this.timeLeft = level.par;
    this.spottedThisLevel = false;
    this.input.clear();
  }

  start() {
    this.state = STATES.BRIEFING;
  }

  _confirm() {
    this.audio.ensure();
    if (this.state === STATES.TITLE) {
      this.state = STATES.BRIEFING;
    } else if (this.state === STATES.BRIEFING) {
      this.state = STATES.PLAY;
    } else if (this.state === STATES.LEVEL_CLEAR) {
      if (this.levelIndex + 1 < LEVELS.length) {
        this.loadLevel(this.levelIndex + 1);
        this.state = STATES.BRIEFING;
      } else {
        this.state = STATES.VICTORY;
      }
    } else if (this.state === STATES.CAUGHT) {
      this.loadLevel(this.levelIndex);
      this.state = STATES.PLAY;
    } else if (this.state === STATES.VICTORY) {
      this.score = 0;
      this.loadLevel(0);
      this.state = STATES.BRIEFING;
    }
  }

  _togglePause() {
    if (this.state === STATES.PLAY) this.state = STATES.PAUSED;
    else if (this.state === STATES.PAUSED) this.state = STATES.PLAY;
  }

  _events() {
    return {
      alert: () => {
        this.spottedThisLevel = true;
        this.audio.alert();
      },
      suspicious: () => this.audio.suspicious(),
      guardStep: (guard, dist) => this.audio.guardStep(dist),
      caught: () => this._onCaught(),
    };
  }

  _onCaught() {
    if (this.state !== STATES.PLAY) return;
    this.state = STATES.CAUGHT;
    this.audio.caught();
  }

  _onLevelClear() {
    const level = LEVELS[this.levelIndex];
    const timeBonus = Math.max(0, Math.round((level.par - this.elapsed) * SCORE_TIME_BONUS_PER_SEC));
    const unseen = this.spottedThisLevel ? 0 : SCORE_UNSEEN_BONUS;
    const gained = SCORE_LEVEL_CLEAR + timeBonus + unseen;
    this.score += gained;
    const parts = [`+${SCORE_LEVEL_CLEAR} clear`];
    if (timeBonus > 0) parts.push(`+${timeBonus} speed`);
    if (unseen > 0) parts.push(`+${unseen} ghost (never spotted)`);
    this.clearLine = `${parts.join('  ·  ')}   —   total ${this.score}`;
    this.audio.levelClear();
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.audio.win();
      this.state = STATES.VICTORY;
    } else {
      this.state = STATES.LEVEL_CLEAR;
    }
  }

  update(dt) {
    if (this.frozen || this.state !== STATES.PLAY) return;
    this.time += dt;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, LEVELS[this.levelIndex].par - this.elapsed);

    this.player.update(dt, this.world, this.input);
    this.audio.footstep(this.player.stepDistance, this.player.sneaking);

    const events = this._events();
    for (const guard of this.guards) {
      guard.update(dt, this.player, this.player.sneaking, events);
      if (this.state !== STATES.PLAY) return; // caught mid-update
    }

    // Alert propagation: a chasing guard tips off guards nearby, so one
    // alarm can snowball if you linger. Breaking sight cools everyone off.
    const chasing = this.guards.some((g) => g.state === GUARD_STATE.CHASE);
    if (chasing) {
      for (const guard of this.guards) {
        if (guard.state === GUARD_STATE.CHASE) continue;
        if (Math.hypot(guard.x - this.player.x, guard.y - this.player.y) > ALERT_PROPAGATION_RADIUS) continue;
        guard.meter = Math.min(100, guard.meter + ALERT_PROPAGATION_RATE * dt);
        guard.lastSeen = { x: this.player.x, y: this.player.y };
      }
    }

    // Pick up a nearby intel core.
    const core = this.world.coreNear(this.player.x, this.player.y, TILE * 0.7);
    if (core) {
      this.world.takeCore(core);
      this.score += SCORE_CORE;
      this.audio.pickup();
      if (this.world.allCoresGot()) this.audio.exitOpen();
    }

    // Exit opens once every core is collected; stepping in clears the level.
    if (this.world.allCoresGot() && this.world.atExit(this.player.x, this.player.y)) {
      this._onLevelClear();
    }
  }

  draw() {
    if (this.state === STATES.TITLE && !this._shot) {
      // Title over a dimmed live level, so the first paint already shows the game.
      this.renderer.draw(this);
      this.renderer.drawScreen('title', this);
      return;
    }
    if (this.state === STATES.BRIEFING && !this._shot) {
      this.renderer.draw(this);
      this.renderer.drawScreen('briefing', this);
      return;
    }
    this.renderer.draw(this);
    if (this.state === STATES.LEVEL_CLEAR) this.renderer.drawScreen('levelClear', this);
    else if (this.state === STATES.CAUGHT) this.renderer.drawScreen('caught', this);
    else if (this.state === STATES.VICTORY) this.renderer.drawScreen('victory', this);
    else if (this.state === STATES.PAUSED) this.renderer.drawScreen('paused', this);
    else if (this._shot === '4') this.renderer.drawScreen('title', this);
  }

  frame(ts) {
    const dt = Math.min(0.05, (ts - this._lastTs) / 1000 || 0);
    this._lastTs = ts;
    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  run() {
    requestAnimationFrame((t) => this.frame(t));
  }

  // Screenshot staging: fixed scenes, rendered by the real game code.
  _stageShot(shot) {
    this.frozen = true;
    if (shot === '4') {
      this.state = STATES.TITLE;
      return;
    }
    this.state = STATES.PLAY;
    if (shot === '1') {
      // Cover: level 1, player sneaking in a guard's cone as it sweeps the hall.
      this.loadLevel(0);
      this.player.x = 9.5 * TILE;
      this.player.y = 3.5 * TILE;
      this.player.dir = Math.PI / 2;
      this.player.sneaking = true;
      this.world.takeCore(this.world.cores[0]);
      this.score = SCORE_CORE;
      this.guards[0].x = 9.5 * TILE;
      this.guards[0].y = 7.5 * TILE;
      this.guards[0].dir = -Math.PI / 2;
    } else if (shot === '2') {
      // Suspicion: level 2, player hiding in a bush while a guard comes to look.
      this.loadLevel(1);
      this.player.x = 7.5 * TILE;
      this.player.y = 10.5 * TILE;
      this.player.dir = -Math.PI / 2;
      this.player.sneaking = true;
      this.score = SCORE_CORE * 2;
      const g = this.guards[1];
      g.x = 7.5 * TILE;
      g.y = 8.5 * TILE;
      g.dir = Math.PI / 2;
      g.meter = 68;
      g.state = GUARD_STATE.SUSPICIOUS;
      g.suspicionPoint = { x: this.player.x, y: this.player.y };
    } else if (shot === '3') {
      // Alarm: level 3, a guard chasing with a red cone, alarm bar full.
      this.loadLevel(2);
      this.player.x = 13.5 * TILE;
      this.player.y = 9.5 * TILE;
      this.player.dir = Math.PI;
      this.score = SCORE_CORE * 2;
      const g = this.guards[1];
      g.x = 17.5 * TILE;
      g.y = 9.5 * TILE;
      g.dir = Math.PI;
      g.meter = 100;
      g.state = GUARD_STATE.CHASE;
      g.lastSeen = { x: this.player.x, y: this.player.y };
      g.memoryTimer = 3.2;
    }
    this.time = 1.7; // a fixed moment, so the pulse and glow are stable
  }
}

// Boot: the canvas is in index.html; the game starts on first paint.
const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__nightshade = game; // handy for the screenshot script and debugging
game.run();
