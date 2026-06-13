import mssql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const AzureSQLServerConnStr = "Data Source=tcp:sql-database-dev-eastus-001.database.windows.net,1433;Initial Catalog=sqldb-mundial2026-dev-eastus-001;Persist Security Info=False;User ID=mundial2026_dev_sql_user;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=30;Encrypt=True;TrustServerCertificate=False;Command Timeout=0";
const AzureSQLServerPassword = "ed8KWHm8rShgADRTYU";

let baseConnectionString = process.env.DATABASE_URL;
let dbPassword = process.env.DATABASE_PASSWORD || AzureSQLServerPassword;

if (!baseConnectionString || baseConnectionString.startsWith('postgresql://') || baseConnectionString.startsWith('postgres://') || (!baseConnectionString.includes('Data Source=') && !baseConnectionString.includes('Initial Catalog=') && !baseConnectionString.includes('Server=') && !baseConnectionString.startsWith('mssql://') && !baseConnectionString.startsWith('sqlserver://'))) {
  console.log("ℹ️ Info: DATABASE_URL is not configured or is a PostgreSQL string. Using default Azure SQL Server connection string.");
  baseConnectionString = AzureSQLServerConnStr;
  dbPassword = AzureSQLServerPassword;
}

// Create a connection pool manager
let poolPromise: Promise<mssql.ConnectionPool> | null = null;

function parseConnectionString(connStr: string, pwd?: string): mssql.config | string {
  // Check if it's an ADO.NET style/classic SQL Server connection string
  if (connStr.includes('Data Source=') || connStr.includes('Initial Catalog=') || connStr.includes('Server=')) {
    const config: mssql.config = {
      server: '',
      database: '',
      user: '',
      password: pwd || '',
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    };

    // Split by semicolon and parse parts
    const parts = connStr.split(';');
    parts.forEach(part => {
      const eqIdx = part.indexOf('=');
      if (eqIdx !== -1) {
        const key = part.substring(0, eqIdx).trim().toLowerCase();
        let value = part.substring(eqIdx + 1).trim();

        if (key === 'data source' || key === 'server') {
          if (value.startsWith('tcp:')) {
            value = value.substring(4);
          }
          const portParts = value.split(',');
          config.server = portParts[0];
          if (portParts[1]) {
            config.port = parseInt(portParts[1], 10);
          }
        } else if (key === 'initial catalog' || key === 'database') {
          config.database = value;
        } else if (key === 'user id' || key === 'user') {
          config.user = value;
        } else if (key === 'password' || key === 'pwd') {
          config.password = value;
        } else if (key === 'encrypt') {
          config.options = config.options || {};
          config.options.encrypt = value.toLowerCase() === 'true';
        } else if (key === 'trustservercertificate') {
          config.options = config.options || {};
          config.options.trustServerCertificate = value.toLowerCase() === 'true';
        } else if (key === 'connect timeout' || key === 'connection timeout') {
          config.connectionTimeout = parseInt(value, 10) * 1000;
        }
      }
    });

    if (pwd && !config.password) {
      config.password = pwd;
    }

    return config;
  }

  // If it's a mssql URI, we can convert it or return it directly
  return connStr;
}

function getPool(): Promise<mssql.ConnectionPool> {
  if (!poolPromise) {
    if (baseConnectionString.startsWith('postgresql://') || baseConnectionString.startsWith('postgres://')) {
      console.warn("⚠️ Warning: DATABASE_URL appears to be a PostgreSQL connection string. Ensure you swap it with your SQL Server connection details.");
    }
    
    let config = parseConnectionString(baseConnectionString, dbPassword);
    
    // Add default security parameters to connection string if it's a string starting with mssql:// or sqlserver://
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
