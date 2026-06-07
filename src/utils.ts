import { Team, Match, GroupStandings, StageType } from './types';
import { TEAMS, GROUPS } from './data';

// Computes standings for a single group based on match predictions
export function computeGroupStandings(gId: string, groupMatches: Match[]): GroupStandings[] {
  const gTeams = TEAMS.filter((t) => t.group === gId);
  const standings: Record<string, GroupStandings> = {};

  gTeams.forEach((t) => {
    standings[t.id] = {
      teamId: t.id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    };
  });

  groupMatches.forEach((m) => {
    if (m.group !== gId) return;
    const hasOfficial = m.homeScore !== undefined && m.homeScore !== null;
    const hVal = hasOfficial ? String(m.homeScore) : m.predictedHome;
    const aVal = hasOfficial ? String(m.awayScore) : m.predictedAway;

    const hasScore = hVal !== undefined && hVal !== null && hVal.trim() !== '' &&
                     aVal !== undefined && aVal !== null && aVal.trim() !== '';

    if (hasScore) {
      const hScore = parseInt(hVal!, 10);
      const aScore = parseInt(aVal!, 10);

      // Validate parsable scores
      if (!isNaN(hScore) && !isNaN(aScore)) {
        const homeStand = standings[m.homeTeamId];
        const awayStand = standings[m.awayTeamId];

        if (homeStand && awayStand) {
          homeStand.played += 1;
          awayStand.played += 1;

          homeStand.goalsFor += hScore;
          homeStand.goalsAgainst += aScore;

          awayStand.goalsFor += aScore;
          awayStand.goalsAgainst += hScore;

          if (hScore > aScore) {
            homeStand.won += 1;
            homeStand.points += 3;
            awayStand.lost += 1;
          } else if (hScore < aScore) {
            awayStand.won += 1;
            awayStand.points += 3;
            homeStand.lost += 1;
          } else {
            homeStand.drawn += 1;
            homeStand.points += 1;
            awayStand.drawn += 1;
            awayStand.points += 1;
          }

          homeStand.goalDifference = homeStand.goalsFor - homeStand.goalsAgainst;
          awayStand.goalDifference = awayStand.goalsFor - awayStand.goalsAgainst;
        }
      }
    }
  });

  // Sort standings rules:
  // 1. Points
  // 2. Goal Difference
  // 3. Goals For
  // 4. Fallback on FIFA Rank (better rank is lower number)
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    const teamA = TEAMS.find((t) => t.id === a.teamId);
    const teamB = TEAMS.find((t) => t.id === b.teamId);
    return (teamA?.rank || 99) - (teamB?.rank || 99);
  });
}

// Compute all group standings
export function computeAllStandings(allMatches: Match[]): Record<string, GroupStandings[]> {
  const allStandings: Record<string, GroupStandings[]> = {};
  GROUPS.forEach((gId) => {
    const groupMatches = allMatches.filter((m) => m.group === gId);
    allStandings[gId] = computeGroupStandings(gId, groupMatches);
  });
  return allStandings;
}

// Get best third placed teams ranked
export function getRankedThirdPlacedTeams(allStandings: Record<string, GroupStandings[]>): Team[] {
  const thirdsList: { team: Team; stats: GroupStandings }[] = [];

  GROUPS.forEach((gId) => {
    const standings = allStandings[gId];
    if (standings && standings.length >= 3) {
      const thirdStats = standings[2];
      const team = TEAMS.find((t) => t.id === thirdStats.teamId);
      if (team) {
        thirdsList.push({ team, stats: thirdStats });
      }
    }
  });

  // Sort criteria for 3rd places:
  // 1. Points
  // 2. Goal Difference
  // 3. Goals For
  // 4. FIFA rank
  thirdsList.sort((a, b) => {
    if (b.stats.points !== a.stats.points) return b.stats.points - a.stats.points;
    if (b.stats.goalDifference !== a.stats.goalDifference) return b.stats.goalDifference - a.stats.goalDifference;
    if (b.stats.goalsFor !== a.stats.goalsFor) return b.stats.goalsFor - a.stats.goalsFor;
    return a.team.rank - b.team.rank;
  });

  return thirdsList.map((item) => item.team);
}

export function resolveAllThirds(rankedThirds: Team[]): Record<string, Team> {
  const slots = [
    { key: '3_ABCDF', allowed: ['A', 'B', 'C', 'D', 'F'] },
    { key: '3_CDFGH', allowed: ['C', 'D', 'F', 'G', 'H'] },
    { key: '3_BEFIJ', allowed: ['B', 'E', 'F', 'I', 'J'] },
    { key: '3_AEHIJ', allowed: ['A', 'E', 'H', 'I', 'J'] },
    { key: '3_CEFHI', allowed: ['C', 'E', 'F', 'H', 'I'] },
    { key: '3_EHIJK', allowed: ['E', 'H', 'I', 'J', 'K'] },
    { key: '3_EFGIJ', allowed: ['E', 'F', 'G', 'I', 'J'] },
    { key: '3_DEIJL', allowed: ['D', 'E', 'I', 'J', 'L'] },
  ];

  const assigned: Record<string, Team> = {};
  const usedTeamIds = new Set<string>();

  // Assign each slot, prefer matching allowed groups from rankedThirds (which is already sorted 1 to 12)
  for (const slot of slots) {
    let team = rankedThirds.find((t) => slot.allowed.includes(t.group) && !usedTeamIds.has(t.id));
    if (!team) {
      // fallback
      team = rankedThirds.find((t) => !usedTeamIds.has(t.id));
    }
    if (team) {
      assigned[slot.key] = team;
      usedTeamIds.add(team.id);
    }
  }

  return assigned;
}

// Resolves a team placeholder (like '1A', '3rd-1', 'WK73') into actual Team details
export function resolveTeam(
  id: string,
  allStandings: Record<string, GroupStandings[]>,
  rankedThirds: Team[],
  knockoutMatches: Match[]
): Team | { placeholder: string; text: string } {
  // If it's a real team ID
  const directTeam = TEAMS.find((t) => t.id === id);
  if (directTeam) return directTeam;

  // Pattern A: Group Winners '1A' - '1L'
  const winnerMatch = id.match(/^1([A-L])$/);
  if (winnerMatch) {
    const groupStandings = allStandings[winnerMatch[1]];
    if (groupStandings && groupStandings.length > 0) {
      const team = TEAMS.find((t) => t.id === groupStandings[0].teamId);
      if (team) return team;
    }
    return { placeholder: id, text: `Ganador Grupo ${winnerMatch[1]}` };
  }

  // Pattern B: Group Runners-up '2A' - '2L'
  const runnerMatch = id.match(/^2([A-L])$/);
  if (runnerMatch) {
    const groupStandings = allStandings[runnerMatch[1]];
    if (groupStandings && groupStandings.length > 1) {
      const team = TEAMS.find((t) => t.id === groupStandings[1].teamId);
      if (team) return team;
    }
    return { placeholder: id, text: `2do Grupo ${runnerMatch[1]}` };
  }

  // Pattern C1: Third places '3rd-1' - '3rd-8'
  const thirdMatch = id.match(/^3rd-(\d)$/);
  if (thirdMatch) {
    const index = parseInt(thirdMatch[1], 10) - 1;
    if (rankedThirds[index]) {
      return rankedThirds[index];
    }
    return { placeholder: id, text: `${index + 1}° Mejor 3ro` };
  }

  // Pattern C2: Custom 3rd places (e.g. 3_ABCDF)
  if (id.startsWith('3_')) {
    const thirdsMap = resolveAllThirds(rankedThirds);
    if (thirdsMap[id]) {
      return thirdsMap[id];
    }
    return { placeholder: id, text: `3ro (Gr. ${id.substring(2)})` };
  }

  // Pattern D: Knockout Winner 'WK73' - 'WK103'
  const wkMatch = id.match(/^WK(\d+)$/);
  if (wkMatch) {
    const mId = `K${wkMatch[1]}`;
    const match = knockoutMatches.find((m) => m.id === mId);
    if (match) {
      const winnerId = getKnockoutWinnerId(match, allStandings, rankedThirds, knockoutMatches);
      if (winnerId) {
        const team = TEAMS.find((t) => t.id === winnerId);
        if (team) return team;
      }
    }
    return { placeholder: id, text: `Ganador P.${wkMatch[1]}` };
  }

  // Pattern E: Knockout Loser 'LK101' - 'LK102' (For third place)
  const lkMatch = id.match(/^LK(\d+)$/);
  if (lkMatch) {
    const mId = `K${lkMatch[1]}`;
    const match = knockoutMatches.find((m) => m.id === mId);
    if (match) {
      const loserId = getKnockoutLoserId(match, allStandings, rankedThirds, knockoutMatches);
      if (loserId) {
        const team = TEAMS.find((t) => t.id === loserId);
        if (team) return team;
      }
    }
    return { placeholder: id, text: `Perdedor P.${lkMatch[1]}` };
  }

  return { placeholder: id, text: id };
}

// Determines the winner of a knockout match
export function getKnockoutWinnerId(
  match: Match,
  allStandings: Record<string, GroupStandings[]>,
  rankedThirds: Team[],
  knockoutMatches: Match[]
): string | undefined {
  const home = resolveTeam(match.homeTeamId, allStandings, rankedThirds, knockoutMatches);
  const away = resolveTeam(match.awayTeamId, allStandings, rankedThirds, knockoutMatches);

  // If teams not settled yet, no winner
  if ('placeholder' in home || 'placeholder' in away) return undefined;

  const hScoreStr = match.predictedHome;
  const aScoreStr = match.predictedAway;

  if (hScoreStr === undefined || hScoreStr.trim() === '' || aScoreStr === undefined || aScoreStr.trim() === '') {
    return undefined;
  }

  const hScore = parseInt(hScoreStr, 10);
  const aScore = parseInt(aScoreStr, 10);

  if (isNaN(hScore) || isNaN(aScore)) return undefined;

  if (hScore > aScore) return home.id;
  if (hScore < aScore) return away.id;

  // In case of a tie in knockout, user should choose a winner (stored in predictedWinnerId)
  if (match.predictedWinnerId && (match.predictedWinnerId === home.id || match.predictedWinnerId === away.id)) {
    return match.predictedWinnerId;
  }

  // Default fallback if tie but no penalty winner selected
  return home.id;
}

// Determines the loser of a knockout match (used for third place)
export function getKnockoutLoserId(
  match: Match,
  allStandings: Record<string, GroupStandings[]>,
  rankedThirds: Team[],
  knockoutMatches: Match[]
): string | undefined {
  const home = resolveTeam(match.homeTeamId, allStandings, rankedThirds, knockoutMatches);
  const away = resolveTeam(match.awayTeamId, allStandings, rankedThirds, knockoutMatches);

  if ('placeholder' in home || 'placeholder' in away) return undefined;

  const winnerId = getKnockoutWinnerId(match, allStandings, rankedThirds, knockoutMatches);
  if (!winnerId) return undefined;

  return winnerId === home.id ? away.id : home.id;
}

// Check if a match has prediction filled
export function isPredictionFilled(match: Match): boolean {
  return (
    match.predictedHome !== undefined &&
    match.predictedHome.trim() !== '' &&
    match.predictedAway !== undefined &&
    match.predictedAway.trim() !== ''
  );
}

// Automatically simulates a match based on team rank weight
export function simulateMatchScores(homeRank: number, awayRank: number): { home: number; away: number } {
  // lower rank (number) is better, e.g. ARG=1, USA=11, NZL=80
  const totalRank = homeRank + awayRank;
  // probability weight
  const homeWeight = awayRank / totalRank; // better team (lower rank) gets higher ratio of awayRank
  
  // Base goals expected
  const homeChance = Math.random() * homeWeight * 4;
  const awayChance = Math.random() * (1 - homeWeight) * 4;

  let homeGoals = Math.floor(homeChance);
  let awayGoals = Math.floor(awayChance);

  // Add random variance for soccer drama
  if (Math.random() < 0.1) homeGoals += 1;
  if (Math.random() < 0.1) awayGoals += 1;

  return { home: homeGoals, away: awayGoals };
}
