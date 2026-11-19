import type { Metadata } from "next";
import { Fragment } from "react";
import { ApplyDivider, ApplyHero, SectionNav } from "@/components/custom/apply/apply-ui";
import applyStyles from "@/components/custom/apply/apply.module.css";
import {
  PRIVACY_POLICY_ARTICLES,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_PREAMBLE,
  PRIVACY_POLICY_TITLE,
  type PolicyBlock,
} from "@/lib/privacy-policy";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "개인정보 처리방침 | CNU",
  description: "CNU 개인정보 처리방침",
};

const URL_PATTERN = /^https?:\/\//;

function Cell({ value }: { value: string }) {
  if (URL_PATTERN.test(value)) {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer">
        {value.replace(URL_PATTERN, "")}
      </a>
    );
  }
  if (value.includes("@") && !value.includes(" ")) {
    return <a href={`mailto:${value}`}>{value}</a>;
  }
  return <>{value}</>;
}

function Block({ block }: { block: PolicyBlock }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "note":
      return <p className={styles.note}>{block.text}</p>;
    case "ol":
      return (
        <ol className={styles.list}>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    case "kv":
      return (
        <dl className={styles.kv}>
          {block.rows.map(([label, value], index) => (
            <div key={`${label}-${index}`}>
              <dt>{label}</dt>
              <dd>
                <Cell value={value} />
              </dd>
            </div>
          ))}
        </dl>
      );
    case "table":
      return (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {block.head.map((cell) => (
                  <th key={cell} scope="col">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td key={index}>
                      <Cell value={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "sub":
      return (
        <div className={styles.sub}>
          <h3>{block.title}</h3>
          {block.blocks.map((child, index) => (
            <Block key={index} block={child} />
          ))}
        </div>
      );
  }
}

export default function PrivacyPolicyPage() {
  return (
    <main className={applyStyles.page}>
      <ApplyHero
        crumbs={[{ label: "홈", href: "/" }, { label: "개인정보 처리방침" }]}
        display="Privacy"
        title={PRIVACY_POLICY_TITLE}
        meta={<span>시행일 {PRIVACY_POLICY_EFFECTIVE_DATE}</span>}
      />

      <ApplyDivider />

      <div className={applyStyles.body}>
        <SectionNav
          label="목차"
          items={PRIVACY_POLICY_ARTICLES.map((article, index) => ({
            href: `#${article.id}`,
            label: `${String(index + 1).padStart(2, "0")}  ${article.nav}`,
          }))}
        />

        <article className={`${applyStyles.content} ${applyStyles.card} ${styles.policy}`}>
          <header className={styles.preamble}>
            <h2>{PRIVACY_POLICY_TITLE}</h2>
            {PRIVACY_POLICY_PREAMBLE.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </header>

          {PRIVACY_POLICY_ARTICLES.map((article) => (
            <section key={article.id} id={article.id} className={styles.article} aria-labelledby={`${article.id}-title`}>
              <h2 id={`${article.id}-title`}>{article.title}</h2>
              {article.blocks.map((block, index) => (
                <Fragment key={index}>
                  <Block block={block} />
                </Fragment>
              ))}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
