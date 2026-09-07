import Image from 'next/image';
import Link from 'next/link';
import { marketing } from '@/locales/en/marketing';

const copy = marketing.hero;

export default function Hero() {
  return (
    <section className="relative z-10 flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-[120px] text-center md:px-10 md:pb-20 md:pt-[140px]">
      {/* Ambient blobs. These use --brand-glow rather than --ring: --ring is the
          stronger focus-halo token and reads as a hard edge at this size. */}
      <div className="pointer-events-none absolute -left-[10%] top-[5%] h-[500px] w-[500px] animate-float rounded-full bg-gradient-to-r from-checkmark-brand-glow to-transparent" style={{ animationDelay: '0s' }} />
      <div className="pointer-events-none absolute -right-[8%] bottom-[10%] h-[350px] w-[350px] animate-float rounded-full bg-gradient-to-r from-checkmark-brand-glow to-transparent" style={{ animationDelay: '-3s' }} />
      <div className="pointer-events-none absolute left-[60%] top-[40%] h-[200px] w-[200px] animate-float rounded-full bg-gradient-to-r from-checkmark-brand-glow to-transparent" style={{ animationDelay: '-6s' }} />

      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: 'linear-gradient(rgba(27,77,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(27,77,255,0.04) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 0%, transparent 100%)',
        }}
      />

      <p className="mb-8 inline-flex animate-fade-up items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--checkmark-brand)_30%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-checkmark-brand" style={{ animationDelay: '0.1s' }}>
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-checkmark-brand" />
        {copy.badge}
      </p>

      <h1 className="relative z-10 mb-7 animate-fade-up font-dm-sans text-5xl font-black leading-[1.04] tracking-tight text-checkmark-text md:text-7xl" style={{ animationDelay: '0.2s' }}>
        {copy.headingBefore}
        <em className="relative inline-block font-syne italic text-checkmark-brand">
          {copy.headingEmphasis}
          <span aria-hidden="true" className="hero-underline absolute -bottom-1 left-0 right-0 h-0.5 rounded bg-checkmark-brand" />
        </em>
        {copy.headingAfter}
      </h1>

      <p className="mb-12 max-w-[560px] animate-fade-up text-base leading-relaxed text-checkmark-text-muted md:text-xl" style={{ animationDelay: '0.35s' }}>
        {copy.subtitle}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: '0.5s' }} id="hero-cta">
        <Link
          href="/login"
          className="rounded-lg bg-checkmark-brand px-9 py-4 text-base font-bold text-white transition-colors hover:bg-brand-hover"
        >
          {copy.primaryCta}
        </Link>
        <Link
          href="#how"
          className="flex items-center gap-2 rounded-lg border border-checkmark-border px-7 py-4 text-base font-medium text-checkmark-text-muted no-underline transition-colors hover:border-checkmark-brand hover:text-checkmark-brand"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none" />
          </svg>
          {copy.secondaryCta}
        </Link>
      </div>

      <PinScene />

    </section>
  );
}

function PinScene() {
  return (
    <div className="relative mt-14 h-[220px] w-[min(580px,90vw)] animate-fade-up" style={{ animationDelay: '0.6s' }} aria-hidden="true">
      <div className="absolute inset-0 overflow-hidden rounded-[20px] border border-[color-mix(in_srgb,var(--checkmark-brand)_12%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_55%,transparent)] backdrop-blur-lg">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(27,77,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(27,77,255,0.07) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {[
          { left: '18%', top: '30%' },
          { left: '72%', top: '22%' },
          { left: '82%', top: '58%' },
          { left: '25%', top: '65%' },
          { left: '55%', top: '75%' },
        ].map((pos) => (
          <div
            key={`${pos.left}-${pos.top}`}
            className="absolute h-1.5 w-1.5 rounded-full border border-[color-mix(in_srgb,var(--checkmark-brand)_40%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_25%,transparent)]"
            style={pos}
          />
        ))}

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 110 Q150 80 300 110 Q450 140 600 110" stroke="rgba(27,77,255,0.08)" strokeWidth="8" fill="none" />
          <path d="M0 60 Q200 40 400 70 Q500 85 600 60" stroke="rgba(27,77,255,0.05)" strokeWidth="5" fill="none" />
          <path d="M0 170 Q100 155 250 165 Q400 175 600 155" stroke="rgba(27,77,255,0.05)" strokeWidth="5" fill="none" />
          <path d="M180 0 Q200 110 185 220" stroke="rgba(27,77,255,0.06)" strokeWidth="6" fill="none" />
          <path d="M400 0 Q420 110 405 220" stroke="rgba(27,77,255,0.06)" strokeWidth="6" fill="none" />
        </svg>
      </div>

      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 flex-col items-center">
        <div className="hero-anim absolute bottom-[-4px] left-1/2 h-1.5 w-5 rounded-full bg-[rgba(0,0,0,0.35)] blur-sm" style={{ transform: 'translateX(-50%) scaleX(0)', animation: 'shadowLoopSync 2s 1.2s cubic-bezier(0.34,1.56,0.64,1) infinite' }} />
        <div className="hero-anim relative z-10 flex h-20 w-20 items-center justify-center rounded-full" style={{ animation: 'pinDropLoop 2s 1.2s cubic-bezier(0.34,1.56,0.64,1) infinite' }}>
          <Image src="/favicon-logo.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
        </div>

        {[
          { size: 40, delay: '2s' },
          { size: 60, delay: '2.2s' },
          { size: 80, delay: '2.4s' },
        ].map((ring) => (
          <div
            key={ring.size}
            className="hero-anim absolute left-1/2 top-[40px] rounded-full border-[1.5px] border-checkmark-brand"
            style={{
              width: `${ring.size}px`,
              height: `${ring.size}px`,
              transform: 'translate(-50%, -50%)',
              animation: `rippleOut 1.6s ${ring.delay} ease-out infinite`,
            }}
          />
        ))}

        <div className="hero-anim absolute left-[calc(50%+28px)] top-0.5 z-20 flex items-center gap-1 whitespace-nowrap rounded-full bg-checkmark-brand px-2.5 py-1 text-xs font-black text-white" style={{ opacity: 0, animation: 'badgeLoopSync 2s 2.0s cubic-bezier(0.34,1.56,0.64,1) infinite' }}>
          <svg viewBox="0 0 16 16" width="14" height="14"><polyline points="3,8 7,12 13,4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          {marketing.hero.verifiedBadge}
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2.5">
        {marketing.hero.signalTags.map((label, i) => (
          <div
            key={label}
            className="hero-anim flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--checkmark-brand)_25%,transparent)] bg-[color-mix(in_srgb,var(--bg-card)_90%,transparent)] px-3 py-1 text-xs font-semibold text-checkmark-brand backdrop-blur-lg"
            style={{ opacity: 0, animation: `tagLoopSync 2s ${2.05 + i * 0.1}s ease infinite` }}
          >
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
