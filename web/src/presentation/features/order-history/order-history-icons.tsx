import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;

const base = (props: P): P => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props,
});

export function IconChevronLeft(props: P) {
  return (
    <svg {...base(props)}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function IconEllipsisVertical(props: P) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSearch(props: P) {
  return (
    <svg {...base({ width: 16, height: 16, ...props })}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconChartLine(props: P) {
  return (
    <svg {...base({ width: 12, height: 12, ...props })}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

export function IconBox(props: P) {
  return (
    <svg {...base({ width: 12, height: 12, ...props })}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12" />
    </svg>
  );
}

export function IconChevronDown(props: P) {
  return (
    <svg {...base({ width: 12, height: 12, ...props })}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconCalendar(props: P) {
  return (
    <svg {...base({ width: 12, height: 12, ...props })}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function IconSliders(props: P) {
  return (
    <svg {...base({ width: 12, height: 12, ...props })}>
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h4M9 8h4M17 16h4" />
    </svg>
  );
}

export function IconInvoice(props: P) {
  return (
    <svg {...base({ width: 14, height: 14, ...props })}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export function IconReorder(props: P) {
  return (
    <svg {...base({ width: 14, height: 14, ...props })}>
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

export function IconPlus(props: P) {
  return (
    <svg {...base({ width: 14, height: 14, ...props })}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
