-- Script SQL para las tablas correspondientes a la estructura de la quiniela en Microsoft SQL Server (SSMS)
-- Traducido y optimizado a partir de la versión original de PostgreSQL (Neon)

-- =========================================================
-- TABLA: users (Usuarios)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_users] PRIMARY KEY,
        [nombreCompleto] NVARCHAR(255) NOT NULL,
        [cedula] NVARCHAR(255) NOT NULL CONSTRAINT [UQ_users_cedula] UNIQUE,
        [correo] NVARCHAR(255) NULL,
        [empresa] NVARCHAR(255) NULL,
        [localidad] NVARCHAR(255) NULL,
        [fechaHoraRegistro] DATETIME2 CONSTRAINT [DF_users_fechaHoraRegistro] DEFAULT CURRENT_TIMESTAMP,
        [role] NVARCHAR(50) CONSTRAINT [DF_users_role] DEFAULT 'user',
        [blocked] BIT CONSTRAINT [DF_users_blocked] DEFAULT 0,
        [created] DATETIME2 CONSTRAINT [DF_users_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_users_updated] DEFAULT CURRENT_TIMESTAMP
    );
END;

-- =========================================================
-- TABLA: matches (Resultados Oficiales de Partidos)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[matches]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[matches] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_matches] PRIMARY KEY,
        [matchId] NVARCHAR(255) NOT NULL CONSTRAINT [UQ_matches_matchId] UNIQUE,
        [homeScore] INT NULL,
        [awayScore] INT NULL,
        [winnerId] NVARCHAR(255) NULL,
        [created] DATETIME2 CONSTRAINT [DF_matches_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_matches_updated] DEFAULT CURRENT_TIMESTAMP
    );
END;

-- =========================================================
-- TABLA: match_predictions (Pronósticos de Partidos - Fase de Grupos)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[match_predictions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[match_predictions] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_match_predictions] PRIMARY KEY,
        [userId] NVARCHAR(255) NOT NULL,
        [matchId] NVARCHAR(255) NOT NULL,
        [predictedHome] NVARCHAR(255) NULL,
        [predictedAway] NVARCHAR(255) NULL,
        [completed] BIT CONSTRAINT [DF_match_predictions_completed] DEFAULT 0,
        [created] DATETIME2 CONSTRAINT [DF_match_predictions_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_match_predictions_updated] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [FK_match_predictions_users] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_match_predictions_user_match] UNIQUE ([userId], [matchId])
    );
END;

-- =========================================================
-- TABLA: knockout_predictions (Pronósticos Llaves Eliminatorias)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[knockout_predictions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[knockout_predictions] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_knockout_predictions] PRIMARY KEY,
        [userId] NVARCHAR(255) NOT NULL,
        [matchId] NVARCHAR(255) NOT NULL,
        [predictedHome] NVARCHAR(255) NULL,
        [predictedAway] NVARCHAR(255) NULL,
        [predictedWinnerId] NVARCHAR(255) NULL,
        [completed] BIT CONSTRAINT [DF_knockout_predictions_completed] DEFAULT 0,
        [created] DATETIME2 CONSTRAINT [DF_knockout_predictions_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_knockout_predictions_updated] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [FK_knockout_predictions_users] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_knockout_predictions_user_match] UNIQUE ([userId], [matchId])
    );
END;

-- =========================================================
-- TABLA: group_standings_predictions (Pronósticos de 1er, 2do y 3er Lugar)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[group_standings_predictions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[group_standings_predictions] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_group_standings_predictions] PRIMARY KEY,
        [userId] NVARCHAR(255) NOT NULL,
        [groupId] NVARCHAR(255) NOT NULL,
        [firstPlaceId] NVARCHAR(255) NULL,
        [secondPlaceId] NVARCHAR(255) NULL,
        [thirdPlaceId] NVARCHAR(255) NULL,
        [created] DATETIME2 CONSTRAINT [DF_group_standings_predictions_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_group_standings_predictions_updated] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [FK_group_standings_predictions_users] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_group_standings_predictions_user_group] UNIQUE ([userId], [groupId])
    );
END;

-- =========================================================
-- TABLA: fifa_awards_predictions (Pronósticos Premios FIFA)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[fifa_awards_predictions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[fifa_awards_predictions] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_fifa_awards_predictions] PRIMARY KEY,
        [userId] NVARCHAR(255) NOT NULL,
        [awardId] NVARCHAR(255) NOT NULL,
        [predictedWinnerId] NVARCHAR(255) NULL,
        [created] DATETIME2 CONSTRAINT [DF_fifa_awards_predictions_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_fifa_awards_predictions_updated] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [FK_fifa_awards_predictions_users] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_fifa_awards_predictions_user_award] UNIQUE ([userId], [awardId])
    );
END;

-- =========================================================
-- TABLA: user_rankings (Ranking de Usuarios)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[user_rankings]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[user_rankings] (
        [userId] NVARCHAR(255) NOT NULL CONSTRAINT [PK_user_rankings] PRIMARY KEY,
        [puntos] INT CONSTRAINT [DF_user_rankings_puntos] DEFAULT 0,
        [puntosFaseGrupos] INT CONSTRAINT [DF_user_rankings_puntosFaseGrupos] DEFAULT 0,
        [puntosCampeon] INT CONSTRAINT [DF_user_rankings_puntosCampeon] DEFAULT 0,
        [aciertosExactos] INT CONSTRAINT [DF_user_rankings_aciertosExactos] DEFAULT 0,
        [aciertosGanador] INT CONSTRAINT [DF_user_rankings_aciertosGanador] DEFAULT 0,
        [aciertosGolesEquipo] INT CONSTRAINT [DF_user_rankings_aciertosGolesEquipo] DEFAULT 0,
        [aciertosDiferenciaGol] INT CONSTRAINT [DF_user_rankings_aciertosDiferenciaGol] DEFAULT 0,
        [aciertosPrimeros] INT CONSTRAINT [DF_user_rankings_aciertosPrimeros] DEFAULT 0,
        [aciertosSegundos] INT CONSTRAINT [DF_user_rankings_aciertosSegundos] DEFAULT 0,
        [aciertosTerceros] INT CONSTRAINT [DF_user_rankings_aciertosTerceros] DEFAULT 0,
        [puntosBalonOro] INT CONSTRAINT [DF_user_rankings_puntosBalonOro] DEFAULT 0,
        [puntosGuanteOro] INT CONSTRAINT [DF_user_rankings_puntosGuanteOro] DEFAULT 0,
        [puntosBotaOro] INT CONSTRAINT [DF_user_rankings_puntosBotaOro] DEFAULT 0,
        [puntosJovenTorneo] INT CONSTRAINT [DF_user_rankings_puntosJovenTorneo] DEFAULT 0,
        [updated] DATETIME2 CONSTRAINT [DF_user_rankings_updated] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [FK_user_rankings_users] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
    );
END;

-- =========================================================
-- TABLA: config (Configuración del Sistema)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[config]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[config] (
        [id] NVARCHAR(255) NOT NULL CONSTRAINT [PK_config] PRIMARY KEY,
        [unlockedWeek] INT CONSTRAINT [DF_config_unlockedWeek] DEFAULT 1,
        [official_balon_oro] NVARCHAR(255) CONSTRAINT [DF_config_official_balon_oro] DEFAULT '',
        [official_guante_oro] NVARCHAR(255) CONSTRAINT [DF_config_official_guante_oro] DEFAULT '',
        [official_bota_oro] NVARCHAR(255) CONSTRAINT [DF_config_official_bota_oro] DEFAULT '',
        [official_joven_torneo] NVARCHAR(255) CONSTRAINT [DF_config_official_joven_torneo] DEFAULT '',
        [official_firsts] NVARCHAR(MAX) CONSTRAINT [DF_config_official_official_firsts] DEFAULT '{}',
        [official_seconds] NVARCHAR(MAX) CONSTRAINT [DF_config_official_official_seconds] DEFAULT '{}',
        [official_thirds] NVARCHAR(MAX) CONSTRAINT [DF_config_official_official_thirds] DEFAULT '[]',
        [match_overrides] NVARCHAR(MAX) CONSTRAINT [DF_config_match_overrides] DEFAULT '{}',
        [deadline] NVARCHAR(255) CONSTRAINT [DF_config_deadline] DEFAULT '2026-06-14T23:59:00',
        [official_campeon] NVARCHAR(255) CONSTRAINT [DF_config_official_campeon] DEFAULT '',
        [maintenance_mode] BIT CONSTRAINT [DF_config_maintenance_mode] DEFAULT 0,
        [created] DATETIME2 CONSTRAINT [DF_config_created] DEFAULT CURRENT_TIMESTAMP,
        [updated] DATETIME2 CONSTRAINT [DF_config_updated] DEFAULT CURRENT_TIMESTAMP
    );
END;

-- Insertar configuración inicial si no existe
IF NOT EXISTS (SELECT 1 FROM [dbo].[config] WHERE [id] = 'system_config')
BEGIN
    INSERT INTO [dbo].[config] (
        [id], 
        [unlockedWeek], 
        [official_balon_oro], 
        [official_guante_oro], 
        [official_bota_oro], 
        [official_joven_torneo], 
        [official_firsts],
        [official_seconds],
        [official_thirds],
        [match_overrides], 
        [deadline], 
        [official_campeon], 
        [maintenance_mode]
    )
    VALUES (
        'system_config', 
        1, 
        '', 
        '', 
        '', 
        '', 
        '{}',
        '{}',
        '[]',
        '{}', 
        '2026-06-14T23:59:00', 
        '', 
        0
    );
END;

-- =========================================================
-- TABLA: allowed_cedulas (Cédulas Permitidas)
-- =========================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[allowed_cedulas]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[allowed_cedulas] (
        [cedula] NVARCHAR(255) NOT NULL CONSTRAINT [PK_allowed_cedulas] PRIMARY KEY,
        [nombre] NVARCHAR(255) NOT NULL,
        [empresa] NVARCHAR(255) NULL,
        [localidad] NVARCHAR(255) NULL,
        [created] DATETIME2 CONSTRAINT [DF_allowed_cedulas_created] DEFAULT CURRENT_TIMESTAMP
    );
END;
