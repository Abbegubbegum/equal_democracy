import React from "react";

/**
 * Shared button primitive for the harmonized web design.
 *
 * Mirrors the mobile app's button language:
 *  - primary   → filled amber, dark-blue label (the app's "Rösta / Skicka kod" button)
 *  - secondary → solid brand-blue, white label
 *  - ghost     → transparent with a hairline border
 *
 * Colors come from the theme tokens (accent / primary) so every button
 * follows the active color scheme automatically.
 */

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent-400 text-primary-800 hover:bg-accent-500 focus-visible:outline-accent-400",
  secondary:
    "bg-primary-600 text-white hover:bg-primary-700 border border-white/15 focus-visible:outline-primary-600",
  ghost:
    "bg-transparent text-primary-800 border border-primary-600/25 hover:bg-primary-600/5 focus-visible:outline-primary-600",
};

const SIZES: Record<Size, string> = {
  sm: "text-sm px-3.5 py-2",
  md: "text-base px-5 py-3",
  lg: "text-lg px-6 py-4",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Fully rounded pill instead of the default 14px radius. */
  pill?: boolean;
  /** Stretch to the full width of the container. */
  fullWidth?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  pill = false,
  fullWidth = false,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 font-bold cursor-pointer",
        "transition-[background-color,transform] duration-100 hover:-translate-y-px",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        pill ? "rounded-full" : "rounded-btn",
        fullWidth ? "w-full" : "",
        VARIANTS[variant],
        SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}
