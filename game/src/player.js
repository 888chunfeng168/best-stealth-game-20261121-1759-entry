// Nightshade — Silent Infiltration
// player.js — the infiltrator: WASD/arrows or click-to-move, Shift to sneak.
// Sneaking is slower and quieter; walking is faster but noisier and easier
// to spot. Facing follows movement so the sprite reads at a glance.

import { PLAYER_SPEED_WALK, PLAYER_SPEED_SNEAK, PLAYER_RADIUS, PLAYER_TURN_SPEED, TILE } from './config.js';

export class Player {
  constructor(start) {
    this.x = start.x;
    this.y = start.y;
    this.dir = 0; // facing angle, radians
    this.sneaking = false;
    this.moving = false;
    this.speed = 0; // current speed, pixels per second (0 when idle)
    this.hidden = false; // standing in a bush
    this.stepDistance = 0; // distance moved since last frame, for footsteps
  }

  reset(start) {
    this.x = start.x;
    this.y = start.y;
    this.dir = 0;
    this.sneaking = false;
    this.moving = false;
    this.speed = 0;
    this.hidden = false;
    this.stepDistance = 0;
  }

  update(dt, world, input) {
    const dir = input.moveDir();
    const ox = this.x;
    const oy = this.y;
    this.sneaking = input.sneak;
    this.moving = false;

    if (dir) {
      const speed = this.sneaking ? PLAYER_SPEED_SNEAK : PLAYER_SPEED_WALK;
      world.moveCircle(this, dir.x * speed * dt, dir.y * speed * dt, PLAYER_RADIUS);
      // Facing turns smoothly toward the movement direction, never snaps.
      const targetDir = Math.atan2(dir.y, dir.x);
      let diff = targetDir - this.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = PLAYER_TURN_SPEED * dt;
      this.dir += Math.max(-turn, Math.min(turn, diff));
      this.moving = true;
    } else if (input.clickTarget) {
      // Click-to-move: steer at the target, stop on arrival or at a wall.
      const dx = input.clickTarget.x - this.x;
      const dy = input.clickTarget.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        input.clickTarget = null;
      } else {
        const speed = this.sneaking ? PLAYER_SPEED_SNEAK : PLAYER_SPEED_WALK;
        const nx = this.x + (dx / dist) * speed * dt;
        const ny = this.y + (dy / dist) * speed * dt;
        world.moveCircle(this, nx - this.x, ny - this.y, PLAYER_RADIUS);
        this.dir = Math.atan2(dy, dx);
        this.moving = true;
        if (Math.hypot(this.x - ox, this.y - oy) < 0.5) input.clickTarget = null;
      }
    }

    this.stepDistance = Math.hypot(this.x - ox, this.y - oy);
    this.speed = dt > 0 ? this.stepDistance / dt : 0;
    this.hidden = world.isBushPx(this.x, this.y);
  }

  tilePos() {
    return { tx: Math.floor(this.x / TILE), ty: Math.floor(this.y / TILE) };
  }
}
