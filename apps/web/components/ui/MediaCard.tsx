import React from "react";

/**
 * Image-heavy card with a dark overlay — the web equivalent of the mobile
 * app's feed cards (Hem/Förslag). A full-bleed background image (or solid
 * brand-blue fallback) sits under a bottom-anchored scrim, with an uppercase
 * amber label + title + optional action rendered on top.
 */

export interface MediaCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Background image URL. Falls back to a solid brand-blue panel when absent. */
  imageUrl?: string | null;
  /** Small uppercase amber eyebrow, e.g. "Förslag" or "Röstning". */
  label?: string;
  /** Card height. Defaults to a portrait-ish feed card. */
  minHeight?: number;
}

export default function MediaCard({
  imageUrl,
  label,
  minHeight = 190,
  className = "",
  children,
  style,
  ...rest
}: MediaCardProps) {
  return (
    <div
      className={[
        "relative flex flex-col justify-end rounded-card overflow-hidden",
        "bg-[#111318] border border-white/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight, ...style }}
      {...rest}
    >
      {/* Background */}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600" />
      )}

      {/* Scrim so text stays legible over any image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

      {/* Content */}
      <div className="relative p-4">
        {label && (
          <div className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-accent-400">
            {label}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
