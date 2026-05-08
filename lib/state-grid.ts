/**
 * Squarified US state grid coordinates. Each state is a 1×1 cell on a
 * coarse geographic-ish grid (similar to NPR / FiveThirtyEight tile maps).
 * Used to render the coverage map without needing a TopoJSON dataset.
 *
 * Origin (0,0) is top-left.
 */

export type GridCell = { postal: string; row: number; col: number };

export const STATE_GRID: GridCell[] = [
  // Row 0 — top edge
  { postal: "AK", row: 0, col: 0 },
  { postal: "ME", row: 0, col: 11 },
  // Row 1
  { postal: "VT", row: 1, col: 10 },
  { postal: "NH", row: 1, col: 11 },
  // Row 2
  { postal: "WA", row: 2, col: 1 },
  { postal: "ID", row: 2, col: 2 },
  { postal: "MT", row: 2, col: 3 },
  { postal: "ND", row: 2, col: 4 },
  { postal: "MN", row: 2, col: 5 },
  { postal: "IL", row: 2, col: 6 },
  { postal: "WI", row: 2, col: 7 },
  { postal: "MI", row: 2, col: 8 },
  { postal: "NY", row: 2, col: 9 },
  { postal: "MA", row: 2, col: 10 },
  // Row 3
  { postal: "OR", row: 3, col: 1 },
  { postal: "NV", row: 3, col: 2 },
  { postal: "WY", row: 3, col: 3 },
  { postal: "SD", row: 3, col: 4 },
  { postal: "IA", row: 3, col: 5 },
  { postal: "IN", row: 3, col: 6 },
  { postal: "OH", row: 3, col: 7 },
  { postal: "PA", row: 3, col: 8 },
  { postal: "NJ", row: 3, col: 9 },
  { postal: "CT", row: 3, col: 10 },
  { postal: "RI", row: 3, col: 11 },
  // Row 4
  { postal: "CA", row: 4, col: 1 },
  { postal: "UT", row: 4, col: 2 },
  { postal: "CO", row: 4, col: 3 },
  { postal: "NE", row: 4, col: 4 },
  { postal: "MO", row: 4, col: 5 },
  { postal: "KY", row: 4, col: 6 },
  { postal: "WV", row: 4, col: 7 },
  { postal: "VA", row: 4, col: 8 },
  { postal: "MD", row: 4, col: 9 },
  { postal: "DE", row: 4, col: 10 },
  // Row 5
  { postal: "AZ", row: 5, col: 2 },
  { postal: "NM", row: 5, col: 3 },
  { postal: "KS", row: 5, col: 4 },
  { postal: "AR", row: 5, col: 5 },
  { postal: "TN", row: 5, col: 6 },
  { postal: "NC", row: 5, col: 7 },
  { postal: "SC", row: 5, col: 8 },
  { postal: "DC", row: 5, col: 9 },
  // Row 6
  { postal: "HI", row: 6, col: 0 },
  { postal: "OK", row: 6, col: 4 },
  { postal: "LA", row: 6, col: 5 },
  { postal: "MS", row: 6, col: 6 },
  { postal: "AL", row: 6, col: 7 },
  { postal: "GA", row: 6, col: 8 },
  // Row 7
  { postal: "TX", row: 7, col: 4 },
  { postal: "FL", row: 7, col: 8 },
];

export const GRID_COLS = 12;
export const GRID_ROWS = 8;
