import PageTransition from '@/components/PageTransition';

export default function WsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--surface-1)' }}>
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
