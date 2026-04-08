'use client';

import { useEffect } from 'react';

function getBgLuminance(el: HTMLElement): number {
  // Walk up until we find a non-transparent background
  let node: HTMLElement | null = el;
  while (node) {
    const bg = window.getComputedStyle(node).backgroundColor;
    const m = bg.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      const [r, g, b, a = 1] = m.map(Number);
      if (a > 0.05) return r * 0.299 + g * 0.587 + b * 0.114;
    }
    node = node.parentElement;
  }
  return 255;
}

export default function RippleProvider() {
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      const el = target.closest('button, a[href]') as HTMLElement | null;
      if (!el) return;
      if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return;
      // Skip if element explicitly opts out
      if (el.dataset.noRipple) return;

      const computed = window.getComputedStyle(el);

      // Ensure the ripple is clipped to the button
      const hadPosition = computed.position !== 'static';
      const hadOverflow = computed.overflow === 'hidden';
      if (!hadPosition) el.style.position = 'relative';
      if (!hadOverflow) el.style.overflow = 'hidden';

      const rect = el.getBoundingClientRect();
      // Size ripple to cover the whole button from the tap point
      const dx = Math.max(e.clientX - rect.left, rect.right - e.clientX);
      const dy = Math.max(e.clientY - rect.top, rect.bottom - e.clientY);
      const size = Math.sqrt(dx * dx + dy * dy) * 2.1;

      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      // Pick ripple color based on button background luminance
      const lum = getBgLuminance(el);
      const color =
        lum < 110
          ? 'rgba(255, 255, 255, 0.26)'   // dark bg → white ripple
          : 'rgba(27, 77, 255, 0.20)';    // light bg → blue tint

      const ripple = document.createElement('span');
      ripple.className = 'click-ripple';
      ripple.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${x}px;
        top: ${y}px;
        background: ${color};
      `;

      el.appendChild(ripple);

      const cleanup = () => {
        ripple.remove();
        if (!el.querySelector('.click-ripple')) {
          if (!hadOverflow) el.style.overflow = '';
          if (!hadPosition) el.style.position = '';
        }
      };

      ripple.addEventListener('animationend', cleanup, { once: true });
      // Fallback cleanup in case animationend doesn't fire
      setTimeout(cleanup, 700);
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return null;
}
