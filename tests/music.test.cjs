'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Contract doubles exercise our controller, not real YouTube playback.
function boot({ api = true, preference = null, loading = false, storageThrows = false, mobile = false } = {}) {
  const elements = [];
  const timers = new Map();
  let serial = 0;
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attributes = {}; this.listeners = {}; this.hidden = false; this.textContent = ''; elements.push(this); }
    append(...nodes) { nodes.forEach(node => { this.children.push(node); node.parentNode = this; }); }
    appendChild(node) { this.append(node); return node; }
    setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'id') this.id = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    dispatch(type) { for (const fn of this.listeners[type] || []) fn({ target: this }); }
    focus() { document.activeElement = this; }
    click() { this.dispatch('click'); }
  }
  const document = {
    readyState: loading ? 'loading' : 'complete', hidden: false, activeElement: null, listeners: {},
    createElement: tag => new Element(tag),
    getElementById: id => elements.find(el => el.id === id) || null,
    querySelector: selector => elements.find(el => selector.includes('iframe_api') && el.src === 'https://www.youtube.com/iframe_api') || null,
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    dispatch(type) { for (const fn of this.listeners[type] || []) fn(); }
  };
  document.head = new Element('head'); document.body = new Element('body');
  let options, player;
  const calls = [];
  const YT = { Player: function (id, opts) {
    options = opts;
    player = this;
    this.state = -1;
    this.playVideo = () => calls.push(['play', !document.getElementById('wedding-music-panel').hidden]);
    this.unMute = () => calls.push(['unmute']);
    this.pauseVideo = () => calls.push(['pause', !document.getElementById('wedding-music-panel').hidden]);
    this.getPlayerState = () => this.state;
    this.getIframe = () => document.getElementById(id);
  }, PlayerState: { PLAYING: 1, PAUSED: 2 } };
  const values = new Map(preference ? [['wedding-music-paused', preference]] : []);
  let previousReadyCalls = 0;
  const window = {
    location: { origin: 'https://wedding.example' },
    matchMedia() { return { matches: mobile }; },
    sessionStorage: { getItem(key) { if (storageThrows) throw Error('storage'); return values.get(key) || null; }, setItem(key, value) { if (storageThrows) throw Error('storage'); values.set(key, value); } },
    onYouTubeIframeAPIReady() { previousReadyCalls++; }
  };
  if (api) window.YT = YT;
  const dialog = new Element('dialog'); dialog.id = 'detail-dialog'; dialog.open = false;
  let dialogObserver;
  class MutationObserver {
    constructor(fn) { this.fn = fn; }
    observe(target, options) { if (target === dialog && options.attributes) dialogObserver = this.fn; }
  }
  const context = { window, document, MutationObserver, location: window.location, console,
    setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/music.js'), 'utf8'), context);
  return { document, window, elements, calls, values, YT,
    el: id => document.getElementById(id),
    get options() { return options; }, get player() { return player; },
    get previousReadyCalls() { return previousReadyCalls; },
    dialogOpen(value) { dialog.open = value; if (dialogObserver) dialogObserver(); },
    ready() { options.events.onReady({ target: player }); },
    state(value) { player.state = value; options.events.onStateChange({ target: player, data: value }); },
    tick(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } }
  };
}

test('ready makes one unmuted attempt but reports playing only from actual state', () => {
  const h = boot();
  h.ready();
  assert.deepEqual(h.calls, [['unmute'], ['play', true]]);
  assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'false');
  h.tick(5000);
  assert.equal(h.el('wedding-music-toggle').textContent, 'แตะเพื่อเปิดเพลง');
  h.el('wedding-music-toggle').click();
  assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'false');
  h.state(1);
  assert.equal(h.el('wedding-music-status').textContent, 'กำลังเล่น');
  assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'true');
  h.options.events.onAutoplayBlocked();
  assert.equal(h.el('wedding-music-toggle').textContent, 'แตะเพื่อเปิดเพลง');
  h.state(2);
  assert.equal(h.el('wedding-music-status').textContent, 'พักเพลง');
});

test('collapse pauses before hiding, restores focus, and reopening needs a gesture', () => {
  const h = boot(); h.ready(); h.state(1);
  h.el('wedding-music-close').click();
  assert.deepEqual(h.calls.at(-1), ['pause', true]);
  assert.equal(h.el('wedding-music-panel').hidden, true);
  assert.equal(h.document.activeElement, h.el('wedding-music-open'));
  assert.equal(h.values.get('wedding-music-paused'), '1');
  h.state(1); // An asynchronous PLAYING event must not allow hidden playback.
  assert.equal(h.calls.at(-1)[0], 'pause');
  h.el('wedding-music-open').click();
  assert.equal(h.el('wedding-music-panel').hidden, false);
  assert.deepEqual(h.calls.at(-1), ['play', true]);
  assert.equal(h.document.activeElement, h.el('wedding-music-toggle'));
  assert.equal(h.values.get('wedding-music-paused'), '0');
  h.document.hidden = true; h.document.dispatch('visibilitychange');
  assert.deepEqual(h.calls.at(-1), ['pause', true]);
  assert.equal(h.el('wedding-music-panel').hidden, true);
  const count = h.calls.length;
  h.document.hidden = false; h.document.dispatch('visibilitychange');
  assert.equal(h.calls.length, count);
});

test('explicit pause preference survives reload without autoplay and storage can be unavailable', () => {
  const h = boot(); h.ready(); h.state(1);
  h.el('wedding-music-toggle').click();
  assert.equal(h.values.get('wedding-music-paused'), '1');
  // Until the API confirms pause, UI still reports the last actual state.
  assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'true');
  const reloaded = boot({ preference: '1' }); reloaded.ready();
  assert.equal(reloaded.options.playerVars.autoplay, 0);
  assert.equal(reloaded.calls.length, 0);
  assert.equal(reloaded.el('wedding-music-toggle').textContent, 'แตะเพื่อเปิดเพลง');
  const unavailable = boot({ storageThrows: true }); unavailable.ready(); unavailable.state(1);
  assert.doesNotThrow(() => unavailable.el('wedding-music-close').click());
});

test('loads the API once, composes existing callback, and handles loading failure', () => {
  const h = boot({ api: false });
  const scripts = h.elements.filter(el => el.tagName === 'SCRIPT');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.youtube.com/iframe_api');
  h.window.YT = h.YT;
  h.window.onYouTubeIframeAPIReady();
  h.window.onYouTubeIframeAPIReady();
  assert.equal(h.previousReadyCalls, 2);
  assert.equal(h.elements.filter(el => el.id === 'wedding-music-player').length, 1);
  h.ready();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 1);
  const failed = boot({ api: false });
  failed.elements.find(el => el.tagName === 'SCRIPT').dispatch('error');
  assert.match(failed.el('wedding-music-status').textContent, /โหลดเพลงไม่ได้/);
  assert.equal(failed.el('wedding-music-toggle').disabled, true);
  assert.equal(failed.el('wedding-music-youtube').hidden, false);
  const timedOut = boot({ api: false }); timedOut.tick(12000);
  assert.match(timedOut.el('wedding-music-status').textContent, /โหลดเพลงไม่ได้/);
  const iframeTimedOut = boot(); iframeTimedOut.tick(12000);
  assert.match(iframeTimedOut.el('wedding-music-status').textContent, /โหลดเพลงไม่ได้/);
});

test('timeout late readiness and PLAYING are paused without clearing failure or resuming', () => {
  for (const mobile of [true, false]) {
    const h = boot({ mobile });
    h.tick(12000);
    const error = h.el('wedding-music-status').textContent;
    const pauses = () => h.calls.filter(call => call[0] === 'pause').length;
    const beforeReady = pauses();
    h.ready();
    assert.equal(pauses(), beforeReady + 1, 'late ready must pause after timeout');
    h.state(1);
    assert.equal(pauses(), beforeReady + 2, 'late PLAYING must pause even after failure');
    h.state(2);
    h.options.events.onAutoplayBlocked();
    h.el('wedding-music-open').click();
    assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
    assert.equal(h.el('wedding-music-status').textContent, error);
    assert.equal(h.el('wedding-music-toggle').disabled, true);
    assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'false');
  }
});

test('late callbacks pause their event target when failed, hidden, or covered', () => {
  const timedOut = boot();
  timedOut.tick(12000);
  let lateReadyPauses = 0;
  timedOut.options.events.onReady({ target: { pauseVideo() { lateReadyPauses++; } } });
  assert.equal(lateReadyPauses, 1);
  for (const restrict of [
    h => h.options.events.onError({ data: 150 }),
    h => h.el('wedding-music-close').click(),
    h => { h.document.hidden = true; },
    h => { h.dialogOpen(true); h.el('wedding-music-panel').hidden = false; }
  ]) {
    const h = boot(); h.ready();
    restrict(h);
    const status = h.el('wedding-music-status').textContent;
    const before = h.calls.length;
    let latePlayingPauses = 0;
    h.options.events.onStateChange({ target: { pauseVideo() { latePlayingPauses++; } }, data: 1 });
    assert.equal(latePlayingPauses, 1, 'must pause the event target, not the stored player');
    assert.equal(h.calls.length, before);
    assert.equal(h.el('wedding-music-status').textContent, status);
    h.document.hidden = false;
    h.dialogOpen(false);
    assert.equal(h.calls.length, before, 'visibility restoration must not resume playback');
  }
});

test('embedding errors provide an honest fallback without a playing claim', () => {
  for (const code of [100, 101, 150, 153, 5]) {
    const h = boot(); h.ready();
    h.options.events.onError({ data: code });
    assert.match(h.el('wedding-music-status').textContent, /YouTube/);
    assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'false');
    assert.equal(h.el('wedding-music-toggle').disabled, true);
    assert.equal(h.el('wedding-music-youtube').hidden, false);
  }
});

test('preview dialog pauses the covered player and closing it does not resume', () => {
  const h = boot(); h.ready(); h.state(1);
  h.dialogOpen(true);
  assert.deepEqual(h.calls.at(-1), ['pause', true]);
  assert.equal(h.el('wedding-music-panel').hidden, true);
  const count = h.calls.length;
  h.dialogOpen(false);
  assert.equal(h.calls.length, count);
  h.el('wedding-music-open').click();
  assert.deepEqual(h.calls.at(-1), ['play', true]);
});

test('dock styles keep a full-size unobscured player and respect reduced motion', () => {
  const h = boot();
  const css = h.elements.find(el => el.tagName === 'STYLE')?.textContent || '';
  assert.match(css, /width:\s*220px/);
  assert.match(css, /height:\s*200px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\[hidden\]/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /left:/);
});

test('buffering is not playing, native pause is remembered, and iframe delegates autoplay', () => {
  const h = boot(); h.ready();
  assert.match(h.player.getIframe().getAttribute('allow'), /autoplay/);
  h.state(1); h.state(3);
  assert.equal(h.el('wedding-music-toggle').getAttribute('aria-pressed'), 'false');
  assert.equal(h.el('wedding-music-status').textContent, 'กำลังโหลดเพลง…');
  h.state(1); h.state(2);
  assert.equal(h.values.get('wedding-music-paused'), '1');
});

test('late readiness never starts a collapsed player and modal-open play is refused', () => {
  const h = boot();
  h.el('wedding-music-close').click();
  assert.deepEqual(h.calls.at(-1), ['pause', true]);
  h.ready();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
  h.dialogOpen(true);
  h.el('wedding-music-open').click();
  assert.equal(h.calls.filter(call => call[0] === 'play').length, 0);
  h.options.events.onError({ data: 153 });
  const error = h.el('wedding-music-status').textContent;
  h.options.events.onAutoplayBlocked();
  assert.equal(h.el('wedding-music-status').textContent, error);
});

test('mobile blocked autoplay collapses an unrequested panel but explicit reopening keeps fallback visible', () => {
  const h=boot({mobile:true});h.ready();h.options.events.onAutoplayBlocked();
  assert.equal(h.el('wedding-music-panel').hidden,true);
  assert.deepEqual(h.calls.at(-1),['pause',true]);
  h.el('wedding-music-open').click();h.options.events.onError({data:150});
  assert.equal(h.el('wedding-music-panel').hidden,false);
  assert.match(h.el('wedding-music-status').textContent,/YouTube/);
  const failed=boot({mobile:true});failed.ready();failed.options.events.onError({data:150});
  assert.equal(failed.el('wedding-music-panel').hidden,true);
  const css=h.el('wedding-music-styles').textContent;
  assert.match(css,/@media\s*\(max-width:\s*760px\)/);
  assert.match(css,/bottom:\s*max\(80px/);
});

test('initializes on DOM ready with a visible, official 220 by 200 player', () => {
  const h = boot({ loading: true });
  assert.equal(h.options, undefined);
  h.document.dispatch('DOMContentLoaded');
  assert.equal(h.el('wedding-music-panel').hidden, false);
  assert.equal(h.options.videoId, 'ULQVcDUJjvM');
  assert.equal(h.options.width, 220);
  assert.equal(h.options.height, 200);
  assert.equal(h.options.playerVars.autoplay, 1);
  assert.equal(h.options.playerVars.controls, 1);
  assert.equal(h.options.playerVars.origin, 'https://wedding.example');
  assert.equal(h.options.playerVars.playsinline, 1);
  assert.equal(h.options.playerVars.loop, 1);
  assert.equal(h.options.playerVars.playlist, 'ULQVcDUJjvM');
  assert.equal(h.el('wedding-music-youtube').href, 'https://youtu.be/ULQVcDUJjvM?si=X3nB8nKP7PUgc-JK');
});
