import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  ALTER TABLE config 
  ADD COLUMN IF NOT EXISTS official_firsts JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS official_seconds JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS official_thirds JSONB DEFAULT '[]'::jsonb;
`).then(() => {
  console.log("DB updated");
  pool.end();
}).catch(console.error);
