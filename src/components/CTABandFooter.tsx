'use client';

import Link from 'next/link';

export default function CTABandFooter() {
  return (
    <>
      <div className="relative z-10 mx-6 mt-[80px] mb-[80px] overflow-hidden rounded-[24px] border border-[rgba(27,77,255,0.3)] bg-gradient-to-b from-[#1A2635] via-[#132131] to-[#0D1B2A] px-7 py-12 text-center md:mx-10 md:mb-[100px] md:px-[60px] md:py-[80px]">
        <div className="pointer-events-none absolute left-1/2 top-[-60%] h-[400px] w-[600px] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(ellipse, rgba(27,77,255,0.12) 0%, transparent 70%)' }} />

        <div className="reveal relative z-10">
          <h2 className="mb-4 font-dm-sans text-3xl font-black leading-tight tracking-tight md:text-4xl">
            Stop chasing<br /><em className="font-syne italic text-checkmark-brand">presence data.</em>
          </h2>
          <p className="mb-10 text-base text-checkmark-text-muted md:text-lg">
            From one frustrated engineer's allowance hack to a platform that makes presence tracking invisible.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3.5">
            <Link href="/login" className="rounded-lg bg-checkmark-brand px-9 py-4 text-base font-bold text-white shadow-[0_0_40px_rgba(27,77,255,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[#446CFF]">
              Get Started - It's Free
            </Link>
            <button className="rounded-lg border border-checkmark-border px-7 py-4 text-base font-medium text-checkmark-text transition-all hover:border-checkmark-brand hover:text-checkmark-brand">
              Talk to us
            </button>
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-5 border-t border-checkmark-border px-6 py-10 md:px-[60px]">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="CheckMark" className="h-[66px] w-auto" />
        </div>
        <div className="text-xs text-checkmark-text-muted">Copyright 2026 CheckMark. Presence Intelligence Platform.</div>
        <div className="flex gap-6">
          <a href="#" className="text-xs text-checkmark-text-muted transition-colors hover:text-checkmark-brand">Privacy</a>
          <a href="#" className="text-xs text-checkmark-text-muted transition-colors hover:text-checkmark-brand">Terms</a>
          <a href="#" className="text-xs text-checkmark-text-muted transition-colors hover:text-checkmark-brand">Contact</a>
        </div>
      </footer>
    </>
  );
}
