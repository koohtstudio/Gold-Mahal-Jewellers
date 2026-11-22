const PATHS = {
  bag: "M6 8h12l-1 12H7z M9 8a3 3 0 016 0",
  check: "M5 12l5 5 9-10",
  pencil: "M4 20l4-1L19 8l-3-3L5 16z M14 7l3 3",
  wrench: "M14 5a4 4 0 00-4 5L4 16l4 4 6-6a4 4 0 005-4l-3 2-3-3z",
  bars: "M3 9h18v8H3z M6 9l2-4h8l2 4",
  card: "M3 6h18v12H3z M3 10h18 M7 15h4",
  sparkle: "M12 3l1.8 5L19 9.5l-4 3.2 1.4 5.3L12 15l-4.4 3 1.4-5.3-4-3.2L10.2 8z",
  gift: "M4 9h16v11H4z M12 9v11 M4 13h16 M12 9c-3-5-6-3-4 0 M12 9c3-5 6-3 4 0",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  close: "M6 6l12 12 M18 6L6 18",
  pin: "M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z M12 7.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  download: "M12 3v12 M7 11l5 5 5-5 M5 21h14",
  send: "M22 3L11 14 M22 3l-7 19-4-8-8-4z",
  plus: "M12 5v14 M5 12h14",
  dash: "M5 12h14",
  dashboard: "M4 13h6V4H4zM14 20h6V11h-6zM4 20h6v-3H4zM14 8h6V4h-6z",
  rate: "M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z M9 12l2 2 4-4",
  inventory: "M12 3l9 5-9 5-9-5z M3 13l9 5 9-5",
  jobs: "M14 5a4 4 0 00-4 5L4 16l4 4 6-6a4 4 0 005-4l-3 2-3-3z",
  gold: "M12 3v18 M7 8c0-2 2-3 5-3s5 1 5 3-2 3-5 3-5 1-5 3 2 3 5 3 5-1 5-3",
  layaway: "M5 4h14v16H5z M9 9h6 M9 13h6 M9 17h3",
  books: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z M9 9h6 M9 13h6",
  settings: "M12 9a3 3 0 100 6 3 3 0 000-6z M12 3v3 M12 18v3 M3 12h3 M18 12h3",
  more: "M5 12h.01 M12 12h.01 M19 12h.01",
  reset: "M4 4v6h6 M20 20v-6h-6 M5 15a8 8 0 0014 3 M19 9A8 8 0 005 6",
  upload: "M12 16V4 M7 9l5-5 5 5 M5 21h14",
  logout: "M10 4H5v16h5 M15 8l4 4-4 4 M19 12H9",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, strokeWidth = 1.7 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
