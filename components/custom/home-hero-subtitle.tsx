"use client";

import { Fragment, type CSSProperties } from "react";
import { useHomeEntranceDone } from "./use-home-entrance-done";
import styles from "./home-hero-title.module.css";

/**
 * Hero subtitle that glides up word by word (each word rises out of its own mask) once
 * the entrance has finished, trailing the CNU wordmark wave.
 */
export function HomeHeroSubtitle({ text, className }: { text: string; className?: string }) {
  const entranceDone = useHomeEntranceDone();
  const words = text.split(" ");

  return (
    <p className={className} aria-label={text} data-play={entranceDone ? "" : undefined}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span aria-hidden="true" className={styles.wordMask}>
            <span className={styles.word} style={{ "--i": index } as CSSProperties}>
              {word}
            </span>
          </span>
          {/* The space sits between the masks: inside an inline-block it would collapse. */}
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </p>
  );
}
