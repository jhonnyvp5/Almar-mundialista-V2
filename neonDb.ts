import mssql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

let connectionString = process.env.DATABASE_URL || "sqlserver://localhost:1433;database=neondb;user=sa;password=Password123;encrypt=true;trustServerCertificate=true;";

// Create a connection pool manager
let poolPromise: Promise<mssql.ConnectionPool> | null = null;

function getPool(): Promise<mssql.ConnectionPool> {
  if (!poolPromise) {
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      console.warn("⚠️ Warning: DATABASE_URL appears to be a PostgreSQL connection string. Ensure you swap it with your SQL Server connection details.");
    }
    
    let config: mssql.config | string = connectionString;
    
    // Add default security parameters to connection string if none is defined
    if (typeof config === 'string' && (config.startsWith('mssql://') || config.startsWith('sqlserver://'))) {
      if (!config.includes('encrypt=')) {
        config += (config.includes('?') ? '&' : '?') + 'encrypt=true&trustServerCertificate=true';
      } else if (!config.includes('trustServerCertificate=')) {
        config += '&trustServerCertificate=true';
      }
    }

    const pool = new mssql.ConnectionPool(config);
    poolPromise = pool.connect().then(p => {
      console.log('✅ Connected to MS SQL Server successfully.');
      return p;
    }).catch(err => {
      console.error('❌ Failed to connect to MS SQL Server:', err);
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

// Helper to translate pg queries to MS SQL queries
function translateQuery(text: string, params?: any[]): { sqlText: string; inputs: { name: string; value: any }[] } {
  let sqlText = text;
  
  // Translate core transaction commands
  const trimmed = sqlText.trim().toUpperCase();
  if (trimmed === 'BEGIN') {
    sqlText = 'BEGIN TRANSACTION;';
  } else if (trimmed === 'COMMIT') {
    sqlText = 'COMMIT TRANSACTION;';
  } else if (trimmed === 'ROLLBACK') {
    sqlText = 'ROLLBACK TRANSACTION;';
  }

  // Replace case-sensitive double quotes e.g. "userId" with [userId] for SQL Server
  sqlText = sqlText.replace(/"([^"]+)"/g, '[$1]');

  // Replace Postgres-specific $1, $2 with SQL Server @p1, @p2
  sqlText = sqlText.replace(/\$(\d+)/g, '@p$1');

  const inputs: { name: string; value: any }[] = [];
  if (params) {
    params.forEach((val, index) => {
      inputs.push({ name: `p${index + 1}`, value: val });
    });
  }

  return { sqlText, inputs };
}

export const dbQuery = async (text: string, params?: any[]) => {
  const pool = await getPool();
  const { sqlText, inputs } = translateQuery(text, params);
  
  const req = pool.request();
  inputs.forEach(input => {
    req.input(input.name, input.value);
  });

  const result = await req.query(sqlText);
  return {
    rows: result.recordset || [],
    rowCount: result.rowsAffected ? result.rowsAffected[0] : 0
  };
};

export const pool = {
  query: dbQuery,
  
  connect: async () => {
    const mssqlPool = await getPool();
    return {
      query: async (text: string, params?: any[]) => {
        const { sqlText, inputs } = translateQuery(text, params);
        const req = mssqlPool.request();
        inputs.forEach(input => {
          req.input(input.name, input.value);
        });
        const result = await req.query(sqlText);
        return {
          rows: result.recordset || [],
          rowCount: result.rowsAffected ? result.rowsAffected[0] : 0
        };
      },
      release: () => {
        // Emulated client release
      }
    };
  },

  end: async () => {
    if (poolPromise) {
      const p = await poolPromise;
      await p.close();
      poolPromise = null;
    }
  }
};

export default pool;
