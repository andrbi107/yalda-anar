// mobile-ux.js — shared PWA mobile UX enhancements (v0.0.4)
// Haptics + PWA install prompt + version stamp. No dependencies.
// Safe no-op when APIs are absent. Loaded after howler, before gamekit.js on every game.
(function () {
  'use strict';
  var VER = '0.0.4';
  var MUX = { version: VER };

  // --- Haptics (Vibration API) ---
  MUX.vibrate = function (pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  };
  MUX.tap   = function () { MUX.vibrate(8); };                 // light button tap
  MUX.bump  = function () { MUX.vibrate(12); };                // pickup / score
  MUX.hit   = function () { MUX.vibrate([0, 25, 18, 35]); };   // damage / collision
  MUX.over  = function () { MUX.vibrate([0, 55, 35, 70]); };   // game over

  // --- Touch detection ---
  MUX.isTouch = function () {
    return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  };

  // --- Delegated haptics: vibrate on button + canvas taps (no per-game wiring) ---
  MUX.autoHaptics = function () {
    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      if (!t) return;
      if (t.closest && t.closest('button,[role="button"],.btn')) { MUX.tap(); return; }
      if (t.tagName === 'CANVAS') { MUX.vibrate(5); }
    }, { passive: true });
  };

  // --- Version stamp (subtle, bottom-right, non-interactive) ---
  MUX.versionStamp = function () {
    var el = document.createElement('div');
    el.textContent = 'v' + VER;
    el.setAttribute('data-mux-version', '1');
    el.style.cssText =
      'position:fixed;right:env(safe-area-inset-right,0);' +
      'bottom:env(safe-area-inset-bottom,0);font:10px/1 system-ui,sans-serif;' +
      'color:#fff;background:rgba(0,0,0,.32);padding:3px 6px;border-radius:6px 0 0 0;' +
      'opacity:.5;pointer-events:none;z-index:9999;letter-spacing:.3px';
    document.body.appendChild(el);
  };

  // --- PWA install prompt (beforeinstallprompt) ---
  var deferred = null;
  MUX.setupInstall = function () {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      MUX._showInstall();
    });
    window.addEventListener('appinstalled', function () {
      deferred = null;
      var b = document.querySelector('[data-mux-install]');
      if (b) b.remove();
    });
  };
  MUX._showInstall = function () {
    if (document.querySelector('[data-mux-install]')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-mux-install', '1');
    btn.textContent = '⬇ نصب بازی';
    btn.style.cssText =
      'position:fixed;left:50%;top:calc(env(safe-area-inset-top,0) + 8px);transform:translateX(-50%);' +
      'z-index:9999;padding:9px 18px;min-height:44px;font:600 14px/1 system-ui,sans-serif;' +
      'color:#fff;background:rgba(40,120,255,.92);border:none;border-radius:999px;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:pointer;-webkit-tap-highlight-color:transparent';
    btn.addEventListener('click', function () {
      if (!deferred) return;
      MUX.tap();
      deferred.prompt();
      try { deferred.userChoice.then(function () {}); } catch (e) {}
      deferred = null;
      btn.remove();
    });
    document.body.appendChild(btn);
  };

  // --- Bootstrap ---
  function boot() {
    MUX.autoHaptics();
    MUX.versionStamp();
    MUX.setupInstall();
    // tag <html> for touch-aware CSS hooks
    if (MUX.isTouch()) document.documentElement.classList.add('mux-touch');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  window.MUX = MUX;
})();
