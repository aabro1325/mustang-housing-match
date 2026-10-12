// Small inline icons (stroke, currentColor). Kept tiny and consistent: 20px box, 1.8 stroke.
const I = ({ d, box = 24 }: { d: string; box?: number }) => (
  <svg viewBox={`0 0 ${box} ${box}`} width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const WalkIcon = () => <I d="M13 4a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM9 21l2-7 2 2v5M7 12l2.5-4.5 3 1.5 2 4M15 10l2 1" />;
export const BikeIcon = () => <I d="M5.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 15l-2-5 4-3 2 4h3M8 10h3" />;
export const BusIcon = () => <I d="M5 4h14a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1zM4 10h16M7 18v2M17 18v2M8 14h.01M16 14h.01" />;
export const CarIcon = () => <I d="M4 15l1.5-5A2 2 0 0 1 7.4 8.5h9.2a2 2 0 0 1 1.9 1.5L20 15M4 15h16v4H4zM7 19v1M17 19v1M7.5 15.5h.01M16.5 15.5h.01" />;
export const CheckIcon = () => <I d="M5 12.5l4.5 4.5L19 7.5" />;
export const PencilIcon = () => <I d="M4 20h4l10.5-10.5a2 2 0 0 0-4-4L4 16v4zM13 7l4 4" />;
export const SlidersIcon = () => <I d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0M14 4v4M7 10v4M16 16v4" />;
export const SparkIcon = () => <I d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />;
export const PeopleIcon = () => <I d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M12 20a6 6 0 0 1 10 0" />;
export const PinIcon = () => <I d="M12 21s-6-5.3-6-11a6 6 0 1 1 12 0c0 5.7-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />;
