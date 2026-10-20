'use strict';
/* Progressive enhancement only: nothing is hidden in the stylesheet or DOM. */
function claimFirstVisit(storage) {
 try {
  if (!storage || storage.getItem('wedding-motion-seen')) return false;
  storage.setItem('wedding-motion-seen', '1');
  return true;
 } catch { return false; }
}
function entranceFrames(baseTransform = 'none', phone = false) {
 const base = baseTransform === 'none' ? '' : baseTransform;
 return [
  {opacity: phone ? 0.45 : 0.3, transform: `translateY(${phone ? 40 : 16}px) ${phone ? 'rotate(-4deg) ' : ''}${base}`.trim()},
  {opacity: 1, transform: baseTransform}
 ];
}
if (typeof module !== 'undefined') module.exports = {claimFirstVisit, entranceFrames};
if (typeof document !== 'undefined') {
 const boot = () => {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || typeof Element.prototype.animate !== 'function') return;
  const active = new Map();
  const seen = new WeakSet();
  function animate(element, {delay = 0, phone = false} = {}) {
   if (preference.matches || !element.isConnected) return;
   try {
    const animation = element.animate(entranceFrames(getComputedStyle(element).transform, phone), {
     duration: phone ? 950 : 620, delay, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards', iterations: 1
    });
    active.set(element, animation);
    const release = () => { if (active.get(element) === animation) active.delete(element); };
    animation.addEventListener('finish', release, {once:true});
    animation.addEventListener('cancel', release, {once:true});
   } catch { /* Unsupported animation leaves the original content readable. */ }
  }
  let storage;
  try { storage = window.sessionStorage; } catch { /* Restricted storage skips the intro. */ }
  if (claimFirstVisit(storage)) {
   document.querySelectorAll('.hero-copy > *').forEach((element, index) => animate(element, {delay:index * 65}));
   document.querySelectorAll('.hero-phone').forEach((element, index) => animate(element, {delay:120 + index * 130, phone:true}));
  }
  let observer;
  let mutations;
  if (typeof IntersectionObserver !== 'undefined') {
   observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
     if (!entry.isIntersecting) continue;
     observer.unobserve(entry.target);
     animate(entry.target);
    }
   }, {threshold:0.08, rootMargin:'0px 0px -24px 0px'});
   const observe = element => {
    if (seen.has(element)) return;
    seen.add(element);
    observer.observe(element);
   };
   document.querySelectorAll('.pricing-intro,.features-sheet,.order-heading,.order-steps li,.story-heading,.story-copy,.gallery-intro,.section-heading,.contact-section,.gallery-card').forEach(observe);
   const gallery = document.querySelector('#gallery');
   if (gallery && typeof MutationObserver !== 'undefined') {
    // Replaced cards are unregistered; new cards are observed without hidden classes.
    mutations = new MutationObserver(records => {
     for (const record of records) {
      for (const removed of record.removedNodes) {
       if (removed.nodeType !== 1) continue;
       for (const element of [removed, ...removed.querySelectorAll('.gallery-card')]) {
        observer.unobserve(element);
        active.get(element)?.cancel();
       }
      }
     }
     gallery.querySelectorAll('.gallery-card').forEach(observe);
    });
    mutations.observe(gallery, {childList:true});
   }
  }
  const stop = () => {
   for (const animation of active.values()) animation.cancel();
   active.clear();
   observer?.disconnect();
   mutations?.disconnect();
  };
  preference.addEventListener?.('change', event => { if (event.matches) stop(); });
  window.addEventListener('pagehide', stop, {once:true});
 };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
 else boot();
}
