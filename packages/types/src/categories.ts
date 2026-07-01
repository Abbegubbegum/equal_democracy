export const GEOGRAPHIC_CATEGORIES = [
  "Vallentuna centrum",
  "Bällsta",
  "Kårsta",
  "Össeby-Garn",
  "Frösunda",
  "Lindholmen",
  "Angarn",
  "Karby",
  "Ekskogen",
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

// Maps an interest area's short key to the ALL_CATEGORIES strings it
// represents — used to filter content (sessions, municipal items, budget
// categories, citizen proposals) by a user's saved interests in "Mina frågor"
// on mobile, and in the admin "Mina frågor" overview on web.
export const INTEREST_TO_CATEGORIES: Record<string, string[]> = {
  budget: ["Allmänt"],
  barn: ["Skola & utbildning", "Barn & familj"],
  arbete: ["Näringsliv & arbete"],
  aldre: ["Äldreomsorg"],
  politik: ["Allmänt"],
  infra: ["Trafik & infrastruktur"],
  kultur: ["Fritid & kultur"],
  miljo: ["Miljö & klimat", "Bostäder", "Trygghet & säkerhet"],
  geo_central: ["Vallentuna centrum", "Bällsta"],
  geo_lindholmen: ["Lindholmen", "Frösunda"],
  geo_karsta: ["Kårsta", "Ekskogen"],
  geo_brottby: ["Karby", "Össeby-Garn", "Angarn"],
};

export interface InterestArea {
  key: string;
  label: string;
  alwaysOn?: boolean;
  note?: string;
  groupLabel?: string;
}

export const INTEREST_AREAS: InterestArea[] = [
  {
    key: "budget",
    label: "Budgeten",
    alwaysOn: true,
    note: "Alltid aktiv — balanserar övriga intressen",
  },
  { key: "barn", label: "Barn och utbildning" },
  { key: "arbete", label: "Arbete och Näringsliv" },
  { key: "aldre", label: "Äldre och social gemenskap" },
  { key: "politik", label: "Politik och Organisation" },
  { key: "infra", label: "Infrastruktur och Identitet" },
  { key: "kultur", label: "Kultur och Fritid" },
  { key: "miljo", label: "Miljö och klimat" },
  {
    key: "geo_central",
    label: "Centrala och södra Vallentuna",
    groupLabel: "Geografiska intressen",
  },
  { key: "geo_lindholmen", label: "Lindholmen och västra Vallentuna" },
  { key: "geo_karsta", label: "Kårsta och norra Vallentuna" },
  { key: "geo_brottby", label: "Brottby och östra Vallentuna" },
];
