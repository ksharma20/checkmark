import { marketing } from '@/locales/en/marketing';

const copy = marketing.forWho;

export default function ForWho() {
  const perspectives = copy.perspectives;

  return (
    <section id="for-who" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand-on-dark">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        {copy.eyebrow}
      </div>

      <h2 className="section-title reveal mb-5 font-heading text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
        {copy.headingBefore}
        <em className="font-heading not-italic text-checkmark-brand-on-dark">{copy.headingEmphasis}</em>
        {copy.headingAfter}
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        {copy.description}
      </p>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
        {perspectives.map((perspective, i) => (
          <div key={perspective.label} className="reveal group relative overflow-hidden rounded-[20px] border border-checkmark-border bg-checkmark-bg-card p-8 transition-colors hover:border-[color-mix(in_srgb,var(--checkmark-brand)_40%,transparent)] md:p-11" style={{ transitionDelay: `${i * 0.12}s` }}>
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at top right, rgba(27,77,255,0.07) 0%, transparent 60%)' }} />

            <p className="relative z-10 mb-5 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--checkmark-brand)_20%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand-on-dark">
              {perspective.label}
            </p>

            <h3 className="relative z-10 mb-2.5 font-heading text-2xl font-extrabold tracking-tight">{perspective.title}</h3>
            <p className="relative z-10 mb-7 text-sm leading-relaxed text-checkmark-text-muted">{perspective.description}</p>

            <ul className="relative z-10 flex flex-col gap-3.5">
              {perspective.points.map((point) => (
                <li key={point.title} className="flex items-start gap-3 text-sm leading-relaxed text-checkmark-text-muted">
                  <div className="mt-0.5 flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--checkmark-brand)_12%,transparent)] text-checkmark-brand-on-dark">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div><strong className="font-semibold text-checkmark-text">{point.title}</strong> - {point.desc}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
