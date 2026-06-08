-- Script SQL para las tablas correspondientes a la estructura de la quiniela en SQLite / PocketBase
-- Si ejecutas esto directamente en la base de datos de PocketBase (SQLite), asegúrate
-- de adaptar los tipos si es necesario, aunque SQLite utiliza tipado dinámico en gran medida.
-- En PocketBase normalmente es mejor crear estas colecciones (tablas) mediante su interfaz de Admin.
-- Si deseas inyectarlo a la BD (pb_data/data.db):

-- =========================================================
-- TABLA: users (Usuarios)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    nombreCompleto TEXT NOT NULL,
    cedula TEXT NOT NULL UNIQUE,
    correo TEXT,
    empresa TEXT,
    localidad TEXT,
    fechaHoraRegistro DATETIME DEFAULT CURRENT_TIMESTAMP,
    role TEXT DEFAULT 'user',
    blocked BOOLEAN DEFAULT 0,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLA: matches (Resultados Oficiales de Partidos)
-- =========================================================
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    matchId TEXT NOT NULL UNIQUE,
    homeScore INTEGER,
    awayScore INTEGER,
    winnerId TEXT,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLA: predictions (Pronósticos de Usuarios)
-- =========================================================
CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    matchId TEXT NOT NULL,
    predictedHome TEXT,
    predictedAway TEXT,
    predictedWinnerId TEXT,
    completed BOOLEAN DEFAULT 0,
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

-- Constraint para asegurar que solo haya un pronóstico por usuario y partido
CREATE UNIQUE INDEX IF NOT EXISTS idx_predictions_user_match ON predictions (userId, matchId);

-- =========================================================
-- TABLA: config (Configuración del Sistema)
-- =========================================================
CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    unlockedWeek INTEGER DEFAULT 1,
    official_balon_oro TEXT DEFAULT '',
    official_guante_oro TEXT DEFAULT '',
    official_bota_oro TEXT DEFAULT '',
    official_joven_torneo TEXT DEFAULT '',
    created DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración inicial
INSERT INTO config (id, unlockedWeek, official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo)
VALUES ('system_config', 1, '', '', '', '')
ON CONFLICT(id) DO NOTHING;
