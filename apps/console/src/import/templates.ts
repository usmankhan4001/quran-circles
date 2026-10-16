import { toCsv } from '../lib/csv';
import type { ImportKind } from './types';

/**
 * Starter files with the right headers and one synthetic example row each. The examples use
 * invented places and a reserved-looking number, never real people.
 */
const TEMPLATES: Record<ImportKind, string[][]> = {
  venues: [
    [
      'city',
      'area',
      'name_en',
      'name_ur',
      'address_en',
      'address_ur',
      'lat',
      'lng',
      'contact_phone',
      'women_section',
      'parking',
      'wudu_area',
      'wheelchair_access',
      'child_friendly',
      'entrance_notes_en',
      'entrance_notes_ur',
    ],
    [
      'karachi',
      'gulshan-e-iqbal',
      'Sample Masjid',
      '',
      'Sample Road (example address)',
      '',
      '24.9215',
      '67.0914',
      '021 0000000',
      'yes',
      'no',
      'yes',
      'no',
      'yes',
      '',
      '',
    ],
  ],
  coordinators: [
    ['phone', 'name', 'role', 'city', 'venue'],
    ['0300 0000099', 'Sample Coordinator', 'venue_coordinator', 'karachi', 'Sample Masjid'],
  ],
  sessions: [
    [
      'venue',
      'city',
      'title_en',
      'title_ur',
      'kind',
      'program',
      'section',
      'language',
      'start_time',
      'duration_minutes',
      'days',
      'starts_on',
      'ends_on',
      'date',
      'capacity',
      'registration',
      'status',
    ],
    [
      'Sample Masjid',
      'karachi',
      'Sample Evening Circle',
      '',
      'recurring',
      'circles',
      'family',
      'ur',
      '20:00',
      '60',
      'Mon|Wed',
      '2027-03-01',
      '',
      '',
      '',
      'yes',
      'published',
    ],
  ],
};

export const templateCsv = (kind: ImportKind): string => toCsv(TEMPLATES[kind]);
export const templateRows = (kind: ImportKind): string[][] => TEMPLATES[kind];
