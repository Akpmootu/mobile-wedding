/* Official YouTube player: playback remains subject to browser and YouTube policy. */
(() => {
  'use strict';
  const VIDEO_ID = 'G5kFdvmxdfo';
  function initialize() {
    if (document.getElementById('wedding-music')) return;
    function element(tag, id, text) {
      const node = document.createElement(tag);
      if (id) node.id = id;
      if (text) node.textContent = text;
      return node;
    }
    const dock = element('aside', 'wedding-music');
    dock.setAttribute('aria-label', 'เพลงคู่ชีวิต');
    const panel = element('div', 'wedding-music-panel');
    const title = element('strong', '', 'คู่ชีวิต · Dr.Fuu');
    const close = element('button', 'wedding-music-close', '−');
    close.setAttribute('aria-label', 'ย่อและพักเพลง');
    close.setAttribute('aria-controls', panel.id);
    const style = element('style', 'wedding-music-styles');
    style.textContent = `
      #wedding-music { position: fixed; left: max(10px, env(safe-area-inset-left)); bottom: max(10px, env(safe-area-inset-bottom)); z-index: 25; width: 230px; font: 12px/1.5 'Noto Sans Thai', Tahoma, sans-serif; color: #493b34; color-scheme: light; }
      #wedding-music, #wedding-music * { box-sizing: border-box; }
      #wedding-music [hidden] { display: none !important; }
      #wedding-music-panel { display: grid; grid-template-columns: 1fr 44px; gap: 4px 0; width: 230px; padding: 4px; border: 1px solid #dfc7bc; border-radius: 13px; background: #fffaf5; box-shadow: 0 6px 24px #493b3420; }
      #wedding-music-panel > strong { align-self: center; padding-left: 5px; font-size: 12px; }
      #wedding-music button { cursor: pointer; min-height: 44px; font: inherit; color: #653e36; border: 1px solid #dfc7bc; border-radius: 8px; background: #f5e6df; padding: 6px 8px; }
      #wedding-music button:disabled { cursor: default; opacity: .7; }
      #wedding-music #wedding-music-close { padding: 0; border: 0; background: transparent; font-size: 23px; }
      #wedding-music-player { display: block; grid-column: 1 / -1; width: 220px; min-width: 220px; height: 200px; min-height: 200px; border: 0; padding: 0; margin: 0; }
      #wedding-music-status { grid-column: 1 / -1; min-height: 18px; margin: 2px 4px; font-size: 11px; line-height: 1.5; }
      #wedding-music-toggle, #wedding-music-youtube { grid-column: 1 / -1; }
      #wedding-music-youtube { display: flex; align-items: center; justify-content: center; min-height: 44px; color: #7c493e; text-decoration: underline; text-underline-offset: 3px; font-size: 11px; }
      #wedding-music button:focus-visible, #wedding-music a:focus-visible { outline: 2px solid #974d3e; outline-offset: 2px; }
      #wedding-music-open { box-shadow: 0 3px 16px #493b3420; }
      @media (max-width: 760px) { #wedding-music:has(#wedding-music-panel:not([hidden])) { bottom: max(80px, calc(env(safe-area-inset-bottom) + 70px)); } }
      @media (prefers-reduced-motion: reduce) { #wedding-music, #wedding-music * { animation: none !important; transition: none !important; scroll-behavior: auto !important; } }
    `;
    document.head.append(style);
    const mount = element('div', 'wedding-music-player');
    const status = element('p', 'wedding-music-status', 'กำลังโหลดเพลง…');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const toggle = element('button', 'wedding-music-toggle', 'กำลังโหลดเพลง…');
    toggle.setAttribute('aria-pressed', 'false');
    const link = element('a', 'wedding-music-youtube', 'เปิดบน YouTube ↗');
    link.href = 'https://youtu.be/G5kFdvmxdfo?si=gUvs7tEuPm1H8d2C';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const open = element('button', 'wedding-music-open', 'เปิดเพลง');
    open.setAttribute('aria-controls', panel.id);
    open.setAttribute('aria-expanded', 'true');
    open.hidden = true;
    panel.append(title, close, mount, status, toggle, link);
    dock.append(panel, open);
    document.body.append(dock);
    let player;
    let ready = false;
    let playing = false;
    let attemptTimer;
    let loadTimer;
    let failed = false;
    let created = false;
    let wantsPlayback = true;
    let userOpened = false;
    try { wantsPlayback = window.sessionStorage.getItem('wedding-music-paused') !== '1'; } catch (_) { /* Storage can be blocked. */ }
    function rememberPause(paused) {
      try { window.sessionStorage.setItem('wedding-music-paused', paused ? '1' : '0'); } catch (_) { /* Optional preference only. */ }
    }
    function pause(target = player) {
      wantsPlayback = false;
      clearTimeout(attemptTimer);
      if (target && typeof target.pauseVideo === 'function') target.pauseVideo();
    }
    function collapse(explicit) {
      pause(); // Always before hiding the visible player.
      if (explicit) rememberPause(true);
      panel.hidden = true;
      open.hidden = false;
      open.setAttribute('aria-expanded', 'false');
      if (explicit) open.focus();
    }
    close.addEventListener('click', () => collapse(true));
    open.addEventListener('click', () => {
      userOpened = true;
      panel.hidden = false;
      open.hidden = true;
      open.setAttribute('aria-expanded', 'true');
      wantsPlayback = true;
      rememberPause(false);
      toggle.focus();
      play();
    });
    const dialog = document.getElementById('detail-dialog');
    const previewOpen = () => Boolean(dialog && dialog.open);
    if (dialog && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => {
        if (previewOpen()) collapse(false);
      }).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) collapse(false);
    });
    function compactMobileFallback() {
      if (!userOpened && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches) collapse(false);
    }
    function needsGesture() {
      if (failed) return;
      clearTimeout(attemptTimer);
      playing = false;
      status.textContent = 'พร้อมเปิดเพลง — เบราว์เซอร์อาจต้องการให้แตะก่อน';
      toggle.textContent = 'แตะเพื่อเปิดเพลง';
      toggle.setAttribute('aria-pressed', 'false');
      compactMobileFallback();
    }
    function play() {
      if (!ready || failed || panel.hidden || document.hidden || previewOpen()) return;
      player.unMute();
      player.playVideo();
      status.textContent = 'กำลังโหลดเพลง…';
      clearTimeout(attemptTimer);
      attemptTimer = setTimeout(() => {
        if (player.getPlayerState() !== 1) needsGesture();
      }, 5000);
    }
    toggle.addEventListener('click', () => {
      userOpened = true;
      if (!ready) return;
      if (playing) {
        rememberPause(true);
        pause();
      } else {
        wantsPlayback = true;
        rememberPause(false);
        play();
      }
    });
    function fail(message) {
      clearTimeout(loadTimer);
      clearTimeout(attemptTimer);
      pause();
      failed = true;
      playing = false;
      status.textContent = message;
      toggle.textContent = 'เปิดเพลงไม่ได้';
      toggle.disabled = true;
      toggle.setAttribute('aria-pressed', 'false');
      compactMobileFallback();
    }
    function createPlayer() {
      if (created || failed || !window.YT || typeof window.YT.Player !== 'function') return;
      created = true;
      try {
        player = new window.YT.Player(mount.id, {
      width: 220, height: 200, videoId: VIDEO_ID,
      playerVars: { autoplay: wantsPlayback && !panel.hidden && !document.hidden && !previewOpen() ? 1 : 0, controls: 1, playsinline: 1, origin: window.location.origin, loop: 1, playlist: VIDEO_ID },
      events: {
        onReady(event) {
          if (failed) {
            pause(event.target);
            return;
          }
          if (ready) return;
          clearTimeout(loadTimer);
          player = event.target;
          ready = true;
          const iframe = player.getIframe();
          const permissions = iframe.getAttribute('allow') || '';
          if (!/(^|;)\s*autoplay(?:\s|;|$)/.test(permissions)) iframe.setAttribute('allow', `${permissions}${permissions ? '; ' : ''}autoplay`);
          iframe.setAttribute('title', 'คู่ชีวิต - Dr.Fuu · YouTube music player');
          if (wantsPlayback && !panel.hidden && !document.hidden && !previewOpen()) play();
          else {
            if (panel.hidden || document.hidden || previewOpen()) player.pauseVideo();
            needsGesture();
          }
        },
        onAutoplayBlocked: needsGesture,
        onError(event) {
          const unavailable = [100, 101, 150].includes(event.data);
          fail(unavailable ? 'เพลงนี้ไม่พร้อมเล่นบนเว็บไซต์ — กรุณาเปิดบน YouTube' : 'เล่นเพลงไม่ได้ในขณะนี้ — กรุณาเปิดบน YouTube');
        },
        onStateChange(event) {
          if (event.data === 1 && (failed || panel.hidden || document.hidden || previewOpen())) {
            pause(event.target);
            return;
          }
          if (failed) return;
          playing = event.data === 1;
          toggle.setAttribute('aria-pressed', String(playing));
          if (playing) {
            clearTimeout(attemptTimer);
            status.textContent = 'กำลังเล่น';
            toggle.textContent = 'พักเพลง';
          } else if (event.data === 2) {
            clearTimeout(attemptTimer);
            status.textContent = 'พักเพลง';
            toggle.textContent = 'แตะเพื่อเปิดเพลง';
            if (wantsPlayback) {
              wantsPlayback = false;
              rememberPause(true);
            }
          } else if (event.data === 3) {
            status.textContent = 'กำลังโหลดเพลง…';
            toggle.textContent = 'แตะเพื่อเปิดเพลง';
          } else {
            needsGesture();
          }
        }
      }
    });
      } catch (_) { fail('โหลดเพลงไม่ได้ — กรุณาเปิดบน YouTube'); }
    }
    loadTimer = setTimeout(() => fail('โหลดเพลงไม่ได้ — กรุณาเปิดบน YouTube'), 12000);
    if (window.YT && typeof window.YT.Player === 'function') createPlayer();
    else {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function (...args) {
        try {
          if (typeof previousReady === 'function') previousReady.apply(window, args);
        } finally { createPlayer(); }
      };
      let script = document.querySelector('script[src="https://www.youtube.com/iframe_api"], script[src="https://www.youtube.com/player_api"]');
      const existing = Boolean(script);
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
      }
      script.addEventListener('error', () => fail('โหลดเพลงไม่ได้ — กรุณาเปิดบน YouTube'), { once: true });
      if (!existing) document.head.append(script);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
