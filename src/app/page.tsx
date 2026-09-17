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
    <main className="w-full overflow-hidden bg-checkmark-bg-dark font-dm-sans text-checkmark-text">
      <div className="pointer-events-none fixed left-1/2 top-[-20%] z-0 h-[700px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(27,77,255,0.09)_0%,transparent_70%)]" />
      <MarketingNav variant="dark" links={marketing.nav.landingLinks} />

      {/* 1 - Hero: base #0D1B2A */}
      <Hero />

      {/* 2 - Marquee: alt */}
      <div className="bg-checkmark-bg-card2">
        <Marquee />
      </div>

      {/* 3 - HowItWorks: base */}
      <HowItWorks />
      <SectionDivider />

      {/* 4 - Features: alt */}
      <div className="bg-checkmark-bg-card2">
        <Features />
      </div>
      <SectionDivider />

      {/* 5 - Industries: base */}
      <Industries />
      <SectionDivider />

      {/* 6 - ComparisonTable: alt */}
      <div className="bg-checkmark-bg-card2">
        <ComparisonTable />
      </div>
      <SectionDivider />

      {/* 7 - ForWho: base */}
      <ForWho />
      <SectionDivider />

      {/* 8 - FAQ: alt */}
      <div className="bg-checkmark-bg-card2">
        <FAQ />
      </div>

      <CTABandFooter />
    </main>
  );
}
