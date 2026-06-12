const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_d4oRtylu6FEU@ep-flat-cherry-aqt2lqfh-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
if (connectionString.includes('npg_x4kmFtLcYf2H')) {
  connectionString = connectionString.replace('npg_x4kmFtLcYf2H', 'npg_d4oRtylu6FEU');
}

const pool = new Pool({
  connectionString,
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
