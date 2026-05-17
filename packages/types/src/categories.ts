export const GEOGRAPHIC_CATEGORIES = [
  "Vallentuna centrum",
  "Bällsta",
  "Kårsta",
  "Össeby-Garn",
  "Frösunda",
  "Lindholmen",
  "Angarn",
  "Karby",
] as const;

export const THEMATIC_CATEGORIES = [
  "Skola & utbildning",
  "Trafik & infrastruktur",
  "Miljö & klimat",
  "Äldreomsorg",
  "Barn & familj",
  "Fritid & kultur",
  "Bostäder",
  "Trygghet & säkerhet",
  "Näringsliv & arbete",
  "Allmänt",
] as const;

export const ALL_CATEGORIES = [
  ...GEOGRAPHIC_CATEGORIES,
  ...THEMATIC_CATEGORIES,
] as const;

export type GeographicCategory = (typeof GEOGRAPHIC_CATEGORIES)[number];
export type ThematicCategory = (typeof THEMATIC_CATEGORIES)[number];
export type ContentCategory = (typeof ALL_CATEGORIES)[number];
