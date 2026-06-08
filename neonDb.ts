import { Pool } from 'pg';

// Create a new pool using the connection string format
// Para usar este pool en el servidor, reemplaza el manejo local por consultas
// Ejemplo: const { rows } = await pool.query('SELECT * FROM users');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_x4kmFtLcYf2H@ep-flat-cherry-aqt2lqfh.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const dbQuery = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

export default pool;
