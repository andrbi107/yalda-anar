'use strict';
// =====================================================================
//  یلدائنار (Yalda Anar) — Suika-style drop & merge game
//  Vanilla JS. Custom circle physics (no libraries, no CDN).
//  Persian RTL UI.  All drawing with canvas primitives.
// =====================================================================
(function () {

  // ===== Logical canvas size =====
  var W = 420, H = 680;

  // ===== Play field (wooden bowl interior) =====
  var BOWL = {
    left: 36,
    right: 384,
    floor: 596,
    top: 150,     // danger line y
    rimY: 128     // visual rim
  };
  var DROPPER_Y = 84;

  // ===== Physics tuning =====
  var GRAVITY = 0.55;
  var WALL_E = 0.28;        // wall restitution
  var FRUIT_E = 0.12;       // fruit-fruit restitution
  var DAMP = 0.991;         // per-frame velocity damping
  var FLOOR_FRICTION = 0.86;
  var ITER = 5;             // collision iterations per sub-step
  var POS_CORR = 0.85;      // positional correction factor
  var MAX_SPEED = 26;

  // ===== Difficulty / timing =====
  var DROP_COOLDOWN_BASE = 620;   // ms
  var DROP_COOLDOWN_MIN = 360;
  var DANGER_GRACE = 1200;        // ms before a fruit counts for danger
  var DANGER_LIMIT = 1500;        // ms above line -> game over
  var SPAWN_MAX = 4;              // dropper emits sizes 0..4

  var LS_BEST = 'yaldaAnar.best';

  // ===== Fruit chain (0..6). score for creating size i = (i+1)*10 =====
  var FRUITS = [
    { name: 'پسته',  r: 13, fill: '#a6c44a', dark: '#5d7a26', hi: '#d6e88a' },
    { name: 'بادام',  r: 18, fill: '#e3c79a', dark: '#a9854f', hi: '#f6e6c8' },
    { name: 'گردو',   r: 24, fill: '#8a5a2b', dark: '#4e3310', hi: '#b07d44' },
    { name: 'انجیر',  r: 31, fill: '#6a2d7a', dark: '#3a1648', hi: '#9a5aad' },
    { name: 'خرما',   r: 39, fill: '#5a1f12', dark: '#2c0c06', hi: '#8a3a22' },
    { name: 'نارنگی', r: 48, fill: '#f08a1e', dark: '#b35e08', hi: '#ffc36b' },
    { name: 'انار',   r: 58, fill: '#c8102e', dark: '#7a0a1c', hi: '#ff5a73' }
  ];
  var MAX_SIZE = FRUITS.length - 1;

  // deterministic seed dots for the pomegranate (so it does not flicker)
  var POME_SEEDS = [];
  (function () {
    for (var i = 0; i < 11; i++) {
      POME_SEEDS.push({ a: (i / 11) * Math.PI * 2 + 0.35, rr: 0.42 + (i % 3) * 0.13 });
    }
  })();

  // ===== DOM =====
  var canvas = document.getElementById('game');
  var nextCanvas = document.getElementById('nextCanvas');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlay = document.getElementById('overlay');
  var pauseBtn = document.getElementById('pauseBtn');
  var stageEl = document.getElementById('stage');
  var stageInner = document.getElementById('stage-inner');

  var ctx = setupCanvas(canvas, W, H, false);
  var nextCtx = setupCanvas(nextCanvas, 48, 48, true);
  ctx.direction = 'rtl';

  // ===== State =====
  var state = 'start'; // start | playing | paused | over
  var fruits = [];
  var particles = [];
  var dropper = { x: W / 2, size: 0, next: 0, cooldown: 0 };
  var score = 0;
  var best = +(localStorage.getItem(LS_BEST) || 0);
  var overTimer = 0;
  var anarReached = false;
  var banner = null;       // { text, t }
  var stars = [];
  var keys = { left: false, right: false };
  var pointer = { down: false, startX: 0, lastX: 0, startTime: 0, moved: 0 };
  var last = performance.now();

  // ===== Helpers =====
  var FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  function fa(n) { return String(Math.round(n)).replace(/\d/g, function (d) { return FA[+d]; }); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function hypot(x, y) { return Math.sqrt(x * x + y * y); }

  function randSize() {
    var weights = [5, 4, 3, 2, 1.4]; // for sizes 0..4
    var total = 0, i;
    for (i = 0; i <= SPAWN_MAX; i++) total += weights[i];
    var r = Math.random() * total;
    for (i = 0; i <= SPAWN_MAX; i++) { r -= weights[i]; if (r <= 0) return i; }
    return 0;
  }

  function setupCanvas(c, lw, lh, fixedCss) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(lw * dpr);
    c.height = Math.round(lh * dpr);
    if (fixedCss) { c.style.width = lw + 'px'; c.style.height = lh + 'px'; }
    var cx = c.getContext('2d');
    cx.scale(dpr, dpr);
    return cx;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ===== Background =====
  function initStars() {
    stars = [];
    for (var i = 0; i < 48; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * (H * 0.72),
        s: rand(1.1, 2.7),
        ph: Math.random() * Math.PI * 2,
        sp: rand(0.4, 1.5)
      });
    }
  }

  function drawStar(c, x, y, s, color) {
    c.strokeStyle = color;
    c.lineWidth = Math.max(0.8, s * 0.5);
    c.beginPath();
    c.moveTo(x, y - s); c.lineTo(x, y + s);
    c.moveTo(x - s, y); c.lineTo(x + s, y);
    c.stroke();
    c.fillStyle = color;
    c.beginPath(); c.arc(x, y, s * 0.32, 0, Math.PI * 2); c.fill();
  }

  function drawMoon(c, x, y, r) {
    c.save();
    c.fillStyle = '#f4e9c8';
    c.globalAlpha = 0.85;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.arc(x + r * 0.42, y - r * 0.22, r * 0.9, 0, Math.PI * 2, true);
    c.fill('evenodd');
    c.restore();
  }

  function drawBackground(t) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0420');
    g.addColorStop(0.5, '#1a0a36');
    g.addColorStop(1, '#2a0f4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var i, st;
    for (i = 0; i < stars.length; i++) {
      st = stars[i];
      var tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 * st.sp + st.ph));
      ctx.globalAlpha = tw;
      drawStar(ctx, st.x, st.y, st.s, '#f4d27a');
    }
    ctx.globalAlpha = 1;

    drawMoon(ctx, W - 56, 56, 17);
  }

  // ===== Bowl =====
  function drawBowl() {
    var lx = BOWL.left, rx = BOWL.right, fy = BOWL.floor, ry = BOWL.rimY;

    // inner cavity
    var g = ctx.createLinearGradient(0, ry, 0, fy);
    g.addColorStop(0, '#160728');
    g.addColorStop(1, '#241038');
    ctx.fillStyle = g;
    roundRect(ctx, lx, ry, rx - lx, fy - ry, 18);
    ctx.fill();

    // danger line (dashed gold)
    ctx.save();
    ctx.strokeStyle = '#e8b73c';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(lx + 2, BOWL.top);
    ctx.lineTo(rx - 2, BOWL.top);
    ctx.stroke();
    ctx.restore();

    // wooden walls (thick U-shaped stroke)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var wood = ctx.createLinearGradient(0, ry, 0, fy);
    wood.addColorStop(0, '#7a4a22');
    wood.addColorStop(1, '#3a200d');
    ctx.strokeStyle = wood;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(lx - 7, ry + 6);
    ctx.lineTo(lx - 7, fy - 14);
    ctx.quadraticCurveTo(lx - 7, fy + 10, lx + 20, fy + 10);
    ctx.lineTo(rx - 20, fy + 10);
    ctx.quadraticCurveTo(rx + 7, fy + 10, rx + 7, fy - 14);
    ctx.lineTo(rx + 7, ry + 6);
    ctx.stroke();

    // wood grain highlight
    ctx.strokeStyle = 'rgba(255,210,140,0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lx - 10, ry + 12); ctx.lineTo(lx - 10, fy - 22);
    ctx.moveTo(rx + 10, ry + 12); ctx.lineTo(rx + 10, fy - 22);
    ctx.stroke();

    // rim ellipse (opening lip)
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse((lx + rx) / 2, ry, (rx - lx) / 2 + 8, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,160,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse((lx + rx) / 2, ry - 2, (rx - lx) / 2 + 6, 10, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
  }

  // ===== Fruit drawing =====
  function baseCircle(c, x, y, r, f) {
    var g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.15, x, y, r);
    g.addColorStop(0, f.hi);
    g.addColorStop(0.55, f.fill);
    g.addColorStop(1, f.dark);
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.22)';
    c.lineWidth = 1.4;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    // gloss
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
    c.fill();
  }

  function drawDate(c, x, y, r, f) {
    var dw = r * 1.5, dh = r * 1.9;
    var g = c.createLinearGradient(x, y - dh / 2, x, y + dh / 2);
    g.addColorStop(0, f.hi); g.addColorStop(0.5, f.fill); g.addColorStop(1, f.dark);
    c.fillStyle = g;
    roundRect(c, x - dw / 2, y - dh / 2, dw, dh, r * 0.55); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.4;
    roundRect(c, x - dw / 2, y - dh / 2, dw, dh, r * 0.55); c.stroke();
    c.strokeStyle = 'rgba(255,180,120,0.4)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x - dw * 0.2, y - dh * 0.3); c.lineTo(x + dw * 0.2, y + dh * 0.3); c.stroke();
    c.fillStyle = f.dark;
    c.fillRect(x - 1, y - dh / 2 - 3, 2, 4);
  }

  // v0.0.3 — recognizable fruit/nut shapes (bounded by the collision circle)
  function drawPistachio(c, x, y, r, f) {
    // beige elongated shell, split at top revealing green kernel
    var g = c.createLinearGradient(x, y - r, x, y + r);
    g.addColorStop(0, '#ece0a8'); g.addColorStop(1, '#b89a5a');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(x, y, r * 0.62, r * 0.95, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(90,70,30,0.55)'; c.lineWidth = 1.2; c.stroke();
    // green kernel through the split
    c.fillStyle = f.fill;
    c.beginPath(); c.ellipse(x, y - r * 0.12, r * 0.3, r * 0.5, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(50,70,20,0.6)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath(); c.ellipse(x - r * 0.1, y - r * 0.25, r * 0.1, r * 0.18, 0, 0, Math.PI * 2); c.fill();
  }
  function drawAlmond(c, x, y, r, f) {
    // pointed teardrop oval with a central ridge
    var g = c.createLinearGradient(x - r, y, x + r, y);
    g.addColorStop(0, f.hi); g.addColorStop(0.5, f.fill); g.addColorStop(1, f.dark);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x, y - r * 0.95);
    c.bezierCurveTo(x + r * 0.78, y - r * 0.4, x + r * 0.78, y + r * 0.4, x, y + r * 0.95);
    c.bezierCurveTo(x - r * 0.78, y + r * 0.4, x - r * 0.78, y - r * 0.4, x, y - r * 0.95);
    c.fill();
    c.strokeStyle = 'rgba(80,50,20,0.5)'; c.lineWidth = 1.3; c.stroke();
    c.strokeStyle = f.dark; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(x, y - r * 0.8); c.lineTo(x, y + r * 0.8); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath(); c.ellipse(x - r * 0.22, y - r * 0.15, r * 0.12, r * 0.4, -0.2, 0, Math.PI * 2); c.fill();
  }
  function drawWalnut(c, x, y, r, f) {
    // roundish shell with a deep central seam + wrinkly lobes
    var g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, f.hi); g.addColorStop(0.6, f.fill); g.addColorStop(1, f.dark);
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = f.dark; c.lineWidth = Math.max(1.6, r * 0.1);
    c.beginPath(); c.moveTo(x, y - r * 0.88); c.lineTo(x, y + r * 0.88); c.stroke();
    c.strokeStyle = 'rgba(60,35,10,0.5)'; c.lineWidth = 1.1;
    for (var s = -1; s <= 1; s += 2) {
      for (var i = 0; i < 3; i++) {
        var yy = y - r * 0.55 + i * r * 0.4;
        c.beginPath();
        c.moveTo(x + s * r * 0.12, yy);
        c.quadraticCurveTo(x + s * r * 0.62, yy + r * 0.12, x + s * r * 0.18, yy + r * 0.28);
        c.stroke();
      }
    }
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
  }
  function drawFig(c, x, y, r, f) {
    // pear/teardrop body (wider bottom, narrow neck) + stem
    var g = c.createRadialGradient(x - r * 0.3, y + r * 0.25, r * 0.1, x, y, r);
    g.addColorStop(0, f.hi); g.addColorStop(0.6, f.fill); g.addColorStop(1, f.dark);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - r * 0.7, y + r * 0.45);
    c.bezierCurveTo(x - r * 0.92, y - r * 0.2, x - r * 0.4, y - r * 0.82, x, y - r * 0.68);
    c.bezierCurveTo(x + r * 0.4, y - r * 0.82, x + r * 0.92, y - r * 0.2, x + r * 0.7, y + r * 0.45);
    c.bezierCurveTo(x + r * 0.62, y + r * 0.9, x - r * 0.62, y + r * 0.9, x - r * 0.7, y + r * 0.45);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1.4; c.stroke();
    c.fillStyle = '#3a2010';
    c.fillRect(x - 1.5, y - r * 0.92, 3, r * 0.28);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.beginPath(); c.ellipse(x - r * 0.25, y + r * 0.05, r * 0.16, r * 0.38, -0.3, 0, Math.PI * 2); c.fill();
  }
  function drawFruit(c, size, x, y, r) {
    var f = FRUITS[size];
    switch (size) {
      case 0: drawPistachio(c, x, y, r, f); return;
      case 1: drawAlmond(c, x, y, r, f); return;
      case 2: drawWalnut(c, x, y, r, f); return;
      case 3: drawFig(c, x, y, r, f); return;
      case 4: drawDate(c, x, y, r, f); return;
      case 5: baseCircle(c, x, y, r, f); // نارنگی — segments + leaf
        c.strokeStyle = 'rgba(180,90,10,0.5)'; c.lineWidth = 1.2;
        for (var s = 0; s < 6; s++) {
          var sa = (s / 6) * Math.PI * 2;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(sa) * r * 0.85, y + Math.sin(sa) * r * 0.85); c.stroke();
        }
        c.fillStyle = '#5d8a2a';
        c.beginPath(); c.ellipse(x + r * 0.1, y - r * 0.95, r * 0.2, r * 0.1, -0.5, 0, Math.PI * 2); c.fill();
        break;
      case 6: baseCircle(c, x, y, r, f); // انار — seeds + gold crown
        c.fillStyle = 'rgba(255,190,205,0.6)';
        for (var k = 0; k < POME_SEEDS.length; k++) {
          var sd = POME_SEEDS[k];
          c.beginPath();
          c.arc(x + Math.cos(sd.a) * r * sd.rr, y + Math.sin(sd.a) * r * sd.rr + r * 0.05, r * 0.085, 0, Math.PI * 2);
          c.fill();
        }
        // calyx patch
        c.fillStyle = f.dark;
        c.beginPath(); c.ellipse(x, y - r * 0.62, r * 0.26, r * 0.11, 0, 0, Math.PI * 2); c.fill();
        // gold crown triangles
        c.fillStyle = '#e8b73c';
        var baseY = y - r * 0.7;
        for (var m = -2; m <= 2; m++) {
          var off = m * r * 0.22;
          var tw = r * 0.13, th = r * 0.3;
          c.beginPath();
          c.moveTo(x + off - tw, baseY);
          c.lineTo(x + off + tw, baseY);
          c.lineTo(x + off, baseY - th);
          c.closePath(); c.fill();
        }
        break;
    }
  }

  // ===== Particles =====
  function spawnParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = rand(1, 4.5);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - rand(0, 2.2),
        life: 1, color: color, size: rand(1.5, 3.5)
      });
    }
  }

  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += 0.2 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= 0.03 * dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ===== Physics =====
  function step(dt) {
    var i, f;
    for (i = 0; i < fruits.length; i++) {
      f = fruits[i];
      f.vy += GRAVITY * dt;
      f.vx *= Math.pow(DAMP, dt);
      f.vy *= Math.pow(DAMP, dt);
      var sp = hypot(f.vx, f.vy);
      if (sp > MAX_SPEED) { f.vx *= MAX_SPEED / sp; f.vy *= MAX_SPEED / sp; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      if (f.x - f.r < BOWL.left) { f.x = BOWL.left + f.r; if (f.vx < 0) f.vx = -f.vx * WALL_E; f.vx *= 0.9; }
      if (f.x + f.r > BOWL.right) { f.x = BOWL.right - f.r; if (f.vx > 0) f.vx = -f.vx * WALL_E; f.vx *= 0.9; }
      if (f.y + f.r > BOWL.floor) { f.y = BOWL.floor - f.r; if (f.vy > 0) f.vy = -f.vy * WALL_E; f.vy *= 0.9; f.vx *= FLOOR_FRICTION; }
      if (Math.abs(f.vx) < 0.04) f.vx = 0;
    }

    for (var it = 0; it < ITER; it++) resolveCollisions();
    handleMerges();
  }

  function resolveCollisions() {
    for (var i = 0; i < fruits.length; i++) {
      for (var j = i + 1; j < fruits.length; j++) {
        var a = fruits[i], b = fruits[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = hypot(dx, dy);
        if (dist === 0) { dx = 0.0001; dist = 0.0001; }
        var min = a.r + b.r;
        if (dist < min) {
          var nx = dx / dist, ny = dy / dist;
          var overlap = min - dist;
          var ma = a.r, mb = b.r;
          var invA = 1 / ma, invB = 1 / mb, invSum = invA + invB;
          var corr = overlap * POS_CORR;
          a.x -= corr * nx * invA / invSum;
          a.y -= corr * ny * invA / invSum;
          b.x += corr * nx * invB / invSum;
          b.y += corr * ny * invB / invSum;

          var rvx = b.vx - a.vx, rvy = b.vy - a.vy;
          var vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            var jn = -(1 + FRUIT_E) * vn / invSum;
            a.vx -= jn * nx * invA; a.vy -= jn * ny * invA;
            b.vx += jn * nx * invB; b.vy += jn * ny * invB;
            // tangent friction
            var tx = -ny, ty = nx;
            var vt = rvx * tx + rvy * ty;
            var jt = -vt / invSum * 0.25;
            a.vx -= jt * tx * invA; a.vy -= jt * ty * invA;
            b.vx += jt * tx * invB; b.vy += jt * ty * invB;
          }
        }
      }
    }
  }

  // v0.0.2 — combo multiplier: quick consecutive merges (within 2.5s) ramp the score
  var COMBO_WINDOW = 2500;
  var comboCount = 0;
  var lastMergeTime = 0;
  function mergeScore(base) {
    var now = performance.now();
    if (now - lastMergeTime < COMBO_WINDOW) comboCount++; else comboCount = 1;
    lastMergeTime = now;
    var mult = 1 + Math.min(comboCount - 1, 4) * 0.5; // ×1, ×1.5, ×2, ×2.5, ×3 (cap)
    if (window.MUX) MUX.bump();
    return Math.round(base * mult);
  }

  function handleMerges() {
    var n = fruits.length;
    var removed = new Array(n).fill(false);
    var created = [];

    for (var i = 0; i < n; i++) {
      if (removed[i]) continue;
      for (var j = i + 1; j < n; j++) {
        if (removed[j]) continue;
        var a = fruits[i], b = fruits[j];
        if (a.size !== b.size) continue;
        var dx = b.x - a.x, dy = b.y - a.y;
        var dist = hypot(dx, dy);
        if (dist < (a.r + b.r) + 1) {
          removed[i] = true; removed[j] = true;
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          var sz = a.size;
          if (sz < MAX_SIZE) {
            var nf = {
              x: mx, y: my,
              vx: (a.vx + b.vx) / 2,
              vy: Math.min(a.vy, b.vy) - 1.6,
              r: FRUITS[sz + 1].r, size: sz + 1, born: performance.now()
            };
            created.push(nf);
            addScore(mergeScore((sz + 2) * 10));
            spawnParticles(mx, my, FRUITS[sz + 1].hi, 14);
            if (sz + 1 === MAX_SIZE && !anarReached) {
              anarReached = true;
              showBanner('انار!');
              spawnParticles(mx, my, '#e8b73c', 26);
            }
          } else {
            addScore(mergeScore(200));
            spawnParticles(mx, my, '#e8b73c', 28);
            spawnParticles(mx, my, FRUITS[MAX_SIZE].fill, 18);
            showBanner('انار! +۲۰۰');
          }
          break;
        }
      }
    }

    var anyRemoved = false;
    for (var k = 0; k < n; k++) { if (removed[k]) { anyRemoved = true; break; } }
    if (anyRemoved || created.length) {
      var next = [];
      for (var m = 0; m < n; m++) if (!removed[m]) next.push(fruits[m]);
      for (var p = 0; p < created.length; p++) next.push(created[p]);
      fruits = next;
    }
  }

  // ===== Dropper =====
  function currentCooldown() {
    var reduce = Math.min(260, score / 8);
    return Math.max(DROP_COOLDOWN_MIN, DROP_COOLDOWN_BASE - reduce);
  }

  function drop() {
    if (state !== 'playing' || dropper.cooldown > 0) return;
    var sz = dropper.size;
    var r = FRUITS[sz].r;
    var x = clamp(dropper.x, BOWL.left + r + 1, BOWL.right - r - 1);
    fruits.push({ x: x, y: DROPPER_Y, vx: 0, vy: 2.2, r: r, size: sz, born: performance.now() });
    dropper.cooldown = currentCooldown();
    dropper.size = dropper.next;
    dropper.next = randSize();
    renderNext();
  }

  function updateDropper(dms, dt) {
    var speed = 4.6;
    if (keys.left) dropper.x -= speed * dt;
    if (keys.right) dropper.x += speed * dt;
    var r = FRUITS[dropper.size].r;
    dropper.x = clamp(dropper.x, BOWL.left + r + 1, BOWL.right - r - 1);
    if (dropper.cooldown > 0) dropper.cooldown -= dms;
  }

  function drawDropper(now) {
    var r = FRUITS[dropper.size].r;
    var x = clamp(dropper.x, BOWL.left + r + 1, BOWL.right - r - 1);
    ctx.save();
    ctx.strokeStyle = 'rgba(232,183,60,0.32)';
    ctx.lineWidth = 1.5; ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(x, DROPPER_Y + r); ctx.lineTo(x, BOWL.floor - 4); ctx.stroke();
    ctx.restore();
    var bob = Math.sin(now * 0.005) * 1.4;
    drawFruit(ctx, dropper.size, x, DROPPER_Y + bob, r);
    ctx.fillStyle = 'rgba(232,183,60,0.85)';
    ctx.beginPath();
    ctx.moveTo(x, DROPPER_Y - r - 2);
    ctx.lineTo(x - 5, DROPPER_Y - r - 10);
    ctx.lineTo(x + 5, DROPPER_Y - r - 10);
    ctx.closePath(); ctx.fill();
  }

  // ===== Danger / game over =====
  function updateDanger(now, dms) {
    var anyOver = false;
    for (var i = 0; i < fruits.length; i++) {
      var f = fruits[i];
      if (now - f.born < DANGER_GRACE) continue;
      if (Math.abs(f.vy) > 2.2) continue;
      if (f.y - f.r < BOWL.top) { anyOver = true; break; }
    }
    if (anyOver) overTimer += dms; else overTimer = 0;
    if (overTimer > DANGER_LIMIT) gameOver();
  }

  // ===== HUD / overlay =====
  function updateHUD() {
    scoreEl.textContent = fa(score);
    bestEl.textContent = fa(best);
  }

  function addScore(n) {
    score += n;
    if (score > best) {
      best = score;
      try { localStorage.setItem(LS_BEST, String(best)); } catch (e) {}
    }
    updateHUD();
  }

  function showBanner(text) { banner = { text: text, t: 0 }; }

  function drawBanner() {
    var a = banner.t < 200 ? banner.t / 200 : (banner.t > 1200 ? Math.max(0, (1600 - banner.t) / 400) : 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#e8b73c';
    ctx.font = 'bold 42px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(232,183,60,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillText(banner.text, W / 2, H / 2 - 40);
    ctx.restore();
  }

  function renderNext() {
    nextCtx.clearRect(0, 0, 48, 48);
    nextCtx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(nextCtx, 2, 2, 44, 44, 10); nextCtx.fill();
    drawFruit(nextCtx, dropper.next, 24, 24, 18);
  }

  function showOverlay(screen) {
    var panels = overlay.querySelectorAll('.panel');
    if (!screen) { overlay.classList.add('hidden'); return; }
    overlay.classList.remove('hidden');
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].dataset.screen === screen) panels[i].removeAttribute('hidden');
      else panels[i].setAttribute('hidden', '');
    }
    if (screen === 'over') {
      document.getElementById('overScore').textContent = fa(score);
      document.getElementById('overBest').textContent = fa(best);
    }
    if (screen === 'start') {
      document.getElementById('startBest').textContent = fa(best);
    }
  }

  // ===== State transitions =====
  function startGame() {
    state = 'playing';
    fruits = []; particles = []; score = 0; overTimer = 0;
    anarReached = false; banner = null;
    comboCount = 0; lastMergeTime = 0;
    dropper.size = randSize(); dropper.next = randSize();
    dropper.x = W / 2; dropper.cooldown = 0;
    keys.left = keys.right = false;
    updateHUD(); renderNext();
    showOverlay(null);
    last = performance.now();
  }

  function pause() { if (state !== 'playing') return; state = 'paused'; showOverlay('paused'); }
  function resume() { if (state !== 'paused') return; state = 'playing'; showOverlay(null); last = performance.now(); }

  function gameOver() {
    state = 'over';
    if (score > best) { best = score; localStorage.setItem(LS_BEST, String(best)); }
    updateHUD();
    showOverlay('over');
    if (window.MUX) MUX.over();
  }

  function goHome() {
    state = 'start';
    fruits = []; particles = []; overTimer = 0; anarReached = false; banner = null;
    dropper.size = randSize(); dropper.next = randSize();
    updateHUD(); renderNext();
    showOverlay('start');
  }

  // ===== Render =====
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    drawBackground(now);
    drawBowl();
    for (var i = 0; i < fruits.length; i++) drawFruit(ctx, fruits[i].size, fruits[i].x, fruits[i].y, fruits[i].r);
    drawParticles();
    if (state === 'playing' || state === 'paused') drawDropper(now);
    if (banner) drawBanner();
  }

  // ===== Main loop =====
  function frame(now) {
    var dms = Math.min(now - last, 60); last = now;
    var dt = dms / 16.667;
    updateParticles(dt);
    if (state === 'playing') {
      var sub = 2;
      for (var s = 0; s < sub; s++) step(dt / sub);
      updateDropper(dms, dt);
      updateDanger(now, dms);
      if (banner) { banner.t += dms; if (banner.t > 1600) banner = null; }
    }
    render(now);
    requestAnimationFrame(frame);
  }

  // ===== Input =====
  function canvasPos(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (W / rect.width),
      y: (clientY - rect.top) * (H / rect.height)
    };
  }

  function clampDropperX() {
    var r = FRUITS[dropper.size].r;
    dropper.x = clamp(dropper.x, BOWL.left + r + 1, BOWL.right - r - 1);
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (state !== 'playing') return;
    pointer.down = true;
    pointer.startX = e.clientX;
    pointer.lastX = e.clientX;
    pointer.startTime = performance.now();
    pointer.moved = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (state !== 'playing') return;
    var p = canvasPos(e.clientX, e.clientY);
    dropper.x = p.x;
    clampDropperX();
    if (pointer.down) {
      pointer.moved += Math.abs(e.clientX - pointer.lastX);
      pointer.lastX = e.clientX;
    }
  });

  function endPointer(e) {
    if (state !== 'playing') { pointer.down = false; return; }
    var dur = performance.now() - pointer.startTime;
    if (pointer.moved < 8 && dur < 350) drop();
    pointer.down = false;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', function () { pointer.down = false; });

  // prevent touch scroll/zoom on the board
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });

  window.addEventListener('keydown', function (e) {
    switch (e.code) {
      case 'ArrowLeft': keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': keys.right = true; e.preventDefault(); break;
      case 'Space': case 'Enter': case 'ArrowDown':
        if (state === 'playing') drop();
        else if (state === 'start' || state === 'over') startGame();
        else if (state === 'paused') resume();
        e.preventDefault(); break;
      case 'Escape': case 'KeyP':
        if (state === 'playing') pause();
        else if (state === 'paused') resume();
        e.preventDefault(); break;
    }
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'ArrowLeft') keys.left = false;
    else if (e.code === 'ArrowRight') keys.right = false;
  });

  pauseBtn.addEventListener('click', function () {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
  });

  overlay.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var a = btn.dataset.action;
    if (a === 'play' || a === 'retry') startGame();
    else if (a === 'resume') resume();
    else if (a === 'home') goHome();
  });

  // ===== Resize =====
  function resize() {
    var sw = stageEl.clientWidth, sh = stageEl.clientHeight;
    if (sw <= 0 || sh <= 0) return;
    var ar = W / H;
    var cw, ch;
    if (sw / sh > ar) { ch = sh; cw = ch * ar; } else { cw = sw; ch = cw / ar; }
    stageInner.style.width = cw + 'px';
    stageInner.style.height = ch + 'px';
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });

  // ===== Init =====
  function init() {
    initStars();
    dropper.size = randSize();
    dropper.next = randSize();
    updateHUD();
    renderNext();
    showOverlay('start');
    resize();
    setTimeout(resize, 50);
    last = performance.now();
    requestAnimationFrame(frame);
  }

  init();
})();
