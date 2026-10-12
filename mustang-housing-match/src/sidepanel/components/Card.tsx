import type { ComponentChildren } from "preact";

export function Card({ children, tone = "surface", class: cls }: { children: ComponentChildren; tone?: "surface" | "brand" | "tint"; class?: string }) {
  return <div class={`card card--${tone} ${cls ?? ""}`}>{children}</div>;
}
