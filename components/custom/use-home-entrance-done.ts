"use client";

import { useSyncExternalStore } from "react";

const ATTR = "data-home-entrance-complete";

function subscribe(onChange: () => void) {
  const home = document.getElementById("home-top");
  if (!home) return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(home, { attributes: true, attributeFilter: [ATTR] });
  return () => observer.disconnect();
}

function getSnapshot() {
  const home = document.getElementById("home-top");
  // Pages without the entrance screen are "done" right away.
  return !home || home.hasAttribute(ATTR);
}

/**
 * True once the home entrance screen has finished (HomeEntrance marks #home-top with
 * data-home-entrance-complete).
 */
export function useHomeEntranceDone() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
