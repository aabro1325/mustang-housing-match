import type { ComponentChildren } from "preact";

/** Labelled form row. `hint` sits under the control; `trailing` sits inside the control box on the right. */
export function Field({ label, hint, children, id, trailing, error }: {
  label: string; hint?: string; children: ComponentChildren; id?: string; trailing?: ComponentChildren; error?: string | null;
}) {
  return (
    <div class={`field ${error ? "field--error" : ""}`}>
      <label class="field__label" for={id}>{label}</label>
      <div class="field__control">
        {children}
        {trailing && <span class="field__trailing">{trailing}</span>}
      </div>
      {error ? <div class="field__hint field__hint--error" role="alert">{error}</div> : hint ? <div class="field__hint">{hint}</div> : null}
    </div>
  );
}
