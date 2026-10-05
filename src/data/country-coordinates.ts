/**
 * Approximate geographic centroids for the 55 AU Member States, keyed by
 * ISO 3166-1 alpha-2.
 *
 * These are PRESENTATION geometry — used to place markers on the globe — and
 * are deliberately not stored in the database. They are not reported data, they
 * never enter an analytic calculation, and no figure on the platform depends on
 * them. A centroid is only accurate enough to put a dot on the right country at
 * globe scale; do not use these for anything requiring real precision.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export const COUNTRY_COORDINATES: Record<string, LatLng> = {
  // --- Northern Africa ---
  DZ: { lat: 28.03, lng: 1.66 },
  EG: { lat: 26.82, lng: 30.8 },
  LY: { lat: 26.34, lng: 17.23 },
  MR: { lat: 21.01, lng: -10.94 },
  MA: { lat: 31.79, lng: -7.09 },
  EH: { lat: 24.22, lng: -12.89 },
  TN: { lat: 33.89, lng: 9.54 },

  // --- Western Africa ---
  BJ: { lat: 9.31, lng: 2.32 },
  BF: { lat: 12.24, lng: -1.56 },
  CV: { lat: 16.0, lng: -24.01 },
  CI: { lat: 7.54, lng: -5.55 },
  GM: { lat: 13.44, lng: -15.31 },
  GH: { lat: 7.95, lng: -1.02 },
  GN: { lat: 9.95, lng: -9.7 },
  GW: { lat: 11.8, lng: -15.18 },
  LR: { lat: 6.43, lng: -9.43 },
  ML: { lat: 17.57, lng: -4.0 },
  NE: { lat: 17.61, lng: 8.08 },
  NG: { lat: 9.08, lng: 8.68 },
  SN: { lat: 14.5, lng: -14.45 },
  SL: { lat: 8.46, lng: -11.78 },
  TG: { lat: 8.62, lng: 0.82 },

  // --- Central Africa ---
  BI: { lat: -3.37, lng: 29.92 },
  CM: { lat: 7.37, lng: 12.35 },
  CF: { lat: 6.61, lng: 20.94 },
  TD: { lat: 15.45, lng: 18.73 },
  CG: { lat: -0.23, lng: 15.83 },
  CD: { lat: -4.04, lng: 21.76 },
  GQ: { lat: 1.65, lng: 10.27 },
  GA: { lat: -0.8, lng: 11.61 },
  ST: { lat: 0.19, lng: 6.61 },

  // --- Eastern Africa ---
  KM: { lat: -11.65, lng: 43.33 },
  DJ: { lat: 11.83, lng: 42.59 },
  ER: { lat: 15.18, lng: 39.78 },
  ET: { lat: 9.15, lng: 40.49 },
  KE: { lat: -0.02, lng: 37.91 },
  MG: { lat: -18.77, lng: 46.87 },
  MU: { lat: -20.35, lng: 57.55 },
  RW: { lat: -1.94, lng: 29.87 },
  SC: { lat: -4.68, lng: 55.49 },
  SO: { lat: 5.15, lng: 46.2 },
  SS: { lat: 6.88, lng: 31.31 },
  SD: { lat: 12.86, lng: 30.22 },
  TZ: { lat: -6.37, lng: 34.89 },
  UG: { lat: 1.37, lng: 32.29 },

  // --- Southern Africa ---
  AO: { lat: -11.2, lng: 17.87 },
  BW: { lat: -22.33, lng: 24.68 },
  SZ: { lat: -26.52, lng: 31.47 },
  LS: { lat: -29.61, lng: 28.23 },
  MW: { lat: -13.25, lng: 34.3 },
  MZ: { lat: -18.67, lng: 35.53 },
  NA: { lat: -22.96, lng: 18.49 },
  ZA: { lat: -30.56, lng: 22.94 },
  ZM: { lat: -13.13, lng: 27.85 },
  ZW: { lat: -19.02, lng: 29.15 },
};

/** Longitude the globe is framed on so the African continent faces the viewer. */
export const AFRICA_CENTRE_LNG = 19;
