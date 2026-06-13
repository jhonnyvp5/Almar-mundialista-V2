const sql = require('mssql');
require('dotenv').config();

const AzureSQLServerConnStr = "Data Source=tcp:sql-database-dev-eastus-001.database.windows.net,1433;Initial Catalog=sqldb-mundial2026-dev-eastus-001;Persist Security Info=False;User ID=mundial2026_dev_sql_user;Pooling=False;MultipleActiveResultSets=False;Connect Timeout=30;Encrypt=True;TrustServerCertificate=False;Command Timeout=0";
const AzureSQLServerPassword = "ed8KWHm8rShgADRTYU";

let baseConnectionString = process.env.DATABASE_URL;
let dbPassword = process.env.DATABASE_PASSWORD || AzureSQLServerPassword;

if (!baseConnectionString || baseConnectionString.startsWith('postgresql://') || baseConnectionString.startsWith('postgres://') || (!baseConnectionString.includes('Data Source=') && !baseConnectionString.includes('Initial Catalog=') && !baseConnectionString.includes('Server=') && !baseConnectionString.startsWith('mssql://') && !baseConnectionString.startsWith('sqlserver://'))) {
  baseConnectionString = AzureSQLServerConnStr;
  dbPassword = AzureSQLServerPassword;
}

function parseConnectionString(connStr, pwd) {
  if (connStr.includes('Data Source=') || connStr.includes('Initial Catalog=') || connStr.includes('Server=')) {
    const config = {
      server: '',
      database: '',
      user: '',
      password: pwd || '',
      options: {
        encrypt: true,
        trustServerCertificate: false
      }
    };

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
  return connStr;
}

const main = async () => {
  try {
    const config = parseConnectionString(baseConnectionString, dbPassword);
    const pool = await sql.connect(config);
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
