'use client';

import { useState } from 'react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: 'How does CheckMark verify I am actually at the office?',
      a: 'When you tap check-in, CheckMark captures IP address and GPS coordinates and validates them against office profile data.',
    },
    {
      q: 'Do I need to install an app?',
      a: 'No. CheckMark is a Progressive Web App. Open it in the browser and add it to your home screen.',
    },
    {
      q: 'What if I work from a coworking space?',
      a: 'Coworking locations can be registered and verified the same way as office locations.',
    },
    {
      q: 'Who owns the check-in data?',
      a: 'Users own their data. Organizations can query with consent but cannot alter immutable records.',
    },
    {
      q: 'How long does setup take?',
      a: 'Typically under 10 minutes for an organization with no hardware setup.',
    },
    {
      q: 'Does CheckMark track me continuously?',
      a: 'No. Data is captured only when you tap check-in.',
    },
    {
      q: 'Is CheckMark free for employees?',
      a: 'Yes. Individuals do not pay. Organizations pay per enrolled user.',
    },
  ];

  return (
    <section id="faq" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        FAQ
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        Questions we get <em className="font-syne italic text-checkmark-brand">a lot</em>
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        Everything you need to know before you get started.
      </p>

      <div className="reveal flex max-w-[820px] flex-col gap-3">
        {faqs.map((faq, i) => (
          <div key={faq.q} className={`overflow-hidden rounded-[14px] border bg-checkmark-bg-card transition-all ${openIndex === i ? 'border-[rgba(27,77,255,0.35)]' : 'border-checkmark-border'}`}>
            <button onClick={() => setOpenIndex(openIndex === i ? null : i)} className="flex w-full items-center justify-between gap-4 border-none bg-transparent px-7 py-5 text-left font-dm-sans text-sm font-semibold text-checkmark-text transition-colors hover:text-checkmark-brand">
              {faq.q}
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(27,77,255,0.2)] bg-[rgba(27,77,255,0.1)]">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1B4DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>

            <div
              className="text-sm leading-relaxed text-checkmark-text-muted"
              style={{
                maxHeight: openIndex === i ? '300px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.4s ease, padding 0.3s ease',
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
