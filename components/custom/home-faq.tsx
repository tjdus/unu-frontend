import { Plus } from "lucide-react";
import type { CSSProperties } from "react";
import { ScrollReveal } from "@/components/custom/scroll-reveal";
import { HomeFaqSpread } from "@/components/custom/home-faq-spread";
import faqSpreadStyles from "@/components/custom/home-faq-spread.module.css";
import type { HomeFaqItem } from "@/lib/home-faq";

interface HomeFaqProps {
  items: HomeFaqItem[];
  /** "deep": accordion with animated dividers for the deep-green home. */
  variant?: "default" | "deep";
}

const graphemes = new Intl.Segmenter("ko");

function FaqAnswer({ answer }: { answer: string }) {
  let letterIndex = 0;

  return (
    <p className="whitespace-pre-line break-keep pb-7 pr-14 text-lg leading-[1.7] font-light text-[var(--deep-on-variant)] [overflow-wrap:anywhere] sm:pr-[200px] sm:text-xl">
      <span className={faqSpreadStyles.answerText}>{answer}</span>
      <span className={faqSpreadStyles.answerMotion} aria-hidden="true">
        {answer.split(/(\s+)/).map((word, wordIndex) =>
          !word || /^\s+$/.test(word) ? word : (
            <span key={wordIndex} className={faqSpreadStyles.answerWord}>
              {Array.from(graphemes.segment(word), ({ segment, index }) => (
                <span
                  key={index}
                  className={faqSpreadStyles.answerLetter}
                  style={{
                    "--letter-delay": `${540 * (1 - Math.exp(-letterIndex++ / 17))}ms`,
                  } as CSSProperties}
                >
                  {segment}
                </span>
              ))}
            </span>
          ),
        )}
      </span>
    </p>
  );
}

function DeepFaq({ items }: { items: HomeFaqItem[] }) {
  return (
    <section aria-labelledby="home-faq-heading">
      <ScrollReveal>
        <h2
          id="home-faq-heading"
          className="text-[clamp(64px,9vw,120px)] leading-[0.9] font-light tracking-[0.02em] uppercase"
        >
          FAQ
        </h2>
      </ScrollReveal>

      <HomeFaqSpread className="mt-10">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={faqSpreadStyles.row}
            // distance from the middle row: the entrance spreads outward from there
            style={{ "--d": Math.abs(index - (items.length - 1) / 2) } as CSSProperties}
          >
            <details name="home-faq" open={index === 0} className="group">
              <summary className={`${faqSpreadStyles.reveal} grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_40px] items-center gap-4 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--deep-accent)] focus-visible:ring-inset sm:gap-6 [&::-webkit-details-marker]:hidden`}>
                <span className="min-w-0 break-keep text-xl leading-[1.3] font-light transition-colors group-open:text-[var(--deep-accent)] group-hover:text-[var(--deep-accent)] sm:text-[26px]">
                  {item.question}
                </span>
                <span className="grid size-10 place-items-center">
                  <Plus
                    aria-hidden="true"
                    className="size-6 transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
                  />
                </span>
              </summary>
              <FaqAnswer answer={item.answer} />
            </details>
            <span aria-hidden="true" className={faqSpreadStyles.rule} />
          </div>
        ))}
      </HomeFaqSpread>
    </section>
  );
}

export function HomeFaq({ items, variant = "default" }: HomeFaqProps) {
  if (items.length === 0) return null;
  if (variant === "deep") return <DeepFaq items={items} />;

  return (
    <section
      aria-labelledby="home-faq-heading"
      className="border-b border-[#e5e5e5] bg-white px-5 py-20 sm:px-8 sm:py-28"
    >
      <ScrollReveal className="mx-auto w-full max-w-[1000px]">
        <div className="text-center">
          <h2
            id="home-faq-heading"
            className="font-cnu-display text-6xl leading-none font-bold text-[#14231b] sm:text-[79px] sm:leading-[86px]"
          >
            FAQ
          </h2>
          <p className="mt-6 text-xl font-semibold text-[#14231b] sm:text-3xl">
            자주 묻는 질문
          </p>
          <p className="mt-4 text-base leading-7 text-[#14231b]/60 sm:text-xl sm:leading-8">
            CNU에 대해 궁금한 점을 모았어요.
          </p>
        </div>

        <div className="mt-12 min-w-0 border-t border-[#14231b]/25 sm:mt-16">
          {items.map((item) => (
            <details
              key={item.id}
              name="home-faq"
              className="group border-b border-[#14231b]/15"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-6 text-left transition-colors hover:text-[#40795b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#40795b]/50 focus-visible:ring-inset group-open:text-[#40795b] sm:gap-8 sm:py-8 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 break-keep text-lg leading-8 font-semibold sm:text-2xl sm:leading-9">
                  {item.question}
                </span>
                <Plus
                  aria-hidden="true"
                  className="size-6 shrink-0 text-[#40795b] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none sm:size-7"
                />
              </summary>
              <p className="whitespace-pre-line break-keep pb-7 pr-11 text-base leading-8 text-[#14231b]/70 [overflow-wrap:anywhere] sm:pb-9 sm:pr-16 sm:text-xl sm:leading-9">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </ScrollReveal>
    </section>
  );
}
