import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

let connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_d4oRtylu6FEU@ep-flat-cherry-aqt2lqfh-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
if (connectionString && connectionString.includes('npg_x4kmFtLcYf2H')) {
  connectionString = connectionString.replace('npg_x4kmFtLcYf2H', 'npg_d4oRtylu6FEU');
}

const pool = new Pool({
  connectionString,
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
