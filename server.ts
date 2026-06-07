import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { TEAMS, GROUPS, generateGroupStageMatches, generateKnockoutMatches } from './src/data';
import { computeAllStandings, getRankedThirdPlacedTeams, getKnockoutWinnerId, resolveAllThirds } from './src/utils';

// Ecuador cedula validation
export function validarCedulaEcuatoriana(cedula: string): boolean {
  if (!cedula || cedula.length !== 10) return false;
  if (!/^\d+$/.test(cedula)) return false;

  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;

  const tercerDigito = parseInt(cedula.charAt(2), 10);
  if (tercerDigito >= 6) return false;

  const n = cedula.length;
  let total = 0;
  for (let i = 0; i < n - 1; i++) {
    let num = parseInt(cedula.charAt(i), 10);
    if (i % 2 === 0) { // Odd positions (0, 2, 4, 6, 8 indexes)
      num = num * 2;
      if (num > 9) num -= 9;
    }
    total += num;
  }

  const digitoVerificador = parseInt(cedula.charAt(9), 10);
  const decenaSuperior = Math.ceil(total / 10) * 10;
  let calculado = decenaSuperior - total;
  if (calculado === 10) calculado = 0;

  return calculado === digitoVerificador;
}

const DB_FILE = path.join(process.cwd(), 'data_db.json');

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
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.config) {
        parsed.config = { 
          unlockedWeek: 1,
          official_balon_oro: '',
          official_guante_oro: '',
          official_bota_oro: '',
          official_joven_torneo: ''
        };
      } else {
        if (parsed.config.official_balon_oro === undefined) parsed.config.official_balon_oro = '';
        if (parsed.config.official_guante_oro === undefined) parsed.config.official_guante_oro = '';
        if (parsed.config.official_bota_oro === undefined) parsed.config.official_bota_oro = '';
        if (parsed.config.official_joven_torneo === undefined) parsed.config.official_joven_torneo = '';
      }
      return parsed;
    }
  } catch (e) {
    console.error('Failed to load DB file, using default schema:', e);
  }
  return { 
    users: [], 
    predictions: {}, 
    matches: [], 
    config: { 
      unlockedWeek: 1,
      official_balon_oro: '',
      official_guante_oro: '',
      official_bota_oro: '',
      official_joven_torneo: ''
    } 
  };
}

function saveDatabase(db: DatabaseSchema) {
  try {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save DB file:', e);
  }
}

// Initial DB save to ensure file structure exists
saveDatabase(loadDatabase());

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API - Auth Register
  app.post('/api/auth/register', (req, res) => {
    const { nombreCompleto, cedula, correo, empresa, localidad, isAdminTest } = req.body;

    if (!nombreCompleto || !cedula || !empresa || !localidad || !correo) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
    }

    const cleanCedula = cedula.trim().replace(/\s+/g, '');
    const cleanNombre = nombreCompleto.trim();
    const cleanCorreo = correo.trim().toLowerCase();

    if (cleanNombre === '' || cleanCedula === '' || cleanCorreo === '') {
      return res.status(400).json({ error: 'No se permiten campos vacíos.' });
    }

    if (!cleanCorreo.includes('@') || !cleanCorreo.includes('.')) {
      return res.status(400).json({ error: 'El formato de correo ingresado no es válido.' });
    }

    // Bypass of cedula check only if it is the special administrator test or special test cedula
    const isSpecialTest = cleanCedula === 'admin12345';
    if (!isSpecialTest && !validarCedulaEcuatoriana(cleanCedula)) {
      return res.status(400).json({ error: 'La cédula ingresada no es una cédula ecuatoriana válida.' });
    }

    const db = loadDatabase();

    // Cédula duplicate check
    const existing = db.users.find(u => u.cedula === cleanCedula);
    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario registrado con esta cédula.' });
    }

    // Email duplicate check
    const existingEmail = db.users.find(u => u.correo && u.correo.toLowerCase().trim() === cleanCorreo);
    if (existingEmail) {
      return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo.' });
    }

    const newUser: UserRecord = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      nombreCompleto: cleanNombre,
      cedula: cleanCedula,
      correo: cleanCorreo,
      empresa,
      localidad,
      fechaHoraRegistro: new Date().toISOString(),
      role: isAdminTest ? 'admin' : (cleanCedula === 'admin12345' ? 'admin' : 'user'),
      blocked: false
    };

    db.users.push(newUser);
    saveDatabase(db);

    res.json({ user: newUser });
  });

  // API - Auth Login (By Cédula and opt Correo)
  app.post('/api/auth/login', (req, res) => {
    const { cedula, correo } = req.body;
    if (!cedula) {
      return res.status(400).json({ error: 'La cédula es requerida.' });
    }

    const cleanCedula = cedula.trim();
    const db = loadDatabase();

    let user;
    if (correo && correo.trim() !== '') {
      const cleanCorreo = correo.trim().toLowerCase();
      user = db.users.find(u => u.cedula === cleanCedula && u.correo && u.correo.trim().toLowerCase() === cleanCorreo);
      if (!user) {
        return res.status(400).json({ error: 'No se encontró ningún usuario registrado que coincida con este correo y cédula.' });
      }
    } else {
      user = db.users.find(u => u.cedula === cleanCedula);
      if (!user) {
        return res.status(400).json({ error: 'No se encontró ningún usuario registrado con esta cédula.' });
      }
    }

    if (user.blocked) {
      return res.status(403).json({ error: 'Tu cuenta ha sido bloqueada por el administrador.' });
    }

    res.json({ user });
  });

  // API - Get all users (Admin only)
  app.get('/api/admin/users', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const db = loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de Administrador.' });
    }

    res.json(db.users);
  });

  // API - Block/Unblock user (Admin Only)
  app.post('/api/admin/users/:id/block', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { id } = req.params;
    const { blocked } = req.body;

    const db = loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    const targetUser = db.users.find(u => u.id === id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    targetUser.blocked = !!blocked;
    saveDatabase(db);

    res.json({ success: true, user: targetUser });
  });

  // API - Delete user (Admin Only)
  app.delete('/api/admin/users/:id', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { id } = req.params;

    const db = loadDatabase();
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

    // Clean up their predictions from database structure if any
    if (db.predictions && db.predictions[id]) {
      delete db.predictions[id];
    }

    saveDatabase(db);
    res.json({ success: true, message: 'Usuario y pronósticos eliminados correctamente.' });
  });

  // API - Export Users to CSV/Excel raw string
  app.get('/api/admin/export', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const db = loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado.' });
    }

    // Build Ranking general stats first to export rich info
    const scores = calculateRankingStats(db);

    let csvContent = '\uFEFF'; // Excel UTF-8 BOM
    csvContent += 'Posición,Nombre Completo,Cédula,Correo,Empresa,Localidad,Fecha Registro,Puntos,Aciertos Exactos,Aciertos Ganador,Aciertos Goles Equipo,Aciertos Diferencia Gol,Aciertos 1er Grupo,Aciertos 2do Grupo,Aciertos 3er Grupo,Puntos Campeón,Puntos Balón de Oro,Puntos Guante de Oro,Puntos Bota de Oro,Puntos Joven Torneo,Rol,Estado\n';

    scores.forEach((u, index) => {
      csvContent += `${index + 1},"${u.nombre}","${u.cedula}","${u.correo || 'N/D'}","${u.empresa}","${u.localidad}","${u.fechaRegistro}",${u.puntos},${u.aciertosExactos},${u.aciertosGanador},${u.aciertosGolesEquipo},${u.aciertosDiferenciaGol},${u.aciertosPrimeros},${u.aciertosSegundos},${u.aciertosTerceros},${u.puntosCampeon},${u.puntosBalonOro},${u.puntosGuanteOro},${u.puntosBotaOro},${u.puntosJovenTorneo},"${u.role}","${u.blocked ? 'Bloqueado' : 'Activo'}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=participantes_mundial2026.csv');
    res.send(csvContent);
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
  app.get('/api/predictions/:userId', (req, res) => {
    const { userId } = req.params;
    const db = loadDatabase();
    const userPredictions = db.predictions[userId] || {};
    res.json(userPredictions);
  });

  // API - Save predictions of a user with locking validations
  app.post('/api/predictions/:userId', (req, res) => {
    const { userId } = req.params;
    const { predictions } = req.body; // Map from matchId -> { predictedHome, predictedAway, predictedWinnerId }

    if (!predictions) {
      return res.status(400).json({ error: 'No se enviaron predicciones para guardar.' });
    }

    const db = loadDatabase();
    
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
    
    // Validate time lock & complete lock
    for (const matchId of incomingMatchIds) {
      const info = predictions[matchId];
      const matchMeta = info.meta; // Frontend passes match date & time

      const isAward = matchId.startsWith('award_');

      if (!isAward) {
        // 1. Weekly lock check configured by admin (only for group stage matches)
        const isKnockout = matchId.startsWith('K');
        if (!isKnockout && matchMeta && matchMeta.date) {
          let matchWeek = 1;
          if (matchMeta.date <= '2026-06-14') {
            matchWeek = 1;
          } else if (matchMeta.date <= '2026-06-21') {
            matchWeek = 2;
          } else {
            matchWeek = 3;
          }

          const unlockedWeek = db.config?.unlockedWeek || 1;
          if (matchWeek !== unlockedWeek) {
            return res.status(400).json({ error: `La Semana ${matchWeek} está bloqueada. Actualmente la única semana habilitada es la Semana ${unlockedWeek}.` });
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

      // Save item
      currentSaved[matchId] = {
        matchId,
        predictedHome: info.predictedHome !== undefined ? info.predictedHome.toString() : '',
        predictedAway: info.predictedAway !== undefined ? info.predictedAway.toString() : '',
        predictedWinnerId: info.predictedWinnerId,
        completed: isAward ? false : true // Mark as completed
      };
    }

    saveDatabase(db);
    res.json({ success: true, predictions: db.predictions[userId] });
  });

  // API - Get current Configuration
  app.get('/api/config', (req, res) => {
    const db = loadDatabase();
    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }
    res.json(db.config);
  });

  // API - Update unlocked week (Admin only)
  app.post('/api/admin/config', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { unlockedWeek } = req.body;

    const db = loadDatabase();
    const requester = db.users.find(u => u.id === requesterId);

    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ error: 'Acceso denegado. Se requiere ser Administrador.' });
    }

    const numWeek = parseInt(unlockedWeek, 10);
    if (numWeek !== 1 && numWeek !== 2 && numWeek !== 3) {
      return res.status(400).json({ error: 'Semana no válida. Debe ser 1, 2 o 3.' });
    }

    if (!db.config) {
      db.config = { unlockedWeek: 1 };
    }

    db.config.unlockedWeek = numWeek;
    saveDatabase(db);
    res.json({ success: true, config: db.config });
  });

  // API - Update awards in config (Admin only)
  app.post('/api/admin/config/awards', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo } = req.body;

    const db = loadDatabase();
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

    saveDatabase(db);
    res.json({ success: true, config: db.config });
  });

  // API - Save official match results (Admin only)
  app.post('/api/admin/results', (req, res) => {
    const requesterId = req.headers['x-user-id'] as string;
    const { results } = req.body; // Array of { matchId, homeScore, awayScore, winnerId }

    const db = loadDatabase();
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

    saveDatabase(db);
    res.json({ success: true, matches: db.matches });
  });

  // API - Get official results
  app.get('/api/admin/results', (req, res) => {
    const db = loadDatabase();
    res.json(db.matches);
  });

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
    const officialRankedThirds = getRankedThirdPlacedTeams(officialAllStandings);
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

    const activeUsers = db.users.filter(u => !u.blocked);
    
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

        // 3. Goles de un equipo: 1 point per team
        if (pHome === oHome) {
          puntos += 1;
          aciertosGolesEquipo += 1;
        }
        if (pAway === oAway) {
          puntos += 1;
          aciertosGolesEquipo += 1;
        }

        // 4. Diferencia de gol: 1 point
        if ((pHome - pAway) === (oHome - oAway)) {
          puntos += 1;
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

    // Sort by points desc, then exact fits desc, then winner hits desc, then name asc
    return ranking.sort((a, b) => {
      if (b.puntos !== a.puntos) return b.puntos - a.puntos;
      if (b.aciertosExactos !== a.aciertosExactos) return b.aciertosExactos - a.aciertosExactos;
      if (b.aciertosGanador !== a.aciertosGanador) return b.aciertosGanador - a.aciertosGanador;
      return a.nombre.localeCompare(b.nombre);
    });
  }

  // API - Get Ranking
  app.get('/api/ranking', (req, res) => {
    const db = loadDatabase();
    const stats = calculateRankingStats(db);
    res.json(stats);
  });

  // API - Get general statistics
  app.get('/api/admin/stats', (req, res) => {
    const db = loadDatabase();
    
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
  app.get('/api/time', (req, res) => {
    res.json({ serverTime: new Date().toISOString() });
  });

  // Vite development mode setup or production build fallback
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on http://localhost:${PORT}`);
  });
}

startServer();
