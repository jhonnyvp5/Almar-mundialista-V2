-- Script SQL para las tablas correspondientes a la estructura de la quiniela en PostgreSQL (Neon)

-- =========================================================
-- TABLA: users (Usuarios)
-- =========================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    "nombreCompleto" TEXT NOT NULL,
    cedula TEXT NOT NULL UNIQUE,
    correo TEXT,
    empresa TEXT,
    localidad TEXT,
    "fechaHoraRegistro" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role TEXT DEFAULT 'user',
    blocked BOOLEAN DEFAULT false,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLA: matches (Resultados Oficiales de Partidos)
-- =========================================================
CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    "matchId" TEXT NOT NULL UNIQUE,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerId" TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLA: match_predictions (Pronósticos de Partidos - Fase de Grupos)
-- =========================================================
CREATE TABLE IF NOT EXISTS match_predictions (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "matchId" TEXT NOT NULL,
    "predictedHome" TEXT,
    "predictedAway" TEXT,
    completed BOOLEAN DEFAULT false,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId", "matchId")
);

-- =========================================================
-- TABLA: knockout_predictions (Pronósticos Llaves Eliminatorias)
-- =========================================================
CREATE TABLE IF NOT EXISTS knockout_predictions (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "matchId" TEXT NOT NULL,
    "predictedHome" TEXT,
    "predictedAway" TEXT,
    "predictedWinnerId" TEXT,
    completed BOOLEAN DEFAULT false,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId", "matchId")
);

-- =========================================================
-- TABLA: group_standings_predictions (Pronósticos de 1er, 2do y 3er Lugar)
-- =========================================================
CREATE TABLE IF NOT EXISTS group_standings_predictions (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "groupId" TEXT NOT NULL,
    "firstPlaceId" TEXT,
    "secondPlaceId" TEXT,
    "thirdPlaceId" TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId", "groupId")
);

-- =========================================================
-- TABLA: fifa_awards_predictions (Pronósticos Premios FIFA)
-- =========================================================
CREATE TABLE IF NOT EXISTS fifa_awards_predictions (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "awardId" TEXT NOT NULL,
    "predictedWinnerId" TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("userId", "awardId")
);

-- =========================================================
-- TABLA: user_rankings (Ranking de Usuarios)
-- =========================================================
CREATE TABLE IF NOT EXISTS user_rankings (
    "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    "puntos" INTEGER DEFAULT 0,
    "puntosFaseGrupos" INTEGER DEFAULT 0,
    "puntosCampeon" INTEGER DEFAULT 0,
    "aciertosExactos" INTEGER DEFAULT 0,
    "aciertosGanador" INTEGER DEFAULT 0,
    "aciertosGolesEquipo" INTEGER DEFAULT 0,
    "aciertosDiferenciaGol" INTEGER DEFAULT 0,
    "aciertosPrimeros" INTEGER DEFAULT 0,
    "aciertosSegundos" INTEGER DEFAULT 0,
    "aciertosTerceros" INTEGER DEFAULT 0,
    "puntosBalonOro" INTEGER DEFAULT 0,
    "puntosGuanteOro" INTEGER DEFAULT 0,
    "puntosBotaOro" INTEGER DEFAULT 0,
    "puntosJovenTorneo" INTEGER DEFAULT 0,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- TABLA: config (Configuración del Sistema)
-- =========================================================
CREATE TABLE IF NOT EXISTS config (
    id TEXT PRIMARY KEY,
    "unlockedWeek" INTEGER DEFAULT 1,
    official_balon_oro TEXT DEFAULT '',
    official_guante_oro TEXT DEFAULT '',
    official_bota_oro TEXT DEFAULT '',
    official_joven_torneo TEXT DEFAULT '',
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración inicial
INSERT INTO config (id, "unlockedWeek", official_balon_oro, official_guante_oro, official_bota_oro, official_joven_torneo)
VALUES ('system_config', 1, '', '', '', '')
ON CONFLICT (id) DO NOTHING;


-- =========================================================
-- TABLA: allowed_cedulas (Cédulas Permitidas)
-- =========================================================
CREATE TABLE IF NOT EXISTS allowed_cedulas (
    cedula TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    empresa TEXT,
    localidad TEXT,
    created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


