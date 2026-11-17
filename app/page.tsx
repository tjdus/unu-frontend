export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowDown, ArrowRight, Mail } from "lucide-react";
import { formatDate } from "@/lib/utils/date-utils";
import { getClosestRecruitment } from "@/lib/api/recruitment";
import { getPublicNotices } from "@/lib/api/notice";
import { TimedAnchorLink } from "@/components/custom/timed-anchor-link";
import { ScrollReveal } from "@/components/custom/scroll-reveal";
import { HomeEntrance } from "@/components/custom/home-entrance";
import entranceStyles from "@/components/custom/home-entrance.module.css";
import { HomeHeroScene } from "@/components/custom/home-hero-scene";
import { HomeAbout } from "@/components/custom/home-about";
import { HomeRulerHover } from "@/components/custom/home-ruler-hover";
import { HomeAccountLink } from "@/components/custom/home-account-link";
import { HomeHeroTitle } from "@/components/custom/home-hero-title";
import { HomeHeroSubtitle } from "@/components/custom/home-hero-subtitle";
import { HomeEthos } from "@/components/custom/home-ethos";
import { HomeDrawFrame } from "@/components/custom/home-draw-frame";
import { HomeWorks } from "@/components/custom/home-works";
import { HomeScrollDivider } from "@/components/custom/home-scroll-divider";
import { NewsList } from "@/components/custom/news-list";
import { HomeFaq } from "@/components/custom/home-faq";
import { HomeContactArrival } from "@/components/custom/home-contact-arrival";
import { PublicNavLinks } from "@/components/custom/public-nav-links";
import styles from "@/components/custom/home-deep.module.css";
import { HOME_FAQ_ITEMS } from "@/lib/home-faq";

const STATS = [
  { value: "2021", label: "시작년도" },
  { value: "60+", label: "진행한 스터디" },
  { value: "50+", label: "완성 프로젝트" },
  { value: "240+", label: "누적 학회원" },
];


async function NewsSection() {
  const { notices } = await getPublicNotices(4).catch(() => ({ notices: [], total: 0 }));
  return <NewsList notices={notices} variant="deep" />;
}

function NewsSectionSkeleton() {
  return (
    <div className="border-t border-dashed border-[var(--deep-outline)]">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-[92px] animate-pulse border-b border-dashed border-[var(--deep-outline)] bg-[var(--deep-on)]/5"
        />
      ))}
    </div>
  );
}

const SERVICE_TIME_ZONE = "Asia/Seoul";

function parseSeoulLocalDateTime(value: string): Date {
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasOffset ? value : `${value}+09:00`);
}
function seoulCalendarDayUtcMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SERVICE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return Date.UTC(year, month - 1, day);
}

function calculateDDay(endDate: string): number {
  const endMs = seoulCalendarDayUtcMs(parseSeoulLocalDateTime(endDate));
  const todayMs = seoulCalendarDayUtcMs(new Date());
  return Math.round((endMs - todayMs) / 86_400_000);
}

function formatDDayLabel(dDay: number): string {
  return dDay <= 0 ? "오늘 마감" : `D-${dDay}`;
}

type RecruitmentCTAStatus = "none" | "upcoming" | "open";

async function RecruitmentCTA() {
  const recruitment = await getClosestRecruitment().catch(() => null);

  // now는 실제 instant 그대로. 문제는 now가 아니라 offset 없는 백엔드 값의 해석이므로,
  // startAt/endAt만 Asia/Seoul instant로 명시 변환해 instant끼리 비교한다.
  const now = new Date();
  const startAt = recruitment
    ? parseSeoulLocalDateTime(recruitment.startAt)
    : null;
  const endAt = recruitment
    ? parseSeoulLocalDateTime(recruitment.endAt)
    : null;

  const status: RecruitmentCTAStatus =
    !recruitment ||
    !startAt ||
    !endAt ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    now > endAt
      ? "none"
      : now < startAt
        ? "upcoming"
        : "open";

  const pillText =
    status === "open" && recruitment
      ? `현재 모집 중 · 모집 마감 ${formatDDayLabel(calculateDDay(recruitment.endAt))}`
      : status === "upcoming" && recruitment
        ? `${recruitment.quarter.name} 분기 모집이 ${formatDate(recruitment.startAt)}에 시작됩니다.`
        : "지금은 모집 기간이 아니에요.";

  const supportingText =
    status === "open" && recruitment ? (
      <>
        지원 기간 - {formatDate(recruitment.startAt)}부터 {formatDate(recruitment.endAt)}까지{" "}
      </>
    ) : status === "upcoming" && recruitment ? (
      <>
        아직은 지원 기간이 아니에요.
      </>
    ) : (
      "다음 모집을 준비 중이에요."
    );

  const buttonLabel = "지원하러 가기";
  const buttonDisabled = status !== "open";
  return (
    <div className={styles.recruit}>
      <span className={styles.chip}>{pillText}</span>
      <h2 className={styles.recruitTitle}>
        Join
        <br />
        CNU
      </h2>
      <p className={styles.recruitText}>
        {status === "open" && recruitment ? (
          <>
            {recruitment.quarter.name} 신입 학회원 모집 진행 중 · {supportingText}
          </>
        ) : (
          supportingText
        )}
      </p>
      {buttonDisabled ? (
        <span aria-disabled="true" className={styles.disabledButton}>
          {buttonLabel}
        </span>
      ) : (
        <Link href="/apply" className={styles.filledButton}>
          <ArrowRight className="size-5" aria-hidden="true" />
          {buttonLabel}
        </Link>
      )}
    </div>
  );
}

function RecruitmentCTASkeleton() {
  return (
    <div className="mx-auto h-[45px] w-full max-w-[585px] animate-pulse rounded-full bg-[var(--deep-on)]/10" />
  );
}

export default function Home() {
  return (
    <div
      id="home-top"
      className={`${entranceStyles.home} ${styles.page} font-cnu-body overflow-x-clip`}
    >
      <HomeEntrance />

      <section data-home-hero className={styles.hero}>
        <HomeHeroScene />

        <div className={styles.heroInner}>
          <HomeAccountLink className={styles.heroLogin} />

          <PublicNavLinks variant="home" />

          <div className={styles.stats}>
            {STATS.map((stat, index) => (
              <div
                key={stat.label}
                data-hero-landing={index < 2 ? "" : undefined}
                className={`hero-stat-reveal ${styles.stat}`}
                style={{
                  animationDelay: `calc(var(--home-entrance-delay, 0ms) + ${360 + index * 120}ms)`,
                }}
              >
                <p className={`${styles.statValue} font-cnu-numeric`}>{stat.value}</p>
                <p className={styles.statLabel}>{stat.label}</p>
              </div>
            ))}
            <span aria-hidden="true" data-hero-floor className={styles.ruler}>
              <HomeRulerHover className={styles.rulerHover} />
            </span>
          </div>

          <div className={styles.heroBottom}>
            <div className={styles.heroTitle}>
              <h1>
                <span
                  data-hero-anchor
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-10 top-1/2 text-sm sm:-left-14 sm:text-2xl"
                />
                <HomeHeroTitle text="CNU" />
              </h1>
            </div>
            <div className={styles.heroAside}>
              <TimedAnchorLink
                targetId="recruit"
                duration={900}
                updateHash={false}
                className={styles.applyLink}
              >
                지원 안내
                <ArrowDown className="size-4" aria-hidden="true" />
              </TimedAnchorLink>
              <HomeHeroSubtitle
                className={styles.heroSubtitle}
                text="Web Development & Software System Community at Sogang University"
              />
            </div>
          </div>
        </div>
      </section>

      <HomeScrollDivider />

      <HomeEthos className={`${styles.container} ${styles.section}`} />

      <HomeScrollDivider />

      <div className={`${styles.container} ${styles.section}`}>
        <HomeAbout />
      </div>

      <HomeScrollDivider />

      <section
        aria-labelledby="home-news-heading"
        className={`${styles.container} ${styles.section}`}
      >
        <ScrollReveal className={styles.sectionHead}>
          <h2 id="home-news-heading" className={styles.sectionTitle}>
            News
          </h2>
        </ScrollReveal>
        <ScrollReveal className="mt-10">
          <Suspense fallback={<NewsSectionSkeleton />}>
            <NewsSection />
          </Suspense>
        </ScrollReveal>
      </section>

      <HomeScrollDivider />

      <HomeWorks className={`${styles.container} ${styles.section}`} />

      <HomeScrollDivider />

      <div className={`${styles.container} ${styles.section}`}>
        <HomeFaq items={HOME_FAQ_ITEMS} variant="deep" />
      </div>

      <HomeScrollDivider />

      <section id="recruit" className={`${styles.container} scroll-mt-16 py-10 sm:py-14`}>
        <HomeDrawFrame>
          <ScrollReveal>
            <Suspense fallback={<RecruitmentCTASkeleton />}>
              <RecruitmentCTA />
            </Suspense>
          </ScrollReveal>
        </HomeDrawFrame>
      </section>

      <HomeScrollDivider />

      <section
        id="contact"
        aria-labelledby="home-contact-heading"
        className={`${styles.container} ${styles.contactLayout} scroll-mt-16 pt-16 pb-10`}
      >
        <HomeContactArrival />
        <div className={styles.contactInfo}>
          <h2 id="home-contact-heading" className={styles.contactTitle}>
            Contact
          </h2>
          <a href="mailto:admin@cnu.team" className={styles.contactEmail}>
            admin@cnu.team
          </a>
          <p className={styles.contactText}>서강대학교 리치과학관 9층 R912</p>
          <p className={styles.contactText}>
            활동, 모집, 프로젝트, 협업 문의는 이메일 부탁드립니다.<br></br>웹사이트 제작 문의 환영합니다.
          </p>
          <a href="mailto:admin@cnu.team" className={styles.outlinedButton}>
            <Mail className="size-5" aria-hidden="true" />
            메일로 문의하기
          </a>
        </div>
        <div className={styles.map}>
          <Image
            src="/map.png"
            alt="CNU 랩실 위치 지도 — 서강대학교 리치과학관 9층 R912"
            fill
            sizes="(max-width: 1100px) 100vw, 820px"
            className="object-cover"
          />
        </div>
      </section>
    </div>
  );
}
