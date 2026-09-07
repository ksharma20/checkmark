'use client';

import { useState } from 'react';
import { marketing } from '@/locales/en/marketing';

const copy = marketing.faq;

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const faqs = copy.items;

  return (
    <section id="faq" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
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

      <div className="reveal flex max-w-[820px] flex-col gap-3">
        {faqs.map((faq, i) => (
          <div key={faq.q} className={`overflow-hidden rounded-[14px] border bg-checkmark-bg-card transition-all ${openIndex === i ? 'border-[color-mix(in_srgb,var(--checkmark-brand)_35%,transparent)]' : 'border-checkmark-border'}`}>
            <button type="button" id={`faq-trigger-${i}`} aria-expanded={openIndex === i} aria-controls={`faq-panel-${i}`} onClick={() => setOpenIndex(openIndex === i ? null : i)} className="flex w-full items-center justify-between gap-4 border-none bg-transparent px-7 py-5 text-left font-dm-sans text-sm font-semibold text-checkmark-text transition-colors hover:text-checkmark-brand">
              {faq.q}
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--checkmark-brand)_20%,transparent)] bg-[color-mix(in_srgb,var(--checkmark-brand)_10%,transparent)] text-checkmark-brand">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>

            <div
              id={`faq-panel-${i}`}
              role="region"
              aria-labelledby={`faq-trigger-${i}`}
              className="text-sm leading-relaxed text-checkmark-text-muted"
              style={{
                maxHeight: openIndex === i ? '300px' : '0px',
                overflow: 'hidden',
                /* `visibility` rather than `hidden`: it takes the collapsed copy
                   out of the accessibility tree the way `display: none` would,
                   but unlike `display` it is transitionable, so the height
                   animation survives. */
                visibility: openIndex === i ? 'visible' : 'hidden',
                transition: 'max-height 0.4s ease, padding 0.3s ease, visibility 0.4s ease',
                paddingLeft: '28px',
                paddingRight: '28px',
                paddingBottom: openIndex === i ? '22px' : '0px',
              }}
            >
              {faq.a}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
