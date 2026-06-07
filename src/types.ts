export interface Team {
  id: string;
  name: string;
  flag: string; // emoji flag
  group: string; // 'A' | 'B' | ... | 'L'
  rank: number; // FIFA ranking weight for mock sim
}

export type StageType = 'group' | '1/16' | '1/8' | '1/4' | '1/2' | 'third_place' | 'final';

export interface Match {
  id: string;
  type: 'group' | 'knockout';
  stage: StageType;
  date: string; // Format: YYYY-MM-DD
  time: string; // Format: HH:MM
  venue: string;
  group?: string; // Group A-L (if group stage)
  homeTeamId: string; // If actual team, or placeholder code (e.g. "1A", "2B", "W73", etc.)
  awayTeamId: string;
  homeScore?: number; // Actual score (if played)
  awayScore?: number;
  winnerId?: string; // For knockout stages in case of penalties/draws
  // User Predictions:
  predictedHome?: string; // string or number, let's use string to allow empty input
  predictedAway?: string;
  predictedWinnerId?: string; // For knockout ties, user selects who advances
}

export interface GroupStandings {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface Group {
  id: string; // 'A', 'B', etc.
  name: string;
  teams: Team[];
}
