// gamekit.js — shared web-game polish kit (v0.0.5)
// v0.0.4: Howler audio + help/settings overlays + test hooks + fullscreen + achievements.
// v0.0.5: loading splash + main-menu chrome + Stats (history) + Leaderboard (medals/share) +
//         auto recordRun (over-screen observer + MUX.over bridge) + PWA auto-update banner.
// Requires: vendor/howler.min.js loaded BEFORE this file. Loads after mobile-ux.js (so MUX exists).
(function () {
  'use strict';
  var VER = '0.0.5';
  var GK = {
    version: VER,
    _mute: (localStorage.getItem('gk_mute') === '1'),
    _helpCfg: null, sfxBase: 'vendor/sfx/',
    _cfg: { title: '', tagline: '', theme: '#0b0f14' },
    _scoreGet: null, _manualRecord: false, _runRecorded: false, _splashShown: false, _splashTimer: 0
  };
  window.GK = GK;
  GK.slug = (location.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop() || 'game').replace(/[^a-z0-9-]/gi, '-');

  // ---------- Audio (Howler) ----------
  var SFX_FILES = { shoot: 'shoot.wav', hit: 'hit.wav', explode: 'explode.wav', coin: 'coin.wav', jump: 'jump.wav', over: 'over.wav', start: 'start.wav' };
  var howls = {}, audioLoaded = false;
  function loadAudio() {
    if (audioLoaded || typeof Howl === 'undefined') return;
    for (var k in SFX_FILES) { (function (key) { howls[key] = new Howl({ src: [GK.sfxBase + SFX_FILES[key]], volume: 0.45, html5: false, preload: true }); })(k); }
    audioLoaded = true;
  }
  GK.sfx = function (name, vol) { if (GK._mute) return; if (!audioLoaded) loadAudio(); var h = howls[name]; if (!h) return; try { if (vol != null) h.volume(vol); h.play(); } catch (e) {} };
  GK.setMute = function (m) { GK._mute = !!m; localStorage.setItem('gk_mute', GK._mute ? '1' : '0'); syncSettingsUI(); };
  GK.isMuted = function () { return GK._mute; };
  function unlockOnce() { loadAudio(); try { if (window.Howler) Howler.unlock(); } catch (e) {} document.removeEventListener('pointerdown', unlockOnce); document.removeEventListener('keydown', unlockOnce); }

  // ---------- MUX -> SFX + recordRun bridge ----------
  function bridgeMUX() {
    if (!window.MUX || MUX._gkBridge) return;
    function wrap(name, sfx) { var orig = MUX[name]; if (typeof orig !== 'function') return; MUX[name] = function () { try { orig.apply(MUX, arguments); } catch (e) {} GK.sfx(sfx); if (name === 'over') GK.recordRun({ result: 'game over' }); }; }
    wrap('hit', 'hit'); wrap('bump', 'coin'); wrap('over', 'over');
    MUX._gkBridge = true;
  }

  // ---------- DOM helpers ----------
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function visible(e) { if (!e) return false; var s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false; return e.offsetParent !== null || e.offsetWidth > 0; }

  // ---------- Loading splash ----------
  function showSplash() {
    if (GK._splashShown) return; GK._splashShown = true;
    var sp = el('div', ''); sp.setAttribute('data-gk-splash', '1');
    sp.style.cssText = `position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${GK._cfg.theme};color:#fff;transition:opacity .35s;font:14px/1.4 system-ui,sans-serif;`;
    sp.innerHTML = '<div data-gk-spin style="width:34px;height:34px;border:3px solid rgba(255,255,255,.18);border-top-color:#fff;border-radius:50%;animation:gkspin .8s linear infinite;margin-bottom:18px"></div>'
      + '<div data-gk-title style="font-size:20px;font-weight:700;letter-spacing:1px;margin-bottom:4px"></div>'
      + '<div data-gk-tag style="opacity:.6;font-size:12px;letter-spacing:.5px"></div>';
    var st = el('style', ''); st.textContent = '@keyframes gkspin{to{transform:rotate(360deg)}}';
    document.head.appendChild(st);
    document.body.appendChild(sp);
    brandSplash();
    GK._splashTimer = Date.now();
    // safety: never block longer than 3s
    setTimeout(function () { if (document.querySelector('[data-gk-splash]')) GK.ready(); }, 3000);
  }
  function brandSplash() {
    var sp = document.querySelector('[data-gk-splash]'); if (!sp) return;
    var t = sp.querySelector('[data-gk-title]'); if (t) t.textContent = GK._cfg.title || 'Loading…';
    var g = sp.querySelector('[data-gk-tag]'); if (g) g.textContent = GK._cfg.tagline || '';
    sp.style.background = GK._cfg.theme || '#0b0f14';
  }
  GK.boot = function (cfg) { if (cfg) GK._cfg = Object.assign(GK._cfg, cfg); showSplash(); brandSplash(); injectMenu(); };
  GK.ready = function () {
    var sp = document.querySelector('[data-gk-splash]'); if (!sp) return;
    var dt = Date.now() - GK._splashTimer; var min = 350;
    setTimeout(function () {
      sp.style.opacity = '0';
      setTimeout(function () { sp.remove(); }, 360);
    }, Math.max(0, min - dt));
  };

  // ---------- Overlays (modal/shell) ----------
  function modal(card, tag) {
    var back = el('div', '');
    back.setAttribute('data-gk-modal', '1'); if (tag) back.setAttribute('data-gk-' + tag, '1');
    back.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;`;
    var close = el('button', ''); close.type = 'button'; close.textContent = '\u2715';
    close.style.cssText = `position:absolute;top:10px;right:12px;width:38px;height:38px;min-height:38px;border:none;background:transparent;color:#fff;font:600 20px/1 system-ui,sans-serif;cursor:pointer;`;
    close.addEventListener('click', function () { back.remove(); });
    back.addEventListener('click', function (e) { if (e.target === back) back.remove(); });
    card.style.cssText = `position:relative;max-width:460px;width:100%;max-height:82vh;overflow:auto;background:#11181f;color:#e8eef2;border:1px solid #2a3a4a;border-radius:14px;padding:22px 22px 18px;font:14px/1.55 system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.5);`;
    card.appendChild(close);
    back.appendChild(card); document.body.appendChild(back);
    return back;
  }

  // ---------- Floating buttons + menu ----------
  function injectButtons() {
    if (document.querySelector('[data-gk-bar]')) return;
    var bar = el('div', ''); bar.setAttribute('data-gk-bar', '1');
    bar.style.cssText = `position:fixed;left:env(safe-area-inset-left,0);bottom:env(safe-area-inset-bottom,0);display:flex;gap:6px;z-index:9998;pointer-events:none;`;
    function btn(sym, label, fn) {
      var b = el('button', ''); b.type = 'button'; b.setAttribute('aria-label', label); b.textContent = sym;
      b.style.cssText = `width:34px;height:34px;min-height:34px;border:none;border-radius:8px;background:rgba(0,0,0,.42);color:#fff;font:600 16px/1 system-ui,sans-serif;cursor:pointer;pointer-events:auto;opacity:.55;transition:opacity .15s;-webkit-tap-highlight-color:transparent;`;
      b.addEventListener('mouseenter', function () { b.style.opacity = '1'; });
      b.addEventListener('mouseleave', function () { b.style.opacity = '.55'; });
      b.addEventListener('click', function () { fn(); });
      return b;
    }
    bar.appendChild(btn('?', 'Help', toggleHelp));
    bar.appendChild(btn('\u2699', 'Settings', toggleSettings));
    bar.appendChild(btn('\u2630', 'Menu', function () { var m = document.querySelector('[data-gk-menu]'); if (m) m.style.display = (m.style.display === 'none' ? '' : 'none'); }));
    document.body.appendChild(bar);
  }
  function findStartScreen() {
    var sels = ['#startScreen', '#screen-start', '#start-screen', '#startscreen', '.screen.start', '.screen.active', '.screen.show', '.screen-card'];
    for (var i = 0; i < sels.length; i++) { var e = $(sels[i]); if (e) return e; }
    // fallback: element containing the play button
    var pb = playBtn(); return pb ? pb.closest('.screen,[class*="screen"],section,div') : null;
  }
  function playBtn() {
    var sels = ['#playBtn', '#startBtn', '#play-btn', '#start-btn', '#btnPlay', '#btn-play', '.primary-btn', '.play-btn'];
    for (var i = 0; i < sels.length; i++) { var e = $(sels[i]); if (e) return e; }
    return null;
  }
  function injectMenu() {
    if (document.querySelector('[data-gk-menu]')) return;
    var host = findStartScreen();
    var row = el('div', ''); row.setAttribute('data-gk-menu', '1');
    row.style.cssText = `display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:14px;`;
    function mbtn(label, fn) {
      var b = el('button', ''); b.type = 'button'; b.textContent = label;
      b.style.cssText = `min-height:40px;padding:8px 14px;border:1px solid #2a3a4a;border-radius:10px;background:rgba(255,255,255,.06);color:#e8eef2;font:600 13px/1 system-ui,sans-serif;cursor:pointer;-webkit-tap-highlight-color:transparent;`;
      b.addEventListener('click', function () { GK.sfx('coin', 0.25); fn(); });
      return b;
    }
    row.appendChild(mbtn('راهنما', toggleHelp));
    row.appendChild(mbtn('آمار و تاریخچه', toggleStats));
    row.appendChild(mbtn('امتیازات و رقابت', toggleLeaderboard));
    row.appendChild(mbtn('تنظیمات', toggleSettings));
    if (host) host.appendChild(row);
    else { row.style.cssText += 'position:fixed;left:50%;bottom:60px;transform:translateX(-50%);z-index:9997;'; document.body.appendChild(row); }
  }

  // ---------- Help ----------
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
  GK.help = function (cfg) { GK._helpCfg = cfg; /* do not auto-popup in v0.0.5 (menu has the button) */ };

  // ---------- Settings ----------
  function syncSettingsUI() { if (GK._settingsTog) { GK._settingsTog.textContent = GK._mute ? 'OFF' : 'ON'; GK._settingsTog.style.background = GK._mute ? '#3a4654' : '#2f7d5b'; } }
  function toggleSettings() {
    var existing = document.querySelector('[data-gk-set]');
    if (existing) { existing.remove(); return; }
    var c = el('div', '');
    c.innerHTML = '<h3 style="margin:0 0 14px;font-size:18px;color:#fff;">تنظیمات</h3>';
    var row = el('label', '');
    row.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:8px 0;cursor:pointer;`;
    row.innerHTML = '<span>جلوه‌های صوتی</span>';
    var tog = el('button', ''); tog.type = 'button'; tog.textContent = GK._mute ? 'OFF' : 'ON';
    tog.style.cssText = `min-width:60px;min-height:38px;padding:6px 12px;border:none;border-radius:8px;font:600 13px/1 system-ui,sans-serif;cursor:pointer;color:#fff;`;
    tog.style.background = GK._mute ? '#3a4654' : '#2f7d5b';
    tog.addEventListener('click', function () { GK.setMute(!GK._mute); });
    row.appendChild(tog); c.appendChild(row);
    GK._settingsTog = tog;
    c.innerHTML += '<p style="margin:14px 0 0;color:#7f93a3;font-size:11px;">کلید F: تمام‌صفحه &middot; H: راهنما &middot; نسخه‌ی ' + VER + '</p>';
    modal(c, 'set');
  }
  GK.settings = function (opts) { GK._difficultyOpts = opts && opts.difficulty; };

  // ---------- Stats / history ----------
  GK.histKey = function () { return 'gk_hist_' + GK.slug; };
  GK.lbKey = function () { return 'gk_lb_' + GK.slug; };
  GK.history = function () { try { return JSON.parse(localStorage.getItem(GK.histKey()) || '[]'); } catch (e) { return []; } };
  GK.leaderboard = function () { try { return JSON.parse(localStorage.getItem(GK.lbKey()) || '[]'); } catch (e) { return []; } };
  GK.readScore = function () {
    if (typeof GK._scoreGet === 'function') { try { var v = GK._scoreGet(); if (v != null && !isNaN(+v)) return Math.round(+v); } catch (e) {} }
    var sels = ['#scoreVal', '#score', '#finalScore', '#overScore', '#finishTotal', '#score-val', '.hud-value', '#points'];
    for (var i = 0; i < sels.length; i++) { var e = $(sels[i]); if (e) { var n = parseInt((e.textContent || '').replace(/[^0-9-]/g, ''), 10); if (!isNaN(n)) return n; } }
    try { return Math.round((window.S && window.S.score) || window.score || 0); } catch (e) { return 0; }
  };
  GK.recordRun = function (opts) {
    opts = opts || {};
    if (GK._runRecorded) return;
    GK._runRecorded = true;
    var score = (opts.score != null ? opts.score : GK.readScore());
    var prevBest = (GK.leaderboard()[0] || {}).score || 0;
    var entry = { score: score, at: Date.now(), result: opts.result || 'over' };
    var hist = GK.history(); hist.unshift(entry); if (hist.length > 50) hist.length = 50;
    localStorage.setItem(GK.histKey(), JSON.stringify(hist));
    var lb = GK.leaderboard(); lb.push(entry); lb.sort(function (a, b) { return b.score - a.score; }); if (lb.length > 10) lb.length = 10;
    localStorage.setItem(GK.lbKey(), JSON.stringify(lb));
    if (score > prevBest && score > 0) { GK.sfx('start'); toast('رکورد جدید! ' + score); }
  };
  function toast(msg) {
    var t = el('div', ''); t.textContent = msg;
    t.style.cssText = `position:fixed;left:50%;top:16%;transform:translateX(-50%);background:rgba(20,28,36,.95);color:#ffd76a;border:1px solid #4a3a1a;border-radius:10px;padding:10px 18px;font:600 14px/1.3 system-ui,sans-serif;z-index:99999;box-shadow:0 8px 24px rgba(0,0,0,.5);`;
    document.body.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 420); }, 2200);
  }
  function fmtDate(ts) { var d = new Date(ts); return d.toLocaleDateString('fa-IR') + ' ' + d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); }
  function medal(i) { return ['🥇', '🥈', '🥉'][i] || (i < 10 ? '#' + (i + 1) : ''); }
  function tier(score) { if (score >= 10000) return 'DIAMOND'; if (score >= 5000) return 'PLATINUM'; if (score >= 2000) return 'GOLD'; if (score >= 500) return 'SILVER'; if (score > 0) return 'BRONZE'; return '—'; }

  function toggleStats() {
    var existing = document.querySelector('[data-gk-stats]');
    if (existing) { existing.remove(); return; }
    var hist = GK.history(), lb = GK.leaderboard(), ach = GK.achievementsUnlocked();
    var tot = hist.reduce(function (s, r) { return s + (r.score || 0); }, 0);
    var best = (lb[0] || {}).score || 0;
    var c = el('div', '');
    var achList = Object.keys(ach).length ? Object.keys(ach).map(function (k) { return '<span style="display:inline-block;margin:2px 4px;padding:3px 8px;background:rgba(255,215,106,.12);border:1px solid #4a3a1a;border-radius:6px;font-size:11px">★ ' + ach[k].name + '</span>'; }).join('') : '<span style="color:#7f93a3;font-size:12px">هنوز دستاوردی باز نشده است.</span>';
    var rows = hist.slice(0, 12).map(function (r) { return '<tr><td style="padding:4px 8px;color:#9fb2c2">' + fmtDate(r.at) + '</td><td style="padding:4px 8px;text-align:right;font-weight:600">' + (r.score || 0) + '</td><td style="padding:4px 8px;color:#7f93a3;font-size:11px">' + tier(r.score) + '</td></tr>'; }).join('') || '<tr><td colspan="3" style="color:#7f93a3;padding:12px">هنوز بازی‌ای ثبت نشده است.</td></tr>';
    c.innerHTML = '<h3 style="margin:0 0 6px;font-size:18px;color:#fff;">آمار و تاریخچه</h3>'
      + '<p style="margin:0 0 12px;color:#9fb2c2;font-size:12px">' + (GK._cfg.title || '') + ' — دستگاه شما</p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'
      + statBox('بازی‌ها', hist.length) + statBox('بهترین', best) + statBox('مجموع', tot) + statBox('میانگین', hist.length ? Math.round(tot / hist.length) : 0)
      + '</div>'
      + '<div style="font-weight:600;color:#cfe;margin:6px 0 4px">دستاوردها</div><div style="margin-bottom:14px">' + achList + '</div>'
      + '<div style="font-weight:600;color:#cfe;margin:6px 0 4px">آخرین بازی‌ها</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:right;padding:4px 8px;color:#7f93a3">زمان</th><th style="text-align:right;padding:4px 8px;color:#7f93a3">امتیاز</th><th style="text-align:right;padding:4px 8px;color:#7f93a3">تیر</th></tr></thead><tbody>' + rows + '</tbody></table>';
    modal(c, 'stats');
  }
  function statBox(label, val) { return '<div style="flex:1;min-width:80px;background:rgba(255,255,255,.05);border:1px solid #2a3a4a;border-radius:8px;padding:8px;text-align:center"><div style="font-size:18px;font-weight:700;color:#fff">' + val + '</div><div style="font-size:10px;color:#7f93a3;margin-top:2px">' + label + '</div></div>'; }

  function toggleLeaderboard() {
    var existing = document.querySelector('[data-gk-lb]');
    if (existing) { existing.remove(); return; }
    var lb = GK.leaderboard();
    var c = el('div', '');
    var rows = lb.length ? lb.map(function (r, i) {
      return '<tr><td style="padding:6px 8px">' + medal(i) + '</td><td style="padding:6px 8px;font-weight:600">' + (r.score || 0) + '</td><td style="padding:6px 8px;color:#ffd76a;font-size:11px">' + tier(r.score) + '</td><td style="padding:6px 8px;color:#7f93a3;font-size:11px">' + fmtDate(r.at) + '</td></tr>';
    }).join('') : '<tr><td colspan="4" style="color:#7f93a3;padding:16px;text-align:center">هنوز رکوردی ثبت نشده. بازی کن و نخستین مدال را بگیر!</td></tr>';
    var code = lb.length ? btoa(GK.slug + ':' + (lb[0].score || 0) + ':' + (lb[0].at || 0)).replace(/=+$/, '') : '';
    c.innerHTML = '<h3 style="margin:0 0 6px;font-size:18px;color:#fff">امتیازات و رقابت</h3>'
      + '<p style="margin:0 0 12px;color:#9fb2c2;font-size:12px">جدول برترین بازی‌های شما روی این دستگاه — مدال‌ها: 🥇🥈🥉 و تیرهای Bronze→Diamond.</p>'
      + '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th style="text-align:right;padding:4px 8px;color:#7f93a3">#</th><th style="text-align:right;padding:4px 8px;color:#7f93a3">امتیاز</th><th style="text-align:right;padding:4px 8px;color:#7f93a3">تیر</th><th style="text-align:right;padding:4px 8px;color:#7f93a3">زمان</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + (code ? '<div style="margin-top:14px;padding:10px;background:rgba(255,255,255,.05);border:1px dashed #2a3a4a;border-radius:8px;font-size:11px;color:#9fb2c2"><div style="color:#cfe;margin-bottom:4px">کد رکورد برتر (برای اشتراک):</div><code style="word-break:break-all">' + code + '</code> <button type="button" id="gkShare" style="margin-left:6px;padding:4px 8px;border:none;border-radius:6px;background:#2f5d8f;color:#fff;font-size:11px;cursor:pointer">کپی</button></div>' : '')
      + '<p style="margin:12px 0 0;color:#7f93a3;font-size:11px">نکته: این جدول محلی است (بدون سرور). برای رقابت بین‌دستگاهی، کد رکورد خود را با دوستان به اشتراک بگذار.</p>';
    modal(c, 'lb');
    var sb = c.querySelector('#gkShare');
    if (sb) sb.addEventListener('click', function () { try { navigator.clipboard.writeText(code); sb.textContent = 'کپی شد!'; } catch (e) {} });
  }

  // ---------- Achievements ----------
  GK.achievementsUnlocked = function () { try { return JSON.parse(localStorage.getItem('gk_ach') || '{}'); } catch (e) { return {}; } };
  GK.achievement = function (id, name, desc) {
    var got = GK.achievementsUnlocked(); if (got[id]) return;
    got[id] = { name: name, desc: desc }; localStorage.setItem('gk_ach', JSON.stringify(got));
    toast('★ ' + name); GK.sfx('start');
  };

  // ---------- Over-screen observer (auto recordRun) ----------
  var OVER_SELS = ['#overScreen', '#screen-over', '#gameover-screen', '#match-over-screen', '#round-over-screen', '#screen-complete', '#screen-failed', '#screen-victory', '#overlay'];
  var overPoll = null;
  function observeOverScreen() {
    if (overPoll) return;
    overPoll = setInterval(function () {
      var any = false;
      for (var i = 0; i < OVER_SELS.length; i++) { var e = $(OVER_SELS[i]); if (e && visible(e)) { any = true; break; } }
      if (any) { if (!GK._manualRecord) GK.recordRun({ result: 'over' }); }
      else { GK._runRecorded = false; } // new run starting
    }, 700);
  }
  GK.resetRun = function () { GK._runRecorded = false; };

  // ---------- Test hooks ----------
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

  // ---------- PWA auto-update ----------
  function setupPWAUpdate() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(reg);
        });
      });
      // poll for updates every 10 min (so installed PWA detects new version without manual refresh)
      setInterval(function () { try { reg.update(); } catch (e) {} }, 10 * 60 * 1000);
      // also check shortly after load + on visibility regain
      setTimeout(function () { try { reg.update(); } catch (e) {} }, 4000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) { try { reg.update(); } catch (e) {} } });
    }).catch(function () {});
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (refreshing) return; refreshing = true; location.reload(); });
  }
  function showUpdateBanner(reg) {
    if (document.querySelector('[data-gk-update]')) return;
    var b = el('div', ''); b.setAttribute('data-gk-update', '1');
    b.style.cssText = `position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0) + 16px);transform:translateX(-50%);z-index:100001;display:flex;align-items:center;gap:12px;background:rgba(20,28,36,.97);color:#fff;border:1px solid #2f5d8f;border-radius:12px;padding:10px 14px;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.5);max-width:92vw;`;
    b.innerHTML = '<span>✨ نسخه‌ی جدید آماده است</span>';
    var btn = el('button', ''); btn.type = 'button'; btn.textContent = 'بروزرسانی';
    btn.style.cssText = `min-height:38px;padding:8px 16px;border:none;border-radius:8px;background:#2f7d5b;color:#fff;font:600 13px/1 system-ui,sans-serif;cursor:pointer;`;
    btn.addEventListener('click', function () {
      btn.textContent = '…'; btn.disabled = true;
      if (reg.waiting) { try { reg.waiting.postMessage('skipWaiting'); } catch (e) {} setTimeout(function () { location.reload(); }, 1200); }
      else location.reload();
    });
    var x = el('button', ''); x.type = 'button'; x.textContent = 'بعدا';
    x.style.cssText = `min-height:38px;padding:8px 12px;border:none;background:transparent;color:#9fb2c2;font:600 13px/1 system-ui,sans-serif;cursor:pointer;`;
    x.addEventListener('click', function () { b.remove(); });
    b.appendChild(btn); b.appendChild(x);
    document.body.appendChild(b);
    GK.sfx('coin', 0.3);
  }

  // ---------- Boot ----------
  function boot() {
    loadAudio(); bridgeMUX(); injectButtons(); injectMenu();
    setupPWAUpdate(); observeOverScreen();
    showSplash(); // shown now; GK.ready() hides after game init
    document.addEventListener('pointerdown', unlockOnce);
    document.addEventListener('keydown', unlockOnce);
    document.addEventListener('keydown', function (e) { var k = (e.key || '').toLowerCase(); if (k === 'f') toggleFullscreen(); else if (k === 'h') toggleHelp(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
