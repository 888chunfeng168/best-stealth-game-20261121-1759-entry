// Nightshade — Silent Infiltration
// guard.js — guard AI: patrol, suspicion, investigation, chase, search, return.
// A guard walks fixed waypoints (a patrol you can learn), watches a vision
// cone, and fills a detection meter while the player is in it. The meter
// drains when the player breaks sight, so a near miss is recoverable:
// at 50 the guard comes to look, at 100 the alarm goes up and it chases.

import { World } from './world.js';
import {
  GUARD_SPEED_PATROL, GUARD_SPEED_SUSPICIOUS, GUARD_SPEED_CHASE,
  GUARD_RADIUS, VISION_RANGE, VISION_HALF_ANGLE, VISION_CLOSE_RANGE,
  DETECT_FILL_BASE, DETECT_FILL_SNEAK, DETECT_FILL_BUSH, DETECT_DRAIN,
  SUSPICIOUS_AT, ALERT_AT, ALERT_MEMORY, SEARCH_TIME, CATCH_DISTANCE,
  NOISE_WALK_RADIUS,
} from './config.js';

export const GUARD_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  CHASE: 'chase',
  SEARCH: 'search',
};

export class Guard {
  constructor(def, world) {
    this.world = world;
    const spawn = World.tileCenter(def.tx, def.ty);
    this.x = spawn.x;
    this.y = spawn.y;
    this.path = def.path.map(([tx, ty]) => World.tileCenter(tx, ty));
    this.pause = def.pause ?? 1.0;
    this.wpIndex = 1 % this.path.length;
    this.dir = this._angleTo(this.path[this.wpIndex]) ?? 0;
    this.state = GUARD_STATE.PATROL;
    this.meter = 0; // 0..100 detection
    this.waitTimer = 0;
    this.memoryTimer = 0; // keeps chasing briefly after losing sight
    this.searchTimer = 0;
    this.lastSeen = null; // {x, y} where the player was last seen
    this.suspicionPoint = null; // where to investigate
    this.stepPhase = 0;
    this.wasSuspicious = false;
    this.wasAlert = false;
  }

  _angleTo(p) {
    if (!p) return null;
    return Math.atan2(p.y - this.y, p.x - this.x);
  }

  // Can this guard see the player right now? Cone + range + line of sight,
  // with bushes and sneaking making the player much harder to spot.
  canSee(player, sneaking) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > VISION_RANGE) return { seen: false, dist, closeness: 0 };
    const angle = Math.atan2(dy, dx);
    let diff = angle - this.dir;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const inBush = this.world.isBushPx(player.x, player.y);
    if (dist > VISION_CLOSE_RANGE && Math.abs(diff) > VISION_HALF_ANGLE) {
      return { seen: false, dist, closeness: 0 };
    }
    if (!this.world.hasLineOfSight(this.x, this.y, player.x, player.y)) {
      return { seen: false, dist, closeness: 0 };
    }
    // Closeness 1 at point blank, 0 at the edge of the cone.
    const closeness = Math.max(0, 1 - dist / VISION_RANGE);
    let factor = 1;
    if (sneaking) factor *= DETECT_FILL_SNEAK;
    if (inBush && dist > VISION_CLOSE_RANGE) factor *= DETECT_FILL_BUSH;
    return { seen: true, dist, closeness, factor };
  }

  // A loud walker nearby draws a guard's attention a little.
  hears(player, sneaking) {
    if (sneaking) return false;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist > NOISE_WALK_RADIUS) return false;
    return this.world.hasLineOfSight(this.x, this.y, player.x, player.y) ||
      dist < NOISE_WALK_RADIUS * 0.5;
  }

  update(dt, player, sneaking, events) {
    const seen = this.canSee(player, sneaking);
    const heard = !seen.seen && this.hears(player, sneaking);

    // Detection meter: fills while seen, drains while hidden.
    if (seen.seen) {
      this.meter += DETECT_FILL_BASE * (0.35 + 0.65 * seen.closeness) * seen.factor * dt;
      this.lastSeen = { x: player.x, y: player.y };
      this.memoryTimer = ALERT_MEMORY;
    } else {
      this.meter -= DETECT_DRAIN * dt;
    }
    if (heard && this.state === GUARD_STATE.PATROL) {
      this.meter += 9 * dt;
      this.suspicionPoint = { x: player.x, y: player.y };
    }
    this.meter = Math.max(0, Math.min(ALERT_AT, this.meter));

    // State transitions.
    if (this.meter >= ALERT_AT && this.state !== GUARD_STATE.CHASE) {
      this.state = GUARD_STATE.CHASE;
      this.searchTimer = 0;
      if (!this.wasAlert) events.alert(this);
      this.wasAlert = true;
      this.wasSuspicious = true;
    } else if (this.state !== GUARD_STATE.CHASE && this.meter >= SUSPICIOUS_AT && this.state === GUARD_STATE.PATROL) {
      this.state = GUARD_STATE.SUSPICIOUS;
      this.suspicionPoint = this.lastSeen
        ? { x: this.lastSeen.x, y: this.lastSeen.y }
        : { x: player.x, y: player.y };
      if (!this.wasSuspicious) events.suspicious(this);
      this.wasSuspicious = true;
    }
    if (this.state !== GUARD_STATE.CHASE) this.wasAlert = false;
    if (this.meter < SUSPICIOUS_AT * 0.6) this.wasSuspicious = false;

    // Movement by state.
    let speed = 0;
    let target = null;
    if (this.state === GUARD_STATE.PATROL) {
      speed = GUARD_SPEED_PATROL;
      target = this.path[this.wpIndex];
      if (this.waitTimer > 0) {
        this.waitTimer -= dt;
        speed = 0;
        // At a waypoint a guard looks around, sweeping its cone: a patrol
        // you can learn includes the moments it turns away.
        this.dir += Math.sin(this.waitTimer * 2.4) * dt * 1.1;
      } else if (this._arrived(target, 6)) {
        this.wpIndex = (this.wpIndex + 1) % this.path.length;
        this.waitTimer = this.pause;
        speed = 0;
      }
    } else if (this.state === GUARD_STATE.SUSPICIOUS) {
      speed = GUARD_SPEED_SUSPICIOUS;
      target = this.suspicionPoint;
      if (target && this._arrived(target, 10)) {
        // Looked, found nothing: suspicion fades, back to patrol.
        this.meter = Math.max(0, this.meter - 55 * dt);
        if (this.meter < SUSPICIOUS_AT * 0.5) {
          this.state = GUARD_STATE.PATROL;
          this.suspicionPoint = null;
        }
      }
    } else if (this.state === GUARD_STATE.CHASE) {
      speed = GUARD_SPEED_CHASE;
      if (seen.seen) {
        target = { x: player.x, y: player.y };
      } else {
        this.memoryTimer -= dt;
        target = this.lastSeen;
        if (this.memoryTimer <= 0) {
          this.state = GUARD_STATE.SEARCH;
          this.searchTimer = SEARCH_TIME;
          this.meter = SUSPICIOUS_AT + 5; // still wary while searching
        }
      }
    } else if (this.state === GUARD_STATE.SEARCH) {
      speed = GUARD_SPEED_SUSPICIOUS;
      target = this.lastSeen;
      this.searchTimer -= dt;
      if (target && this._arrived(target, 12)) {
        this.dir += dt * 1.6; // scan the area, looking around
      }
      if (this.searchTimer <= 0 || this.meter < SUSPICIOUS_AT * 0.4) {
        this.state = GUARD_STATE.PATROL;
        // Resume the patrol from the nearest waypoint, not a stale one:
        // a guard that searched far away walks back to its route.
        this.wpIndex = this._nearestWaypointIndex();
        this.waitTimer = 0;
        this.meter = Math.min(this.meter, SUSPICIOUS_AT * 0.5);
        this.lastSeen = null;
      }
    }

    if (target && speed > 0) {
      const angle = this._angleTo(target);
      this.dir = angle;
      const dx = Math.cos(angle) * speed * dt;
      const dy = Math.sin(angle) * speed * dt;
      const ox = this.x;
      const oy = this.y;
      this.world.moveCircle(this, dx, dy, GUARD_RADIUS);
      const moved = Math.hypot(this.x - ox, this.y - oy);
      this.stepPhase += moved;
      if (this.stepPhase > 30) {
        this.stepPhase -= 30;
        events.guardStep(this, Math.hypot(player.x - this.x, player.y - this.y));
      }
    }

    // Caught: a chasing guard that touches the player ends the run.
    if (this.state === GUARD_STATE.CHASE &&
      Math.hypot(player.x - this.x, player.y - this.y) < CATCH_DISTANCE) {
      events.caught(this);
    }
  }

  _arrived(target, radius) {
    return target && Math.hypot(target.x - this.x, target.y - this.y) < radius;
  }

  _nearestWaypointIndex() {
    let best = 0;
    let bestDist = Infinity;
    this.path.forEach((p, i) => {
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  // Highest meter across the level drives the global alarm display.
  get alertLevel() {
    return this.meter / ALERT_AT;
  }
}
