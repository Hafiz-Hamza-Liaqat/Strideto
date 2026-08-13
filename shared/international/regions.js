/**
 * Country → region/state/province catalogs for location cascade UI.
 *
 * Only countries with an explicit catalog return options. Unknown countries
 * return an empty list so callers can show a truthful “no catalog” state
 * instead of mixing geography from unrelated countries.
 */
import { PAKISTAN_PROVINCES } from '../constants/pakistan.js';

export const US_STATES = Object.freeze([
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia',
  'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia',
  'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
]);

export const DE_STATES = Object.freeze([
  'Baden-Württemberg', 'Bavaria', 'Berlin', 'Brandenburg', 'Bremen',
  'Hamburg', 'Hesse', 'Lower Saxony', 'Mecklenburg-Vorpommern',
  'North Rhine-Westphalia', 'Rhineland-Palatinate', 'Saarland', 'Saxony',
  'Saxony-Anhalt', 'Schleswig-Holstein', 'Thuringia',
]);

export const GB_REGIONS = Object.freeze([
  'England', 'Scotland', 'Wales', 'Northern Ireland',
]);

export const CA_PROVINCES = Object.freeze([
  'Alberta', 'British Columbia', 'Manitoba', 'New Brunswick',
  'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia',
  'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan',
  'Yukon',
]);

export const AU_STATES = Object.freeze([
  'Australian Capital Territory', 'New South Wales', 'Northern Territory',
  'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia',
]);

const CATALOG = Object.freeze({
  PK: PAKISTAN_PROVINCES.filter((p) => p !== 'Other'),
  US: US_STATES,
  DE: DE_STATES,
  GB: GB_REGIONS,
  CA: CA_PROVINCES,
  AU: AU_STATES,
});

/** Regions/states/provinces for an ISO country code, or [] when none exist. */
export function regionsForCountry(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  return CATALOG[code] ? [...CATALOG[code]] : [];
}

export function hasRegionCatalog(countryCode) {
  return regionsForCountry(countryCode).length > 0;
}
