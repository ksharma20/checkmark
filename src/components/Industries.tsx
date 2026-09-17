'use client';

import { useState } from 'react';
import { marketing } from '@/locales/en/marketing';

const copy = marketing.industries;

export default function Industries() {
  const [activeTab, setActiveTab] = useState(0);
  const industries = copy.items;

  return (
    <section id="industries" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
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

      <div className="reveal grid min-h-[420px] grid-cols-1 overflow-hidden rounded-[20px] border border-[color-mix(in_srgb,var(--checkmark-brand)_14%,transparent)] bg-checkmark-bg-card md:grid-cols-[280px_1fr]">
        <div role="group" aria-label={copy.tablistLabel} className="flex flex-col border-r border-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)] bg-[color-mix(in_srgb,var(--bg-dark)_60%,transparent)]">
          {industries.map((ind, i) => (
            <button key={ind.num} type="button" aria-pressed={activeTab === i} aria-controls="industry-panel" onClick={() => setActiveTab(i)} className={`relative flex items-center gap-3 border-b border-[color-mix(in_srgb,var(--checkmark-brand)_7%,transparent)] px-5 py-4 text-left transition-colors ${activeTab === i ? 'bg-[color-mix(in_srgb,var(--checkmark-brand)_7%,transparent)]' : 'hover:bg-[color-mix(in_srgb,var(--checkmark-brand)_4%,transparent)]'}`}>
              <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-r" style={{ background: 'var(--checkmark-brand)', transform: activeTab === i ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'center', transition: 'transform 0.25s ease' }} />
              <span className={`text-[11px] font-bold tracking-[0.1em] ${activeTab === i ? 'text-checkmark-brand-on-dark' : 'text-checkmark-text-muted'}`}>{ind.num}</span>
              <span className={`flex-1 text-[13px] font-semibold ${activeTab === i ? 'text-checkmark-text' : 'text-checkmark-text-muted'}`}>{ind.title}</span>
              <span aria-hidden="true" className={`text-checkmark-brand-on-dark transition-all ${activeTab === i ? 'translate-x-0 opacity-100' : '-translate-x-1.5 opacity-0'}`}>→</span>
            </button>
          ))}
        </div>

        <div id="industry-panel" aria-live="polite" className="relative overflow-hidden bg-checkmark-bg-card2 px-7 py-10 md:px-12 md:py-12">
          <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[360px] w-[360px]" style={{ background: 'radial-gradient(circle, rgba(27,77,255,0.08) 0%, transparent 65%)' }} />

          <div className="animate-ind-fade-in relative">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-checkmark-brand-on-dark">
              <span className="h-0.5 w-5 rounded bg-checkmark-brand" />
              {industries[activeTab].eyebrow}
            </div>

            <div aria-hidden="true" className="mb-4 font-heading text-7xl font-extrabold not-italic leading-none tracking-tight text-[color-mix(in_srgb,var(--checkmark-brand)_7%,transparent)]">
              {industries[activeTab].num}
            </div>

            <h3 className="mb-4 font-heading text-3xl font-extrabold tracking-tight">{industries[activeTab].title}</h3>
            <p className="mb-8 max-w-[440px] text-sm leading-relaxed text-checkmark-text-muted">{industries[activeTab].description}</p>

            <div className="flex w-fit gap-0 overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--checkmark-brand)_12%,transparent)]">
              {industries[activeTab].metrics.map((metric, idx) => (
                <div key={metric.label} className={`px-5 py-3 text-center md:px-6 md:py-3.5 ${idx < 2 ? 'border-r border-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)]' : ''}`}>
                  <span className="mb-0.5 block font-heading text-lg font-extrabold tracking-tight text-checkmark-brand-on-dark">{metric.value}</span>
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
