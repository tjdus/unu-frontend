"use client";

import { useEffect } from "react";

/**
 * Page loading holds: anything still getting ready on screen (a WebGL thumbnail before its
 * first frame, a lazily loaded three.js chunk) takes a hold, and PageLoadingScreen stays up
 * until every hold is released. Holds taken after the screen has gone do nothing.
 */

let pending = 0;
let changedAt = 0;
const listeners = new Set<() => void>();

const notify = () => {
  changedAt = performance.now();
  listeners.forEach((listener) => listener());
};

/** Takes a hold; call the returned function (any number of times) to release it. */
export function holdPageLoad() {
  pending++;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending--;
    notify();
  };
}

export function pageLoadState() {
  return { pending, changedAt };
}

export function subscribePageLoad(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Holds the page load while mounted — e.g. as a next/dynamic `loading` placeholder. */
export function PageLoadHold() {
  useEffect(() => holdPageLoad(), []);
  return null;
}
