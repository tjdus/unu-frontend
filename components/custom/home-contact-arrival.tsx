"use client";

import { useLayoutEffect } from "react";

export function HomeContactArrival() {
  useLayoutEffect(() => {
    // Next's client router cache keeps the hash from the first visit to "/#contact" and
    // appends it again on the next one ("/#contact#contact"). Put the address back.
    if (/^#contact(#contact)+$/.test(location.hash)) {
      history.replaceState(history.state, "", `${location.pathname}${location.search}#contact`);
    }
    if (location.hash !== "#contact") return;
    const home = document.getElementById("home-top");
    const contact = document.getElementById("contact");
    if (!home || !contact) return;

    const align = () => {
      if (location.hash !== "#contact") return;
      const top = contact.getBoundingClientRect().top + window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const destination = Math.max(0, Math.min(top, max));
      if (Math.abs(window.scrollY - destination) > 1) {
        window.scrollTo({ top: destination, behavior: "instant" });
      }
    };

    // Sections above Contact may still resize after the home route mounts.
    const observer = new ResizeObserver(align);
    observer.observe(home);
    align();
    const frame = requestAnimationFrame(align);

    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("hashchange", stop);
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("pointerdown", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    window.addEventListener("hashchange", stop);
    return stop;
  }, []);

  return null;
}
