// Nightshade — Silent Infiltration
// input.js — keyboard (WASD / arrows + Shift to sneak) and mouse click-to-move.
// One object holds the whole input state; the game loop reads it each frame.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.sneak = false;
    this.clickTarget = null; // {x, y} in world pixels, or null
    this.anyKeyPressed = false; // set on any keydown, cleared by the game
    this.onPause = null; // game assigns: called on P / Escape
    this.onMute = null; // game assigns: called on M
    this.onConfirm = null; // game assigns: called on Enter / Space on menus
    this.onRestart = null; // game assigns: called on R (retry the level)
    this._onKeyDown = (e) => this._keydown(e);
    this._onKeyUp = (e) => this._keyup(e);
    this._onMouse = (e) => this._mousedown(e);
    this._onContext = (e) => e.preventDefault();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouse);
    canvas.addEventListener('contextmenu', this._onContext);
    this.canvas = canvas;
  }

  _keydown(e) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    this.anyKeyPressed = true;
    if (k === 'p' || k === 'escape') {
      if (this.onPause) this.onPause();
      return;
    }
    if (k === 'm') {
      if (this.onMute) this.onMute();
      return;
    }
    if (k === 'r') {
      if (this.onRestart) this.onRestart();
      return;
    }
    if (k === 'enter' || k === ' ') {
      if (this.onConfirm) this.onConfirm();
    }
    this.keys.add(k);
    this.sneak = this.keys.has('shift');
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      this.clickTarget = null; // keys override click-to-move
    }
  }

  _keyup(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    this.sneak = this.keys.has('shift');
  }

  _mousedown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.clickTarget = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
    this.anyKeyPressed = true;
  }

  // Normalised movement direction from the held keys, or null.
  moveDir() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  clear() {
    this.keys.clear();
    this.sneak = false;
    this.clickTarget = null;
  }
}
