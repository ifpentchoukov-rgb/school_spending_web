/**
 * Static facts about U.S. states + DC. Used to render names on
 * per-state pages and to enumerate all 51 jurisdictions on the index
 * page (so deferred states still show up even though they have no
 * budget_events rows).
 */

export type StateMeta = {
  postal: string;
  name: string;
  /** Approximate K-12 enrollment for ranking. Sourced from Census/CCD. */
  enrollment: number;
  /** Whether this jurisdiction has at least one extractor live (set
   *  dynamically by joining with v_state_fy_coverage). Defaults to false
   *  if no events exist. */
  isLive?: boolean;
};

export const STATE_META: StateMeta[] = [
  { postal: "TX", name: "Texas", enrollment: 5_490_000 },
  { postal: "CA", name: "California", enrollment: 4_260_000 },
  { postal: "FL", name: "Florida", enrollment: 2_830_000 },
  { postal: "NY", name: "New York", enrollment: 2_360_000 },
  { postal: "GA", name: "Georgia", enrollment: 1_730_000 },
  { postal: "PA", name: "Pennsylvania", enrollment: 1_600_000 },
  { postal: "OH", name: "Ohio", enrollment: 1_550_000 },
  { postal: "NC", name: "North Carolina", enrollment: 1_500_000 },
  { postal: "MI", name: "Michigan", enrollment: 1_340_000 },
  { postal: "VA", name: "Virginia", enrollment: 1_260_000 },
  { postal: "IL", name: "Illinois", enrollment: 1_120_000 },
  { postal: "WA", name: "Washington", enrollment: 1_080_000 },
  { postal: "NJ", name: "New Jersey", enrollment: 1_050_000 },
  { postal: "IN", name: "Indiana", enrollment: 1_010_000 },
  { postal: "TN", name: "Tennessee", enrollment: 971_000 },
  { postal: "MD", name: "Maryland", enrollment: 891_000 },
  { postal: "MO", name: "Missouri", enrollment: 869_000 },
  { postal: "CO", name: "Colorado", enrollment: 865_000 },
  { postal: "MN", name: "Minnesota", enrollment: 836_000 },
  { postal: "MA", name: "Massachusetts", enrollment: 806_000 },
  { postal: "SC", name: "South Carolina", enrollment: 795_000 },
  { postal: "WI", name: "Wisconsin", enrollment: 766_000 },
  { postal: "AL", name: "Alabama", enrollment: 750_000 },
  { postal: "OK", name: "Oklahoma", enrollment: 668_000 },
  { postal: "KY", name: "Kentucky", enrollment: 654_000 },
  { postal: "AZ", name: "Arizona", enrollment: 650_000 },
  { postal: "UT", name: "Utah", enrollment: 650_000 },
  { postal: "LA", name: "Louisiana", enrollment: 609_000 },
  { postal: "OR", name: "Oregon", enrollment: 543_000 },
  { postal: "CT", name: "Connecticut", enrollment: 525_000 },
  { postal: "IA", name: "Iowa", enrollment: 504_000 },
  { postal: "NV", name: "Nevada", enrollment: 483_000 },
  { postal: "AR", name: "Arkansas", enrollment: 486_000 },
  { postal: "KS", name: "Kansas", enrollment: 470_000 },
  { postal: "MS", name: "Mississippi", enrollment: 440_000 },
  { postal: "NE", name: "Nebraska", enrollment: 330_000 },
  { postal: "ID", name: "Idaho", enrollment: 301_000 },
  { postal: "NM", name: "New Mexico", enrollment: 295_000 },
  { postal: "WV", name: "West Virginia", enrollment: 242_000 },
  { postal: "HI", name: "Hawaii", enrollment: 167_000 },
  { postal: "ME", name: "Maine", enrollment: 160_000 },
  { postal: "SD", name: "South Dakota", enrollment: 141_000 },
  { postal: "AK", name: "Alaska", enrollment: 129_000 },
  { postal: "RI", name: "Rhode Island", enrollment: 127_000 },
  { postal: "DE", name: "Delaware", enrollment: 124_000 },
  { postal: "ND", name: "North Dakota", enrollment: 118_000 },
  { postal: "NH", name: "New Hampshire", enrollment: 119_000 },
  { postal: "WY", name: "Wyoming", enrollment: 89_000 },
  { postal: "VT", name: "Vermont", enrollment: 71_000 },
  { postal: "DC", name: "District of Columbia", enrollment: 67_000 },
  { postal: "MT", name: "Montana", enrollment: 21_000 },
];

export function getStateName(postal: string): string {
  return STATE_META.find((s) => s.postal === postal.toUpperCase())?.name ?? postal;
}

export function getStateMeta(postal: string): StateMeta | undefined {
  return STATE_META.find((s) => s.postal === postal.toUpperCase());
}
