import pool from './neonDb.ts';

async function updateDb() {
  try {
    await pool.query(`IF COL_LENGTH('config', 'official_firsts') IS NULL ALTER TABLE config ADD official_firsts NVARCHAR(MAX) DEFAULT '{}'`);
    await pool.query(`IF COL_LENGTH('config', 'official_seconds') IS NULL ALTER TABLE config ADD official_seconds NVARCHAR(MAX) DEFAULT '{}'`);
    await pool.query(`IF COL_LENGTH('config', 'official_thirds') IS NULL ALTER TABLE config ADD official_thirds NVARCHAR(MAX) DEFAULT '[]'`);
    console.log("DB updated successfully");
  } catch (error) {
    console.error("Error updating DB:", error);
  } finally {
    await pool.end();
  }
}

updateDb();
