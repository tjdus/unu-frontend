"use client";

import dynamic from "next/dynamic";
import styles from "./blog-book-thumbnail.module.css";

// The booklet (three.js) loads in the browser only; rows render server-side without it.
const BlogBookStage = dynamic(() => import("./blog-book-stage").then((module) => module.BlogBookStage), {
  ssr: false,
});

/** Blog post thumbnail: a floating open booklet with turning pages (see blog-book-stage). */
export function BlogBookThumbnail({ seed }: { seed: string }) {
  return <BlogBookStage seed={seed} />;
}

/** Class for the media frame that holds it: transparent, no rim. */
export const blogBookFrame = styles.frame;
