import type { ButtonHTMLAttributes, ComponentChildren } from "preact";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> & {
  variant?: "primary" | "secondary" | "ghost" | "link";
  size?: "md" | "sm";
  children: ComponentChildren;
};

export function Button({ variant = "primary", size = "md", class: cls, children, type, ...rest }: Props) {
  return (
    <button type={type ?? "button"} class={`btn btn--${variant} btn--${size} ${cls ?? ""}`} {...rest}>
      {children}
    </button>
  );
}
