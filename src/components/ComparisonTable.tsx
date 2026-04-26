'use client';

type Cell = 'yes' | 'no' | 'partial';

type Row = {
  category: string;
  items: Array<{ feature: string; checkmark: Cell; keka: Cell; whatsapp: Cell }>;
};

export default function ComparisonTable() {
  const rows: Row[] = [
    {
      category: 'Setup and Access',
      items: [
        { feature: 'No app install (PWA)', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
        { feature: 'Self-serve setup under 10 min', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
        { feature: 'Zero hardware required', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
      ],
    },
    {
      category: 'Verification and Accuracy',
      items: [
        { feature: 'GPS + IP cross-validation', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
        { feature: 'Tamper-proof check-ins', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
        { feature: 'Works in coworking spaces', checkmark: 'yes', keka: 'no', whatsapp: 'yes' },
      ],
    },
    {
      category: 'Data and Compliance',
      items: [
        { feature: 'Immutable 7-year history', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
        { feature: 'User-owned portable data', checkmark: 'yes', keka: 'no', whatsapp: 'no' },
        { feature: 'Automated month-end reports', checkmark: 'yes', keka: 'partial', whatsapp: 'no' },
      ],
    },
  ];

  const renderIcon = (value: Cell) => {
    if (value === 'yes') {
      return (
        <div className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-full bg-[rgba(27,77,255,0.15)]">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#1B4DFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
      );
    }

    if (value === 'partial') {
      return (
        <div className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-full bg-[rgba(200,160,60,0.1)]">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#c8a03c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </div>
      );
    }

    return (
      <div className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-full bg-[rgba(255,80,80,0.08)]">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#e05050" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </div>
    );
  };

  return (
    <section id="compare" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
      <div className="section-eyebrow reveal mb-4 flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand">
        <span className="h-0.5 w-6 rounded bg-checkmark-brand" />
        Why CheckMark
      </div>

      <h2 className="section-title reveal mb-5 font-dm-sans text-4xl font-black leading-tight tracking-tight md:text-5xl">
        How we stack up against the <em className="font-syne italic text-checkmark-brand">rest</em>
      </h2>

      <p className="section-desc reveal mb-14 max-w-[540px] text-base leading-relaxed text-checkmark-text-muted md:text-lg">
        Traditional HRMS tools were not designed for hybrid work or field teams.
      </p>

      <div className="reveal overflow-x-auto">
        <table className="min-w-[640px] w-full border-collapse">
          <thead>
            <tr className="border-b border-checkmark-border">
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.1em] text-checkmark-text-muted" style={{ width: '38%' }}>Feature</th>
              <th className="bg-[rgba(27,77,255,0.06)] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-checkmark-brand" style={{ width: '20%' }}>CheckMark</th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-checkmark-text-muted" style={{ width: '21%' }}>Keka / Zoho</th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-checkmark-text-muted" style={{ width: '21%' }}>WhatsApp / Forms</th>
            </tr>
          </thead>
          {rows.map((group) => (
            <tbody key={group.category}>
                <tr>
                  <td colSpan={4} className="bg-transparent px-6 pb-2 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand opacity-70">{group.category}</td>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.feature} className="border-b border-[rgba(27,77,255,0.07)] hover:bg-[rgba(27,77,255,0.025)]">
                    <td className="px-6 py-3.5 text-sm font-medium text-checkmark-text">{item.feature}</td>
                    <td className="bg-[rgba(27,77,255,0.04)] px-6 py-3.5 text-center">{renderIcon(item.checkmark)}</td>
                    <td className="px-6 py-3.5 text-center">{renderIcon(item.keka)}</td>
                    <td className="px-6 py-3.5 text-center">{renderIcon(item.whatsapp)}</td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="reveal mt-4 text-xs text-checkmark-text-muted opacity-60">Partial = available only in higher tiers or with significant configuration.</p>
    </section>
  );
}
