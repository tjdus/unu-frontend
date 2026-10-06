import { Plus } from "lucide-react";
import { ScrollReveal } from "@/components/custom/scroll-reveal";
import type { HomeFaqItem } from "@/lib/home-faq";

interface HomeFaqProps {
  items: HomeFaqItem[];
}

export function HomeFaq({ items }: HomeFaqProps) {
  if (items.length === 0) return null;

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
