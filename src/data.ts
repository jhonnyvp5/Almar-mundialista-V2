import { Team, Match } from './types';

export const TEAMS: Team[] = [
  // Group A
  { id: 'MEX', name: 'México', flag: '🇲🇽', group: 'A', rank: 15 },
  { id: 'RSA', name: 'Sudáfrica', flag: '🇿🇦', group: 'A', rank: 59 },
  { id: 'KOR', name: 'Corea del Sur', flag: '🇰🇷', group: 'A', rank: 22 },
  { id: 'CZE', name: 'Chequia', flag: '🇨🇿', group: 'A', rank: 36 },

  // Group B
  { id: 'CAN', name: 'Canadá', flag: '🇨🇦', group: 'B', rank: 40 },
  { id: 'BIH', name: 'Bosnia y Herzegovina', flag: '🇧🇦', group: 'B', rank: 74 },
  { id: 'QAT', name: 'Qatar', flag: '🇶🇦', group: 'B', rank: 46 },
  { id: 'SUI', name: 'Suiza', flag: '🇨🇭', group: 'B', rank: 19 },

  // Group C
  { id: 'BRA', name: 'Brasil', flag: '🇧🇷', group: 'C', rank: 5 },
  { id: 'MAR', name: 'Marruecos', flag: '🇲🇦', group: 'C', rank: 13 },
  { id: 'HAI', name: 'Haití', flag: '🇭🇹', group: 'C', rank: 86 },
  { id: 'SCO', name: 'Escocia', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'C', rank: 39 },

  // Group D
  { id: 'USA', name: 'Estados Unidos', flag: '🇺🇸', group: 'D', rank: 11 },
  { id: 'PAR', name: 'Paraguay', flag: '🇵🇾', group: 'D', rank: 56 },
  { id: 'AUS', name: 'Australia', flag: '🇦🇺', group: 'D', rank: 23 },
  { id: 'TUR', name: 'Turquía', flag: '🇹🇷', group: 'D', rank: 42 },

  // Group E
  { id: 'GER', name: 'Alemania', flag: '🇩🇪', group: 'E', rank: 16 },
  { id: 'CUW', name: 'Curazao', flag: '🇨🇼', group: 'E', rank: 88 },
  { id: 'CIV', name: 'Costa de Marfil', flag: '🇨🇮', group: 'E', rank: 38 },
  { id: 'ECU', name: 'Ecuador', flag: '🇪🇨', group: 'E', rank: 31 },

  // Group F
  { id: 'NED', name: 'Países Bajos', flag: '🇳🇱', group: 'F', rank: 7 },
  { id: 'JPN', name: 'Japón', flag: '🇯🇵', group: 'F', rank: 18 },
  { id: 'SWE', name: 'Suecia', flag: '🇸🇪', group: 'F', rank: 28 },
  { id: 'TUN', name: 'Túnez', flag: '🇹🇳', group: 'F', rank: 41 },

  // Group G
  { id: 'BEL', name: 'Bélgica', flag: '🇧🇪', group: 'G', rank: 3 },
  { id: 'EGY', name: 'Egipto', flag: '🇪🇬', group: 'G', rank: 37 },
  { id: 'IRN', name: 'Irán', flag: '🇮🇷', group: 'G', rank: 20 },
  { id: 'NZL', name: 'Nueva Zelanda', flag: '🇳🇿', group: 'G', rank: 104 },

  // Group H
  { id: 'ESP', name: 'España', flag: '🇪🇸', group: 'H', rank: 8 },
  { id: 'CPV', name: 'Cabo Verde', flag: '🇨🇻', group: 'H', rank: 65 },
  { id: 'KSA', name: 'Arabia Saudita', flag: '🇸🇦', group: 'H', rank: 53 },
  { id: 'URU', name: 'Uruguay', flag: '🇺🇾', group: 'H', rank: 15 },

  // Group I
  { id: 'FRA', name: 'Francia', flag: '🇫🇷', group: 'I', rank: 2 },
  { id: 'SEN', name: 'Senegal', flag: '🇸🇳', group: 'I', rank: 17 },
  { id: 'IRQ', name: 'Iraq', flag: '🇮🇶', group: 'I', rank: 58 },
  { id: 'NOR', name: 'Noruega', flag: '🇳🇴', group: 'I', rank: 44 },

  // Group J
  { id: 'ARG', name: 'Argentina', flag: '🇦🇷', group: 'J', rank: 1 },
  { id: 'ALG', name: 'Argelia', flag: '🇩🇿', group: 'J', rank: 43 },
  { id: 'AUT', name: 'Austria', flag: '🇦🇹', group: 'J', rank: 25 },
  { id: 'JOR', name: 'Jordania', flag: '🇯🇴', group: 'J', rank: 71 },

  // Group K
  { id: 'POR', name: 'Portugal', flag: '🇵🇹', group: 'K', rank: 6 },
  { id: 'COD', name: 'RD Congo', flag: '🇨🇩', group: 'K', rank: 63 },
  { id: 'UZB', name: 'Uzbekistán', flag: '🇺🇿', group: 'K', rank: 66 },
  { id: 'COL', name: 'Colombia', flag: '🇨🇴', group: 'K', rank: 14 },

  // Group L
  { id: 'ENG', name: 'Inglaterra', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'L', rank: 4 },
  { id: 'CRO', name: 'Croacia', flag: '🇭🇷', group: 'L', rank: 10 },
  { id: 'GHA', name: 'Ghana', flag: '🇬🇭', group: 'L', rank: 61 },
  { id: 'PAN', name: 'Panamá', flag: '🇵🇦', group: 'L', rank: 45 }
];

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

export const VENUES = [
  'Estadio Azteca, Ciudad de México',
  'MetLife Stadium, New York / New Jersey',
  'AT&T Stadium, Dallas',
  'SoFi Stadium, Los Angeles',
  'Mercedes-Benz Stadium, Atlanta',
  'Hard Rock Stadium, Miami',
  'Lumen Field, Seattle',
  'BC Place, Vancouver',
  'BMO Field, Toronto',
  'Estadio BBVA, Monterrey',
  'Estadio Akron, Guadalajara',
  'Gillette Stadium, Boston',
  'NRG Stadium, Houston',
  'Arrowhead Stadium, Kansas City',
  'Lincoln Financial Field, Philadelphia',
  'Levi\'s Stadium, San Francisco'
];

// Generates the 72 group stage matches nicely across dates
export function generateGroupStageMatches(): Match[] {
  const matches: Match[] = [
    // Jueves, 11 de Junio 2026
    { id: 'G-1', type: 'group', stage: 'group', group: 'A', date: '2026-06-11', time: '14:00', venue: VENUES[0], homeTeamId: 'MEX', awayTeamId: 'RSA' },
    { id: 'G-2', type: 'group', stage: 'group', group: 'A', date: '2026-06-11', time: '21:00', venue: VENUES[1], homeTeamId: 'KOR', awayTeamId: 'CZE' },

    // Viernes, 12 de Junio 2026
    { id: 'G-3', type: 'group', stage: 'group', group: 'B', date: '2026-06-12', time: '14:00', venue: VENUES[2], homeTeamId: 'CAN', awayTeamId: 'BIH' },
    { id: 'G-4', type: 'group', stage: 'group', group: 'D', date: '2026-06-12', time: '20:00', venue: VENUES[3], homeTeamId: 'USA', awayTeamId: 'PAR' },

    // Sábado, 13 de Junio 2026
    { id: 'G-5', type: 'group', stage: 'group', group: 'B', date: '2026-06-13', time: '14:00', venue: VENUES[4], homeTeamId: 'QAT', awayTeamId: 'SUI' },
    { id: 'G-6', type: 'group', stage: 'group', group: 'C', date: '2026-06-13', time: '17:00', venue: VENUES[5], homeTeamId: 'BRA', awayTeamId: 'MAR' },
    { id: 'G-7', type: 'group', stage: 'group', group: 'C', date: '2026-06-13', time: '20:00', venue: VENUES[6], homeTeamId: 'HAI', awayTeamId: 'SCO' },
    { id: 'G-8', type: 'group', stage: 'group', group: 'D', date: '2026-06-13', time: '23:00', venue: VENUES[7], homeTeamId: 'AUS', awayTeamId: 'TUR' },

    // Domingo, 14 de Junio 2026
    { id: 'G-9', type: 'group', stage: 'group', group: 'E', date: '2026-06-14', time: '12:00', venue: VENUES[8], homeTeamId: 'GER', awayTeamId: 'CUW' },
    { id: 'G-10', type: 'group', stage: 'group', group: 'F', date: '2026-06-14', time: '15:00', venue: VENUES[9], homeTeamId: 'NED', awayTeamId: 'JPN' },
    { id: 'G-11', type: 'group', stage: 'group', group: 'E', date: '2026-06-14', time: '18:00', venue: VENUES[10], homeTeamId: 'CIV', awayTeamId: 'ECU' },
    { id: 'G-12', type: 'group', stage: 'group', group: 'F', date: '2026-06-14', time: '21:00', venue: VENUES[11], homeTeamId: 'SWE', awayTeamId: 'TUN' },

    // Lunes, 15 de Junio 2026
    { id: 'G-13', type: 'group', stage: 'group', group: 'H', date: '2026-06-15', time: '11:00', venue: VENUES[12], homeTeamId: 'ESP', awayTeamId: 'CPV' },
    { id: 'G-14', type: 'group', stage: 'group', group: 'G', date: '2026-06-15', time: '14:00', venue: VENUES[13], homeTeamId: 'BEL', awayTeamId: 'EGY' },
    { id: 'G-15', type: 'group', stage: 'group', group: 'H', date: '2026-06-15', time: '17:00', venue: VENUES[14], homeTeamId: 'KSA', awayTeamId: 'URU' },
    { id: 'G-16', type: 'group', stage: 'group', group: 'G', date: '2026-06-15', time: '20:00', venue: VENUES[15], homeTeamId: 'IRN', awayTeamId: 'NZL' },

    // Martes, 16 de Junio 2026
    { id: 'G-17', type: 'group', stage: 'group', group: 'I', date: '2026-06-16', time: '14:00', venue: VENUES[0], homeTeamId: 'FRA', awayTeamId: 'SEN' },
    { id: 'G-18', type: 'group', stage: 'group', group: 'I', date: '2026-06-16', time: '17:00', venue: VENUES[1], homeTeamId: 'IRQ', awayTeamId: 'NOR' },
    { id: 'G-19', type: 'group', stage: 'group', group: 'J', date: '2026-06-16', time: '20:00', venue: VENUES[2], homeTeamId: 'ARG', awayTeamId: 'ALG' },
    { id: 'G-20', type: 'group', stage: 'group', group: 'J', date: '2026-06-16', time: '23:00', venue: VENUES[3], homeTeamId: 'AUT', awayTeamId: 'JOR' },

    // Miércoles, 17 de Junio 2026
    { id: 'G-21', type: 'group', stage: 'group', group: 'K', date: '2026-06-17', time: '12:00', venue: VENUES[4], homeTeamId: 'POR', awayTeamId: 'COD' },
    { id: 'G-22', type: 'group', stage: 'group', group: 'L', date: '2026-06-17', time: '15:00', venue: VENUES[5], homeTeamId: 'ENG', awayTeamId: 'CRO' },
    { id: 'G-23', type: 'group', stage: 'group', group: 'L', date: '2026-06-17', time: '18:00', venue: VENUES[6], homeTeamId: 'GHA', awayTeamId: 'PAN' },
    { id: 'G-24', type: 'group', stage: 'group', group: 'K', date: '2026-06-17', time: '21:00', venue: VENUES[7], homeTeamId: 'UZB', awayTeamId: 'COL' },

    // Jueves, 18 de Junio 2026
    { id: 'G-25', type: 'group', stage: 'group', group: 'A', date: '2026-06-18', time: '11:00', venue: VENUES[8], homeTeamId: 'CZE', awayTeamId: 'RSA' },
    { id: 'G-26', type: 'group', stage: 'group', group: 'B', date: '2026-06-18', time: '14:00', venue: VENUES[9], homeTeamId: 'SUI', awayTeamId: 'BIH' },
    { id: 'G-27', type: 'group', stage: 'group', group: 'B', date: '2026-06-18', time: '17:00', venue: VENUES[10], homeTeamId: 'CAN', awayTeamId: 'QAT' },
    { id: 'G-28', type: 'group', stage: 'group', group: 'A', date: '2026-06-18', time: '20:00', venue: VENUES[11], homeTeamId: 'MEX', awayTeamId: 'KOR' },

    // Viernes, 19 de Junio 2026
    { id: 'G-29', type: 'group', stage: 'group', group: 'D', date: '2026-06-19', time: '14:00', venue: VENUES[12], homeTeamId: 'USA', awayTeamId: 'AUS' },
    { id: 'G-30', type: 'group', stage: 'group', group: 'C', date: '2026-06-19', time: '17:00', venue: VENUES[13], homeTeamId: 'SCO', awayTeamId: 'MAR' },
    { id: 'G-31', type: 'group', stage: 'group', group: 'C', date: '2026-06-19', time: '19:30', venue: VENUES[14], homeTeamId: 'BRA', awayTeamId: 'HAI' },
    { id: 'G-32', type: 'group', stage: 'group', group: 'D', date: '2026-06-19', time: '22:00', venue: VENUES[15], homeTeamId: 'TUR', awayTeamId: 'PAR' },

    // Sábado, 20 de Junio 2026
    { id: 'G-33', type: 'group', stage: 'group', group: 'F', date: '2026-06-20', time: '12:00', venue: VENUES[0], homeTeamId: 'NED', awayTeamId: 'SWE' },
    { id: 'G-34', type: 'group', stage: 'group', group: 'E', date: '2026-06-20', time: '15:00', venue: VENUES[1], homeTeamId: 'GER', awayTeamId: 'CIV' },
    { id: 'G-35', type: 'group', stage: 'group', group: 'E', date: '2026-06-20', time: '19:00', venue: VENUES[2], homeTeamId: 'ECU', awayTeamId: 'CUW' },
    { id: 'G-36', type: 'group', stage: 'group', group: 'F', date: '2026-06-20', time: '23:00', venue: VENUES[3], homeTeamId: 'TUN', awayTeamId: 'JPN' },

    // Domingo, 21 de Junio 2026
    { id: 'G-37', type: 'group', stage: 'group', group: 'H', date: '2026-06-21', time: '11:00', venue: VENUES[4], homeTeamId: 'ESP', awayTeamId: 'KSA' },
    { id: 'G-38', type: 'group', stage: 'group', group: 'G', date: '2026-06-21', time: '14:00', venue: VENUES[5], homeTeamId: 'BEL', awayTeamId: 'IRN' },
    { id: 'G-39', type: 'group', stage: 'group', group: 'H', date: '2026-06-21', time: '17:00', venue: VENUES[6], homeTeamId: 'URU', awayTeamId: 'CPV' },
    { id: 'G-40', type: 'group', stage: 'group', group: 'G', date: '2026-06-21', time: '20:00', venue: VENUES[7], homeTeamId: 'NZL', awayTeamId: 'EGY' },

    // Lunes, 22 de Junio 2026
    { id: 'G-41', type: 'group', stage: 'group', group: 'J', date: '2026-06-22', time: '12:00', venue: VENUES[8], homeTeamId: 'ARG', awayTeamId: 'AUT' },
    { id: 'G-42', type: 'group', stage: 'group', group: 'I', date: '2026-06-22', time: '16:00', venue: VENUES[9], homeTeamId: 'FRA', awayTeamId: 'IRQ' },
    { id: 'G-43', type: 'group', stage: 'group', group: 'I', date: '2026-06-22', time: '19:00', venue: VENUES[10], homeTeamId: 'NOR', awayTeamId: 'SEN' },
    { id: 'G-44', type: 'group', stage: 'group', group: 'J', date: '2026-06-22', time: '22:00', venue: VENUES[11], homeTeamId: 'JOR', awayTeamId: 'ALG' },

    // Martes, 23 de Junio 2026
    { id: 'G-45', type: 'group', stage: 'group', group: 'K', date: '2026-06-23', time: '12:00', venue: VENUES[12], homeTeamId: 'POR', awayTeamId: 'UZB' },
    { id: 'G-46', type: 'group', stage: 'group', group: 'L', date: '2026-06-23', time: '15:00', venue: VENUES[13], homeTeamId: 'ENG', awayTeamId: 'GHA' },
    { id: 'G-47', type: 'group', stage: 'group', group: 'L', date: '2026-06-23', time: '18:00', venue: VENUES[14], homeTeamId: 'PAN', awayTeamId: 'CRO' },
    { id: 'G-48', type: 'group', stage: 'group', group: 'K', date: '2026-06-23', time: '21:00', venue: VENUES[15], homeTeamId: 'COL', awayTeamId: 'COD' },

    // Miércoles, 24 de Junio 2026
    { id: 'G-49', type: 'group', stage: 'group', group: 'B', date: '2026-06-24', time: '14:00', venue: VENUES[0], homeTeamId: 'BIH', awayTeamId: 'QAT' },
    { id: 'G-50', type: 'group', stage: 'group', group: 'B', date: '2026-06-24', time: '14:00', venue: VENUES[1], homeTeamId: 'SUI', awayTeamId: 'CAN' },
    { id: 'G-51', type: 'group', stage: 'group', group: 'C', date: '2026-06-24', time: '17:00', venue: VENUES[2], homeTeamId: 'MAR', awayTeamId: 'HAI' },
    { id: 'G-52', type: 'group', stage: 'group', group: 'C', date: '2026-06-24', time: '17:00', venue: VENUES[3], homeTeamId: 'SCO', awayTeamId: 'BRA' },
    { id: 'G-53', type: 'group', stage: 'group', group: 'A', date: '2026-06-24', time: '20:00', venue: VENUES[4], homeTeamId: 'CZE', awayTeamId: 'MEX' },
    { id: 'G-54', type: 'group', stage: 'group', group: 'A', date: '2026-06-24', time: '20:00', venue: VENUES[5], homeTeamId: 'RSA', awayTeamId: 'KOR' },

    // Jueves, 25 de Junio 2026
    { id: 'G-55', type: 'group', stage: 'group', group: 'E', date: '2026-06-25', time: '15:00', venue: VENUES[6], homeTeamId: 'CUW', awayTeamId: 'CIV' },
    { id: 'G-56', type: 'group', stage: 'group', group: 'E', date: '2026-06-25', time: '15:00', venue: VENUES[7], homeTeamId: 'ECU', awayTeamId: 'GER' },
    { id: 'G-57', type: 'group', stage: 'group', group: 'F', date: '2026-06-25', time: '18:00', venue: VENUES[8], homeTeamId: 'JPN', awayTeamId: 'SWE' },
    { id: 'G-58', type: 'group', stage: 'group', group: 'F', date: '2026-06-25', time: '18:00', venue: VENUES[9], homeTeamId: 'TUN', awayTeamId: 'NED' },
    { id: 'G-59', type: 'group', stage: 'group', group: 'D', date: '2026-06-25', time: '21:00', venue: VENUES[10], homeTeamId: 'PAR', awayTeamId: 'AUS' },
    { id: 'G-60', type: 'group', stage: 'group', group: 'D', date: '2026-06-25', time: '21:00', venue: VENUES[11], homeTeamId: 'TUR', awayTeamId: 'USA' },

    // Viernes, 26 de Junio 2026
    { id: 'G-61', type: 'group', stage: 'group', group: 'I', date: '2026-06-26', time: '14:00', venue: VENUES[12], homeTeamId: 'NOR', awayTeamId: 'FRA' },
    { id: 'G-62', type: 'group', stage: 'group', group: 'I', date: '2026-06-26', time: '14:00', venue: VENUES[13], homeTeamId: 'SEN', awayTeamId: 'IRQ' },
    { id: 'G-63', type: 'group', stage: 'group', group: 'H', date: '2026-06-26', time: '19:00', venue: VENUES[14], homeTeamId: 'CPV', awayTeamId: 'KSA' },
    { id: 'G-64', type: 'group', stage: 'group', group: 'H', date: '2026-06-26', time: '19:00', venue: VENUES[15], homeTeamId: 'URU', awayTeamId: 'ESP' },
    { id: 'G-65', type: 'group', stage: 'group', group: 'G', date: '2026-06-26', time: '22:00', venue: VENUES[0], homeTeamId: 'EGY', awayTeamId: 'IRN' },
    { id: 'G-66', type: 'group', stage: 'group', group: 'G', date: '2026-06-26', time: '22:00', venue: VENUES[1], homeTeamId: 'NZL', awayTeamId: 'BEL' },

    // Sábado, 27 de Junio 2026
    { id: 'G-67', type: 'group', stage: 'group', group: 'L', date: '2026-06-27', time: '16:00', venue: VENUES[2], homeTeamId: 'CRO', awayTeamId: 'GHA' },
    { id: 'G-68', type: 'group', stage: 'group', group: 'L', date: '2026-06-27', time: '16:00', venue: VENUES[3], homeTeamId: 'PAN', awayTeamId: 'ENG' },
    { id: 'G-69', type: 'group', stage: 'group', group: 'K', date: '2026-06-27', time: '18:30', venue: VENUES[4], homeTeamId: 'COL', awayTeamId: 'POR' },
    { id: 'G-70', type: 'group', stage: 'group', group: 'K', date: '2026-06-27', time: '18:30', venue: VENUES[5], homeTeamId: 'COD', awayTeamId: 'UZB' },
    { id: 'G-71', type: 'group', stage: 'group', group: 'J', date: '2026-06-27', time: '21:00', venue: VENUES[6], homeTeamId: 'ALG', awayTeamId: 'AUT' },
    { id: 'G-72', type: 'group', stage: 'group', group: 'J', date: '2026-06-27', time: '21:00', venue: VENUES[7], homeTeamId: 'JOR', awayTeamId: 'ARG' }
  ];

  return matches.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

// Generate the initial placeholder Knockout matches (Round of 32 onwards)
// The actual teams are resolved dynamically from the group standings,
// but we define the empty fixture list here.
export function generateKnockoutMatches(): Match[] {
  const matches: Match[] = [];

  // 1/16 Final (Round of 32)
  // June 28 to July 3, 2026
  const r32Dates = [
    '2026-06-28', '2026-06-28', '2026-06-29', '2026-06-29',
    '2026-06-30', '2026-06-30', '2026-07-01', '2026-07-01',
    '2026-07-02', '2026-07-02', '2026-07-03', '2026-07-03',
    '2026-06-28', '2026-06-29', '2026-07-01', '2026-07-02'
  ];

  // We have 16 matches in Round of 32
  // Let's map homeTeamId and awayTeamId to placeholders
  const r32Pairings = [
    { home: '1E', away: '3_ABCDF' },  // K73
    { home: '1I', away: '3_CDFGH' },  // K74
    { home: '2A', away: '2B' },       // K75
    { home: '1F', away: '2C' },       // K76
    { home: '2K', away: '2L' },       // K77
    { home: '1H', away: '2J' },       // K78
    { home: '1D', away: '3_BEFIJ' },  // K79
    { home: '1G', away: '3_AEHIJ' },  // K80
    { home: '1C', away: '2F' },       // K81
    { home: '2E', away: '2I' },       // K82
    { home: '1A', away: '3_CEFHI' },  // K83
    { home: '1L', away: '3_EHIJK' },  // K84
    { home: '1J', away: '2H' },       // K85
    { home: '2D', away: '2G' },       // K86
    { home: '1B', away: '3_EFGIJ' },  // K87
    { home: '1K', away: '3_DEIJL' },  // K88
  ];

  for (let i = 0; i < 16; i++) {
    matches.push({
      id: `K${73 + i}`,
      type: 'knockout',
      stage: '1/16',
      date: r32Dates[i],
      time: i % 2 === 0 ? '14:00' : '19:00',
      venue: VENUES[i % VENUES.length],
      homeTeamId: r32Pairings[i].home,
      awayTeamId: r32Pairings[i].away,
    });
  }

  // 1/8 Final (Round of 16)
  // July 4 to July 7
  const r16Pairings = [
    { home: 'WK73', away: 'WK74' }, // K89
    { home: 'WK75', away: 'WK76' }, // K90
    { home: 'WK77', away: 'WK78' }, // K91
    { home: 'WK79', away: 'WK80' }, // K92
    { home: 'WK81', away: 'WK82' }, // K93
    { home: 'WK83', away: 'WK84' }, // K94
    { home: 'WK85', away: 'WK86' }, // K95
    { home: 'WK87', away: 'WK88' }, // K96
  ];
  const r16Dates = ['2026-07-04', '2026-07-04', '2026-07-05', '2026-07-05', '2026-07-06', '2026-07-06', '2026-07-07', '2026-07-07'];

  for (let i = 0; i < 8; i++) {
    matches.push({
      id: `K${89 + i}`,
      type: 'knockout',
      stage: '1/8',
      date: r16Dates[i],
      time: i % 2 === 0 ? '14:00' : '19:00',
      venue: VENUES[(16 + i) % VENUES.length],
      homeTeamId: r16Pairings[i].home,
      awayTeamId: r16Pairings[i].away,
    });
  }

  // 1/4 Final
  // July 9 to July 11
  const qfPairings = [
    { home: 'WK89', away: 'WK90' }, // K97
    { home: 'WK91', away: 'WK92' }, // K98
    { home: 'WK93', away: 'WK94' }, // K99
    { home: 'WK95', away: 'WK96' }, // K100
  ];
  const qfDates = ['2026-07-09', '2026-07-10', '2026-07-10', '2026-07-11'];

  for (let i = 0; i < 4; i++) {
    matches.push({
      id: `K${97 + i}`,
      type: 'knockout',
      stage: '1/4',
      date: qfDates[i],
      time: i === 0 || i === 3 ? '19:00' : '14:00',
      venue: VENUES[(24 + i) % VENUES.length],
      homeTeamId: qfPairings[i].home,
      awayTeamId: qfPairings[i].away,
    });
  }

  // Semi-finals (1/2)
  // July 14 and July 15
  const sfPairings = [
    { home: 'WK97', away: 'WK98' },  // K101
    { home: 'WK99', away: 'WK100' }, // K102
  ];
  matches.push({
    id: 'K101',
    type: 'knockout',
    stage: '1/2',
    date: '2026-07-14',
    time: '19:00',
    venue: VENUES[2], // Dallas AT&T Stadium
    homeTeamId: sfPairings[0].home,
    awayTeamId: sfPairings[0].away,
  });
  matches.push({
    id: 'K102',
    type: 'knockout',
    stage: '1/2',
    date: '2026-07-15',
    time: '19:00',
    venue: VENUES[4], // Atlanta Mercedes-Benz Stadium
    homeTeamId: sfPairings[1].home,
    awayTeamId: sfPairings[1].away,
  });

  // Third Place (Third place play-off)
  // July 18
  matches.push({
    id: 'K103',
    type: 'knockout',
    stage: 'third_place',
    date: '2026-07-18',
    time: '15:00',
    venue: VENUES[5], // Miami Hard Rock Stadium
    homeTeamId: 'LK101',
    awayTeamId: 'LK102',
  });

  // Final
  // July 19
  matches.push({
    id: 'K104',
    type: 'knockout',
    stage: 'final',
    date: '2026-07-19',
    time: '16:00',
    venue: VENUES[1], // MetLife Stadium, New York / New Jersey Ground Winner
    homeTeamId: 'WK101',
    awayTeamId: 'WK102',
  });

  return matches;
}
