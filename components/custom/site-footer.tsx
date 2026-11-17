import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer data-site-footer className="mt-auto shrink-0 border-t border-white/10 bg-[#14231b]">
      <div className="mx-auto flex min-h-24 w-full max-w-[1180px] flex-col items-start justify-center gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3 transition-opacity hover:opacity-70"
          aria-label="CNU 홈"
        >
          <span className="relative size-8 overflow-hidden rounded-lg">
            <Image
              src="/cnu-header-logo.png"
              alt=""
              fill
              sizes="32px"
              className="object-cover"
            />
          </span>
          <span className="font-cnu-body text-lg font-bold text-white">
            CNU
          </span>
        </Link>

        <div className="flex max-w-full flex-col gap-1 text-left text-xs leading-relaxed text-white/65 sm:items-end sm:text-right">
          <a
            href="mailto:admin@cnu.team"
            className="transition-colors hover:text-white"
          >
            admin@cnu.team
          </a>
          <address className="max-w-[520px] not-italic">
              04107 서울시 마포구 백범로 35 (신수동) 서강대학교 리치과학관(R관) 912호
          </address>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p>© {new Date().getFullYear()} CNU. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              <span className="text-white/40">Developed by</span>
              <span className="font-medium text-white/75">
                이서연 · 홍준영
              </span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
