/** Screen header: a small context line, the headline, and an optional lede. The headline carries the voice. */
export function Header({ context, title, lede }: { context?: string; title: string; lede?: string }) {
  return (
    <div class="screenhead">
      {context && <p class="screenhead__context">{context}</p>}
      <h1 class="screenhead__title">{title}</h1>
      {lede && <p class="screenhead__lede">{lede}</p>}
    </div>
  );
}
