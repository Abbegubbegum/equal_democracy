export type ThematicCategory =
  | "budget"
  | "barn"
  | "arbete"
  | "aldre"
  | "politik"
  | "infra"
  | "kultur";

export type GeographicCategory =
  | "geo_central"
  | "geo_lindholmen"
  | "geo_karsta"
  | "geo_karby";

export type ContentCategory = ThematicCategory | GeographicCategory;

export const THEMATIC_CATEGORIES: ThematicCategory[] = [
  "budget",
  "barn",
  "arbete",
  "aldre",
  "politik",
  "infra",
  "kultur",
];

export const GEOGRAPHIC_CATEGORIES: GeographicCategory[] = [
  "geo_central",
  "geo_lindholmen",
  "geo_karsta",
  "geo_karby",
];

export const ALL_CATEGORIES: ContentCategory[] = [
  ...THEMATIC_CATEGORIES,
  ...GEOGRAPHIC_CATEGORIES,
];
