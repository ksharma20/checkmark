import { marketing } from '@/locales/en/marketing';

const copy = marketing.comparison;

type Cell = 'yes' | 'no';

export default function ComparisonTable() {
  const rows = copy.groups;

  /* Each cell carries its own visually-hidden label: the icon alone is not a
     readable answer for a screen reader working through a 4-column table. */
  const renderIcon = (value: Cell) => {
    const shell = 'inline-flex h-6.5 w-6.5 items-center justify-center rounded-full';
    const label = <span className="sr-only">{copy.cellLabels[value]}</span>;

    if (value === 'yes') {
      return (
        <div className={`${shell} bg-[color-mix(in_srgb,var(--checkmark-brand)_15%,transparent)] text-checkmark-brand-on-dark`}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          {label}
        </div>
      );
    }

    return (
      <div className={`${shell} bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-danger`}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        {label}
      </div>
    );
  };

  return (
    <section id="compare" className="relative z-10 mx-auto max-w-[1200px] px-6 py-[80px] md:px-10 md:py-[100px]">
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

      <div className="reveal overflow-x-auto">
        <table className="min-w-[640px] w-full border-collapse">
          <thead>
            <tr className="border-b border-checkmark-border">
              <th scope="col" className="px-6 py-4 text-left text-xs font-bold uppercase tracking-[0.1em] text-checkmark-text-muted" style={{ width: '38%' }}>{copy.columns.feature}</th>
              <th scope="col" className="bg-[color-mix(in_srgb,var(--checkmark-brand)_6%,transparent)] px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-checkmark-brand-on-dark" style={{ width: '20%' }}>{copy.columns.checkmark}</th>
              <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-checkmark-text-muted" style={{ width: '21%' }}>{copy.columns.keka}</th>
              <th scope="col" className="px-6 py-4 text-center text-xs font-bold uppercase tracking-[0.1em] text-checkmark-text-muted" style={{ width: '21%' }}>{copy.columns.whatsapp}</th>
            </tr>
          </thead>
          {rows.map((group) => (
            <tbody key={group.category}>
                <tr>
                  <td colSpan={4} className="bg-transparent px-6 pb-2 pt-5 text-xs font-bold uppercase tracking-[0.14em] text-checkmark-brand-on-dark">{group.category}</td>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.feature} className="border-b border-[color-mix(in_srgb,var(--checkmark-brand)_7%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--checkmark-brand)_4%,transparent)]">
                    <th scope="row" className="px-6 py-3.5 text-left text-sm font-medium text-checkmark-text">{item.feature}</th>
                    <td className="bg-[color-mix(in_srgb,var(--checkmark-brand)_4%,transparent)] px-6 py-3.5 text-center">{renderIcon(item.checkmark)}</td>
                    <td className="px-6 py-3.5 text-center">{renderIcon(item.keka)}</td>
                    <td className="px-6 py-3.5 text-center">{renderIcon(item.whatsapp)}</td>
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>

      <p className="reveal mt-4 text-xs text-checkmark-text-muted">{copy.footnote}</p>
    </section>
  );
}
