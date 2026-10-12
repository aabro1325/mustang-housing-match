/** The Fit Score as a ring: the arc length is the score, the number sits inside. Used large on the Scorecard. */
export function ScoreRing({ score, size = 96, stroke = 8, label }: { score: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div class="ring" style={`width:${size}px;height:${size}px`} role="img" aria-label={`Fit Score ${score} out of 100`}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} class="ring__track" stroke-width={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} class="ring__arc" stroke-width={stroke}
          stroke-dasharray={`${c * pct} ${c * (1 - pct)}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div class="ring__value">
        <span class="ring__number">{score}</span>
        {label && <span class="ring__label">{label}</span>}
      </div>
    </div>
  );
}
