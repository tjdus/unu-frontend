"use client";

/**
 * "The hero's WebGL scene has drawn its first real frame" — so the entrance screen can stay
 * up exactly as long as the 3D needs, instead of a fixed time.
 */

const EVENT = "home-hero-ready";
let ready = false;

export function markHomeHeroReady() {
  if (ready) return;
  ready = true;
  window.dispatchEvent(new Event(EVENT));
}

/** Calls `callback` once the hero is ready (right away if it already is). Returns an unsubscribe. */
export function onHomeHeroReady(callback: () => void) {
  if (ready) {
    callback();
    return () => undefined;
  }
  window.addEventListener(EVENT, callback, { once: true });
  return () => window.removeEventListener(EVENT, callback);
}
