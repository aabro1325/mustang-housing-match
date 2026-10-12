export function CategoryBar({ title, detail, points, max, state }: { title: string; detail: string; points: number; max: number; state: "good" | "mid" | "poor" }) {
  const pct = max > 0 ? Math.round((points / max) * 100) : 0;
  return (
    <div class={`catrow catrow--${state}`}>
      <div class="catrow__head">
        <span class="catrow__dot" aria-hidden="true" />
        <span class="catrow__title">{title}</span>
        <span class="catrow__pts">{Math.round(points)} / {max} pts</span>
      </div>
      <div class="catrow__detail">{detail}</div>
      <div class="catrow__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} ${pct}%`}>
        <div class="catrow__fill" style={`width:${pct}%`} />
      </div>
    </div>
  );
}
