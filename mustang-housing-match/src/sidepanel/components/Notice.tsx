import type { ComponentChildren } from "preact";

export function Notice({ title, children, tone = "warn", role }: { title?: string; children: ComponentChildren; tone?: "warn" | "info" | "danger" | "success"; role?: "alert" | "status" }) {
  return (
    <div class={`notice notice--${tone}`} role={role}>
      <span class="notice__icon" aria-hidden="true">
        {tone === "success" ? "✓" : tone === "info" ? "i" : "!"}
      </span>
      <div>
        {title && <div class="notice__title">{title}</div>}
        <div class="notice__body">{children}</div>
      </div>
    </div>
  );
}
