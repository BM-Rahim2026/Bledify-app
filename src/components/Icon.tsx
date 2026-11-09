// Line icons (24×24, stroke) used instead of emojis, so they look the same on every phone.
const PATHS: Record<string, string> = {
  bag: "M6 7h12l1 13H5zM9 7V5.5a3 3 0 0 1 6 0V7",
  store: "M4 9.5 5.5 4h13L20 9.5M4 9.5V20h16V9.5M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5M9.5 20v-5h5v5",
  truck: "M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v4M18 10v4",
  home: "M3 11 12 4l9 7M5.5 9.5V20h13V9.5M10 20v-5h4v5",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z",
  cart: "M3 4h2l2.2 11h10.6L20 7H6.2M9.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM16.5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  shield: "M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6zM8.5 12l2.5 2.5 4.5-5",
  star: "M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z",
  map: "M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  check: "M5 12.5 10 17l9-10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  // categories
  food: "M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M5 16c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0M12 12V8M12 5.2v.1",
  fashion: "M9 3h6l1 3-2 2 3 13H7L10 8 8 6zM9.5 3 12 6l2.5-3",
  crafts: "M9 3h6M10 3v3C7.2 7 5 10 5 13.8a7 7 0 0 0 14 0C19 10 16.8 7 14 6V3M6 13h12",
  terroir: "M5 19C5 10.5 10.5 5 19 5c0 8.5-5.5 14-14 14zM5 19l8.5-8.5",
  jewelry: "M6.5 4h11l3.5 5-9 11L3 9zM3 9h18M9.5 4 12 9l2.5-5M12 9v11",
  beauty: "M9 10h6a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM10.5 10V7h3v3M12 7V4h3M10 15.5c0-1 2-2.8 2-2.8s2 1.8 2 2.8a2 2 0 0 1-4 0z",
  occasions: "M9 14m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M15 14m-5 0a5 5 0 1 0 10 0a5 5 0 1 0-10 0M12 3l1.5 2-1.5 2-1.5-2z",
  // seasons
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
  gift: "M4 10h16v10H4zM3 7h18v3H3zM12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zm0 0c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z",
  sun: "M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
};

export type IconName = keyof typeof PATHS | string;

export function Icon({ name, className = "h-5 w-5", strokeWidth = 1.8, fill = "none" }: {
  name: IconName; className?: string; strokeWidth?: number; fill?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill} stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

export const CATEGORY_ICON_PATHS = PATHS;
