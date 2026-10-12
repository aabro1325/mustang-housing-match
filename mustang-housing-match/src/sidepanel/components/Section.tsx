import type { ComponentChildren } from "preact";

/** A titled block with an optional right-aligned aside, used to group Scorecard and Review content. */
export function Section({ title, aside, children, id }: { title: string; aside?: ComponentChildren; children: ComponentChildren; id?: string }) {
  return (
    <section class="section" aria-labelledby={id}>
      <div class="section__head">
        <h2 id={id} class="section__title">{title}</h2>
        {aside && <span class="section__aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
