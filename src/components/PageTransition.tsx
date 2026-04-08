'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className={`page-enter${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
}
