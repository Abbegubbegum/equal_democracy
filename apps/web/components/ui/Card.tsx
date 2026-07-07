import React from "react";

/**
 * Light surface card — the default container for lists and content.
 * White surface, soft 18px radius, hairline border and a gentle shadow.
 * Use MediaCard (below) for the image-heavy, dark-overlay feed style.
 */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Apply the standard inner padding. Turn off for edge-to-edge content (e.g. a list). */
  padded?: boolean;
}

export default function Card({
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "bg-white rounded-card border border-black/5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.5)]",
        padded ? "p-5" : "overflow-hidden",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
