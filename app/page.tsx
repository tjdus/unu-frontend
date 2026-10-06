export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Code2, Rocket, Users } from "lucide-react";
import { formatDate } from "@/lib/utils/date-utils";
import { getClosestRecruitment } from "@/lib/api/recruitment";
import { getPublicNotices } from "@/lib/api/notice";
import { TimedAnchorLink } from "@/components/custom/timed-anchor-link";
import { ScrollReveal } from "@/components/custom/scroll-reveal";
import { HomeHeroScene } from "@/components/custom/home-hero-scene";
import { NewsList } from "@/components/custom/news-list";
import { HomeFaq } from "@/components/custom/home-faq";
import { HOME_FAQ_ITEMS } from "@/lib/home-faq";

const STATS = [
  { value: "240+", label: "누적 학회원" },
  { value: "50+", label: "완성 프로젝트" },
  { value: "60+", label: "진행한 스터디" },
  { value: "2021", label: "시작년도" },
];

const FEATURES = [
  { title: "Study", description: "웹과 시스템 중심 스터디", Icon: Code2 },
  { title: "Team Projects", description: "실전 프로젝트 경험", Icon: Rocket },
  { title: "Community", description: "개발자 네트워크와 협업 문화", Icon: Users },
];

async function NewsSection() {
  const { notices } = await getPublicNotices(4).catch(() => ({ notices: [], total: 0 }));
  return <NewsList notices={notices} />;
}

function NewsSectionSkeleton() {
  return (
    <div className="mx-auto mt-10 w-[90%] max-w-[1045px] overflow-hidden rounded-[26px] bg-white/50 shadow-[0_1px_73px_rgba(0,0,0,0.25)] backdrop-blur-xl">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="min-h-[77px] animate-pulse border-b border-[#d8d8d8] bg-white/40 last:border-b-0 sm:min-h-[89px]"
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
    <div className="font-cnu-body flex flex-col items-center px-5 text-center text-white">
      <div className="flex min-h-[45px] w-fit min-w-[280px] max-w-full items-center justify-center rounded-full border border-[#8b8a8a] px-6 text-sm sm:text-xl">
        {pillText}
      </div>

      <h2 className="font-cnu-body mt-12 text-[40px] leading-[1.06] font-bold sm:text-6xl lg:text-[83px] lg:leading-[86px]">
        {status === "open" && recruitment ? (
          <>
            {recruitment.quarter.name} 
            <br />
            신입 학회원 모집 진행 중
          </>
        ) : (
          <>
            함께할 분들을
            <br />
            기다리고 있어요.
          </>
        )}
      </h2>

      <p className="mt-8 text-base leading-8 sm:text-2xl">{supportingText}</p>

      {buttonDisabled ? (
        <span
          aria-disabled="true"
          className="mt-10 flex h-[45px] w-full max-w-[250px] cursor-not-allowed items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 text-lg font-medium text-white/50 sm:text-2xl"
        >
          {buttonLabel}
        </span>
      ) : (
        <Link
          href="/apply"
          className="mt-10 flex h-[45px] w-full max-w-[250px] items-center justify-center rounded-full bg-white px-6 text-lg font-medium text-black transition-colors hover:bg-[#264638] hover:text-white sm:text-2xl"
        >
          {buttonLabel}
        </Link>
      )}
    </div>
  );
}

function RecruitmentCTASkeleton() {
  return (
    <div className="mx-auto h-[45px] w-full max-w-[585px] animate-pulse rounded-full bg-white/10" />
  );
}

export default function Home() {
  return (
    <div
      id="home-top"
      className="font-cnu-body overflow-x-hidden bg-white text-black"
    >
      <section className="border-b border-[#dddddd]">
        <div
          data-home-hero
          className="relative min-h-[calc(100svh-4rem)] select-none overflow-hidden bg-[#14231b]"
        >
          <HomeHeroScene />

          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[1219px] items-center justify-center px-5 py-10 text-center text-white sm:px-8 sm:py-12 2xl:max-w-[1236px] 2xl:px-0">
            <div className="flex w-full flex-col items-center">
              <p
                data-hero-anchor
                className="font-cnu-body text-sm font-semibold text-[#b4e2c9] [text-shadow:0_2px_12px_rgba(0,0,0,0.72)] sm:text-2xl"
              >
                WEB DEVELOPMENT &amp; SOFTWARE SYSTEM COMMUNITY
              </p>
              <h1 className="font-cnu-body mt-2 text-7xl leading-none font-bold tracking-[0.45px] [text-shadow:0_3px_22px_rgba(0,0,0,0.82)] sm:text-8xl lg:text-[140px] lg:leading-none">
                CNU
              </h1>
              <p className="mt-3 max-w-[760px] text-base leading-7 font-medium text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.88)] sm:text-2xl sm:leading-9">
                <span className="font-semibold text-[#c1efd3]">웹과 시스템</span>을 중심으로 함께
                성장하는 서강대학교 컴퓨터공학과{" "}
                <span className="whitespace-nowrap">학회</span>
              </p>
              <TimedAnchorLink
                targetId="recruit"
                duration={900}
                className="mt-7 flex h-[45px] w-[180px] items-center justify-center rounded-full border border-[#c9c9c9] bg-white text-lg font-medium text-black shadow-[0_10px_34px_rgba(0,0,0,0.3)] transition-colors hover:border-[#264638] hover:bg-[#264638] hover:text-white sm:text-2xl"
              >
                지원 안내
              </TimedAnchorLink>

              <div className="mt-12 grid w-full max-w-[860px] grid-cols-2 gap-y-10 sm:mt-14 sm:grid-cols-4">
                {STATS.map((stat, index) => (
                  <div
                    key={stat.label}
                    className="hero-stat-reveal group min-h-[66px] min-w-0 sm:min-h-[100px]"
                    style={{ animationDelay: `${360 + index * 120}ms` }}
                  >
                    <div className="hero-stat-float relative mx-auto w-fit transition-transform duration-300 ease-out group-hover:-translate-y-1.5">
                      <p className="text-4xl leading-none font-medium [text-shadow:0_3px_16px_rgba(0,0,0,0.78)] sm:text-[50px] lg:text-[58px]">
                        {stat.value}
                      </p>
                      <p className="absolute top-full left-0 mt-4 whitespace-nowrap text-sm font-medium [text-shadow:0_2px_10px_rgba(0,0,0,0.8)] sm:text-xl">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[1219px] px-5 sm:px-8">
          <div className="pt-20 text-center">
            <ScrollReveal>
              <h2 className="font-cnu-body text-4xl font-bold text-[#020618] sm:text-5xl lg:text-[54px] lg:leading-[65px]">
                CNU는 어떤 곳인가요?
              </h2>
              <p className="mx-auto mt-7 max-w-[810px] text-base leading-relaxed text-[#62748e] sm:text-2xl sm:leading-[1.4]">
                CNU는 웹 개발과 소프트웨어 시스템 기술을 중심으로 활동하는 학회입니다.
                <br className="hidden sm:block" /> 스터디와 프로젝트를 통해 실전 역량을
                키우고, 함께 협업하며 성장하는 경험을 제공합니다.
              </p>
            </ScrollReveal>

            <div className="mx-auto mt-16 grid max-w-[922px] gap-6 text-left md:grid-cols-3">
              {FEATURES.map(({ title, description, Icon }, index) => (
                <ScrollReveal
                  key={title}
                  delay={index * 100}
                  className="h-full"
                >
                  <div className="flex min-h-[177px] h-full flex-col justify-end rounded-[13px] border border-slate-200/50 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-[9px] bg-[#0f172b]/10">
                      <Icon className="size-6 text-[#020618]" />
                    </div>
                    <h3 className="text-xl font-bold text-[#020618]">{title}</h3>
                    <p className="mt-2 text-base text-[#62748e]">{description}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>

            <ScrollReveal delay={120} className="mt-12">
              <Link
                href="/about"
                className="mx-auto inline-flex h-12 items-center justify-center gap-3 rounded-full bg-white px-6 text-base font-semibold text-[#14231b] transition-colors hover:text-[#40795B] sm:text-lg"
              >
                더 알아보기
                <ArrowRight className="size-5" />
              </Link>
            </ScrollReveal>
          </div>

          <div className="pt-28 pb-24 sm:pt-36 sm:pb-[119px]">
            <ScrollReveal>
              <h2 className="mx-auto w-[90%] max-w-[1045px] text-4xl font-semibold sm:text-5xl">
                학회 소식
              </h2>
              <Suspense fallback={<NewsSectionSkeleton />}>
                <NewsSection />
              </Suspense>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <section
        id="recruit"
        className="flex min-h-[585px] scroll-mt-16 items-center justify-center bg-[#14231b] py-20 sm:min-h-[720px]"
      >
        <ScrollReveal className="w-full">
          <Suspense fallback={<RecruitmentCTASkeleton />}>
            <RecruitmentCTA />
          </Suspense>
        </ScrollReveal>
      </section>

      <Link
        href="/portfolio"
        className="group relative block h-[270px] overflow-hidden border-b border-[#e5e5e5] bg-white/30 transition-colors duration-300 hover:bg-[#14231b] sm:h-[450px]"
      >
        <ScrollReveal className="relative mx-auto h-full w-full max-w-[1062px] px-5">
          <div className="absolute top-1/2 left-5 -translate-y-1/2 sm:left-0">
            <h2 className="font-cnu-display text-4xl font-bold tracking-[-0.45px] transition-colors group-hover:text-white sm:text-[61px] sm:leading-[54px]">
              지금까지의 활동
            </h2>
            <p className="mt-4 text-base font-bold transition-colors group-hover:text-white sm:text-2xl">
              CNU가 만들어온 활동을 소개합니다.
            </p>
          </div>
          <ArrowRight className="absolute top-1/2 right-5 size-8 -translate-y-1/2 text-[#2d9c64] transition-colors group-hover:text-white sm:right-0 sm:size-10" />
          <span className="font-cnu-display absolute right-5 bottom-5 text-[65px] leading-none font-bold tracking-[-0.45px] text-[#e0e0e0] transition-colors group-hover:text-white sm:right-0 sm:bottom-4 sm:text-[162px]">
            portfolio
          </span>
        </ScrollReveal>
      </Link>

      <Link
        href="/blog"
        className="group relative block h-[270px] overflow-hidden border-b border-[#e5e5e5] bg-white/30 transition-colors duration-300 hover:bg-[#14231b] sm:h-[450px]"
      >
        <ScrollReveal className="relative mx-auto h-full w-full max-w-[1062px] px-5">
          <div className="absolute top-1/2 left-5 -translate-y-1/2 sm:left-0">
            <h2 className="font-cnu-display text-4xl font-bold tracking-[-0.45px] transition-colors group-hover:text-white sm:text-[61px] sm:leading-[54px]">
              남겨온 이야기
            </h2>
            <p className="mt-4 text-base font-bold transition-colors group-hover:text-white sm:text-2xl">
              기술과 경험, 그리고 생각을 나눕니다.
            </p>
          </div>
          <ArrowRight className="absolute top-1/2 right-5 size-8 -translate-y-1/2 text-[#2d9c64] transition-colors group-hover:text-white sm:right-0 sm:size-10" />
          <span className="font-cnu-display absolute right-5 bottom-5 text-[79px] leading-none font-bold tracking-[-0.45px] text-[#e0e0e0] transition-colors group-hover:text-white sm:right-0 sm:bottom-4 sm:text-[162px]">
            blog
          </span>
        </ScrollReveal>
      </Link>

      <HomeFaq items={HOME_FAQ_ITEMS} />

      <section
        id="contact"
        className="scroll-mt-16 px-5 pt-16 pb-12 sm:px-8 sm:pt-[53px] sm:pb-16"
      >
        <div className="mx-auto w-full max-w-[1062px]">
          <ScrollReveal>
            <h2 className="font-cnu-display text-6xl leading-none font-bold tracking-[0.45px] text-[#020618] sm:text-[79px] sm:leading-[86px]">
              Contact
            </h2>
            <p className="mt-8 text-base font-medium leading-8 text-[#0b0c0c] sm:text-2xl">
              CNU의 모든 공식 문의는 이메일을 통해 받고 있습니다.
              <br />
              활동, 모집, 프로젝트, 협업과 관련해 궁금한 점이 있다면
              admin@cnu.team으로 전달해 주세요.
            </p>
            <a
              href="mailto:admin@cnu.team"
              className="mt-10 flex h-[59px] w-[234px] items-center justify-center rounded-full border border-black bg-white text-lg font-medium transition-colors hover:bg-[#1f3f2e] hover:text-white sm:w-[286px] sm:text-2xl"
            >
              메일로 문의하기
            </a>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h3 className="mt-11 text-3xl font-bold">랩실 위치</h3>
            <p className="mt-5 text-base font-medium leading-8 sm:text-2xl">
              CNU의 랩실 R912는 서강대학교 리치과학관 9층에 위치하고 있습니다.
            </p>
            <br></br>
            <div className="relative mx-auto mt-5 aspect-[885/679] w-full max-w-[797px] overflow-hidden">
              <Image
                src="/map.png"
                alt="CNU 랩실 위치 지도"
                fill
                sizes="(max-width: 900px) 100vw, 797px"
                className="object-cover"
              />
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
