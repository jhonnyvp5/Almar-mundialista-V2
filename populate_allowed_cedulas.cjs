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

const populate = async () => {
  try {
    const csvPath = path.join(__dirname, 'allowed_users.csv');
    if (!fs.existsSync(csvPath)) {
      console.error('CSV file not found at:', csvPath);
      return;
    }

    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split(/\r?\n/);
    console.log(`Successfully read CSV file. Total lines read: ${lines.length}`);

    // Parse the lines
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = line.split(';');
      if (columns.length < 2) continue; // At least cedula and nombre

      const cedula = columns[0].trim();
      const nombre = columns[1].trim();
      const empresa = columns[2] ? columns[2].trim() : null;
      const localidad = columns[3] ? columns[3].trim() : null;

      if (!cedula || !nombre) {
        continue;
      }

      rows.push({ cedula, nombre, empresa, localidad });
    }

    console.log(`Parsed ${rows.length} valid rows from CSV to insert/upsert.`);

    // Batch insert using a transaction or insert consecutively
    console.log('Inserting into allowed_cedulas...');
    let successCount = 0;
    
    // Using single query with prepared arrays or transaction for speed
    await pool.query('BEGIN');
    for (const row of rows) {
      await pool.query(
        `INSERT INTO allowed_cedulas (cedula, nombre, empresa, localidad)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (cedula) 
         DO UPDATE SET nombre = EXCLUDED.nombre, empresa = EXCLUDED.empresa, localidad = EXCLUDED.localidad`,
        [row.cedula, row.nombre, row.empresa, row.localidad]
      );
      successCount++;
    }
    await pool.query('COMMIT');

    console.log(`Finished populating allowed_cedulas successfully! Inserted/updated ${successCount} records.`);

  } catch (error) {
    console.error('Error populating allowed_cedulas:', error);
    try {
      await pool.query('ROLLBACK');
    } catch (e) {}
  } finally {
    await pool.end();
  }
};

populate();
