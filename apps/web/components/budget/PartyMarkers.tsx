import type { AlternativeMarker } from "@repo/types";

/**
 * The parties' own figures on a budget slider: a coloured vertical line each,
 * drawn inside the slider track (which must be `relative`). A value outside
 * the slider's range sits at the nearest end — the legend below gives the
 * real figure. The app draws the same thing (apps/mobile/lib/AmberSlider.tsx).
 */
export function PartyMarkers({
  markers,
  min,
  max,
}: {
  markers: AlternativeMarker[];
  min: number;
  max: number;
}) {
  if (!markers?.length || max <= min) return null;
  return (
    <>
      {markers.map((m) => {
        const pct =
          ((Math.min(max, Math.max(min, m.value)) - min) / (max - min)) * 100;
        return (
          <div
            key={m.key}
            title={`${m.label}`}
            className="absolute w-[3px] rounded-sm z-[15] ring-1 ring-white"
            style={{
              left: `calc(${pct}% - 1.5px)`,
              top: "-6px",
              bottom: "-6px",
              backgroundColor: m.color,
            }}
          />
        );
      })}
    </>
  );
}

/** Legend for the lines: party, colour and its figure for this post. */
export function PartyLegend({
  markers,
  format,
}: {
  markers: AlternativeMarker[];
  format: (value: number) => string;
}) {
  if (!markers?.length) return null;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
      {markers.map((m) => (
        <span
          key={m.key}
          className="inline-flex items-center gap-1"
          title={m.label}
        >
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: m.color }}
          />
          <span className="font-semibold">{m.key}</span> {format(m.value)}
        </span>
      ))}
    </div>
  );
}
