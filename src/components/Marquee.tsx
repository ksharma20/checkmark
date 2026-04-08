export default function Marquee() {
  const items = [
    'No app install required',
    'WiFi + GPS + IP verification',
    'Works in coworking spaces',
    '7-year immutable history',
    'Self-serve under 10 minutes',
    'Under Rs 100 / user / month',
  ];

  return (
    <div className="relative z-10 mb-0 overflow-hidden border-y border-checkmark-border py-5">
      <div className="flex w-max gap-[60px] animate-marquee">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 whitespace-nowrap text-xs font-semibold uppercase text-checkmark-text-muted">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
