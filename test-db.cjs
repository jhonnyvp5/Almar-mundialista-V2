const sql = require('mssql');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || "sqlserver://localhost:1433;database=neondb;user=sa;password=Password123;encrypt=true;trustServerCertificate=true;";

const main = async () => {
  try {
    const pool = await sql.connect(connectionString);
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✅ Connected successfully to SQL Server. Test result:', result.recordset);
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to connect to SQL Server:', err);
    process.exit(1);
  }
};

main();
