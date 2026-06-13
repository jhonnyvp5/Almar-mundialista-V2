import pool from './neonDb.ts';
import dotenv from 'dotenv';
dotenv.config();

const envUrl = process.env.DATABASE_URL;
let connectionString = (envUrl && (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')))
  ? envUrl
  : "postgresql://neondb_owner:npg_d4oRtylu6FEU@ep-flat-cherry-aqt2lqfh-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

if (connectionString.includes('npg_x4kmFtLcYf2H')) {
  connectionString = connectionString.replace('npg_x4kmFtLcYf2H', 'npg_d4oRtylu6FEU');
}

console.log("Using Database Connection String (obfuscated):", connectionString.replace(/:([^:@]+)@/, ':****@'));

pool.query(`
  ALTER TABLE config 
  ADD COLUMN IF NOT EXISTS official_firsts JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS official_seconds JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS official_thirds JSONB DEFAULT '[]'::jsonb;
`).then(() => {
  console.log("DB updated");
  pool.end();
}).catch((error) => {
  console.error("Query Error:", error);
  pool.end();
});
