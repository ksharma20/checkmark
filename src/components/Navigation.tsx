'use client';

import Link from 'next/link';

export default function Navigation() {
  return (
    <nav className="fixed left-0 right-0 top-0 z-[100] flex items-center justify-between border-b border-checkmark-border bg-[rgba(13,27,42,0.72)] px-6 py-4 backdrop-blur-[16px] md:px-[60px] md:py-5">
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="CheckMark" className="h-[68px] w-auto md:h-[77px]" />
      </div>

      <ul className="hidden list-none items-center gap-9 md:flex">
        <li><Link href="#how" className="text-sm font-medium text-checkmark-text-muted transition-colors hover:text-checkmark-brand">How it works</Link></li>
        <li><Link href="#features" className="text-sm font-medium text-checkmark-text-muted transition-colors hover:text-checkmark-brand">Features</Link></li>
        <li><Link href="#industries" className="text-sm font-medium text-checkmark-text-muted transition-colors hover:text-checkmark-brand">Industries</Link></li>
        <li><Link href="#compare" className="text-sm font-medium text-checkmark-text-muted transition-colors hover:text-checkmark-brand">Compare</Link></li>
        <li><Link href="#faq" className="text-sm font-medium text-checkmark-text-muted transition-colors hover:text-checkmark-brand">FAQ</Link></li>
      </ul>

      <Link
        href="/login"
        className="rounded-lg bg-checkmark-brand px-5 py-2 text-sm font-bold text-white transition-all hover:bg-[#446CFF] hover:shadow-lg active:scale-95 md:px-6 md:py-2.5"
      >
        Get Started
      </Link>
    </nav>
  );
}
