// Nightshade — Silent Infiltration
// config.js — every tunable number of the game lives here, one place.
// Canvas is fixed: the whole level fits on screen, no camera scrolling.

export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 640

// Player movement (pixels per second)
export const PLAYER_SPEED_WALK = 175;
export const PLAYER_SPEED_SNEAK = 95;
export const PLAYER_RADIUS = 12;
export const PLAYER_TURN_SPEED = 14; // radians per second: facing turns smoothly

// Noise ring: while walking (not sneaking) a faint ring shows how loud you are.
export const NOISE_RING_MAX = 46;

// Alert propagation: a chasing guard tips off guards nearby.
export const ALERT_PROPAGATION_RADIUS = 280;
export const ALERT_PROPAGATION_RATE = 24; // meter per second for a tipped-off guard

// Guards
export const GUARD_SPEED_PATROL = 62;
export const GUARD_SPEED_SUSPICIOUS = 95;
export const GUARD_SPEED_CHASE = 132;
export const GUARD_RADIUS = 13;

// Vision: how far a guard sees, and how wide the cone is (half-angle).
export const VISION_RANGE = 195;
export const VISION_HALF_ANGLE = 0.61; // ~35 degrees
export const VISION_CLOSE_RANGE = 46; // inside this, a guard sees you even in a bush

// Detection meter 0..100. Fills while the player is seen, drains otherwise.
export const DETECT_FILL_BASE = 46; // per second at point-blank, scaled by closeness
export const DETECT_FILL_SNEAK = 0.45; // sneaking fills the meter this much slower
export const DETECT_FILL_BUSH = 0.14; // hiding in a bush fills this much slower
export const DETECT_DRAIN = 26; // per second while unseen
export const SUSPICIOUS_AT = 50; // meter at/above this: guard investigates
export const ALERT_AT = 100; // meter full: guard chases, alarm sounds
export const ALERT_MEMORY = 3.2; // seconds a guard keeps chasing after losing sight
export const SEARCH_TIME = 4.0; // seconds a guard searches the last seen spot

// Noise: walking makes sound guards can hear up close; sneaking is silent.
export const NOISE_WALK_RADIUS = 95;
export const NOISE_SNEAK_RADIUS = 0;

// Catch: a chasing guard that touches the player ends the run.
export const CATCH_DISTANCE = 20;

// Scoring
export const SCORE_CORE = 500;
export const SCORE_LEVEL_CLEAR = 1000;
export const SCORE_UNSEEN_BONUS = 750; // finishing a level never spotted
export const SCORE_TIME_BONUS_PER_SEC = 12; // under par time

// Footstep sounds: one tick each stride, shorter strides while sneaking.
export const FOOTSTEP_STRIDE_WALK = 34;
export const FOOTSTEP_STRIDE_SNEAK = 26;

// Colours — a night palette: dark floors, warm lamps, red cones.
export const COLORS = {
  floorA: '#1c2433',
  floorB: '#19202e',
  floorLine: '#232c3f',
  wall: '#3a4660',
  wallTop: '#4d5a78',
  crate: '#6b5433',
  crateTop: '#8a6f45',
  bush: '#1e4d2e',
  bushLeaf: '#2f7a44',
  exit: '#39d98a',
  core: '#ffd166',
  player: '#e8f1ff',
  playerRing: '#7fd4ff',
  guard: '#ff5d5d',
  guardSuspicious: '#ffb020',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 176, 32, 0.30)',
  coneAlert: 'rgba(255, 70, 70, 0.34)',
  dark: 'rgba(4, 8, 18, 0.55)',
};
