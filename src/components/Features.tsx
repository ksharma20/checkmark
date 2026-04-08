'use client';

type Feature = {
  title: string;
  description: string;
  icon: 'grid' | 'map' | 'lock' | 'phone' | 'building' | 'integration';
};

export default function Features() {
  const features: Feature[] = [
    {
      title: 'Hybrid Office Mode',
      description: 'Register your WiFi, GPS, and IP. CheckMark auto-filters presence events to verified office check-ins.',
      icon: 'grid',
    },
    {
      title: 'Field Force Mode',
      description: 'No location pre-registration needed. Every check-in is logged with full location for agents.',
      icon: 'map',
    },
    {
      title: 'Immutable History',
      description: 'Companies cannot delete or alter user check-ins. Seven-year retention keeps a portable proof-of-work record.',
      icon: 'lock',
    },
    {
      title: 'Zero Hardware',
      description: 'No biometric devices. No IT setup. If you have a phone and WiFi, setup is quick.',
      icon: 'phone',
    },
    {
      title: 'Coworking-Ready',
      description: 'Works where biometric systems fail. Multi-location support handles distributed teams.',
      icon: 'building',
    },
    {
      title: 'Payroll and HRMS Integration',
      description: 'Clean presence data feeds payroll, incentives, leave management, and compliance workflows.',
      icon: 'integration',
    },
  ];

  const getIcon = (type: Feature['icon']) => {
    switch (type) {
      case 'grid':
        return <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>;
      case 'map':
        return <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />;
      case 'lock':
        return <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>;
      case 'phone':
        return <><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></>;
      case 'building':
        return <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>;
      case 'integration':
        return <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />;
    }
  };

  return (
    <section id="features" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        Platform features
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        Built for the <em className="font-syne italic text-checkmark-brand">hybrid era</em>
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        One platform, two modes. Same architecture, different use cases.
      </p>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {features.map((feature, i) => (
          <div key={feature.title} className="reveal group relative overflow-hidden rounded-[14px] border border-checkmark-border bg-checkmark-bg-card p-7 transition-all hover:-translate-y-0.5 hover:border-[rgba(27,77,255,0.35)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.35)]" style={{ transitionDelay: `${i * 0.08}s` }}>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-checkmark-brand to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[10px] border border-[rgba(27,77,255,0.2)] bg-[rgba(27,77,255,0.1)]">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
