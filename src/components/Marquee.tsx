import { marketing } from '@/locales/en/marketing';

export default function Marquee() {
  const items = marketing.marquee.items;

  return (
    <div className="relative z-10 mb-0 overflow-hidden border-y border-checkmark-border py-5">
      <ul className="flex w-max list-none gap-[60px] animate-marquee">
        {[...items, ...items].map((item, i) => (
          <li
            key={`${item}-${i}`}
            aria-hidden={i >= items.length}
            className="flex items-center gap-2.5 whitespace-nowrap text-xs font-semibold uppercase text-checkmark-text-muted"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
