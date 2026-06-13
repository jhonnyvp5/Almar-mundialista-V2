import express from 'express';
import path from 'path';
import fs from 'fs';
import pool from './neonDb';
import * as xlsx from 'xlsx';
import { TEAMS, GROUPS, generateGroupStageMatches, generateKnockoutMatches } from './src/data';
import { Team } from './src/types';
import { computeAllStandings, getRankedThirdPlacedTeams, getKnockoutWinnerId, resolveAllThirds } from './src/utils';

// Ecuador cedula validation
export function validarCedulaEcuatoriana(cedula: string): boolean {
  if (!cedula || cedula.length !== 10) return false;
  return /^\d+$/.test(cedula);
}

const DB_FILE = process.env.VERCEL ? '/tmp/data_db.json' : path.join(process.cwd(), 'data_db.json');

// Interface definition matching database structure
interface UserRecord {
  id: string;
  nombreCompleto: string;
  cedula: string;
  correo?: string;
  empresa: string;
  localidad: string;
  fechaHoraRegistro: string;
  role: 'user' | 'admin';
  blocked?: boolean;
}

interface MatchResultRecord {
  matchId: string;
  homeScore?: number;
  awayScore?: number;
  winnerId?: string;
}

interface PredictionRecord {
  matchId: string;
  predictedHome: string;
  predictedAway: string;
  predictedWinnerId?: string;
  completed?: boolean;
}

interface DatabaseSchema {
  users: UserRecord[];
  predictions: Record<string, Record<string, PredictionRecord>>; // userId -> (matchId -> prediction)
  matches: MatchResultRecord[];
  config?: {
    unlockedWeek: number;
    official_balon_oro?: string;
    official_guante_oro?: string;
    official_bota_oro?: string;
    official_joven_torneo?: string;
    official_campeon?: string;
    official_firsts?: Record<string, string>;
    official_seconds?: Record<string, string>;
    official_thirds?: string[];
    match_overrides?: Record<string, { date: string; time: string }>;
    deadline?: string;
    maintenance_mode?: boolean;
  };
}


function getValueCaseInsensitive(obj: any, key: string): any {
  if (!obj) return undefined;
  if (obj[key] !== undefined) return obj[key];
  const lowerKey = key.toLowerCase();
  if (obj[lowerKey] !== undefined) return obj[lowerKey];
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) {
      return obj[k];
    }
  }
  return undefined;
}

async function loadDatabase(userId?: string): Promise<DatabaseSchema> {
  try {
    const { rows: users } = userId 
      ? await pool.query('SELECT * FROM users WHERE id = $1', [userId])
      : await pool.query('SELECT * FROM users');

    const { rows: matches } = await pool.query('SELECT * FROM matches');
    
    // Read from the 4 new prediction tables
    const { rows: pMatches } = userId
      ? await pool.query('SELECT * FROM match_predictions WHERE "userId" = $1', [userId])
      : await pool.query('SELECT * FROM match_predictions');

    const { rows: pKnockouts } = userId
      ? await pool.query('SELECT * FROM knockout_predictions WHERE "userId" = $1', [userId])
      : await pool.query('SELECT * FROM knockout_predictions');

    const { rows: pGroups } = userId
      ? await pool.query('SELECT * FROM group_standings_predictions WHERE "userId" = $1', [userId])
      : await pool.query('SELECT * FROM group_standings_predictions');

    const { rows: pAwards } = userId
      ? await pool.query('SELECT * FROM fifa_awards_predictions WHERE "userId" = $1', [userId])
      : await pool.query('SELECT * FROM fifa_awards_predictions');

    const { rows: conf } = await pool.query("SELECT * FROM config WHERE id = 'system_config'");

    const db: DatabaseSchema = {
      users: users.map(u => {
        const idVal = getValueCaseInsensitive(u, 'id') || '';
        const nameVal = getValueCaseInsensitive(u, 'nombreCompleto') || '';
        const cedulaVal = getValueCaseInsensitive(u, 'cedula') || '';
        const correoVal = getValueCaseInsensitive(u, 'correo') || '';
        const empresaVal = getValueCaseInsensitive(u, 'empresa') || '';
        const localidadVal = getValueCaseInsensitive(u, 'localidad') || '';
        const dateVal = getValueCaseInsensitive(u, 'fechaHoraRegistro');
        const roleVal = getValueCaseInsensitive(u, 'role') || 'user';
        const blockedVal = getValueCaseInsensitive(u, 'blocked');

        let formattedDate = '';
        if (dateVal) {
          try {
            const d = new Date(dateVal);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toISOString();
            }
          } catch (e) {}
        }

        return {
          id: idVal,
          nombreCompleto: nameVal,
          cedula: cedulaVal,
          correo: correoVal,
          empresa: empresaVal,
          localidad: localidadVal,
          fechaHoraRegistro: formattedDate,
          role: roleVal as 'user' | 'admin',
          blocked: typeof blockedVal === 'boolean' ? blockedVal : (blockedVal === 'true' || blockedVal === 1)
        };
      }),
      predictions: {},
      matches: matches.map(m => ({
        matchId: m.matchId,
        homeScore: m.homeScore !== null ? m.homeScore : undefined,
        awayScore: m.awayScore !== null ? m.awayScore : undefined,
        winnerId: m.winnerId !== null ? m.winnerId : undefined,
      })),
      config: conf[0] ? {
        unlockedWeek: conf[0].unlockedWeek || 1,
        official_balon_oro: conf[0].official_balon_oro || '',
        official_guante_oro: conf[0].official_guante_oro || '',
        official_bota_oro: conf[0].official_bota_oro || '',
        official_joven_torneo: conf[0].official_joven_torneo || '',
        official_campeon: conf[0].official_campeon || '',
        official_firsts: typeof conf[0].official_firsts === 'string' ? JSON.parse(conf[0].official_firsts) : conf[0].official_firsts || {},
        official_seconds: typeof conf[0].official_seconds === 'string' ? JSON.parse(conf[0].official_seconds) : conf[0].official_seconds || {},
        official_thirds: typeof conf[0].official_thirds === 'string' ? JSON.parse(conf[0].official_thirds) : conf[0].official_thirds || [],
        match_overrides: typeof conf[0].match_overrides === 'string' ? JSON.parse(conf[0].match_overrides) : conf[0].match_overrides || {},
        deadline: conf[0].deadline || '2026-06-14T23:59:00',
        maintenance_mode: typeof conf[0].maintenance_mode === 'boolean' ? conf[0].maintenance_mode : (conf[0].maintenance_mode === 'true' || conf[0].maintenance_mode === 1 || conf[0].maintenance_mode === true)
      } : {
        unlockedWeek: 1,
        official_balon_oro: '',
        official_guante_oro: '',
        official_bota_oro: '',
        official_joven_torneo: '',
        official_campeon: '',
        official_firsts: {},
        official_seconds: {},
        official_thirds: [],
        match_overrides: {},
        deadline: '2026-06-14T23:59:00',
        maintenance_mode: false
      }
    };

    // Reconstruct predictions structure for the frontend
    // 1. Regular Matches
    for (const p of pMatches) {
      if (!db.predictions[p.userId]) db.predictions[p.userId] = {};
      db.predictions[p.userId][p.matchId] = {
        matchId: p.matchId,
        predictedHome: p.predictedHome,
        predictedAway: p.predictedAway,
        completed: !!p.completed
      };
    }

    // 2. Knockout Matches
    for (const p of pKnockouts) {
      if (!db.predictions[p.userId]) db.predictions[p.userId] = {};
      db.predictions[p.userId][p.matchId] = {
        matchId: p.matchId,
        predictedHome: p.predictedHome,
        predictedAway: p.predictedAway,
        predictedWinnerId: p.predictedWinnerId !== null ? p.predictedWinnerId : undefined,
        completed: !!p.completed
      };
    }

    // 3. Group Standings
    for (const p of pGroups) {
      if (!db.predictions[p.userId]) db.predictions[p.userId] = {};
      const grp = p.groupId;
      if (p.firstPlaceId) {
        db.predictions[p.userId][`group_override_first_${grp}`] = { matchId: `group_override_first_${grp}`, predictedHome: '0', predictedAway: '0', predictedWinnerId: p.firstPlaceId, completed: true };
      }
      if (p.secondPlaceId) {
        db.predictions[p.userId][`group_override_second_${grp}`] = { matchId: `group_override_second_${grp}`, predictedHome: '0', predictedAway: '0', predictedWinnerId: p.secondPlaceId, completed: true };
      }
      if (p.thirdPlaceId) {
         db.predictions[p.userId][`group_override_third_${grp}`] = { matchId: `group_override_third_${grp}`, predictedHome: '0', predictedAway: '0', predictedWinnerId: p.thirdPlaceId, completed: true };
      }
    }

    // 4. Awards
    for (const p of pAwards) {
      if (!db.predictions[p.userId]) db.predictions[p.userId] = {};
      db.predictions[p.userId][p.awardId] = {
        matchId: p.awardId,
        predictedHome: '0',
        predictedAway: '0',
        predictedWinnerId: p.predictedWinnerId !== null ? p.predictedWinnerId : undefined,
        completed: true
      };
    }

    return db;
  } catch (error) {
    console.error('Neon DB load error:', error);
    throw error;
  }
}


async function saveDatabase(db: DatabaseSchema, options?: {
  singleUserId?: string;
  singleUserPredictionsId?: string;
  configOnly?: boolean;
  matchesOnly?: boolean;
  recalculateRankings?: boolean;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saveAll = !options || Object.keys(options).length === 0;

    // 1. Save users
    if (saveAll || (options && options.singleUserId)) {
      const usersToSave = options?.singleUserId 
        ? db.users.filter(u => u.id === options.singleUserId)
        : db.users;

      for (const u of usersToSave) {
        await client.query(`
          INSERT INTO users (id, "nombreCompleto", cedula, correo, empresa, localidad, "fechaHoraRegistro", role, blocked)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (cedula) DO UPDATE SET
            "nombreCompleto" = EXCLUDED."nombreCompleto",
            correo = EXCLUDED.correo,
            empresa = EXCLUDED.empresa,
            localidad = EXCLUDED.localidad,
            role = EXCLUDED.role,
            blocked = EXCLUDED.blocked
        `, [u.id, u.nombreCompleto, u.cedula, u.correo || null, u.empresa, u.localidad, u.fechaHoraRegistro ? new Date(u.fechaHoraRegistro) : null, u.role, u.blocked ? true : false]);
      }
    }

    // 2. Save Config
    if (saveAll || (options && options.configOnly)) {
      if (db.config) {
        await client.query(`
          INSERT INTO config (id, "unlockedWeek", official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo, official_campeon, official_firsts, official_seconds, official_thirds, match_overrides, deadline, maintenance_mode)
          VALUES ('system_config', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            "unlockedWeek" = EXCLUDED."unlockedWeek",
            official_balon_oro = EXCLUDED.official_balon_oro,
            official_guante_oro = EXCLUDED.official_guante_oro,
            official_bota_oro = EXCLUDED.official_bota_oro,
            official_joven_torneo = EXCLUDED.official_joven_torneo,
            official_campeon = EXCLUDED.official_campeon,
            official_firsts = EXCLUDED.official_firsts,
            official_seconds = EXCLUDED.official_seconds,
            official_thirds = EXCLUDED.official_thirds,
            match_overrides = EXCLUDED.match_overrides,
            deadline = EXCLUDED.deadline,
            maintenance_mode = EXCLUDED.maintenance_mode
        `, [
          db.config.unlockedWeek, 
          db.config.official_balon_oro, 
          db.config.official_guante_oro, 
          db.config.official_bota_oro, 
          db.config.official_joven_torneo,
          db.config.official_campeon || '',
          JSON.stringify(db.config.official_firsts || {}),
          JSON.stringify(db.config.official_seconds || {}),
          JSON.stringify(db.config.official_thirds || []),
          JSON.stringify(db.config.match_overrides || {}),
          db.config.deadline || '2026-06-14T23:59:00',
          db.config.maintenance_mode ? true : false
        ]);
      }
    }

    // 3. Save Matches
    if (saveAll || (options && options.matchesOnly)) {
      for (const m of db.matches) {
         await client.query(`
           INSERT INTO matches (id, "matchId", "homeScore", "awayScore", "winnerId")
           VALUES ($1, $1, $2, $3, $4)
           ON CONFLICT ("matchId") DO UPDATE SET
             "homeScore" = EXCLUDED."homeScore",
             "awayScore" = EXCLUDED."awayScore",
             "winnerId" = EXCLUDED."winnerId"
         `, [m.matchId, m.homeScore, m.awayScore, m.winnerId]);
      }
    }

    // 4. Save Predictions
    const hasSinglePred = options && options.singleUserPredictionsId;
    if (saveAll || hasSinglePred) {
      const userIds = hasSinglePred ? [options.singleUserPredictionsId!] : Object.keys(db.predictions);
      
      for (const userId of userIds) {
        const preds = db.predictions[userId];
        if (!preds) continue;
        
        // Temporary object to group standings predictions by Group ID
        const groupStandings: Record<string, any> = {};

        for (const matchId of Object.keys(preds)) {
          const p = preds[matchId];
          
          if (matchId.startsWith('group_override_')) {
             const parts = matchId.split('_');
             const grp = parts[parts.length - 1]; // e.g. 'A'
             if (!groupStandings[grp]) groupStandings[grp] = { first: null, second: null, third: null };
             if (matchId.includes('_first_')) groupStandings[grp].first = p.predictedWinnerId;
             if (matchId.includes('_second_')) groupStandings[grp].second = p.predictedWinnerId;
             if (matchId.includes('_third_')) groupStandings[grp].third = p.predictedWinnerId;
          } else if (matchId.startsWith('award_')) {
             await client.query(`
               INSERT INTO fifa_awards_predictions (id, "userId", "awardId", "predictedWinnerId")
               VALUES ($1, $2, $3, $4)
               ON CONFLICT ("userId", "awardId") DO UPDATE SET
                 "predictedWinnerId" = EXCLUDED."predictedWinnerId"
             `, [`${userId}_${matchId}`, userId, matchId, p.predictedWinnerId]);
          } else if (matchId.startsWith('K') || matchId.startsWith('O')) { // Knockouts
             await client.query(`
               INSERT INTO knockout_predictions (id, "userId", "matchId", "predictedHome", "predictedAway", "predictedWinnerId", completed)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT ("userId", "matchId") DO UPDATE SET
                 "predictedHome" = EXCLUDED."predictedHome",
                 "predictedAway" = EXCLUDED."predictedAway",
                 "predictedWinnerId" = EXCLUDED."predictedWinnerId",
                 completed = EXCLUDED.completed
             `, [`${userId}_${matchId}`, userId, matchId, p.predictedHome, p.predictedAway, p.predictedWinnerId, p.completed ? true : false]);
          } else { // Standard matches
             await client.query(`
               INSERT INTO match_predictions (id, "userId", "matchId", "predictedHome", "predictedAway", completed)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT ("userId", "matchId") DO UPDATE SET
                 "predictedHome" = EXCLUDED."predictedHome",
                 "predictedAway" = EXCLUDED."predictedAway",
                 completed = EXCLUDED.completed
             `, [`${userId}_${matchId}`, userId, matchId, p.predictedHome, p.predictedAway, p.completed ? true : false]);
          }
        }

        // Persist gathered group standings
        for (const grp of Object.keys(groupStandings)) {
           await client.query(`
             INSERT INTO group_standings_predictions (id, "userId", "groupId", "firstPlaceId", "secondPlaceId", "thirdPlaceId")
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT ("userId", "groupId") DO UPDATE SET
               "firstPlaceId" = EXCLUDED."firstPlaceId",
               "secondPlaceId" = EXCLUDED."secondPlaceId",
               "thirdPlaceId" = EXCLUDED."thirdPlaceId"
           `, [`${userId}_${grp}`, userId, grp, groupStandings[grp].first, groupStandings[grp].second, groupStandings[grp].third]);
        }
      }
    }

    // 5. Recalculate Rankings
    // ONLY do this if requested or if doing a full save
    if (saveAll || (options && options.recalculateRankings)) {
      const rankings = calculateRankingStats(db);
      for (const r of rankings) {
         await client.query(`
           INSERT INTO user_rankings ("userId", "puntos", "puntosFaseGrupos", "puntosCampeon", "aciertosExactos", "aciertosGanador", "aciertosGolesEquipo", "aciertosDiferenciaGol", "aciertosPrimeros", "aciertosSegundos", "aciertosTerceros", "puntosBalonOro", "puntosGuanteOro", "puntosBotaOro", "puntosJovenTorneo", updated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
           ON CONFLICT ("userId") DO UPDATE SET
             "puntos" = EXCLUDED."puntos",
             "puntosFaseGrupos" = EXCLUDED."puntosFaseGrupos",
             "puntosCampeon" = EXCLUDED."puntosCampeon",
             "aciertosExactos" = EXCLUDED."aciertosExactos",
             "aciertosGanador" = EXCLUDED."aciertosGanador",
             "aciertosGolesEquipo" = EXCLUDED."aciertosGolesEquipo",
             "aciertosDiferenciaGol" = EXCLUDED."aciertosDiferenciaGol",
             "aciertosPrimeros" = EXCLUDED."aciertosPrimeros",
             "aciertosSegundos" = EXCLUDED."aciertosSegundos",
             "aciertosTerceros" = EXCLUDED."aciertosTerceros",
             "puntosBalonOro" = EXCLUDED."puntosBalonOro",
             "puntosGuanteOro" = EXCLUDED."puntosGuanteOro",
             "puntosBotaOro" = EXCLUDED."puntosBotaOro",
             "puntosJovenTorneo" = EXCLUDED."puntosJovenTorneo",
             updated = CURRENT_TIMESTAMP
         `, [r.id, r.puntos, r.puntosFaseGrupos, r.puntosCampeon, r.aciertosExactos, r.aciertosGanador, r.aciertosGolesEquipo, r.aciertosDiferenciaGol, r.aciertosPrimeros, r.aciertosSegundos, r.aciertosTerceros, r.puntosBalonOro, r.puntosGuanteOro, r.puntosBotaOro, r.puntosJovenTorneo]);
      }
    } else if (options && options.singleUserId) {
      // Ensure the registered/modified user has a ranking row initialized if it doesn't exist
      await client.query(`
         INSERT INTO user_rankings ("userId", "puntos", "puntosFaseGrupos", "puntosCampeon", "aciertosExactos", "aciertosGanador", "aciertosGolesEquipo", "aciertosDiferenciaGol", "aciertosPrimeros", "aciertosSegundos", "aciertosTerceros", "puntosBalonOro", "puntosGuanteOro", "puntosBotaOro", "puntosJovenTorneo", updated)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP)
         ON CONFLICT ("userId") DO NOTHING
      `, [options.singleUserId]);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error("SaveDB Error", e);
    throw e;
  } finally {
    client.release();
  }
}



// Initial DB save to ensure file structure exists
// Initial DB call ignored.
// We use Postgres now.

  // Helper calculating general ranking
  interface RankingStat {
    id: string;
    nombre: string;
    empresa: string;
    localidad: string;
    cedula: string;
    correo?: string;
    fechaRegistro: string;
    role: string;
    blocked: boolean;
    puntos: number;
    puntosFaseGrupos: number;
    puntosCampeon: number;
    aciertosExactos: number;
    aciertosGanador: number;
    aciertosGolesEquipo: number;
    aciertosDiferenciaGol: number;
    aciertosPrimeros: number;
    aciertosSegundos: number;
    aciertosTerceros: number;
    puntosBalonOro: number;
    puntosGuanteOro: number;
    puntosBotaOro: number;
    puntosJovenTorneo: number;
  }

  function calculateRankingStats(db: DatabaseSchema): RankingStat[] {
    const ranking: RankingStat[] = [];

    // 1. Calculate official group standings using official scores.
    const baseGroupMatches = generateGroupStageMatches();
    const officialGroupMatches = baseGroupMatches.map((m) => {
      const dbMatch = db.matches.find(om => om.matchId === m.id);
      return {
        ...m,
        // Set official scores if present in DB
        homeScore: dbMatch?.homeScore !== undefined && dbMatch?.homeScore !== null ? Number(dbMatch.homeScore) : undefined,
        awayScore: dbMatch?.awayScore !== undefined && dbMatch?.awayScore !== null ? Number(dbMatch.awayScore) : undefined,
        winnerId: dbMatch?.winnerId
      };
    });

    // Compute official group standings
    const officialAllStandings = computeAllStandings(officialGroupMatches);
    let officialRankedThirds = getRankedThirdPlacedTeams(officialAllStandings);

    if (db.config && db.config.official_thirds && db.config.official_thirds.length === 8) {
      officialRankedThirds = db.config.official_thirds.map(tid => TEAMS.find(t => t.id === tid)).filter(Boolean) as Team[];
    }
    
    // Also inject overrides into the officialAllStandings directly to spoof them for getKnockoutWinnerId
    if (db.config?.official_firsts && Object.keys(db.config.official_firsts).length > 0) {
      Object.keys(db.config.official_firsts).forEach(gId => {
        const teamId = db.config!.official_firsts![gId];
        if (officialAllStandings[gId]) {
          const idx = officialAllStandings[gId].findIndex(s => s.teamId === teamId);
          if (idx !== -1 && idx !== 0) {
            const temp = officialAllStandings[gId][0];
            officialAllStandings[gId][0] = officialAllStandings[gId][idx];
            officialAllStandings[gId][idx] = temp;
          }
        }
      });
    }

    if (db.config?.official_seconds && Object.keys(db.config.official_seconds).length > 0) {
      Object.keys(db.config.official_seconds).forEach(gId => {
        const teamId = db.config!.official_seconds![gId];
        if (officialAllStandings[gId]) {
          const idx = officialAllStandings[gId].findIndex(s => s.teamId === teamId);
          if (idx !== -1 && idx !== 1 && officialAllStandings[gId].length > 1) {
            // Swap with 1st index
            const temp = officialAllStandings[gId][1];
            officialAllStandings[gId][1] = officialAllStandings[gId][idx];
            officialAllStandings[gId][idx] = temp;
          }
        }
      });
    }

    const officialTop8Thirds = officialRankedThirds.slice(0, 8).map(t => t.id);

    // Check which groups are fully finalized (all 6 matches have official scores)
    const groupStatusFinalized: Record<string, boolean> = {};
    GROUPS.forEach((gId) => {
      const gMatches = officialGroupMatches.filter(m => m.group === gId);
      const allPlayed = gMatches.every(m => m.homeScore !== undefined && m.homeScore !== null && !isNaN(m.homeScore));
      groupStatusFinalized[gId] = allPlayed;
    });

    const all72GroupMatchesPlayed = officialGroupMatches.every(m => m.homeScore !== undefined && m.homeScore !== null && !isNaN(m.homeScore));

    // 2. Resolve official champion if K104 is played
    const baseKnockoutMatches = generateKnockoutMatches();
    const officialKnockoutMatches = baseKnockoutMatches.map((m) => {
      const dbMatch = db.matches.find(om => om.matchId === m.id);
      return {
        ...m,
        predictedHome: dbMatch?.homeScore !== undefined && dbMatch?.homeScore !== null ? String(dbMatch.homeScore) : '',
        predictedAway: dbMatch?.awayScore !== undefined && dbMatch?.awayScore !== null ? String(dbMatch.awayScore) : '',
        predictedWinnerId: dbMatch?.winnerId || '',
        completed: dbMatch?.homeScore !== undefined && dbMatch?.homeScore !== null && !isNaN(dbMatch.homeScore)
      };
    });

    const officialK104Match = officialKnockoutMatches.find(m => m.id === 'K104');
    const isFinalPlayed = officialK104Match && officialK104Match.completed;
    let officialChampionId: string | undefined = undefined;
    if (isFinalPlayed) {
      officialChampionId = getKnockoutWinnerId(officialK104Match!, officialAllStandings, officialRankedThirds, officialKnockoutMatches);
    }

    const activeUsers = db.users.filter(u => !u.blocked && u.role !== 'admin');
    
    activeUsers.forEach((user) => {
      let puntos = 0;
      let aciertosExactos = 0;
      let aciertosGanador = 0;
      let aciertosGolesEquipo = 0;
      let aciertosDiferenciaGol = 0;
      let puntosFaseGrupos = 0;
      let puntosCampeon = 0;
      let aciertosPrimeros = 0;
      let aciertosSegundos = 0;
      let aciertosTerceros = 0;

      const userPreds = db.predictions[user.id] || {};

      // Match-by-match predictions points
      db.matches.forEach((official) => {
        const pred = userPreds[official.matchId];
        if (!pred) return; // No prediction made

        if (official.homeScore === undefined || official.homeScore === null || isNaN(official.homeScore)) return; // Match not played yet
        if (official.awayScore === undefined || official.awayScore === null || isNaN(official.awayScore)) return; // Match not played yet

        const pHome = parseInt(pred.predictedHome, 10);
        const pAway = parseInt(pred.predictedAway, 10);
        const oHome = official.homeScore;
        const oAway = official.awayScore;

        if (isNaN(pHome) || isNaN(pAway)) return;

        // Check accurate score hit (Acierto Exacto)
        const isExact = pHome === oHome && pAway === oAway;

        // Check winner/draw prediction success (Acierto Ganador)
        const predWinner = pHome > pAway ? 'home' : (pHome < pAway ? 'away' : 'draw');
        const officialWinner = oHome > oAway ? 'home' : (oHome < oAway ? 'away' : 'draw');
        let isWinnerCorrect = predWinner === officialWinner;

        // If knockout match and game ended in a draw (regulation/extra time), the winner is decided by penalty shootout
        if (official.matchId.startsWith('K') && oHome === oAway) {
          if (pred.predictedWinnerId && official.winnerId) {
            isWinnerCorrect = pred.predictedWinnerId === official.winnerId;
          }
        }

        // Scoring rules:
        // Line-by-line official rules update:
        // 1. Selección del ganador: 3 points
        if (isWinnerCorrect) {
          puntos += 3;
          aciertosGanador += 1;
        }

        // 2. Marcador exacto: 2 points
        if (isExact) {
          puntos += 2;
          aciertosExactos += 1;
        }

        // Goles de un equipo & Diferencia de gol do NOT grant points in the new rule update.
        if (pHome === oHome) {
          aciertosGolesEquipo += 1;
        }
        if (pAway === oAway) {
          aciertosGolesEquipo += 1;
        }

        if ((pHome - pAway) === (oHome - oAway)) {
          aciertosDiferenciaGol += 1;
        }
      });

      // --- GRUPO SOBREESCRITO / CLASIFICACIONES DE GRUPO ---
      GROUPS.forEach((gId) => {
        if (groupStatusFinalized[gId]) {
          const predFirst = userPreds[`group_override_first_${gId}`]?.predictedWinnerId;
          const predSecond = userPreds[`group_override_second_${gId}`]?.predictedWinnerId;

          const officialFirst = officialAllStandings[gId]?.[0]?.teamId;
          const officialSecond = officialAllStandings[gId]?.[1]?.teamId;

          if (predFirst && officialFirst && predFirst === officialFirst) {
            puntos += 5;
            puntosFaseGrupos += 5;
            aciertosPrimeros += 1;
          }
          if (predSecond && officialSecond && predSecond === officialSecond) {
            puntos += 5;
            puntosFaseGrupos += 5;
            aciertosSegundos += 1;
          }
        }

        if (all72GroupMatchesPlayed) {
          const predThird = userPreds[`group_override_third_${gId}`]?.predictedWinnerId;
          if (predThird && predThird !== 'no_aplica' && officialTop8Thirds.includes(predThird)) {
            puntos += 5;
            puntosFaseGrupos += 5;
            aciertosTerceros += 1;
          }
        }
      });

      // --- CAMPEÓN DEL MUNDO ---
      if (isFinalPlayed && officialChampionId) {
        // Resolve user's predicted champion
        const userGroupMatches = baseGroupMatches.map((m) => {
          const pred: any = userPreds[m.id] || {};
          return {
            ...m,
            homeScore: undefined,
            awayScore: undefined,
            predictedHome: pred.predictedHome !== undefined ? String(pred.predictedHome) : '',
            predictedAway: pred.predictedAway !== undefined ? String(pred.predictedAway) : '',
            completed: pred.completed
          };
        });

        const userAllStandings = computeAllStandings(userGroupMatches);
        const userRankedThirds = getRankedThirdPlacedTeams(userAllStandings);

        const userKnockoutMatches = baseKnockoutMatches.map((m) => {
          const pred: any = userPreds[m.id] || {};
          return {
            ...m,
            predictedHome: pred.predictedHome !== undefined ? String(pred.predictedHome) : '',
            predictedAway: pred.predictedAway !== undefined ? String(pred.predictedAway) : '',
            predictedWinnerId: pred.predictedWinnerId || '',
            completed: pred.completed
          };
        });

        // Replicating helper inline to avoid circular reference / lexical scope issues
        function resolveUserTeam(id: string): any {
          const directTeam = TEAMS.find((t) => t.id === id);
          if (directTeam) return directTeam;

          const wMatch = id.match(/^1([A-L])$/);
          if (wMatch) {
            const gr = wMatch[1];
            const overrideFirst = userPreds[`group_override_first_${gr}`]?.predictedWinnerId;
            if (overrideFirst) {
              const t = TEAMS.find(x => x.id === overrideFirst);
              if (t) return t;
            }
            const groupStandings = userAllStandings[gr];
            if (groupStandings && groupStandings.length > 0) {
              const t = TEAMS.find((x) => x.id === groupStandings[0].teamId);
              if (t) return t;
            }
            return { placeholder: id, text: `Ganador Grupo ${gr}` };
          }

          const rMatch = id.match(/^2([A-L])$/);
          if (rMatch) {
            const gr = rMatch[1];
            const overrideSecond = userPreds[`group_override_second_${gr}`]?.predictedWinnerId;
            if (overrideSecond) {
              const t = TEAMS.find(x => x.id === overrideSecond);
              if (t) return t;
            }
            const groupStandings = userAllStandings[gr];
            if (groupStandings && groupStandings.length > 1) {
              const t = TEAMS.find((x) => x.id === groupStandings[1].teamId);
              if (t) return t;
            }
            return { placeholder: id, text: `2do Grupo ${gr}` };
          }

          if (id.startsWith('3_')) {
            const manualThirds: string[] = [];
            GROUPS.forEach((gr) => {
              const tid = userPreds[`group_override_third_${gr}`]?.predictedWinnerId;
              if (tid && tid !== 'no_aplica' && !manualThirds.includes(tid)) {
                manualThirds.push(tid);
              }
            });

            const thirdsToUse = manualThirds.length === 8
              ? (manualThirds.map(tid => TEAMS.find(t => t.id === tid)).filter(Boolean) as any)
              : userRankedThirds;

            const thirdsMap = resolveAllThirds(thirdsToUse);
            if (thirdsMap[id]) return thirdsMap[id];
            return { placeholder: id, text: `3ro (Gr. ${id.substring(2)})` };
          }

          const wkMatch = id.match(/^WK(\d+)$/);
          if (wkMatch) {
            const mId = `K${wkMatch[1]}`;
            const mObj = userKnockoutMatches.find((x: any) => x.id === mId);
            if (mObj) {
              const wId = getUserKnockoutWinnerId(mObj);
              if (wId) {
                const t = TEAMS.find((x) => x.id === wId);
                if (t) return t;
              }
            }
            return { placeholder: id, text: `Ganador P.${wkMatch[1]}` };
          }

          const lkMatch = id.match(/^LK(\d+)$/);
          if (lkMatch) {
            const mId = `K${lkMatch[1]}`;
            const mObj = userKnockoutMatches.find((x: any) => x.id === mId);
            if (mObj) {
              const wId = getUserKnockoutWinnerId(mObj);
              if (wId) {
                const home = resolveUserTeam(mObj.homeTeamId);
                const away = resolveUserTeam(mObj.awayTeamId);
                if (!('placeholder' in home) && !('placeholder' in away)) {
                  return wId === home.id ? away : home;
                }
              }
            }
            return { placeholder: id, text: `Perdedor P.${lkMatch[1]}` };
          }

          return { placeholder: id, text: id };
        }

        function getUserKnockoutWinnerId(mObj: any): string | undefined {
          const home = resolveUserTeam(mObj.homeTeamId);
          const away = resolveUserTeam(mObj.awayTeamId);

          if ('placeholder' in home || 'placeholder' in away) return undefined;

          const hScoreStr = mObj.predictedHome;
          const aScoreStr = mObj.predictedAway;

          if (hScoreStr === undefined || hScoreStr === null || hScoreStr.trim() === '' || 
              aScoreStr === undefined || aScoreStr === null || aScoreStr.trim() === '') {
            return undefined;
          }

          const hScore = parseInt(hScoreStr, 10);
          const aScore = parseInt(aScoreStr, 10);

          if (isNaN(hScore) || isNaN(aScore)) return undefined;

          if (hScore > aScore) return home.id;
          if (hScore < aScore) return away.id;

          if (mObj.predictedWinnerId && (mObj.predictedWinnerId === home.id || mObj.predictedWinnerId === away.id)) {
            return mObj.predictedWinnerId;
          }

          return home.id;
        }

        const userK104Match = userKnockoutMatches.find((m: any) => m.id === 'K104');
        let userChampionId: string | undefined = undefined;
        if (userK104Match) {
          userChampionId = getUserKnockoutWinnerId(userK104Match);
        }

        if (userChampionId && userChampionId === officialChampionId) {
          puntos += 12;
          puntosCampeon = 12;
        }
      }

      // --- FIFA AWARDS POINTS ---
      let puntosBalonOro = 0;
      let puntosGuanteOro = 0;
      let puntosBotaOro = 0;
      let puntosJovenTorneo = 0;

      const norm = (text?: string): string => {
        if (!text) return '';
        return text
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
          .replace(/\s+/g, ' ');           // Normalize spaces to single space
      };

      const officialBalon = norm(db.config?.official_balon_oro);
      const officialGuante = norm(db.config?.official_guante_oro);
      const officialBota = norm(db.config?.official_bota_oro);
      const officialJoven = norm(db.config?.official_joven_torneo);

      const userBalon = norm(userPreds['award_balon_oro']?.predictedWinnerId);
      const userGuante = norm(userPreds['award_guante_oro']?.predictedWinnerId);
      const userBota = norm(userPreds['award_bota_oro']?.predictedWinnerId);
      const userJoven = norm(userPreds['award_joven_torneo']?.predictedWinnerId);

      if (officialBalon && userBalon && userBalon === officialBalon) {
        puntos += 10;
        puntosBalonOro = 10;
      }
      if (officialGuante && userGuante && userGuante === officialGuante) {
        puntos += 10;
        puntosGuanteOro = 10;
      }
      if (officialBota && userBota && userBota === officialBota) {
        puntos += 7;
        puntosBotaOro = 7;
      }
      if (officialJoven && userJoven && userJoven === officialJoven) {
        puntos += 8;
        puntosJovenTorneo = 8;
      }

      ranking.push({
        id: user.id,
        nombre: user.nombreCompleto,
        empresa: user.empresa,
        localidad: user.localidad,
        cedula: user.cedula,
        correo: user.correo,
        fechaRegistro: user.fechaHoraRegistro,
        role: user.role,
        blocked: !!user.blocked,
        puntos,
        puntosFaseGrupos,
        puntosCampeon,
        aciertosExactos,
        aciertosGanador,
        aciertosGolesEquipo,
        aciertosDiferenciaGol,
        aciertosPrimeros,
        aciertosSegundos,
        aciertosTerceros,
        puntosBalonOro,
        puntosGuanteOro,
        puntosBotaOro,
        puntosJovenTorneo
      });
    });

    // Sort by points desc, then by form submission date/time (earliest first), then name asc
    return ranking.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      
      const timeA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : Infinity;
      const timeB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : Infinity;
      if (timeA !== timeB) return timeA - timeB;

      return a.nombre.localeCompare(b.nombre);
    });
  }

async function startServer() {
  const app = express();
  const PORT = 3000;

  try {
    await pool.query(`ALTER TABLE config ADD COLUMN IF NOT EXISTS match_overrides TEXT DEFAULT '{}'`);
  } catch (err) {
    console.warn('Could not run ALTER TABLE config to add match_overrides:', err);
  }

  try {
    await pool.query(`ALTER TABLE config ADD COLUMN IF NOT EXISTS deadline TEXT DEFAULT '2026-06-14T23:59:00'`);
  } catch (err) {
    console.warn('Could not run ALTER TABLE config to add deadline:', err);
  }

  try {
    await pool.query(`ALTER TABLE config ADD COLUMN IF NOT EXISTS official_campeon TEXT DEFAULT ''`);
  } catch (err) {
    console.warn('Could not run ALTER TABLE config to add official_campeon:', err);
  }

  try {
    await pool.query(`ALTER TABLE config ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE`);
  } catch (err) {
    console.warn('Could not run ALTER TABLE config to add maintenance_mode:', err);
  }

  app.use(express.json());

  // API - Auth Check Cedula
  app.get('/api/auth/check-cedula/:cedula', async (req, res) => {
    try {
      const { cedula } = req.params;
      const cleanCedula = cedula.trim().replace(/\s+/g, '');

      // Special administrator test or special test bypass
      if (cleanCedula === 'admin12345') {
        return res.json({
          nombre: 'ADMINISTRADOR DE PRUEBA',
          empresa: 'PRODUMAR SA',
          localidad: 'Matriz',
          isAllowed: true
        });
      }

      if (!validarCedulaEcuatoriana(cleanCedula)) {
        return res.status(400).json({ error: 'La cédula ingresada debe tener exactamente 10 dígitos numéricos.' });
      }

      const checkResult = await pool.query('SELECT * FROM allowed_cedulas WHERE cedula = $1', [cleanCedula]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'La cédula ingresada no está registrada en la base de datos de usuarios permitidos.' });
      }

      const row = checkResult.rows[0];
      return res.json({
        nombre: (row.nombre_completo || row.nombre || '').replace(/[\uFFFD\u00A0]/g, 'Ñ'),
        empresa: row.empresa,
        localidad: row.localidad,
        isAllowed: true
      });
    } catch (error: any) {
      console.error('Check cedula error:', error);
      res.status(500).json({ error: 'Error interno del servidor al verificar la cédula.' });
    }
  });

  // API - Auth Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { nombreCompleto, cedula, correo, empresa, localidad } = req.body;

      if (!nombreCompleto || !cedula || !empresa || !localidad || !correo) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
      }

      const cleanCedula = cedula.trim().replace(/\s+/g, '');
      const cleanNombre = nombreCompleto.trim().replace(/[\uFFFD\u00A0]/g, 'Ñ');
      const cleanCorreo = correo.trim().toLowerCase();

      if (cleanNombre === '' || cleanCedula === '' || cleanCorreo === '') {
        return res.status(400).json({ error: 'No se permiten campos vacíos.' });
      }

      if (!cleanCorreo.includes('@') || !cleanCorreo.includes('.')) {
        return res.status(400).json({ error: 'El formato de correo ingresado no es válido.' });
      }

      // Bypass of cedula check only if it is the special administrator test or special test cedula
      const isSpecialTest = cleanCedula === 'admin12345';
      if (!isSpecialTest) {
        if (!validarCedulaEcuatoriana(cleanCedula)) {
          return res.status(400).json({ error: 'La cédula ingresada debe tener exactamente 10 dígitos numéricos.' });
        }

        // Validate if cedula exists in the pre-allowed database table
        const checkResult = await pool.query('SELECT * FROM allowed_cedulas WHERE cedula = $1', [cleanCedula]);
        if (checkResult.rows.length === 0) {
          return res.status(400).json({ error: 'La cédula ingresada no está registrada en la base de datos de usuarios permitidos.' });
        }
      }

      // Cédula duplicate check
      const dupCedulaCheck = await pool.query('SELECT * FROM users WHERE cedula = $1', [cleanCedula]);
      if (dupCedulaCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un usuario registrado con esta cédula.' });
      }

      // Email duplicate check
      const dupEmailCheck = await pool.query('SELECT * FROM users WHERE LOWER(correo) = $1', [cleanCorreo]);
      if (dupEmailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo.' });
      }

      const newUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        nombreCompleto: cleanNombre,
        cedula: cleanCedula,
        correo: cleanCorreo,
        empresa,
        localidad,
        fechaHoraRegistro: new Date().toISOString(),
        role: (cleanCedula === 'admin12345' ? 'admin' : 'user'),
        blocked: false
      };

      // Direct Database inserts
      await pool.query(`
        INSERT INTO users (id, "nombreCompleto", cedula, correo, empresa, localidad, "fechaHoraRegistro", role, blocked)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [newUser.id, newUser.nombreCompleto, newUser.cedula, newUser.correo || null, newUser.empresa, newUser.localidad, newUser.fechaHoraRegistro ? new Date(newUser.fechaHoraRegistro) : null, newUser.role, newUser.blocked]);

      await pool.query(`
         INSERT INTO user_rankings ("userId", "puntos", "puntosFaseGrupos", "puntosCampeon", "aciertosExactos", "aciertosGanador", "aciertosGolesEquipo", "aciertosDiferenciaGol", "aciertosPrimeros", "aciertosSegundos", "aciertosTerceros", "puntosBalonOro", "puntosGuanteOro", "puntosBotaOro", "puntosJovenTorneo", updated)
         VALUES ($1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP)
         ON CONFLICT ("userId") DO NOTHING
      `, [newUser.id]);

      res.json({ user: newUser });
    } catch (error: any) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Error interno del servidor. Por favor intenta de nuevo.' });
    }
  });

  // API - Auth Login (By Cédula and opt Correo)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { cedula, correo } = req.body;
      if (!cedula) {
        return res.status(400).json({ error: 'La cédula es requerida.' });
      }

      const cleanCedula = cedula.trim();

      let user;
      if (correo && correo.trim() !== '') {
        const cleanCorreo = correo.trim().toLowerCase();
        const userRes = await pool.query('SELECT * FROM users WHERE cedula = $1 AND LOWER(correo) = $2', [cleanCedula, cleanCorreo]);
        if (userRes.rows.length === 0) {
          return res.status(400).json({ error: 'No se encontró ningún usuario registrado que coincida con este correo y cédula.' });
        }
        user = userRes.rows[0];
      } else {
        const userRes = await pool.query('SELECT * FROM users WHERE cedula = $1', [cleanCedula]);
        if (userRes.rows.length === 0) {
          return res.status(400).json({ error: 'No se encontró ningún usuario registrado con esta cédula.' });
        }
        user = userRes.rows[0];
      }

      const userIdVal = getValueCaseInsensitive(user, 'id') || '';
      const nombreCompletoVal = getValueCaseInsensitive(user, 'nombreCompleto') || '';
      const cedulaVal = getValueCaseInsensitive(user, 'cedula') || '';
      const correoVal = getValueCaseInsensitive(user, 'correo') || '';
      const empresaVal = getValueCaseInsensitive(user, 'empresa') || '';
      const localidadVal = getValueCaseInsensitive(user, 'localidad') || '';
      const fechaHoraRegistroVal = getValueCaseInsensitive(user, 'fechaHoraRegistro');
      const roleVal = getValueCaseInsensitive(user, 'role') || 'user';
      const blockedVal = getValueCaseInsensitive(user, 'blocked');

      let formattedDate = '';
      if (fechaHoraRegistroVal) {
        try {
          const d = new Date(fechaHoraRegistroVal);
          if (!isNaN(d.getTime())) {
            formattedDate = d.toISOString();
          }
        } catch (e) {
          console.error('Error parsing fechaHoraRegistro:', e);
        }
      }

      const mappedUser = {
        id: userIdVal,
        nombreCompleto: nombreCompletoVal,
        cedula: cedulaVal,
        correo: correoVal,
        empresa: empresaVal,
        localidad: localidadVal,
        fechaHoraRegistro: formattedDate,
        role: roleVal,
        blocked: typeof blockedVal === 'boolean' ? blockedVal : (blockedVal === 'true' || blockedVal === 1)
      };

      if (mappedUser.blocked) {
        return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada por el administrador.' });
      }

      res.json({ user: mappedUser });
    } catch (error: any) {
      console.error('Login error details:', error);
      res.status(500).json({ error: 'Error interno del servidor. Por favor intenta de nuevo.' });
    }
  });

  // API - Get all users (Admin only)
  app.get('/api/admin/users', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
    }

    res.json(db.users);
  });

  // API - Block/Unblock user (Admin Only)
  app.post('/api/admin/users/:id/block', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { blocked } = req.body;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const targetUser = db.users.find(u => u.id === id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    targetUser.blocked = !!blocked;
    await saveDatabase(db, { singleUserId: id });

    res.json({ success: true, user: targetUser });
  });

  // API - Delete user (Admin Only)
  app.delete('/api/admin/users/:id', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const targetUserIndex = db.users.findIndex(u => u.id === id);
    if (targetUserIndex === -1) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const targetUser = db.users[targetUserIndex];
    if (targetUser.role === 'admin') {
      return res.status(400).json({ error: 'No se puede eliminar a un Administrador.' });
    }

    // Remove user from list
    db.users.splice(targetUserIndex, 1);
    await pool.query('DELETE FROM users WHERE id = $1', [targetUser.id]);
    await pool.query('DELETE FROM user_rankings WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM match_predictions WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM knockout_predictions WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM group_standings_predictions WHERE "userId" = $1', [id]);
    await pool.query('DELETE FROM fifa_awards_predictions WHERE "userId" = $1', [id]);

    // Clean up their predictions from database structure if any
    if (db.predictions && db.predictions[id]) {
      delete db.predictions[id];
    }

    res.json({ success: true, message: 'Usuario y pronósticos eliminados correctamente.' });
  });

  // API - Export Users to CSV/Excel raw string
  app.get('/api/admin/export', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    // Build Ranking general stats first to export rich info
    const scores = calculateRankingStats(db);
    
    const getMatchWeek = (matchDate: string, matchStage?: string): number => {
      if (!matchDate) return 1;
      if (matchStage) {
        if (matchStage === 'group') {
          if (matchDate <= '2026-06-14') return 1;
          if (matchDate <= '2026-06-21') return 2;
          return 3;
        } else if (matchStage === '1/16') {
          return 4;
        } else if (matchStage === '1/8') {
          return 5;
        } else if (matchStage === '1/4') {
          return 6;
        } else if (matchStage === '1/2') {
          return 7;
        } else if (matchStage === 'third_place') {
          return 8;
        } else if (matchStage === 'final') {
          return 9;
        }
      }
      if (matchDate <= '2026-06-14') return 1;
      if (matchDate <= '2026-06-21') return 2;
      if (matchDate <= '2026-06-27') return 3;
      if (matchDate <= '2026-07-03') return 4;
      if (matchDate <= '2026-07-07') return 5;
      if (matchDate <= '2026-07-11') return 6;
      if (matchDate <= '2026-07-15') return 7;
      if (matchDate <= '2026-07-18') return 8;
      return 9;
    };

    const getTeamName = (teamId: string) => {
      const t = TEAMS.find(x => x.id === teamId);
      return t ? t.name : (teamId || 'N/A');
    };

    const unlockedWeek = db.config?.unlockedWeek || 1;
    const allMatches = [...generateGroupStageMatches(), ...generateKnockoutMatches()];
    const weekMatches = allMatches.filter(m => getMatchWeek(m.date, m.stage) === unlockedWeek);
    const knockoutMatches = generateKnockoutMatches();

    // Sheet 1: Pronósticos Semana Activada
    const sheet1Data = scores.map((u, i) => {
      const baseObj: any = {
        'Posición': i + 1,
        'Nombre': u.nombre,
        'Cédula': u.cedula,
        'Empresa': u.empresa,
        'Localidad': u.localidad,
        'Puntos Totales': u.puntos
      };

      const userPreds = db.predictions[u.id] || {};

      weekMatches.forEach(m => {
        const p = userPreds[m.id];
        let pTxt = 'Sin pronóstico';
        if (p) {
            if (m.type === 'knockout') {
                pTxt = `${p.predictedHome || 0} - ${p.predictedAway || 0} (Avanza: ${getTeamName(p.predictedWinnerId || 'Empate')})`;
            } else {
                pTxt = `${p.predictedHome || 0} - ${p.predictedAway || 0}`;
            }
        }
        const colName = `${m.id} (${getTeamName(m.homeTeamId)} vs ${getTeamName(m.awayTeamId)})`;
        baseObj[colName] = pTxt;
      });

      return baseObj;
    });

    // Sheet 2: Posiciones Grupos (1st, 2nd, 3rd)
    const sheet2Data = scores.map((u, i) => {
      const baseObj: any = {
        'Posición': i + 1,
        'Nombre': u.nombre,
        'Cédula': u.cedula,
      };
      
      const userPreds = db.predictions[u.id] || {};
      
      GROUPS.forEach(g => {
        const first = getTeamName(userPreds[`group_override_first_${g}`]?.predictedWinnerId || '');
        const second = getTeamName(userPreds[`group_override_second_${g}`]?.predictedWinnerId || '');
        const thirdId = userPreds[`group_override_third_${g}`]?.predictedWinnerId || '';
        const third = thirdId === 'no_aplica' ? 'No aplica' : getTeamName(thirdId);
        
        baseObj[`Grupo ${g} - 1ero`] = first !== 'N/A' ? first : 'No seleccionado';
        baseObj[`Grupo ${g} - 2do`] = second !== 'N/A' ? second : 'No seleccionado';
        baseObj[`Grupo ${g} - 3ero`] = third !== 'N/A' ? third : 'No seleccionado';
      });

      return baseObj;
    });

    // Sheet 3: Llave Eliminatoria (Knockouts)
    const sheet3Data = scores.map((u, i) => {
      const baseObj: any = {
        'Posición': i + 1,
        'Nombre': u.nombre,
        'Cédula': u.cedula,
      };

      const userPreds = db.predictions[u.id] || {};

      knockoutMatches.forEach(m => {
        const p = userPreds[m.id];
        let pTxt = 'Sin pronóstico';
        if (p) {
             pTxt = `${p.predictedHome || 0} - ${p.predictedAway || 0} (Avanza: ${getTeamName(p.predictedWinnerId || 'Empate')})`;
        }
        const colName = `${m.id} - ${m.stage}`;
        baseObj[colName] = pTxt;
      });

      return baseObj;
    });

    // Sheet 4: Premios FIFA
    const awardsMap: Record<string, string> = {
      'award_balon_oro': 'Balón de Oro',
      'award_guante_oro': 'Guante de Oro',
      'award_bota_oro': 'Bota de Oro',
      'award_joven_torneo': 'Jugador Joven',
      'award_campeon': 'Al Campeón'
    };

    const sheet4Data = scores.map((u, i) => {
      const baseObj: any = {
        'Posición': i + 1,
        'Nombre': u.nombre,
        'Cédula': u.cedula,
      };

      const userPreds = db.predictions[u.id] || {};

      Object.keys(awardsMap).forEach(key => {
         const p = userPreds[key]?.predictedWinnerId;
         baseObj[awardsMap[key]] = p ? getTeamName(p) : 'Sin pronóstico';
      });

      return baseObj;
    });

    const wb = xlsx.utils.book_new();
    
    // Convert JSONs to Sheets
    const ws1 = xlsx.utils.json_to_sheet(sheet1Data);
    const ws2 = xlsx.utils.json_to_sheet(sheet2Data);
    const ws3 = xlsx.utils.json_to_sheet(sheet3Data);
    const ws4 = xlsx.utils.json_to_sheet(sheet4Data);

    xlsx.utils.book_append_sheet(wb, ws1, `Semana ${unlockedWeek}`);
    xlsx.utils.book_append_sheet(wb, ws2, "Fase Grupos");
    xlsx.utils.book_append_sheet(wb, ws3, "Llave Eliminatoria");
    xlsx.utils.book_append_sheet(wb, ws4, "Premios FIFA");

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=pronosticos_mundial2026.xlsx');
    res.send(buffer);
  });

  // Helper matching dates/times
  function isBeforeMatchOneHour(matchDate: string, matchTime: string): boolean {
    const serverTimeMs = Date.now();
    // parse date & time
    const [year, month, day] = matchDate.split('-').map(Number);
    const [hours, minutes] = matchTime.split(':').map(Number);
    const matchTimeMs = new Date(year, month - 1, day, hours, minutes).getTime();
    
    // Check if remaining time is more than 3600000 ms (1 hour)
    return (matchTimeMs - serverTimeMs) > 60 * 60 * 1000;
  }

  // API - Get predictions of a user
  app.get('/api/predictions/:userId', async (req, res) => {
    const { userId } = req.params;
    const db = await loadDatabase(userId);
    const userPredictions = db.predictions[userId] || {};
    res.json(userPredictions);
  });

  // API - Save predictions of a user with locking validations
  app.post('/api/predictions/:userId', async (req, res) => {
    const { userId } = req.params;
    const { predictions } = req.body; // Map from matchId -> { predictedHome, predictedAway, predictedWinnerId }

    if (!predictions) {
      return res.status(400).json({ error: 'No se enviaron predicciones para guardar.' });
    }

    const db = await loadDatabase(userId);
    
    // Check user block status
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    if (user.blocked) {
      return res.status(403).json({ error: 'Usuario bloqueado.' });
    }

    if (!db.predictions[userId]) {
      db.predictions[userId] = {};
    }

    const currentSaved = db.predictions[userId];

    // Read match meta dates for time locking
    const incomingMatchIds = Object.keys(predictions);

    // Check general deadline for Fase de grupos, Llaves Eliminatorias, and Premios FIFA
    const deadlineStr = db.config?.deadline || '2026-06-14T23:59:00';
    const dlIso = deadlineStr.includes('-05:00') || deadlineStr.includes('Z') ? deadlineStr : deadlineStr + '-05:00';
    const deadlineMs = new Date(dlIso).getTime();
    if (Date.now() > deadlineMs && user.role !== 'admin') {
      const hasRestricted = incomingMatchIds.some(id => 
        id.startsWith('G-') || 
        id.startsWith('K') || 
        id.startsWith('group_override_') || 
        id.startsWith('award_')
      );
      if (hasRestricted) {
        return res.status(400).json({ error: 'La fecha límite para registrar "Fase de Grupos", "Llaves Eliminatorias" y "Premios FIFA" ha expirado.' });
      }
    }
    
    // Validate time lock & complete lock
    for (const matchId of incomingMatchIds) {
      const info = predictions[matchId];
      const matchMeta = info.meta; // Frontend passes match date & time

      const isAward = matchId.startsWith('award_');

      if (!isAward) {
        const isGroupStageItem = matchId.startsWith('G-') || matchId.startsWith('group_override_');
        const isKnockoutStageItem = matchId.startsWith('K');
        const isBeforeDeadline = Date.now() <= deadlineMs;
        const isUserBypass = (isGroupStageItem || isKnockoutStageItem) && isBeforeDeadline && user.role === 'user';

        if (!isUserBypass) {
          // 1. Weekly lock check configured by admin
          if (matchMeta && matchMeta.date) {
            let matchWeek = 1;
            if (matchMeta.stage) {
              const stage = matchMeta.stage;
              if (stage === 'group') {
                if (matchMeta.date <= '2026-06-14') matchWeek = 1;
                else if (matchMeta.date <= '2026-06-21') matchWeek = 2;
                else matchWeek = 3;
              } else if (stage === '1/16') {
                matchWeek = 4;
              } else if (stage === '1/8') {
                matchWeek = 5;
              } else if (stage === '1/4') {
                matchWeek = 6;
              } else if (stage === '1/2') {
                matchWeek = 7;
              } else if (stage === 'third_place') {
                matchWeek = 8;
              } else if (stage === 'final') {
                matchWeek = 9;
              }
            } else {
              // Fallback based on date
              if (matchMeta.date <= '2026-06-14') matchWeek = 1;
              else if (matchMeta.date <= '2026-06-21') matchWeek = 2;
              else if (matchMeta.date <= '2026-06-27') matchWeek = 3;
              else if (matchMeta.date <= '2026-07-03') matchWeek = 4;
              else if (matchMeta.date <= '2026-07-07') matchWeek = 5;
              else if (matchMeta.date <= '2026-07-11') matchWeek = 6;
              else if (matchMeta.date <= '2026-07-15') matchWeek = 7;
              else if (matchMeta.date <= '2026-07-18') matchWeek = 8;
              else matchWeek = 9;
            }

            const unlockedWeek = db.config?.unlockedWeek || 1;
            if (matchWeek !== unlockedWeek) {
              const getWeekLabel = (wk: number) => {
                if (wk === 1) return "Semana 1";
                if (wk === 2) return "Semana 2";
                if (wk === 3) return "Semana 3";
                if (wk === 4) return "Round 32";
                if (wk === 5) return "Round 1/8";
                if (wk === 6) return "Round 1/4";
                if (wk === 7) return "Round 1/2";
                if (wk === 8) return "Round 3er Puesto";
                return "Gran final";
              };
              return res.status(400).json({ error: `${getWeekLabel(matchWeek)} está bloqueada. Actualmente la única habilitada es ${getWeekLabel(unlockedWeek)}.` });
            }
          }

          // 2. Time Lock check (exactly 1 hour before kickoff)
          if (matchMeta && !isBeforeMatchOneHour(matchMeta.date, matchMeta.time)) {
            return res.status(400).json({ error: `El partido con ID ${matchId} ya está cerrado debido a que falta menos de 1 hora para su inicio.` });
          }

          // 3. Already completed lock check
          if (currentSaved[matchId] && currentSaved[matchId].completed) {
            return res.status(400).json({ error: `El pronóstico para el partido ${matchId} ya fue registrado anteriormente y está bloqueado para edición.` });
          }
        }
      }

      // Save item
      currentSaved[matchId] = {
        matchId,
        predictedHome: info.predictedHome !== undefined ? info.predictedHome.toString() : '',
        predictedAway: info.predictedAway !== undefined ? info.predictedAway.toString() : '',
        predictedWinnerId: info.predictedWinnerId,
        completed: isAward ? false : true // Mark as completed
      };
    }

    await saveDatabase(db, { singleUserPredictionsId: userId });
    res.json({ success: true, predictions: db.predictions[userId] });
  });

  // API - Get current Configuration
  app.get('/api/config', async (req, res) => {
    try {
      const { rows: conf } = await pool.query("SELECT * FROM config WHERE id = 'system_config'");
      if (conf.length === 0) {
        return res.json({
          unlockedWeek: 1,
          official_balon_oro: '',
          official_guante_oro: '',
          official_bota_oro: '',
          official_joven_torneo: '',
          official_campeon: '',
          official_firsts: {},
          official_seconds: {},
          official_thirds: [],
          match_overrides: {},
          deadline: '2026-06-14T23:59:00',
          maintenance_mode: false
        });
      }
      const systemConfig = {
        unlockedWeek: conf[0].unlockedWeek || 1,
        official_balon_oro: conf[0].official_balon_oro || '',
        official_guante_oro: conf[0].official_guante_oro || '',
        official_bota_oro: conf[0].official_bota_oro || '',
        official_joven_torneo: conf[0].official_joven_torneo || '',
        official_campeon: conf[0].official_campeon || '',
        official_firsts: typeof conf[0].official_firsts === 'string' ? JSON.parse(conf[0].official_firsts) : conf[0].official_firsts || {},
        official_seconds: typeof conf[0].official_seconds === 'string' ? JSON.parse(conf[0].official_seconds) : conf[0].official_seconds || {},
        official_thirds: typeof conf[0].official_thirds === 'string' ? JSON.parse(conf[0].official_thirds) : conf[0].official_thirds || [],
        match_overrides: typeof conf[0].match_overrides === 'string' ? JSON.parse(conf[0].match_overrides) : conf[0].match_overrides || {},
        deadline: conf[0].deadline || '2026-06-14T23:59:00',
        maintenance_mode: typeof conf[0].maintenance_mode === 'boolean' ? conf[0].maintenance_mode : (conf[0].maintenance_mode === 'true' || conf[0].maintenance_mode === 1 || conf[0].maintenance_mode === true)
      };
      res.json(systemConfig);
    } catch (error) {
      console.error('Get config error:', error);
      res.status(500).json({ error: 'Error interno del servidor al obtener la configuración.' });
    }
  });

  // API - Toggle Maintenance Mode (Admin only)
  app.post('/api/admin/config/maintenance', async (req, res) => {
    try {
      const requesterId = req.headers['x-user-id'] as string;
      const { maintenanceMode } = req.body;

      const db = await loadDatabase();
      const requester = db.users.find(u => u.id === requesterId);

      if (!requester || requester.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
      }

      if (!db.config) {
        db.config = { unlockedWeek: 1 };
      }

      db.config.maintenance_mode = !!maintenanceMode;
      await saveDatabase(db, { configOnly: true });
      res.json({ success: true, config: db.config });
    } catch (error) {
      console.error('Toggle maintenance error:', error);
      res.status(500).json({ error: 'Error interno del servidor al cambiar el estado de mantenimiento.' });
    }
  });

  // API - Update unlocked week (Admin only)
  app.post('/api/admin/config', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { unlockedWeek } = req.body;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
    }

    const numWeek = parseInt(unlockedWeek, 10);
    if (numWeek < 1 || numWeek > 9) {
      return res.status(400).json({ error: 'Semana no válida. Debe ser del 1 al 9.' });
    }

    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }

    db.config.unlockedWeek = numWeek;
    await saveDatabase(db, { configOnly: true });
    res.json({ success: true, config: db.config });
  });

  // API - Update prediction deadline (Admin only)
  app.post('/api/admin/config/deadline', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { deadline } = req.body;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
    }

    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }

    db.config.deadline = deadline || '2026-06-14T23:59:00';
    await saveDatabase(db, { configOnly: true });
    res.json({ success: true, config: db.config });
  });

  // API - Update official bracket in config (Admin only)
  app.post('/api/admin/config/bracket', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { official_firsts, official_seconds, official_thirds } = req.body;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
    }

    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }

    db.config.official_firsts = official_firsts;
    db.config.official_seconds = official_seconds;
    db.config.official_thirds = official_thirds;

    await saveDatabase(db, { configOnly: true, recalculateRankings: true });
    res.json({ success: true, config: db.config });
  });

  // API - Update awards in config (Admin only)
  app.post('/api/admin/config/awards', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo, official_campeon } = req.body;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
    }

    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }

    db.config.official_balon_oro = official_balon_oro ?? '';
    db.config.official_guante_oro = official_guante_oro ?? '';
    db.config.official_bota_oro = official_bota_oro ?? '';
    db.config.official_joven_torneo = official_joven_torneo ?? '';
    db.config.official_campeon = official_campeon ?? '';

    await saveDatabase(db, { configOnly: true, recalculateRankings: true });
    res.json({ success: true, config: db.config });
  });

  // API - Update match schedule overrides (Admin only)
  app.post('/api/admin/matches/schedule', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { match_overrides } = req.body;

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
    }

    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }

    db.config.match_overrides = match_overrides || {};
    await saveDatabase(db, { configOnly: true });
    res.json({ success: true, config: db.config });
  });

  // API - Save official match results (Admin only)
  app.post('/api/admin/results', async (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { results } = req.body; // Array of { matchId, homeScore, awayScore, winnerId }

    const db = await loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'Formato inváldo.' });
    }

    results.forEach((r) => {
      const idx = db.matches.findIndex(m => m.matchId === r.matchId);
      const record = {
        matchId: r.matchId,
        homeScore: r.homeScore !== undefined && r.homeScore !== '' ? parseInt(r.homeScore, 10) : undefined,
        awayScore: r.awayScore !== undefined && r.awayScore !== '' ? parseInt(r.awayScore, 10) : undefined,
        winnerId: r.winnerId
      };

      if (idx >= 0) {
        db.matches[idx] = record;
      } else {
        db.matches.push(record);
      }
    });

    await saveDatabase(db, { matchesOnly: true, recalculateRankings: true });
    res.json({ success: true, matches: db.matches });
  });

  // API - Get official results
  app.get('/api/admin/results', async (req, res) => {
    const db = await loadDatabase();
    res.json(db.matches);
  });


  // API - Get Ranking
  app.get('/api/ranking', async (req, res) => {
    try {
      // Perform a LEFT JOIN starting from users to include ALL users who are not admin
      const { rows: fullRanking } = await pool.query(`
        SELECT 
          u.id AS "userId",
          u."nombreCompleto" AS "nombreCompleto",
          u.empresa,
          u.localidad,
          u.cedula,
          u.correo,
          u."fechaHoraRegistro" AS "fechaHoraRegistro",
          u.role,
          u.blocked,
          COALESCE(r.puntos, 0) AS puntos,
          COALESCE(r."puntosFaseGrupos", 0) AS "puntosFaseGrupos",
          COALESCE(r."puntosCampeon", 0) AS "puntosCampeon",
          COALESCE(r."aciertosExactos", 0) AS "aciertosExactos",
          COALESCE(r."aciertosGanador", 0) AS "aciertosGanador",
          COALESCE(r."aciertosGolesEquipo", 0) AS "aciertosGolesEquipo",
          COALESCE(r."aciertosDiferenciaGol", 0) AS "aciertosDiferenciaGol",
          COALESCE(r."aciertosPrimeros", 0) AS "aciertosPrimeros",
          COALESCE(r."aciertosSegundos", 0) AS "aciertosSegundos",
          COALESCE(r."aciertosTerceros", 0) AS "aciertosTerceros",
          COALESCE(r."puntosBalonOro", 0) AS "puntosBalonOro",
          COALESCE(r."puntosGuanteOro", 0) AS "puntosGuanteOro",
          COALESCE(r."puntosBotaOro", 0) AS "puntosBotaOro",
          COALESCE(r."puntosJovenTorneo", 0) AS "puntosJovenTorneo"
        FROM users u
        LEFT JOIN user_rankings r ON u.id = r."userId"
        WHERE u.role != 'admin'
      `);
      
      const stats = fullRanking.map(r => ({
        id: r.userId,
        nombre: (r.nombreCompleto || '').replace(/[\uFFFD\u00A0]/g, 'Ñ'),
        empresa: r.empresa,
        localidad: r.localidad,
        cedula: r.cedula,
        correo: r.correo,
        fechaRegistro: r.fechaHoraRegistro,
        role: r.role,
        blocked: r.blocked,
        puntos: Number(r.puntos),
        puntosFaseGrupos: Number(r.puntosFaseGrupos),
        puntosCampeon: Number(r.puntosCampeon),
        aciertosExactos: Number(r.aciertosExactos),
        aciertosGanador: Number(r.aciertosGanador),
        aciertosGolesEquipo: Number(r.aciertosGolesEquipo),
        aciertosDiferenciaGol: Number(r.aciertosDiferenciaGol),
        aciertosPrimeros: Number(r.aciertosPrimeros),
        aciertosSegundos: Number(r.aciertosSegundos),
        aciertosTerceros: Number(r.aciertosTerceros),
        puntosBalonOro: Number(r.puntosBalonOro),
        puntosGuanteOro: Number(r.puntosGuanteOro),
        puntosBotaOro: Number(r.puntosBotaOro),
        puntosJovenTorneo: Number(r.puntosJovenTorneo),
      }));

      // Helper function to extract first last name (primer apellido) from "nombreCompleto"
      const getFirstLastName = (fullName?: string): string => {
        if (!fullName) return '';
        const parts = fullName.trim().split(/\s+/);
        const N = parts.length;
        if (N >= 3) {
          return parts[N - 2] || '';
        } else if (N === 2) {
          return parts[1] || '';
        }
        return parts[0] || '';
      };

      // Custom Sorting:
      // - Users with puntos > 0 go at the top, sorted by puntos (DESC), then within same points, sorted by first last name (ASC).
      // - Users with points = 0 are sorted entirely alphabetically by first last name (ASC) at the bottom.
      stats.sort((a, b) => {
        const pA = a.puntos || 0;
        const pB = b.puntos || 0;

        if (pA > 0 && pB > 0) {
          // Both have points -> Highest points first
          if (pB !== pA) return pB - pA;
          // Tie-breaker -> Alphabetical by first last name (primer apellido)
          const lnA = getFirstLastName(a.nombre);
          const lnB = getFirstLastName(b.nombre);
          return lnA.localeCompare(lnB, 'es', { sensitivity: 'base' });
        } else if (pA > 0 && pB === 0) {
          return -1; // user a has points, goes above
        } else if (pA === 0 && pB > 0) {
          return 1; // user b has points, goes above
        } else {
          // Both have 0 points -> Alphabetical by first last name (primer apellido)
          const lnA = getFirstLastName(a.nombre);
          const lnB = getFirstLastName(b.nombre);
          return lnA.localeCompare(lnB, 'es', { sensitivity: 'base' });
        }
      });

      res.json(stats);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Error getting ranking' });
    }
  });

  // API - Get general statistics
  app.get('/api/admin/stats', async (req, res) => {
    const db = await loadDatabase();
    
    const totalUsers = db.users.length;
    const activeUsers = db.users.filter(u => !u.blocked).length;
    const blockedUsers = db.users.filter(u => u.blocked).length;

    // Calculate predictions statistics
    const totalPredictionsMade = Object.values(db.predictions).reduce((sum, userPreds) => {
      return sum + Object.keys(userPreds).length;
    }, 0);

    const matchPredictionCounts: Record<string, number> = {};
    Object.values(db.predictions).forEach(userPreds => {
      Object.keys(userPreds).forEach(mId => {
        matchPredictionCounts[mId] = (matchPredictionCounts[mId] || 0) + 1;
      });
    });

    res.json({
      totalUsers,
      activeUsers,
      blockedUsers,
      totalPredictionsMade,
      matchPredictionCounts
    });
  });

  // API - Get Server Current Time
  app.get('/api/time', async (req, res) => {
    res.json({ serverTime: new Date().toISOString() });
  });

  // Vite development mode setup or production build fallback
  if (process.env.NODE_ENV !== 'production') {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server started on http://0.0.0.0:${PORT}`);
    });
  }

  return app;
}

const appPromise = startServer();
export default async function handler(req: any, res: any) {
  const app = await appPromise;
  app(req, res);
}
