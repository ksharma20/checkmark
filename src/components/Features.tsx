import { marketing } from '@/locales/en/marketing';

const copy = marketing.features;

type FeatureIcon = (typeof copy.items)[number]['icon'];

export default function Features() {
  const features = copy.items;

  const getIcon = (type: FeatureIcon) => {
    /* Lucide geometry, all on the 24px grid at 1.75 stroke - the glyph has to
       read as one family across the six cards, and a mixed stroke weight is the
       first thing that gives an icon set away. `building` used to draw Lucide's
       USERS glyph: two people standing in for an office. */
    switch (type) {
      case 'lock':
        return <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>;
      case 'shield':
        return <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>;
      case 'code':
        return <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>;
      case 'building':
        return <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M8.5 6h.01M15.5 6h.01M8.5 10h.01M15.5 10h.01M8.5 14h.01M15.5 14h.01" /></>;
      case 'map':
        return <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />;
      case 'integration':
        return <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />;
    }
  };

  return (
    <section id="features" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
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

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {features.map((feature, i) => (
          <div key={feature.title} className="reveal group relative overflow-hidden rounded-[14px] border border-checkmark-border bg-checkmark-bg-card p-7 transition-colors hover:border-[color-mix(in_srgb,var(--checkmark-brand)_35%,transparent)]" style={{ transitionDelay: `${i * 0.08}s` }}>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-checkmark-brand to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--checkmark-brand)_20%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)] text-checkmark-brand-on-dark">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {getIcon(feature.icon)}
              </svg>
            </div>

            <h3 className="mb-2 text-base font-bold text-checkmark-text">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-checkmark-text-muted">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
