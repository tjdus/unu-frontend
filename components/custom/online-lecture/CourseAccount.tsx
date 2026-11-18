import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LectureAccountStatus } from "@/lib/online-lecture/types";
import styles from "./booking.module.css";

export default function CourseAccount({ account, error }: LectureAccountStatus) {
  return (
    <div className={styles.panel}>
      <h2 className="mb-3">수강 정보</h2>
      {!account ? (
        <p className={styles.small}>{error ?? "등록된 계정 정보가 없습니다."}</p>
      ) : (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-2 text-sm">
          <dt className={styles.small}>계정 Email</dt><dd className="wrap-anywhere">{account.login_id}</dd>
          <dt className={styles.small}>비밀번호</dt><dd className="wrap-anywhere">{account.login_password}</dd>
          {account.course_url && (
            <>
              <dt className={styles.small}>수강 사이트</dt>
              <dd>
                <Button asChild size="sm" variant="outline">
                  <a href={account.course_url} target="_blank" rel="noreferrer">열기 <ArrowUpRight size={14} /></a>
                </Button>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
