import { Pool } from 'pg';
import dotenv from 'dotenv';

// Configure dotenv
dotenv.config();

// Create a new pool using the connection string format
// Para usar este pool en el servidor, reemplaza el manejo local por consultas
// Ejemplo: const { rows } = await pool.query('SELECT * FROM users');
const envUrl = process.env.DATABASE_URL;
let connectionString = (envUrl && (envUrl.startsWith('postgresql://') || envUrl.startsWith('postgres://')))
  ? envUrl
  : "postgresql://neondb_owner:npg_d4oRtylu6FEU@ep-flat-cherry-aqt2lqfh-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

if (connectionString.includes('npg_x4kmFtLcYf2H')) {
  connectionString = connectionString.replace('npg_x4kmFtLcYf2H', 'npg_d4oRtylu6FEU');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  },
  max: 15, // Optimizamos para Vercel Serverless
  idleTimeoutMillis: 10000, // Cerrar conexiones ociosas rápido para evitar leaks
  connectionTimeoutMillis: 30000 // Timeout de 30 segundos para soportar cold starts de Neon de forma robusta
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const dbQuery = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
