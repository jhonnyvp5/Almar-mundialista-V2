const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_x4kmFtLcYf2H@ep-flat-cherry-aqt2lqfh.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT 1').then(() => {
  console.log('Connected');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
