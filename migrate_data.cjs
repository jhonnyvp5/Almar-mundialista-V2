const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_x4kmFtLcYf2H@ep-flat-cherry-aqt2lqfh.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

async function migrateData() {
  const client = await pool.connect();
  try {
    const { rows: preds } = await client.query('SELECT * FROM predictions');
    
    // Group standings
    const groupStandings = {};
    
    for (const p of preds) {
      const matchId = p.matchId;
      const userId = p.userId;
      
      if (matchId.startsWith('group_override_')) {
        const parts = matchId.split('_');
        const grp = parts[parts.length - 1]; // e.g. 'A'
        if (!groupStandings[userId]) groupStandings[userId] = {};
        if (!groupStandings[userId][grp]) groupStandings[userId][grp] = { first: null, second: null, third: null };
        if (matchId.includes('_first_')) groupStandings[userId][grp].first = p.predictedWinnerId;
        if (matchId.includes('_second_')) groupStandings[userId][grp].second = p.predictedWinnerId;
        if (matchId.includes('_third_')) groupStandings[userId][grp].third = p.predictedWinnerId;
      } else if (matchId.startsWith('award_')) {
        await client.query(`
          INSERT INTO fifa_awards_predictions (id, "userId", "awardId", "predictedWinnerId")
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [`${userId}_${matchId}`, userId, matchId, p.predictedWinnerId]);
      } else if (matchId.startsWith('K') || matchId.startsWith('O')) {
        await client.query(`
          INSERT INTO knockout_predictions (id, "userId", "matchId", "predictedHome", "predictedAway", "predictedWinnerId", completed)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [`${userId}_${matchId}`, userId, matchId, p.predictedHome, p.predictedAway, p.predictedWinnerId, p.completed]);
      } else {
        await client.query(`
          INSERT INTO match_predictions (id, "userId", "matchId", "predictedHome", "predictedAway", completed)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT DO NOTHING
        `, [`${userId}_${matchId}`, userId, matchId, p.predictedHome, p.predictedAway, p.completed]);
      }
    }
    
    for (const userId of Object.keys(groupStandings)) {
      for (const grp of Object.keys(groupStandings[userId])) {
         await client.query(`
           INSERT INTO group_standings_predictions (id, "userId", "groupId", "firstPlaceId", "secondPlaceId", "thirdPlaceId")
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING
         `, [`${userId}_${grp}`, userId, grp, groupStandings[userId][grp].first, groupStandings[userId][grp].second, groupStandings[userId][grp].third]);
      }
    }
    
    console.log("Data migration to new prediction tables complete.");
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}

migrateData();
