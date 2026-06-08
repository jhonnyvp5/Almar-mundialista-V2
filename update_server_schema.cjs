const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf-8');

const newLoadDatabase = `
async function loadDatabase(): Promise<DatabaseSchema> {
  try {
    const { rows: users } = await pool.query('SELECT * FROM users');
    const { rows: matches } = await pool.query('SELECT * FROM matches');
    
    // Read from the 4 new prediction tables
    const { rows: pMatches } = await pool.query('SELECT * FROM match_predictions');
    const { rows: pKnockouts } = await pool.query('SELECT * FROM knockout_predictions');
    const { rows: pGroups } = await pool.query('SELECT * FROM group_standings_predictions');
    const { rows: pAwards } = await pool.query('SELECT * FROM fifa_awards_predictions');

    const { rows: conf } = await pool.query("SELECT * FROM config WHERE id = 'system_config'");

    const db: DatabaseSchema = {
      users: users.map(u => ({
        ...u,
        blocked: !!u.blocked,
        fechaHoraRegistro: u.fechaHoraRegistro ? new Date(u.fechaHoraRegistro).toISOString() : ''
      })),
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
      } : {
        unlockedWeek: 1,
        official_balon_oro: '',
        official_guante_oro: '',
        official_bota_oro: '',
        official_joven_torneo: ''
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
        db.predictions[p.userId][\`group_override_first_\${grp}\`] = { matchId: \`group_override_first_\${grp}\`, predictedHome: '0', predictedAway: '0', predictedWinnerId: p.firstPlaceId, completed: true };
      }
      if (p.secondPlaceId) {
        db.predictions[p.userId][\`group_override_second_\${grp}\`] = { matchId: \`group_override_second_\${grp}\`, predictedHome: '0', predictedAway: '0', predictedWinnerId: p.secondPlaceId, completed: true };
      }
      if (p.thirdPlaceId) {
         db.predictions[p.userId][\`group_override_third_\${grp}\`] = { matchId: \`group_override_third_\${grp}\`, predictedHome: '0', predictedAway: '0', predictedWinnerId: p.thirdPlaceId, completed: true };
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
`;

const newSaveDatabase = `
async function saveDatabase(db: DatabaseSchema) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Save users
    for (const u of db.users) {
      await client.query(\`
        INSERT INTO users (id, "nombreCompleto", cedula, correo, empresa, localidad, "fechaHoraRegistro", role, blocked)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (cedula) DO UPDATE SET
          "nombreCompleto" = EXCLUDED."nombreCompleto",
          correo = EXCLUDED.correo,
          empresa = EXCLUDED.empresa,
          localidad = EXCLUDED.localidad,
          role = EXCLUDED.role,
          blocked = EXCLUDED.blocked
      \`, [u.id, u.nombreCompleto, u.cedula, u.correo || null, u.empresa, u.localidad, u.fechaHoraRegistro ? new Date(u.fechaHoraRegistro) : null, u.role, u.blocked ? true : false]);
    }

    if (db.config) {
      await client.query(\`
        INSERT INTO config (id, "unlockedWeek", official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo)
        VALUES ('system_config', $1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          "unlockedWeek" = EXCLUDED."unlockedWeek",
          official_balon_oro = EXCLUDED.official_balon_oro,
          official_guante_oro = EXCLUDED.official_guante_oro,
          official_bota_oro = EXCLUDED.official_bota_oro,
          official_joven_torneo = EXCLUDED.official_joven_torneo
      \`, [db.config.unlockedWeek, db.config.official_balon_oro, db.config.official_guante_oro, db.config.official_bota_oro, db.config.official_joven_torneo]);
    }

    for (const m of db.matches) {
       await client.query(\`
         INSERT INTO matches (id, "matchId", "homeScore", "awayScore", "winnerId")
         VALUES ($1, $1, $2, $3, $4)
         ON CONFLICT ("matchId") DO UPDATE SET
           "homeScore" = EXCLUDED."homeScore",
           "awayScore" = EXCLUDED."awayScore",
           "winnerId" = EXCLUDED."winnerId"
       \`, [m.matchId, m.homeScore, m.awayScore, m.winnerId]);
    }

    // Split predictions into 4 tables
    for (const userId of Object.keys(db.predictions)) {
      const preds = db.predictions[userId];
      
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
           await client.query(\`
             INSERT INTO fifa_awards_predictions (id, "userId", "awardId", "predictedWinnerId")
             VALUES ($1, $2, $3, $4)
             ON CONFLICT ("userId", "awardId") DO UPDATE SET
               "predictedWinnerId" = EXCLUDED."predictedWinnerId"
           \`, [\`\${userId}_\${matchId}\`, userId, matchId, p.predictedWinnerId]);
        } else if (matchId.startsWith('K') || matchId.startsWith('O')) { // Knockouts
           await client.query(\`
             INSERT INTO knockout_predictions (id, "userId", "matchId", "predictedHome", "predictedAway", "predictedWinnerId", completed)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT ("userId", "matchId") DO UPDATE SET
               "predictedHome" = EXCLUDED."predictedHome",
               "predictedAway" = EXCLUDED."predictedAway",
               "predictedWinnerId" = EXCLUDED."predictedWinnerId",
               completed = EXCLUDED.completed
           \`, [\`\${userId}_\${matchId}\`, userId, matchId, p.predictedHome, p.predictedAway, p.predictedWinnerId, p.completed ? true : false]);
        } else { // Standard matches
           await client.query(\`
             INSERT INTO match_predictions (id, "userId", "matchId", "predictedHome", "predictedAway", completed)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT ("userId", "matchId") DO UPDATE SET
               "predictedHome" = EXCLUDED."predictedHome",
               "predictedAway" = EXCLUDED."predictedAway",
               completed = EXCLUDED.completed
           \`, [\`\${userId}_\${matchId}\`, userId, matchId, p.predictedHome, p.predictedAway, p.completed ? true : false]);
        }
      }

      // Persist gathered group standings
      for (const grp of Object.keys(groupStandings)) {
         await client.query(\`
           INSERT INTO group_standings_predictions (id, "userId", "groupId", "firstPlaceId", "secondPlaceId", "thirdPlaceId")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT ("userId", "groupId") DO UPDATE SET
             "firstPlaceId" = EXCLUDED."firstPlaceId",
             "secondPlaceId" = EXCLUDED."secondPlaceId",
             "thirdPlaceId" = EXCLUDED."thirdPlaceId"
         \`, [\`\${userId}_\${grp}\`, userId, grp, groupStandings[grp].first, groupStandings[grp].second, groupStandings[grp].third]);
      }
    }

    // Now recalculate and save User Rankings explicitly to user_rankings table
    const rankings = calculateRankingStats(db);
    for (const r of rankings) {
       await client.query(\`
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
       \`, [r.id, r.puntos, r.puntosFaseGrupos, r.puntosCampeon, r.aciertosExactos, r.aciertosGanador, r.aciertosGolesEquipo, r.aciertosDiferenciaGol, r.aciertosPrimeros, r.aciertosSegundos, r.aciertosTerceros, r.puntosBalonOro, r.puntosGuanteOro, r.puntosBotaOro, r.puntosJovenTorneo]);
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
`;

// Replace loadDatabase and saveDatabase blocks
code = code.replace(/async function loadDatabase\(\): Promise<DatabaseSchema> \{[\s\S]*?\n\}\n\nasync function saveDatabase[\s\S]*?\n\}\n/, newLoadDatabase + "\n" + newSaveDatabase + "\n");

fs.writeFileSync('server.ts', code, 'utf-8');
