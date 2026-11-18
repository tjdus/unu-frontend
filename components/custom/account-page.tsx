import type { ReactNode } from "react";
import styles from "./account-page.module.css";
import editorial from "./editorial.module.css";

export function AccountPage({
  title,
  intro,
  notFound,
  children,
}: {
  title: string;
  intro: string;
  notFound?: boolean;
  children?: ReactNode;
}) {
  return (
    <main className={`${editorial.page} ${styles.page}`} data-public-not-found={notFound || undefined}>
      <div className={styles.layout}>
        <div className={styles.intro}>
          <h1 className={notFound ? styles.errorCode : undefined}>{title}</h1>
          <p>{intro}</p>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </main>
  );
}
