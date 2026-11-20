// gamekit.js — shared web-game polish kit (v0.0.4)
// Local-vendored Howler.js audio + help/settings overlays + test hooks + fullscreen + achievements.
// Auto-boots. Bridges existing MUX haptic calls to SFX so games get sound with zero new call sites.
// Requires: vendor/howler.min.js loaded BEFORE this file. Loads after mobile-ux.js (so MUX exists).
(function () {
  'use strict';
  var VER = '0.0.4';
  var GK = { version: VER, _mute: (localStorage.getItem('gk_mute') === '1'), _helpCfg: null, sfxBase: 'vendor/sfx/' };
  window.GK = GK;

  // ---------- Audio (Howler) ----------
  var SFX_FILES = { shoot: 'shoot.wav', hit: 'hit.wav', explode: 'explode.wav', coin: 'coin.wav', jump: 'jump.wav', over: 'over.wav', start: 'start.wav' };
  var howls = {}, audioLoaded = false;
  function loadAudio() {
    if (audioLoaded || typeof Howl === 'undefined') return;
    for (var k in SFX_FILES) {
      (function (key) { howls[key] = new Howl({ src: [GK.sfxBase + SFX_FILES[key]], volume: 0.45, html5: false, preload: true }); })(k);
    }
    audioLoaded = true;
  }
  GK.sfx = function (name, vol) { if (GK._mute) return; if (!audioLoaded) loadAudio(); var h = howls[name]; if (!h) return; try { if (vol != null) h.volume(vol); h.play(); } catch (e) {} };
  GK.setMute = function (m) { GK._mute = !!m; localStorage.setItem('gk_mute', GK._mute ? '1' : '0'); syncSettingsUI(); };
  GK.isMuted = function () { return GK._mute; };
  function unlockOnce() { loadAudio(); try { if (window.Howler) Howler.unlock(); } catch (e) {} document.removeEventListener('pointerdown', unlockOnce); document.removeEventListener('keydown', unlockOnce); }

  // ---------- MUX -> SFX bridge ----------
  function bridgeMUX() {
    if (!window.MUX || MUX._gkBridge) return;
    function wrap(name, sfx) { var orig = MUX[name]; if (typeof orig !== 'function') return; MUX[name] = function () { try { orig.apply(MUX, arguments); } catch (e) {} GK.sfx(sfx); }; }
    wrap('hit', 'hit'); wrap('bump', 'coin'); wrap('over', 'over');
    MUX._gkBridge = true;
  }

  // ---------- DOM helpers ----------
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function injectButtons() {
    if (document.querySelector('[data-gk-bar]')) return;
    var bar = el('div', '');
    bar.setAttribute('data-gk-bar', '1');
    bar.style.cssText = `position:fixed;left:env(safe-area-inset-left,0);bottom:env(safe-area-inset-bottom,0);display:flex;gap:6px;z-index:9998;pointer-events:none;`;
    function btn(sym, label, fn) {
      var b = el('button', '');
      b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = sym;
      b.style.cssText = `width:34px;height:34px;min-height:34px;border:none;border-radius:8px;background:rgba(0,0,0,.42);color:#fff;font:600 16px/1 system-ui,sans-serif;cursor:pointer;pointer-events:auto;opacity:.55;transition:opacity .15s;-webkit-tap-highlight-color:transparent;`;
      b.addEventListener('mouseenter', function () { b.style.opacity = '1'; });
      b.addEventListener('mouseleave', function () { b.style.opacity = '.55'; });
      b.addEventListener('click', function () { fn(); });
      return b;
    }
    bar.appendChild(btn('?', 'Help', toggleHelp));
    bar.appendChild(btn('\u2699', 'Settings', toggleSettings));
    document.body.appendChild(bar);
  }

  function modal(card, tag) {
    var back = el('div', '');
    back.setAttribute('data-gk-modal', '1'); if (tag) back.setAttribute('data-gk-' + tag, '1');
    back.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;`;
    var close = el('button', '');
    close.type = 'button'; close.textContent = '\u2715';
    close.style.cssText = `position:absolute;top:10px;right:12px;width:38px;height:38px;min-height:38px;border:none;background:transparent;color:#fff;font:600 20px/1 system-ui,sans-serif;cursor:pointer;`;
    close.addEventListener('click', function () { back.remove(); });
    back.addEventListener('click', function (e) { if (e.target === back) back.remove(); });
    card.style.cssText = `position:relative;max-width:420px;width:100%;max-height:80vh;overflow:auto;background:#11181f;color:#e8eef2;border:1px solid #2a3a4a;border-radius:14px;padding:22px 22px 18px;font:14px/1.55 system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);`;
    card.appendChild(close);
    back.appendChild(card); document.body.appendChild(back);
    return back;
  }

  function toggleHelp() {
    if (!GK._helpCfg) return;
    var existing = document.querySelector('[data-gk-help]');
    if (existing) { existing.remove(); return; }
    var cfg = GK._helpCfg, c = el('div', '');
    c.innerHTML = '<h3 style="margin:0 0 6px;font-size:18px;color:#fff;">' + (cfg.title || 'How to play') + '</h3>';
    if (cfg.objective) c.innerHTML += '<p style="margin:0 0 12px;color:#9fb2c2;">' + cfg.objective + '</p>';
    if (cfg.controls && cfg.controls.length) {
      var list = '<div style="font-weight:600;color:#cfe;margin:6px 0;">Controls</div><ul style="margin:0 0 12px;padding:0 0 0 18px;">';
      cfg.controls.forEach(function (x) { list += '<li style="margin:4px 0;">' + x + '</li>'; });
      c.innerHTML += list + '</ul>';
    }
    if (cfg.tips) c.innerHTML += '<p style="margin:8px 0 0;color:#7f93a3;font-size:12px;">' + cfg.tips + '</p>';
    modal(c, 'help');
    localStorage.setItem('gk_help_seen', '1');
  }
  GK.help = function (cfg) { GK._helpCfg = cfg; if (localStorage.getItem('gk_help_seen') !== '1') toggleHelp(); };

  function syncSettingsUI() {
    if (GK._settingsTog) { GK._settingsTog.textContent = GK._mute ? 'OFF' : 'ON'; GK._settingsTog.style.background = GK._mute ? '#3a4654' : '#2f7d5b'; }
  }
  function toggleSettings() {
    var existing = document.querySelector('[data-gk-set]');
    if (existing) { existing.remove(); return; }
    var c = el('div', '');
    c.innerHTML = '<h3 style="margin:0 0 14px;font-size:18px;color:#fff;">Settings</h3>';
    var row = el('label', '');
    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;`;
    row.innerHTML = '<span>Sound effects</span>';
    var tog = el('button', '');
    tog.type = 'button'; tog.textContent = GK._mute ? 'OFF' : 'ON';
    tog.style.cssText = `min-width:60px;min-height:38px;padding:6px 12px;border:none;border-radius:8px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;color:#fff;`;
    tog.style.background = GK._mute ? '#3a4654' : '#2f7d5b';
    tog.addEventListener('click', function () { GK.setMute(!GK._mute); });
    row.appendChild(tog); c.appendChild(row);
    GK._settingsTog = tog;
    if (GK._difficultyOpts) {
      var drow = el('div', ''); drow.style.cssText = 'padding:8px 0;';
      drow.innerHTML = '<div style="font-weight:600;color:#cfe;margin-bottom:6px;">Difficulty</div>';
      var grp = el('div', ''); grp.style.cssText = 'display:flex;gap:8px;';
      GK._difficultyOpts.forEach(function (opt) {
        var b = el('button', ''); b.type = 'button'; b.textContent = opt.label;
        b.style.cssText = `flex:1;min-height:38px;padding:6px;border:1px solid #2a3a4a;border-radius:8px;color:#fff;cursor:pointer;font:600 12px/1 system-ui;`;
        b.style.background = opt.active ? '#2f5d8f' : '#1a2530';
        b.addEventListener('click', function () { try { opt.onSelect(); } catch (e) {} c.remove(); });
        grp.appendChild(b);
      });
      drow.appendChild(grp); c.appendChild(drow);
    }
    c.innerHTML += '<p style="margin:14px 0 0;color:#7f93a3;font-size:11px;">Press F for fullscreen &middot; H for help</p>';
    modal(c, 'set');
  }
  GK.settings = function (opts) { GK._difficultyOpts = opts && opts.difficulty; };

  // ---------- Achievements ----------
  GK.achievementsUnlocked = function () { try { return JSON.parse(localStorage.getItem('gk_ach') || '{}'); } catch (e) { return {}; } };
  GK.achievement = function (id, name, desc) {
    var got = GK.achievementsUnlocked();
    if (got[id]) return;
    got[id] = { name: name, desc: desc }; localStorage.setItem('gk_ach', JSON.stringify(got));
    var t = el('div', ''); t.textContent = '\u2605 ' + name;
    t.style.cssText = `position:fixed;left:50%;top:14%;transform:translateX(-50%);background:rgba(20,28,36,.95);color:#ffd76a;border:1px solid #4a3a1a;border-radius:10px;padding:10px 18px;font:600 14px/1.3 system-ui,sans-serif;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.5);transition:opacity .4s;opacity:0;`;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.style.opacity = '1'; });
    setTimeout(function () { t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 450); }, 2600);
    GK.sfx('start');
  };

  // ---------- Test hooks (develop-web-game skill) ----------
  GK.exposeState = function (fn) { window.render_game_to_text = function () { try { return JSON.stringify(fn()); } catch (e) { return '{}'; } }; };
  if (typeof window.advanceTime !== 'function') {
    window.advanceTime = function (ms) { if (typeof window.GAME_TICK === 'function') { var steps = Math.max(1, Math.round(ms / 16.67)); for (var i = 0; i < steps; i++) window.GAME_TICK(); } };
  }
  function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) { (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement); }
      else { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    } catch (e) {}
  }
  GK.toggleFullscreen = toggleFullscreen;

  // ---------- Boot ----------
  function boot() {
    loadAudio(); bridgeMUX(); injectButtons();
    document.addEventListener('pointerdown', unlockOnce);
    document.addEventListener('keydown', unlockOnce);
    document.addEventListener('keydown', function (e) { var k = (e.key || '').toLowerCase(); if (k === 'f') toggleFullscreen(); else if (k === 'h') toggleHelp(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
