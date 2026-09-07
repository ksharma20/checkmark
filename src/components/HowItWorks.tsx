import { marketing } from '@/locales/en/marketing';

const copy = marketing.howItWorks;

type StepIcon = (typeof copy.steps)[number]['icon'];

export default function HowItWorks() {
  const steps = copy.steps;

  const getIcon = (type: StepIcon) => {
    switch (type) {
      case 'location':
        return <><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></>;
      case 'wifi':
        return <><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /></>;
      case 'check':
        return <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>;
      case 'chart':
        return <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></>;
    }
  };

  return (
    <section id="how" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        {copy.eyebrow}
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        {copy.headingBefore}
        <em className="font-syne italic text-checkmark-brand">{copy.headingEmphasis}</em>
        {copy.headingAfter}
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        {copy.description}
      </p>

      <div className="relative mt-4">
        <div className="pointer-events-none absolute left-[12.5%] top-[52px] z-0 hidden h-px w-[75%] bg-gradient-to-r from-transparent via-checkmark-brand to-transparent opacity-20 md:block" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-0">
          {steps.map((step, i) => (
            <div key={step.num} className="reveal relative flex flex-col items-start px-0 md:px-5" style={{ transitionDelay: `${i * 0.05}s` }}>
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-0 hidden h-full w-px bg-gradient-to-b from-checkmark-brand-glow to-transparent md:block" />
              )}

              <div className="relative z-10 mb-7 flex h-9 w-9 items-center justify-center rounded-full bg-checkmark-brand text-xs font-bold text-white ring-[6px] ring-checkmark-brand-glow">
                {step.num}
              </div>

              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--checkmark-brand)_22%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)] text-checkmark-brand">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {getIcon(step.icon)}
                </svg>
              </div>

              <h3 className="mb-2.5 text-base font-bold leading-tight text-checkmark-text">{step.title}</h3>
              <p className="text-sm leading-relaxed text-checkmark-text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
