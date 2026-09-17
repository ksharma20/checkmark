'use client';

import { useEffect } from 'react';
import CTABandFooter from '@/components/CTABandFooter';
import ComparisonTable from '@/components/ComparisonTable';
import FAQ from '@/components/FAQ';
import Features from '@/components/Features';
import ForWho from '@/components/ForWho';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Industries from '@/components/Industries';
import Marquee from '@/components/Marquee';
import MarketingNav from '@/components/marketing/MarketingNav';
import SectionDivider from '@/components/SectionDivider';
import { marketing } from '@/locales/en/marketing';

export default function Home() {
  useEffect(() => {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px',
      },
    );

    reveals.forEach((el) => observer.observe(el));
    return () => {
      reveals.forEach((el) => observer.unobserve(el));
    };
  }, []);

  return (
    <main className="w-full overflow-hidden bg-checkmark-bg-dark font-body text-checkmark-text">
      <div className="pointer-events-none fixed left-1/2 top-[-20%] z-0 h-[700px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(27,77,255,0.09)_0%,transparent_70%)]" />
      <MarketingNav variant="dark" links={marketing.nav.landingLinks} />

      {/* The section ORDER is the argument, not a layout choice.
          Hero states what the reader owns; How it works shows there is nothing
          running behind them; ForWho is the pivot where the organisation's need
          finally appears, AFTER the reader knows the record is theirs. Features,
          Industries and Compare are evidence for a decision already framed.
          Putting ForWho after Compare - where it used to sit - meant three org
          sections ran before the person was answered at all.

          Backgrounds alternate base (#0D1B2A) / alt (#1E2D3D) down the page; a
          re-order has to keep that stripe intact or two sections merge. */}

      {/* 1 - Hero: base */}
      <Hero />

      {/* 2 - Marquee: alt */}
      <div className="bg-checkmark-bg-card2">
        <Marquee />
      </div>

      {/* 3 - HowItWorks: base */}
      <HowItWorks />
      <SectionDivider />

      {/* 4 - ForWho: alt - the user/organisation pivot */}
      <div className="bg-checkmark-bg-card2">
        <ForWho />
      </div>
      <SectionDivider />

      {/* 5 - Features: base */}
      <Features />
      <SectionDivider />

      {/* 6 - Industries: alt */}
      <div className="bg-checkmark-bg-card2">
        <Industries />
      </div>
      <SectionDivider />

      {/* 7 - ComparisonTable: base */}
      <ComparisonTable />
      <SectionDivider />

      {/* 8 - FAQ: alt */}
      <div className="bg-checkmark-bg-card2">
        <FAQ />
      </div>

      <CTABandFooter />
    </main>
  );
}
