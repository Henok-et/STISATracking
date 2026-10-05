/**
 * African Union Member States and the five official AU geographical regions.
 *
 * Regional assignment follows the African Union's own regional classification
 * (Northern, Western, Central, Eastern, Southern), which differs in places from
 * UN geoscheme groupings — notably Burundi (AU: Central), Rwanda (AU: Eastern)
 * and Angola (AU: Southern).
 *
 * ISO codes are ISO 3166-1 alpha-2 / alpha-3. The alpha-2 code is the public
 * URL segment: /countries/[code].
 */

export interface RegionSeed {
  code: string;
  name: string;
  sortOrder: number;
}

export const REGIONS: RegionSeed[] = [
  { code: 'NORTH', name: 'Northern Africa', sortOrder: 1 },
  { code: 'WEST', name: 'Western Africa', sortOrder: 2 },
  { code: 'CENTRAL', name: 'Central Africa', sortOrder: 3 },
  { code: 'EAST', name: 'Eastern Africa', sortOrder: 4 },
  { code: 'SOUTH', name: 'Southern Africa', sortOrder: 5 },
];

export interface CountrySeed {
  /** Official long-form name. */
  name: string;
  /** Short display name for tables, charts and map labels. */
  shortName: string;
  iso2: string;
  iso3: string;
  regionCode: string;
}

export const AU_MEMBER_STATES: CountrySeed[] = [
  // --- Northern Africa (7) -------------------------------------------------
  { name: "People's Democratic Republic of Algeria", shortName: 'Algeria', iso2: 'DZ', iso3: 'DZA', regionCode: 'NORTH' },
  { name: 'Arab Republic of Egypt', shortName: 'Egypt', iso2: 'EG', iso3: 'EGY', regionCode: 'NORTH' },
  { name: 'State of Libya', shortName: 'Libya', iso2: 'LY', iso3: 'LBY', regionCode: 'NORTH' },
  { name: 'Islamic Republic of Mauritania', shortName: 'Mauritania', iso2: 'MR', iso3: 'MRT', regionCode: 'NORTH' },
  { name: 'Kingdom of Morocco', shortName: 'Morocco', iso2: 'MA', iso3: 'MAR', regionCode: 'NORTH' },
  { name: 'Sahrawi Arab Democratic Republic', shortName: 'Sahrawi Republic', iso2: 'EH', iso3: 'ESH', regionCode: 'NORTH' },
  { name: 'Republic of Tunisia', shortName: 'Tunisia', iso2: 'TN', iso3: 'TUN', regionCode: 'NORTH' },

  // --- Western Africa (15) -------------------------------------------------
  { name: 'Republic of Benin', shortName: 'Benin', iso2: 'BJ', iso3: 'BEN', regionCode: 'WEST' },
  { name: 'Burkina Faso', shortName: 'Burkina Faso', iso2: 'BF', iso3: 'BFA', regionCode: 'WEST' },
  { name: 'Republic of Cabo Verde', shortName: 'Cabo Verde', iso2: 'CV', iso3: 'CPV', regionCode: 'WEST' },
  { name: "Republic of Côte d'Ivoire", shortName: "Côte d'Ivoire", iso2: 'CI', iso3: 'CIV', regionCode: 'WEST' },
  { name: 'Republic of The Gambia', shortName: 'Gambia', iso2: 'GM', iso3: 'GMB', regionCode: 'WEST' },
  { name: 'Republic of Ghana', shortName: 'Ghana', iso2: 'GH', iso3: 'GHA', regionCode: 'WEST' },
  { name: 'Republic of Guinea', shortName: 'Guinea', iso2: 'GN', iso3: 'GIN', regionCode: 'WEST' },
  { name: 'Republic of Guinea-Bissau', shortName: 'Guinea-Bissau', iso2: 'GW', iso3: 'GNB', regionCode: 'WEST' },
  { name: 'Republic of Liberia', shortName: 'Liberia', iso2: 'LR', iso3: 'LBR', regionCode: 'WEST' },
  { name: 'Republic of Mali', shortName: 'Mali', iso2: 'ML', iso3: 'MLI', regionCode: 'WEST' },
  { name: 'Republic of the Niger', shortName: 'Niger', iso2: 'NE', iso3: 'NER', regionCode: 'WEST' },
  { name: 'Federal Republic of Nigeria', shortName: 'Nigeria', iso2: 'NG', iso3: 'NGA', regionCode: 'WEST' },
  { name: 'Republic of Senegal', shortName: 'Senegal', iso2: 'SN', iso3: 'SEN', regionCode: 'WEST' },
  { name: 'Republic of Sierra Leone', shortName: 'Sierra Leone', iso2: 'SL', iso3: 'SLE', regionCode: 'WEST' },
  { name: 'Togolese Republic', shortName: 'Togo', iso2: 'TG', iso3: 'TGO', regionCode: 'WEST' },

  // --- Central Africa (9) --------------------------------------------------
  { name: 'Republic of Burundi', shortName: 'Burundi', iso2: 'BI', iso3: 'BDI', regionCode: 'CENTRAL' },
  { name: 'Republic of Cameroon', shortName: 'Cameroon', iso2: 'CM', iso3: 'CMR', regionCode: 'CENTRAL' },
  { name: 'Central African Republic', shortName: 'Central African Rep.', iso2: 'CF', iso3: 'CAF', regionCode: 'CENTRAL' },
  { name: 'Republic of Chad', shortName: 'Chad', iso2: 'TD', iso3: 'TCD', regionCode: 'CENTRAL' },
  { name: 'Republic of the Congo', shortName: 'Congo', iso2: 'CG', iso3: 'COG', regionCode: 'CENTRAL' },
  { name: 'Democratic Republic of the Congo', shortName: 'DR Congo', iso2: 'CD', iso3: 'COD', regionCode: 'CENTRAL' },
  { name: 'Republic of Equatorial Guinea', shortName: 'Equatorial Guinea', iso2: 'GQ', iso3: 'GNQ', regionCode: 'CENTRAL' },
  { name: 'Gabonese Republic', shortName: 'Gabon', iso2: 'GA', iso3: 'GAB', regionCode: 'CENTRAL' },
  { name: 'Democratic Republic of São Tomé and Príncipe', shortName: 'São Tomé and Príncipe', iso2: 'ST', iso3: 'STP', regionCode: 'CENTRAL' },

  // --- Eastern Africa (14) -------------------------------------------------
  { name: 'Union of the Comoros', shortName: 'Comoros', iso2: 'KM', iso3: 'COM', regionCode: 'EAST' },
  { name: 'Republic of Djibouti', shortName: 'Djibouti', iso2: 'DJ', iso3: 'DJI', regionCode: 'EAST' },
  { name: 'State of Eritrea', shortName: 'Eritrea', iso2: 'ER', iso3: 'ERI', regionCode: 'EAST' },
  { name: 'Federal Democratic Republic of Ethiopia', shortName: 'Ethiopia', iso2: 'ET', iso3: 'ETH', regionCode: 'EAST' },
  { name: 'Republic of Kenya', shortName: 'Kenya', iso2: 'KE', iso3: 'KEN', regionCode: 'EAST' },
  { name: 'Republic of Madagascar', shortName: 'Madagascar', iso2: 'MG', iso3: 'MDG', regionCode: 'EAST' },
  { name: 'Republic of Mauritius', shortName: 'Mauritius', iso2: 'MU', iso3: 'MUS', regionCode: 'EAST' },
  { name: 'Republic of Rwanda', shortName: 'Rwanda', iso2: 'RW', iso3: 'RWA', regionCode: 'EAST' },
  { name: 'Republic of Seychelles', shortName: 'Seychelles', iso2: 'SC', iso3: 'SYC', regionCode: 'EAST' },
  { name: 'Federal Republic of Somalia', shortName: 'Somalia', iso2: 'SO', iso3: 'SOM', regionCode: 'EAST' },
  { name: 'Republic of South Sudan', shortName: 'South Sudan', iso2: 'SS', iso3: 'SSD', regionCode: 'EAST' },
  { name: 'Republic of the Sudan', shortName: 'Sudan', iso2: 'SD', iso3: 'SDN', regionCode: 'EAST' },
  { name: 'United Republic of Tanzania', shortName: 'Tanzania', iso2: 'TZ', iso3: 'TZA', regionCode: 'EAST' },
  { name: 'Republic of Uganda', shortName: 'Uganda', iso2: 'UG', iso3: 'UGA', regionCode: 'EAST' },

  // --- Southern Africa (10) ------------------------------------------------
  { name: 'Republic of Angola', shortName: 'Angola', iso2: 'AO', iso3: 'AGO', regionCode: 'SOUTH' },
  { name: 'Republic of Botswana', shortName: 'Botswana', iso2: 'BW', iso3: 'BWA', regionCode: 'SOUTH' },
  { name: 'Kingdom of Eswatini', shortName: 'Eswatini', iso2: 'SZ', iso3: 'SWZ', regionCode: 'SOUTH' },
  { name: 'Kingdom of Lesotho', shortName: 'Lesotho', iso2: 'LS', iso3: 'LSO', regionCode: 'SOUTH' },
  { name: 'Republic of Malawi', shortName: 'Malawi', iso2: 'MW', iso3: 'MWI', regionCode: 'SOUTH' },
  { name: 'Republic of Mozambique', shortName: 'Mozambique', iso2: 'MZ', iso3: 'MOZ', regionCode: 'SOUTH' },
  { name: 'Republic of Namibia', shortName: 'Namibia', iso2: 'NA', iso3: 'NAM', regionCode: 'SOUTH' },
  { name: 'Republic of South Africa', shortName: 'South Africa', iso2: 'ZA', iso3: 'ZAF', regionCode: 'SOUTH' },
  { name: 'Republic of Zambia', shortName: 'Zambia', iso2: 'ZM', iso3: 'ZMB', regionCode: 'SOUTH' },
  { name: 'Republic of Zimbabwe', shortName: 'Zimbabwe', iso2: 'ZW', iso3: 'ZWE', regionCode: 'SOUTH' },
];

export const COUNTRY_COUNT = AU_MEMBER_STATES.length; // 55
