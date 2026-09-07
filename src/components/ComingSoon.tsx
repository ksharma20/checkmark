import type { ReactNode } from 'react';
import { marketing } from '@/locales/en/marketing';

const copy = marketing.comingSoon;

type BulletIcon = (typeof copy.bullets)[number]['icon'];

const BULLET_ICONS: Record<BulletIcon, ReactNode> = {
  pin: <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />,
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  people: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </>
  ),
};

export default function ComingSoon() {
  const { signals, bullets } = copy;

  return (
    <section
      id="coming-soon"
      className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]"
    >
      {/* Eyebrow */}
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        {copy.eyebrow}
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        {copy.headingBefore}
        <em className="font-syne italic text-checkmark-brand">{copy.headingEmphasis}</em>
        {copy.headingAfter}
      </h2>

      <p className="section-desc reveal mb-14 max-w-[600px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        {copy.description}
      </p>

      {/* Main feature card */}
      <div className="reveal relative overflow-hidden rounded-2xl border border-checkmark-border bg-checkmark-bg-card">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute right-0 top-0 h-[400px] w-[600px] bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.07)_0%,transparent_65%)]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[300px] w-[400px] bg-[radial-gradient(ellipse_at_bottom_left,var(--brand-glow)_0%,transparent_65%)]" />

        <div className="relative flex flex-col gap-10 p-8 md:flex-row md:items-start md:p-12">

          {/* ── Left: content ── */}
          <div className="flex-1">
            {/* Coming Soon badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber)_8%,transparent)] px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber" />
              <span className="text-xs font-semibold uppercase tracking-widest text-amber">
                {copy.badge}
              </span>
            </div>

            {/* Icon + title */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.1)]">
                {/* Face-scan SVG */}
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="rgba(167,139,250,1)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 3H5a2 2 0 0 0-2 2v4" />
                  <path d="M15 3h4a2 2 0 0 1 2 2v4" />
                  <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
                  <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
                  <circle cx="9" cy="10" r="1.5" fill="rgba(167,139,250,0.7)" stroke="none" />
                  <circle cx="15" cy="10" r="1.5" fill="rgba(167,139,250,0.7)" stroke="none" />
                  <path d="M9 15.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" />
                </svg>
              </div>
              <h3 className="font-dm-sans text-2xl font-bold text-checkmark-text md:text-3xl">
                {copy.title}
              </h3>
            </div>

            <p className="mb-8 max-w-[520px] text-base leading-relaxed text-checkmark-text-muted">
              {copy.body}
            </p>

            {/* Bullet grid */}
            <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {bullets.map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--checkmark-brand)_20%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_8%,transparent)]">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-checkmark-brand">
                      {BULLET_ICONS[b.icon]}
                    </svg>
                  </div>
                  <div>
                    <p className="mb-0.5 text-sm font-semibold text-checkmark-text">{b.title}</p>
                    <p className="text-xs leading-relaxed text-checkmark-text-muted">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Signal evolution stack */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-checkmark-text-muted">
                {copy.signalStackLabel}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {signals.map((s, i) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span
                      className={[
                        'rounded-full px-3.5 py-1 text-xs font-semibold',
                        s.active
                          ? 'border border-[color-mix(in_srgb,var(--checkmark-brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_12%,transparent)] text-checkmark-brand'
                          : 'border border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.1)] text-[rgba(167,139,250,1)]',
                      ].join(' ')}
                    >
                      {s.label}
                    </span>
                    {i < signals.length - 1 && (
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 text-checkmark-text-muted">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: face scan visual ── */}
          <div aria-hidden="true" className="flex shrink-0 items-center justify-center self-stretch md:w-[220px]">
            <div className="relative flex h-[200px] w-[200px] items-center justify-center">
              {/* Outer pulsing ring */}
              <div className="cs-ping absolute inset-0 animate-[ping_3s_ease-in-out_infinite] rounded-full border border-[rgba(139,92,246,0.2)]" />
              {/* Ring 1 */}
              <div className="absolute inset-3 rounded-full border border-[rgba(139,92,246,0.25)]" />
              {/* Ring 2 */}
              <div className="absolute inset-8 rounded-full border border-[rgba(139,92,246,0.35)]" />
              {/* Face card */}
              <div className="relative flex h-[100px] w-[100px] items-center justify-center rounded-2xl border border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.1)]">
                {/* Corner brackets */}
                <div className="absolute left-1.5 top-1.5 h-3 w-3 border-l-[2px] border-t-[2px] border-[rgba(139,92,246,0.7)] rounded-tl" />
                <div className="absolute right-1.5 top-1.5 h-3 w-3 border-r-[2px] border-t-[2px] border-[rgba(139,92,246,0.7)] rounded-tr" />
                <div className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-[2px] border-l-[2px] border-[rgba(139,92,246,0.7)] rounded-bl" />
                <div className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-[2px] border-r-[2px] border-[rgba(139,92,246,0.7)] rounded-br" />
                {/* Face icon */}
                <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="rgba(167,139,250,0.85)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="5" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </div>
              {/* Scan line */}
              <div className="cs-scanline absolute left-1/2 h-px w-20 -translate-x-1/2 bg-gradient-to-r from-transparent via-[rgba(167,139,250,0.6)] to-transparent" style={{ top: '50%', animation: 'scanline 2.5s ease-in-out infinite' }} />
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="border-t border-checkmark-border px-8 py-4 md:px-12">
          <p className="text-xs leading-relaxed text-checkmark-text-muted">
            <span className="font-semibold text-checkmark-text">{copy.footnoteStrong}</span>
            {copy.footnote}
          </p>
        </div>
      </div>

    </section>
  );
}
