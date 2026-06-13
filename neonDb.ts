import mssql from 'mssql';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const AzureSQLServerConnStr = "Data Source=tcp:sql-database-dev-eastus-001.database.windows.net,1433;Initial Catalog=sqldb-mundial2026-dev-eastus-001;Persist Security Info=False;User ID=mundial2026_dev_sql_user;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=30;Encrypt=True;TrustServerCertificate=False;Command Timeout=0";
const AzureSQLServerPassword = "ed8KWHm8rShgADRTYU";

let baseConnectionString = process.env.DATABASE_URL;
let dbPassword = process.env.DATABASE_PASSWORD || AzureSQLServerPassword;

if (!baseConnectionString || baseConnectionString.startsWith('postgresql://') || baseConnectionString.startsWith('postgres://') || (!baseConnectionString.includes('Data Source=') && !baseConnectionString.includes('Initial Catalog=') && !baseConnectionString.includes('Server=') && !baseConnectionString.startsWith('mssql://') && !baseConnectionString.startsWith('sqlserver://'))) {
  console.log("ℹ️ Info: DATABASE_URL is not configured or is a PostgreSQL string. Using default Azure SQL Server connection string.");
  baseConnectionString = AzureSQLServerConnStr;
  dbPassword = AzureSQLServerPassword;
}

let poolPromise: Promise<mssql.ConnectionPool> | null = null;

function parseConnectionString(connStr: string, pwd?: string): any {
  if (connStr.includes('Data Source=') || connStr.includes('Initial Catalog=') || connStr.includes('Server=')) {
    const config: any = {
      server: '',
      database: '',
      user: '',
      password: pwd || '',
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    };

    const parts = connStr.split(';');
    parts.forEach(part => {
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const key = part.substring(0, eqIdx).trim().toLowerCase();
        let value = part.substring(eqIdx + 1).trim();

        if (key === 'data source' || key === 'server') {
          if (value.startsWith('tcp:')) {
            value = value.substring(4);
          }
          const portParts = value.split(',');
          config.server = portParts[0];
          if (portParts[1]) {
            config.port = parseInt(portParts[1], 10);
          }
        } else if (key === 'initial catalog' || key === 'database') {
          config.database = value;
        } else if (key === 'user id' || key === 'user') {
          config.user = value;
        } else if (key === 'password' || key === 'pwd') {
          config.password = value;
        } else if (key === 'encrypt') {
          config.options = config.options || {};
          config.options.encrypt = value.toLowerCase() === 'true';
        } else if (key === 'trustservercertificate') {
          config.options = config.options || {};
          config.options.trustServerCertificate = value.toLowerCase() === 'true';
        } else if (key === 'connect timeout' || key === 'connection timeout') {
          config.connectionTimeout = parseInt(value, 10) * 1000;
        }
      }
    });

    if (pwd && !config.password) {
      config.password = pwd;
    }

    return config;
  }
  return connStr;
}

// ============================================================================
// SQL EMULATOR STORAGE (Fallback Mode)
// ============================================================================
const DB_FILE = path.join(process.cwd(), 'data_db.json');
const CSV_FILE = path.join(process.cwd(), 'allowed_users.csv');

// In-memory representation of tables
interface EmulatedDb {
  users: any[];
  user_rankings: any[];
  matches: any[];
  match_predictions: any[];
  knockout_predictions: any[];
  group_standings_predictions: any[];
  fifa_awards_predictions: any[];
  config: any[];
  allowed_cedulas: any[];
}

let fallbackStore: EmulatedDb | null = null;
let fallbackModeActive = false;
export let lastErrorIp: string | null = null;
export let lastConnectionError: string | null = null;

// Return whether we are operating under local fallback
export function isFallbackModeActive(): boolean {
  return fallbackModeActive;
}

function loadFallbackStore(): EmulatedDb {
  if (fallbackStore) return fallbackStore;

  const store: EmulatedDb = {
    users: [],
    user_rankings: [],
    matches: [],
    match_predictions: [],
    knockout_predictions: [],
    group_standings_predictions: [],
    fifa_awards_predictions: [],
    config: [],
    allowed_cedulas: []
  };

  // 1. Initial Default Config
  store.config = [{
    id: 'system_config',
    unlockedWeek: 1,
    official_balon_oro: '',
    official_guante_oro: '',
    official_bota_oro: '',
    official_joven_torneo: '',
    official_campeon: '',
    official_firsts: '{}',
    official_seconds: '{}',
    official_thirds: '[]',
    match_overrides: '{}',
    deadline: '2026-06-14T23:59:00',
    maintenance_mode: false
  }];

  // 2. Parse CSV for allowed_cedulas
  if (fs.existsSync(CSV_FILE)) {
    try {
      const csvContent = fs.readFileSync(CSV_FILE, 'utf-8');
      const lines = csvContent.split(/\r?\n/);
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(';');
        if (cols.length >= 2) {
          store.allowed_cedulas.push({
            cedula: cols[0].trim(),
            nombre: cols[1].trim(),
            empresa: cols[2] ? cols[2].trim() : '',
            localidad: cols[3] ? cols[3].trim() : ''
          });
        }
      }
    } catch (e) {
      console.error('Error parsing CSV for allowed_cedulas:', e);
    }
  }

  // 3. Load JSON DB to reconstruct the relational tables
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const json = JSON.parse(content);
      
      if (Array.isArray(json.users)) {
        store.users = json.users;
      } else {
        // Safe default default admin
        store.users = [
          {
            id: 'usr_admin',
            nombreCompleto: 'Jhonny Vargas',
            cedula: 'admin12345',
            correo: 'jhonnyvp5@gmail.com',
            empresa: 'PRODUMAR SA',
            localidad: 'San Pablo',
            fechaHoraRegistro: new Date().toISOString(),
            role: 'admin',
            blocked: false
          }
        ];
      }

      if (Array.isArray(json.matches)) store.matches = json.matches;
      if (Array.isArray(json.user_rankings)) store.user_rankings = json.user_rankings;
      
      if (json.config) {
        store.config = [{
          id: 'system_config',
          unlockedWeek: json.config.unlockedWeek || 1,
          official_balon_oro: json.config.official_balon_oro || '',
          official_guante_oro: json.config.official_guante_oro || '',
          official_bota_oro: json.config.official_bota_oro || '',
          official_joven_torneo: json.config.official_joven_torneo || '',
          official_campeon: json.config.official_campeon || '',
          official_firsts: typeof json.config.official_firsts === 'string' ? json.config.official_firsts : JSON.stringify(json.config.official_firsts || {}),
          official_seconds: typeof json.config.official_seconds === 'string' ? json.config.official_seconds : JSON.stringify(json.config.official_seconds || {}),
          official_thirds: typeof json.config.official_thirds === 'string' ? json.config.official_thirds : JSON.stringify(json.config.official_thirds || []),
          match_overrides: typeof json.config.match_overrides === 'string' ? json.config.match_overrides : JSON.stringify(json.config.match_overrides || {}),
          deadline: json.config.deadline || '2026-06-14T23:59:00',
          maintenance_mode: typeof json.config.maintenance_mode === 'boolean' ? json.config.maintenance_mode : (json.config.maintenance_mode === 'true' || json.config.maintenance_mode === 1 || json.config.maintenance_mode === true)
        }];
      }

      // Reconstruct predictions
      if (json.predictions) {
        for (const [userId, userPreds] of Object.entries(json.predictions)) {
          if (!userPreds || typeof userPreds !== 'object') continue;
          for (const [matchId, p] of Object.entries(userPreds as Record<string, any>)) {
            if (matchId.startsWith('group_override_')) {
              const parts = matchId.split('_');
              const grp = parts[parts.length - 1];
              let existing = store.group_standings_predictions.find(entry => entry.userId === userId && entry.groupId === grp);
              if (!existing) {
                existing = { id: `${userId}_${grp}`, userId, groupId: grp, firstPlaceId: null, secondPlaceId: null, thirdPlaceId: null };
                store.group_standings_predictions.push(existing);
              }
              if (matchId.includes('_first_')) existing.firstPlaceId = p.predictedWinnerId;
              if (matchId.includes('_second_')) existing.secondPlaceId = p.predictedWinnerId;
              if (matchId.includes('_third_')) existing.thirdPlaceId = p.predictedWinnerId;
            } else if (matchId.startsWith('award_')) {
              store.fifa_awards_predictions.push({
                id: `${userId}_${matchId}`,
                userId,
                awardId: matchId,
                predictedWinnerId: p.predictedWinnerId
              });
            } else if (matchId.startsWith('K') || matchId.startsWith('O')) {
              store.knockout_predictions.push({
                id: `${userId}_${matchId}`,
                userId,
                matchId,
                predictedHome: p.predictedHome,
                predictedAway: p.predictedAway,
                predictedWinnerId: p.predictedWinnerId,
                completed: !!p.completed
              });
            } else {
              store.match_predictions.push({
                id: `${userId}_${matchId}`,
                userId,
                matchId,
                predictedHome: p.predictedHome,
                predictedAway: p.predictedAway,
                completed: !!p.completed
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Error loading fallback data_db.json file:', e);
    }
  }

  fallbackStore = store;
  return store;
}

function saveFallbackStore() {
  if (!fallbackStore) return;
  const store = fallbackStore;
  
  const json: any = {
    users: store.users,
    matches: store.matches,
    user_rankings: store.user_rankings,
    config: store.config[0] ? {
      unlockedWeek: store.config[0].unlockedWeek,
      official_balon_oro: store.config[0].official_balon_oro,
      official_guante_oro: store.config[0].official_guante_oro,
      official_bota_oro: store.config[0].official_bota_oro,
      official_joven_torneo: store.config[0].official_joven_torneo,
      official_campeon: store.config[0].official_campeon,
      official_firsts: typeof store.config[0].official_firsts === 'string' ? JSON.parse(store.config[0].official_firsts) : store.config[0].official_firsts,
      official_seconds: typeof store.config[0].official_seconds === 'string' ? JSON.parse(store.config[0].official_seconds) : store.config[0].official_seconds,
      official_thirds: typeof store.config[0].official_thirds === 'string' ? JSON.parse(store.config[0].official_thirds) : store.config[0].official_thirds,
      match_overrides: typeof store.config[0].match_overrides === 'string' ? JSON.parse(store.config[0].match_overrides) : store.config[0].match_overrides,
      deadline: store.config[0].deadline,
      maintenance_mode: !!store.config[0].maintenance_mode
    } : { unlockedWeek: 1 },
    predictions: {}
  };

  store.match_predictions.forEach(p => {
    if (!json.predictions[p.userId]) json.predictions[p.userId] = {};
    json.predictions[p.userId][p.matchId] = {
      matchId: p.matchId,
      predictedHome: p.predictedHome,
      predictedAway: p.predictedAway,
      completed: !!p.completed
    };
  });

  store.knockout_predictions.forEach(p => {
    if (!json.predictions[p.userId]) json.predictions[p.userId] = {};
    json.predictions[p.userId][p.matchId] = {
      matchId: p.matchId,
      predictedHome: p.predictedHome,
      predictedAway: p.predictedAway,
      predictedWinnerId: p.predictedWinnerId,
      completed: !!p.completed
    };
  });

  store.fifa_awards_predictions.forEach(p => {
    if (!json.predictions[p.userId]) json.predictions[p.userId] = {};
    json.predictions[p.userId][p.awardId] = {
      matchId: p.awardId,
      predictedWinnerId: p.predictedWinnerId,
      completed: true
    };
  });

  store.group_standings_predictions.forEach(p => {
    if (!json.predictions[p.userId]) json.predictions[p.userId] = {};
    const grp = p.groupId;
    if (p.firstPlaceId) {
      json.predictions[p.userId][`group_override_first_${grp}`] = {
        matchId: `group_override_first_${grp}`,
        predictedWinnerId: p.firstPlaceId,
        completed: true
      };
    }
    if (p.secondPlaceId) {
      json.predictions[p.userId][`group_override_second_${grp}`] = {
        matchId: `group_override_second_${grp}`,
        predictedWinnerId: p.secondPlaceId,
        completed: true
      };
    }
    if (p.thirdPlaceId) {
      json.predictions[p.userId][`group_override_third_${grp}`] = {
        matchId: `group_override_third_${grp}`,
        predictedWinnerId: p.thirdPlaceId,
        completed: true
      };
    }
  });

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(json, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing to fallback JSON file:', err);
  }
}

function processEmulatedQuery(text: string, params?: any[]): { rows: any[]; rowCount: number } {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const store = loadFallbackStore();

  // 1) SELECT FROM allowed_cedulas WHERE cedula = ...
  if (/SELECT \* FROM allowed_cedulas WHERE cedula =/i.test(normalized)) {
    const cedulaParam = params ? params[0] : '';
    const found = store.allowed_cedulas.find(c => c.cedula === cedulaParam);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  // 2) SELECT FROM users WHERE id = ...
  if (/SELECT \* FROM users WHERE id =/i.test(normalized)) {
    const idParam = params ? params[0] : '';
    const found = store.users.find(u => u.id === idParam);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  // 3) SELECT FROM users WHERE cedula = ...
  if (/SELECT \* FROM users WHERE cedula =/i.test(normalized)) {
    const cedulaParam = params ? params[0] : '';
    const found = store.users.find(u => u.cedula === cedulaParam);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  // 4) SELECT FROM users WHERE LOWER(correo) = ...
  if (/SELECT \* FROM users WHERE LOWER\(correo\) =/i.test(normalized)) {
    const emailParam = params ? (params[0] || '') : '';
    const emailLower = emailParam.toLowerCase();
    const found = store.users.find(u => (u.correo || '').toLowerCase() === emailLower);
    return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
  }

  // 5) SELECT FROM users with LEFT JOIN user_rankings
  if (/LEFT JOIN user_rankings/i.test(normalized)) {
    const rows = store.users.filter(u => u.role !== 'admin').map(user => {
      const r = store.user_rankings.find(rank => rank.userId === user.id) || {};
      return {
        userId: user.id,
        nombreCompleto: user.nombreCompleto,
        empresa: user.empresa,
        localidad: user.localidad,
        cedula: user.cedula,
        correo: user.correo,
        fechaHoraRegistro: user.fechaHoraRegistro,
        role: user.role,
        blocked: !!user.blocked,
        puntos: r.puntos || 0,
        puntosFaseGrupos: r.puntosFaseGrupos || 0,
        puntosCampeon: r.puntosCampeon || 0,
        aciertosExactos: r.aciertosExactos || 0,
        aciertosGanador: r.aciertosGanador || 0,
        aciertosGolesEquipo: r.aciertosGolesEquipo || 0,
        aciertosDiferenciaGol: r.aciertosDiferenciaGol || 0,
        aciertosPrimeros: r.aciertosPrimeros || 0,
        aciertosSegundos: r.aciertosSegundos || 0,
        aciertosTerceros: r.aciertosTerceros || 0,
        puntosBalonOro: r.puntosBalonOro || 0,
        puntosGuanteOro: r.puntosGuanteOro || 0,
        puntosBotaOro: r.puntosBotaOro || 0,
        puntosJovenTorneo: r.puntosJovenTorneo || 0
      };
    });
    return { rows, rowCount: rows.length };
  }

  // 6) SELECT FROM users (Standard)
  if (/SELECT \* FROM users$/i.test(normalized)) {
    return { rows: store.users, rowCount: store.users.length };
  }

  // 7) SELECT FROM matches
  if (/SELECT \* FROM matches/i.test(normalized)) {
    return { rows: store.matches, rowCount: store.matches.length };
  }

  // 8) SELECT FROM config
  if (/SELECT \* FROM config/i.test(normalized)) {
    return { rows: store.config, rowCount: store.config.length };
  }

  // 9) SELECT FROM Predictions tables
  if (/FROM match_predictions/i.test(normalized)) {
    const val = params ? params[0] : null;
    const filterList = val ? store.match_predictions.filter(p => p.userId === val) : store.match_predictions;
    return { rows: filterList, rowCount: filterList.length };
  }
  if (/FROM knockout_predictions/i.test(normalized)) {
    const val = params ? params[0] : null;
    const filterList = val ? store.knockout_predictions.filter(p => p.userId === val) : store.knockout_predictions;
    return { rows: filterList, rowCount: filterList.length };
  }
  if (/FROM group_standings_predictions/i.test(normalized)) {
    const val = params ? params[0] : null;
    const filterList = val ? store.group_standings_predictions.filter(p => p.userId === val) : store.group_standings_predictions;
    return { rows: filterList, rowCount: filterList.length };
  }
  if (/FROM fifa_awards_predictions/i.test(normalized)) {
    const val = params ? params[0] : null;
    const filterList = val ? store.fifa_awards_predictions.filter(p => p.userId === val) : store.fifa_awards_predictions;
    return { rows: filterList, rowCount: filterList.length };
  }

  // 10) Schema or metadata checks (ignore and bypass)
  if (/COL_LENGTH|ALTER TABLE|CREATE TABLE/i.test(normalized)) {
    return { rows: [], rowCount: 0 };
  }

  // 11) INSERT INTO users
  if (/INSERT INTO users/i.test(normalized)) {
    if (params) {
      const [id, nombreCompleto, cedula, correo, empresa, localidad, fechaHoraRegistro, role, blocked] = params;
      const existingIdx = store.users.findIndex(u => u.cedula === cedula);
      const newUser = {
        id,
        nombreCompleto,
        cedula,
        correo,
        empresa,
        localidad,
        fechaHoraRegistro: fechaHoraRegistro instanceof Date ? fechaHoraRegistro.toISOString() : (fechaHoraRegistro || ''),
        role: role || 'user',
        blocked: !!blocked
      };
      if (existingIdx !== -1) {
        store.users[existingIdx] = newUser;
      } else {
        store.users.push(newUser);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 12) DELETE FROM users
  if (/DELETE FROM users WHERE id =/i.test(normalized)) {
    if (params) {
      const id = params[0];
      store.users = store.users.filter(u => u.id !== id);
      store.match_predictions = store.match_predictions.filter(p => p.userId !== id);
      store.knockout_predictions = store.knockout_predictions.filter(p => p.userId !== id);
      store.fifa_awards_predictions = store.fifa_awards_predictions.filter(p => p.userId !== id);
      store.group_standings_predictions = store.group_standings_predictions.filter(p => p.userId !== id);
      store.user_rankings = store.user_rankings.filter(r => r.userId !== id);
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 13) MERGE INTO users
  if (/MERGE INTO users/i.test(normalized)) {
    if (params) {
      const [id, nombreCompleto, cedula, correo, empresa, localidad, fechaHoraRegistro, role, blocked] = params;
      const existingIdx = store.users.findIndex(u => u.cedula === cedula);
      const userObj = {
        id,
        nombreCompleto,
        cedula,
        correo,
        empresa,
        localidad,
        fechaHoraRegistro: fechaHoraRegistro instanceof Date ? fechaHoraRegistro.toISOString() : (fechaHoraRegistro || ''),
        role: role || 'user',
        blocked: !!blocked
      };
      if (existingIdx !== -1) {
        store.users[existingIdx] = { ...store.users[existingIdx], ...userObj };
      } else {
        store.users.push(userObj);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 14) MERGE INTO config
  if (/MERGE INTO config/i.test(normalized)) {
    if (params) {
      const [unlockedWeek, official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo, official_campeon, official_firsts, official_seconds, official_thirds, match_overrides, deadline, maintenance_mode] = params;
      store.config = [{
        id: 'system_config',
        unlockedWeek,
        official_balon_oro,
        official_guante_oro,
        official_bota_oro,
        official_joven_torneo,
        official_campeon,
        official_firsts,
        official_seconds,
        official_thirds,
        match_overrides,
        deadline,
        maintenance_mode: !!maintenance_mode
      }];
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 15) MERGE INTO matches
  if (/MERGE INTO matches/i.test(normalized)) {
    if (params) {
      const [matchId, homeScore, awayScore, winnerId] = params;
      const existingIdx = store.matches.findIndex(m => m.matchId === matchId);
      const matchObj = {
        matchId,
        homeScore: homeScore !== null && homeScore !== undefined ? Number(homeScore) : undefined,
        awayScore: awayScore !== null && awayScore !== undefined ? Number(awayScore) : undefined,
        winnerId: winnerId || undefined
      };
      if (existingIdx !== -1) {
        store.matches[existingIdx] = matchObj;
      } else {
        store.matches.push(matchObj);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 16) MERGE INTO fifa_awards_predictions
  if (/MERGE INTO fifa_awards_predictions/i.test(normalized)) {
    if (params) {
      const [id, userId, awardId, predictedWinnerId] = params;
      const existingIdx = store.fifa_awards_predictions.findIndex(p => p.userId === userId && p.awardId === awardId);
      const predObj = { id, userId, awardId, predictedWinnerId };
      if (existingIdx !== -1) {
        store.fifa_awards_predictions[existingIdx] = predObj;
      } else {
        store.fifa_awards_predictions.push(predObj);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 17) MERGE INTO knockout_predictions
  if (/MERGE INTO knockout_predictions/i.test(normalized)) {
    if (params) {
      const [id, userId, matchId, predictedHome, predictedAway, predictedWinnerId, completed] = params;
      const existingIdx = store.knockout_predictions.findIndex(p => p.userId === userId && p.matchId === matchId);
      const predObj = { id, userId, matchId, predictedHome, predictedAway, predictedWinnerId, completed: !!completed };
      if (existingIdx !== -1) {
        store.knockout_predictions[existingIdx] = predObj;
      } else {
        store.knockout_predictions.push(predObj);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 18) MERGE INTO match_predictions
  if (/MERGE INTO match_predictions/i.test(normalized)) {
    if (params) {
      const [id, userId, matchId, predictedHome, predictedAway, completed] = params;
      const existingIdx = store.match_predictions.findIndex(p => p.userId === userId && p.matchId === matchId);
      const predObj = { id, userId, matchId, predictedHome, predictedAway, completed: !!completed };
      if (existingIdx !== -1) {
        store.match_predictions[existingIdx] = predObj;
      } else {
        store.match_predictions.push(predObj);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 19) MERGE INTO group_standings_predictions
  if (/MERGE INTO group_standings_predictions/i.test(normalized)) {
    if (params) {
      const [id, userId, groupId, firstPlaceId, secondPlaceId, thirdPlaceId] = params;
      const existingIdx = store.group_standings_predictions.findIndex(p => p.userId === userId && p.groupId === groupId);
      const predObj = { id, userId, groupId, firstPlaceId, secondPlaceId, thirdPlaceId };
      if (existingIdx !== -1) {
        store.group_standings_predictions[existingIdx] = predObj;
      } else {
        store.group_standings_predictions.push(predObj);
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // 20) MERGE INTO user_rankings
  if (/MERGE INTO user_rankings/i.test(normalized)) {
    if (params) {
      const userId = params[0];
      const existingIdx = store.user_rankings.findIndex(r => r.userId === userId);
      
      if (params.length > 2) {
        const [_, puntos, puntosFaseGrupos, puntosCampeon, aciertosExactos, aciertosGanador, aciertosGolesEquipo, aciertosDiferenciaGol, aciertosPrimeros, aciertosSegundos, aciertosTerceros, puntosBalonOro, puntosGuanteOro, puntosBotaOro, puntosJovenTorneo] = params;
        const rankObj = {
          userId,
          puntos: Number(puntos),
          puntosFaseGrupos: Number(puntosFaseGrupos),
          puntosCampeon: Number(puntosCampeon),
          aciertosExactos: Number(aciertosExactos),
          aciertosGanador: Number(aciertosGanador),
          aciertosGolesEquipo: Number(aciertosGolesEquipo),
          aciertosDiferenciaGol: Number(aciertosDiferenciaGol),
          aciertosPrimeros: Number(aciertosPrimeros),
          aciertosSegundos: Number(aciertosSegundos),
          aciertosTerceros: Number(aciertosTerceros),
          puntosBalonOro: Number(puntosBalonOro),
          puntosGuanteOro: Number(puntosGuanteOro),
          puntosBotaOro: Number(puntosBotaOro),
          puntosJovenTorneo: Number(puntosJovenTorneo),
          updated: new Date().toISOString()
        };
        if (existingIdx !== -1) {
          store.user_rankings[existingIdx] = rankObj;
        } else {
          store.user_rankings.push(rankObj);
        }
      } else {
        if (existingIdx === -1) {
          store.user_rankings.push({
            userId,
            puntos: 0,
            puntosFaseGrupos: 0,
            puntosCampeon: 0,
            aciertosExactos: 0,
            aciertosGanador: 0,
            aciertosGolesEquipo: 0,
            aciertosDiferenciaGol: 0,
            aciertosPrimeros: 0,
            aciertosSegundos: 0,
            aciertosTerceros: 0,
            puntosBalonOro: 0,
            puntosGuanteOro: 0,
            puntosBotaOro: 0,
            puntosJovenTorneo: 0,
            updated: new Date().toISOString()
          });
        }
      }
      saveFallbackStore();
    }
    return { rows: [], rowCount: 1 };
  }

  // Default fallback empty rows
  return { rows: [], rowCount: 0 };
}


// ============================================================================
// ORIGINAL MSSQL CONNECTION POOL SETUP
// ============================================================================
function getPool(): Promise<mssql.ConnectionPool> {
  if (!poolPromise) {
    if (baseConnectionString.startsWith('postgresql://') || baseConnectionString.startsWith('postgres://')) {
      console.warn("⚠️ Warning: DATABASE_URL appears to be a PostgreSQL connection string. Ensure you swap it with your SQL Server connection details.");
    }
    
    let config = parseConnectionString(baseConnectionString, dbPassword);
    
    // Add default security parameters to connection string if it's a string starting with mssql:// or sqlserver://
    if (typeof config === 'string' && (config.startsWith('mssql://') || config.startsWith('sqlserver://'))) {
      if (!config.includes('encrypt=')) {
        config += (config.includes('?') ? '&' : '?') + 'encrypt=true&trustServerCertificate=true';
      } else if (!config.includes('trustServerCertificate=')) {
        config += '&trustServerCertificate=true';
      }
    }

    const pool = new mssql.ConnectionPool(config);
    poolPromise = pool.connect().then(p => {
      console.log('✅ Connected to MS SQL Server successfully.');
      fallbackModeActive = false;
      lastErrorIp = null;
      lastConnectionError = null;
      return p;
    }).catch(err => {
      const errMsg = err?.message || '';
      fallbackModeActive = true;
      lastConnectionError = errMsg;

      if (errMsg.includes('is not allowed to access the server') || errMsg.includes('Client with IP address')) {
        const ipMatch = errMsg.match(/IP address '([^']+)'/);
        lastErrorIp = ipMatch ? ipMatch[1] : null;
        const ipAddress = lastErrorIp || 'the container IP';
        
        console.error('\n' + '='.repeat(80));
        console.error('⚠️  AZURE SQL FIREWALL ERROR DETECTED  ⚠️');
        console.error('='.repeat(80));
        console.error(`Your Azure SQL Database is blocking connections from the current environment.`);
        console.error(`Blocked IP Address: ${ipAddress}`);
        console.error('\nTO FIX THIS ERROR AND DISABLING THE OFFLINE FALLBACK:');
        console.error(`1. Go to the Azure Portal (portal.azure.com)`);
        console.error(`2. Find your Azure SQL Server: sql-database-dev-eastus-001`);
        console.error(`3. Under "Security", select "Networking"`);
        console.error(`4. Under "Firewall rules", add a rule allowing:`);
        console.error(`   - Name: GoogleCloudRunDev`);
        console.error(`   - Start IP: ${ipAddress}`);
        console.error(`   - End IP: ${ipAddress}`);
        console.error(`   (OR enable the checkbox "Allow Azure services and resources to access this server" or "Allow all public IPs")`);
        console.error(`5. Save the changes (it takes about 1-5 minutes to apply).`);
        console.error('='.repeat(80) + '\n');
      } else {
        console.error('❌ Failed to connect to MS SQL Server:', err);
      }
      
      // Return a dummy pool structure that will reject so queries route to fallback
      throw err;
    });
  }
  return poolPromise;
}

export async function testConnectionAndReset(): Promise<{ success: boolean; error?: string; ipAddress?: string }> {
  poolPromise = null;
  fallbackModeActive = false;

  try {
    const p = await getPool();
    // Test connection with lightweight query
    const res = await p.request().query('SELECT 1 as test');
    console.log('✅ Connection test succeeded! Disabling fallbackModeActive.');
    fallbackModeActive = false;
    lastErrorIp = null;
    lastConnectionError = null;
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || '';
    fallbackModeActive = true;
    poolPromise = null;
    lastConnectionError = errMsg;
    
    let ipAddress: string | undefined = undefined;
    if (errMsg.includes('is not allowed to access the server') || errMsg.includes('Client with IP address')) {
      const ipMatch = errMsg.match(/IP address '([^']+)'/);
      if (ipMatch) {
         ipAddress = ipMatch[1];
      }
    }
    lastErrorIp = ipAddress || null;
    return {
      success: false,
      error: errMsg,
      ipAddress: ipAddress
    };
  }
}

// Helper to translate pg queries to MS SQL queries
function translateQuery(text: string, params?: any[]): { sqlText: string; inputs: { name: string; value: any }[] } {
  let sqlText = text;
  
  // Translate core transaction commands
  const trimmed = sqlText.trim().toUpperCase();
  if (trimmed === 'BEGIN') {
    sqlText = 'BEGIN TRANSACTION;';
  } else if (trimmed === 'COMMIT') {
    sqlText = 'COMMIT TRANSACTION;';
  } else if (trimmed === 'ROLLBACK') {
    sqlText = 'ROLLBACK TRANSACTION;';
  }

  // Replace case-sensitive double quotes e.g. "userId" with [userId] for SQL Server
  sqlText = sqlText.replace(/"([^"]+)"/g, '[$1]');

  // Replace Postgres-specific $1, $2 with SQL Server @p1, @p2
  sqlText = sqlText.replace(/\$(\d+)/g, '@p$1');

  const inputs: { name: string; value: any }[] = [];
  if (params) {
    params.forEach((val, index) => {
      inputs.push({ name: `p${index + 1}`, value: val });
    });
  }

  return { sqlText, inputs };
}

export const dbQuery = async (text: string, params?: any[]) => {
  if (fallbackModeActive) {
    return processEmulatedQuery(text, params);
  }

  try {
    const pool = await getPool();
    const { sqlText, inputs } = translateQuery(text, params);
    
    const req = pool.request();
    inputs.forEach(input => {
      req.input(input.name, input.value);
    });

    const result = await req.query(sqlText);
    return {
      rows: result.recordset || [],
      rowCount: result.rowsAffected ? result.rowsAffected[0] : 0
    };
  } catch (err) {
    // If the pool fails to connect or query fails due to login/connection error
    fallbackModeActive = true;
    console.log('⚠️ dbQuery error. Dynamically falling back to Local SQL Emulator...');
    return processEmulatedQuery(text, params);
  }
};

export const pool = {
  query: dbQuery,
  
  connect: async () => {
    if (fallbackModeActive) {
      return {
        query: async (text: string, params?: any[]) => {
          return processEmulatedQuery(text, params);
        },
        release: () => {}
      };
    }

    try {
      const mssqlPool = await getPool();
      return {
        query: async (text: string, params?: any[]) => {
          try {
            const { sqlText, inputs } = translateQuery(text, params);
            const req = mssqlPool.request();
            inputs.forEach(input => {
              req.input(input.name, input.value);
            });
            const result = await req.query(sqlText);
            return {
              rows: result.recordset || [],
              rowCount: result.rowsAffected ? result.rowsAffected[0] : 0
            };
          } catch (err) {
            fallbackModeActive = true;
            console.log('⚠️ query client error. Dynamically falling back to Local SQL Emulator...');
            return processEmulatedQuery(text, params);
          }
        },
        release: () => {
          // Emulated client release
        }
      };
    } catch (err) {
      fallbackModeActive = true;
      console.log('⚠️ connect client error. Dynamically falling back to Local SQL Emulator...');
      return {
        query: async (text: string, params?: any[]) => {
          return processEmulatedQuery(text, params);
        },
        release: () => {}
      };
    }
  },

  end: async () => {
    if (poolPromise) {
      try {
        const p = await poolPromise;
        await p.close();
      } catch (e) {}
      poolPromise = null;
    }
  }
};

export default pool;
