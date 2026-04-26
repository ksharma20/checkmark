'use client';

type Step = {
  num: string;
  title: string;
  description: string;
  icon: 'location' | 'wifi' | 'check' | 'chart';
};

export default function HowItWorks() {
  const steps: Step[] = [
    {
      num: '01',
      title: "Employee taps \"I'm at office\"",
      description: 'A single tap on the PWA home-screen shortcut. No app store, no login friction. Works on any smartphone.',
      icon: 'location',
    },
    {
      num: '02',
      title: 'Two signals captured silently',
      description: 'GPS coordinates and IP address are captured in the background and cross-validated for accuracy.',
      icon: 'wifi',
    },
    {
      num: '03',
      title: 'Presence verified instantly',
      description: 'Both signals must match the registered office profile. No match, no credit. Tamper-proof by design.',
      icon: 'check',
    },
    {
      num: '04',
      title: 'HR gets clean data automatically',
      description: 'Month-end reports, allowance calculations, and attendance summaries are generated automatically.',
      icon: 'chart',
    },
  ];

  const getIcon = (type: Step['icon']) => {
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
        How it works
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        One tap. Two <em className="font-syne italic text-checkmark-brand">signals</em>. Zero chaos.
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        CheckMark captures verified presence in seconds. Employees tap once, the system does the rest.
      </p>

      <div className="relative mt-4">
        <div className="pointer-events-none absolute left-[12.5%] top-[52px] z-0 hidden h-px w-[75%] bg-gradient-to-r from-transparent via-checkmark-brand to-transparent opacity-20 md:block" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-0">
          {steps.map((step, i) => (
            <div key={step.num} className="reveal relative flex flex-col items-start px-0 md:px-5" style={{ transitionDelay: `${i * 0.05}s` }}>
              {i < steps.length - 1 && (
                <div className="absolute right-0 top-0 hidden h-full w-px bg-gradient-to-b from-[rgba(27,77,255,0.1)] to-transparent md:block" />
              )}

              <div className="relative z-10 mb-7 flex h-9 w-9 items-center justify-center rounded-full bg-checkmark-brand text-xs font-bold text-white shadow-[0_0_0_6px_rgba(27,77,255,0.12),_0_0_0_12px_rgba(27,77,255,0.05)]">
                {step.num}
              </div>

              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(27,77,255,0.22)] bg-[rgba(27,77,255,0.1)]">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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
