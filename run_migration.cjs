const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_x4kmFtLcYf2H@ep-flat-cherry-aqt2lqfh.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

const initDb = async () => {
  try {
    const schemaSql = fs.readFileSync('neon_schema.sql', 'utf-8');
    await pool.query(schemaSql);
    console.log('Migrated schema successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
};
initDb();
