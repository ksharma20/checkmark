'use client';

import { useState } from 'react';

type Industry = {
  eyebrow: string;
  num: string;
  title: string;
  description: string;
  metrics: Array<{ value: string; label: string }>;
};

export default function Industries() {
  const [activeTab, setActiveTab] = useState(0);

  const industries: Industry[] = [
    {
      eyebrow: 'Hybrid offices',
      num: '01',
      title: 'IT and SaaS',
      description: 'Track hybrid attendance across offices and coworking hubs. CheckMark auto-reconciles allowance data directly into payroll.',
      metrics: [
        { value: '~5 hrs', label: 'HR time saved / month' },
        { value: '4+', label: 'locations supported' },
        { value: '<10 min', label: 'setup time' },
      ],
    },
    {
      eyebrow: 'Field force',
      num: '02',
      title: 'Pharma and Healthcare',
      description: 'Verified location diaries for field reps visiting clinics, hospitals, and stockists.',
      metrics: [
        { value: '0', label: 'disputes after go-live' },
        { value: '100%', label: 'tamper-proof logs' },
        { value: 'Any', label: 'clinic / hospital' },
      ],
    },
    {
      eyebrow: 'Compliance-ready',
      num: '03',
      title: 'BFSI and Insurance',
      description: 'Timestamped and immutable attendance logs that are always audit-accessible.',
      metrics: [
        { value: '7 yrs', label: 'log retention' },
        { value: 'Instant', label: 'audit export' },
        { value: '0', label: 'hardware required' },
      ],
    },
    {
      eyebrow: 'Multi-location',
      num: '04',
      title: 'Retail and FMCG',
      description: 'Real-time visibility into field agent activity across hundreds of distributor and retail points.',
      metrics: [
        { value: '500+', label: 'locations supported' },
        { value: 'Real-time', label: 'field visibility' },
        { value: 'Rs0', label: 'hardware cost' },
      ],
    },
    {
      eyebrow: 'Zero hardware',
      num: '05',
      title: 'Logistics and Supply Chain',
      description: 'Verified presence at warehouses, docks, and delivery hubs with existing WiFi and one tap.',
      metrics: [
        { value: 'Any', label: 'warehouse / hub' },
        { value: '3-signal', label: 'verification' },
        { value: '1 tap', label: 'per check-in' },
      ],
    },
    {
      eyebrow: 'Campus-ready',
      num: '06',
      title: 'Education and EdTech',
      description: 'Faculty and staff presence verification across campuses and centers using existing network infrastructure.',
      metrics: [
        { value: 'Any', label: 'campus / centre' },
        { value: 'Existing', label: 'WiFi only' },
        { value: 'PWA', label: 'no app store needed' },
      ],
    },
  ];

  return (
    <section id="industries" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        Industries
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        Built for how <em className="font-syne italic text-checkmark-brand">India works</em>
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        From pharma field reps to IT hybrid teams, CheckMark fits the way your industry actually operates.
      </p>

      <div className="reveal grid min-h-[420px] grid-cols-1 overflow-hidden rounded-[20px] border border-[rgba(27,77,255,0.14)] bg-checkmark-bg-card md:grid-cols-[280px_1fr]">
        <div className="flex flex-col border-r border-[rgba(27,77,255,0.1)] bg-[rgba(13,27,42,0.6)]">
          {industries.map((ind, i) => (
            <button key={ind.num} onClick={() => setActiveTab(i)} className={`relative flex items-center gap-3 border-b border-[rgba(27,77,255,0.07)] px-5 py-4 text-left transition-all ${activeTab === i ? 'bg-[rgba(27,77,255,0.07)]' : 'hover:bg-[rgba(27,77,255,0.04)]'}`}>
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-r" style={{ background: 'var(--checkmark-brand)', transform: activeTab === i ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'center', transition: 'transform 0.25s ease' }} />
              <span className={`text-[11px] font-bold tracking-[0.1em] text-checkmark-brand ${activeTab === i ? 'opacity-100' : 'opacity-50'}`}>{ind.num}</span>
              <span className={`flex-1 text-[13px] font-semibold ${activeTab === i ? 'text-checkmark-text' : 'text-checkmark-text-muted'}`}>{ind.title}</span>
              <span className={`text-checkmark-brand transition-all ${activeTab === i ? 'translate-x-0 opacity-100' : '-translate-x-1.5 opacity-0'}`}>→</span>
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden bg-checkmark-bg-card2 px-7 py-10 md:px-12 md:py-12">
          <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[360px] w-[360px]" style={{ background: 'radial-gradient(circle, rgba(27,77,255,0.08) 0%, transparent 65%)' }} />

          <div className="animate-ind-fade-in relative">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-checkmark-brand">
              <span className="h-0.5 w-5 rounded bg-checkmark-brand" />
              {industries[activeTab].eyebrow}
            </div>

            <div className="mb-4 font-syne text-7xl font-black italic leading-none tracking-tight text-[rgba(27,77,255,0.07)]">
              {industries[activeTab].num}
            </div>

            <h3 className="mb-4 text-3xl font-black tracking-tight">{industries[activeTab].title}</h3>
            <p className="mb-8 max-w-[440px] text-sm leading-relaxed text-checkmark-text-muted">{industries[activeTab].description}</p>

            <div className="flex w-fit gap-0 overflow-hidden rounded-xl border border-[rgba(27,77,255,0.12)]">
              {industries[activeTab].metrics.map((metric, idx) => (
                <div key={metric.label} className={`px-5 py-3 text-center md:px-6 md:py-3.5 ${idx < 2 ? 'border-r border-[rgba(27,77,255,0.1)]' : ''}`}>
                  <span className="mb-0.5 block text-lg font-black tracking-tight text-checkmark-brand">{metric.value}</span>
                  <small className="whitespace-nowrap text-[11px] text-checkmark-text-muted">{metric.label}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
