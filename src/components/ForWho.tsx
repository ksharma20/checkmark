'use client';

type Perspective = {
  label: string;
  title: string;
  description: string;
  points: Array<{ title: string; desc: string }>;
};

export default function ForWho() {
  const perspectives: Perspective[] = [
    {
      label: 'For Individuals',
      title: 'Your work, verified. Always.',
      description: 'Build a permanent, portable record of your professional presence, owned by you.',
      points: [
        { title: 'Personal timeline', desc: 'See every day you showed up, for how long, and where.' },
        { title: 'Dispute protection', desc: 'Verified proof if your allowance or incentive is disputed.' },
        { title: 'Work streaks', desc: 'Track consistency and build sustainable work habits.' },
        { title: 'Portable history', desc: 'Your presence log follows you across employers.' },
        { title: 'Always free', desc: 'Individuals never pay.' },
      ],
    },
    {
      label: 'For Organisations',
      title: 'Clean data. Zero drama.',
      description: 'Stop wasting HR time on manual reconciliation and plug verified data into payroll and compliance.',
      points: [
        { title: 'Automated reports', desc: 'Month-end allowance calculations without manual work.' },
        { title: 'Multi-location support', desc: 'Manage multiple offices and coworking hubs from one dashboard.' },
        { title: 'Field force visibility', desc: 'Real-time location diaries for on-ground agents.' },
        { title: 'Audit-ready logs', desc: 'Every check-in is timestamped and immutable.' },
      ],
    },
  ];

  return (
    <section id="for-who" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        Built for everyone
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        One platform. <em className="font-syne italic text-checkmark-brand">Two perspectives.</em>
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        Whether you are an employee who wants proof of effort or an org that needs verified data, CheckMark works for both sides.
      </p>

      <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
        {perspectives.map((perspective, i) => (
          <div key={perspective.label} className="reveal group relative overflow-hidden rounded-[20px] border border-checkmark-border bg-checkmark-bg-card p-8 transition-all hover:-translate-y-1 hover:border-[rgba(27,77,255,0.4)] hover:shadow-[0_24px_64px_rgba(0,0,0,0.4)] md:p-11" style={{ transitionDelay: `${i * 0.12}s` }}>
            <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(circle at top right, rgba(27,77,255,0.07) 0%, transparent 60%)' }} />

            <div className="relative z-10 mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(27,77,255,0.2)] bg-[rgba(27,77,255,0.1)] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
              {perspective.label}
            </div>

            <h3 className="relative z-10 mb-2.5 text-2xl font-black tracking-tight">{perspective.title}</h3>
            <p className="relative z-10 mb-7 text-sm leading-relaxed text-checkmark-text-muted">{perspective.description}</p>

            <ul className="relative z-10 flex flex-col gap-3.5">
              {perspective.points.map((point) => (
                <li key={point.title} className="flex items-start gap-3 text-sm leading-relaxed text-checkmark-text-muted">
                  <div className="mt-0.5 flex h-5.5 w-5.5 flex-shrink-0 items-center justify-center rounded-md bg-[rgba(27,77,255,0.12)]">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#1B4DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
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
