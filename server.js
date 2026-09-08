const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

const GAME_VERSION = "17.0";

if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   STATIC FILES
========================================================= */

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================================================
   GAME CONFIG
========================================================= */

const BUILDINGS = {
  farm: {
    name: "المزرعة",
    basePower: 100
  },

  lumber_mill: {
    name: "منشرة الخشب",
    basePower: 100
  },

  iron_mine: {
    name: "منجم الحديد",
    basePower: 150
  },

  gold_mine: {
    name: "منجم الذهب",
    basePower: 200
  },

  barracks: {
    name: "الثكنة",
    basePower: 250
  },

  hospital: {
    name: "المستشفى",
    basePower: 250
  },

  research_center: {
    name: "مركز الأبحاث",
    basePower: 300
  },

  warehouse: {
    name: "المخزن",
    basePower: 200
  },

  watchtower: {
    name: "برج المراقبة",
    basePower: 300
  },

  alliance_center: {
    name: "مركز التحالف",
    basePower: 300
  },

  airfield: {
    name: "المطار",
    basePower: 500
  }
};

const RESEARCH_TYPES = [
  "economy",
  "construction",
  "military",
  "defense",
  "troops",
  "technology"
];

const TALENT_TYPES = [
  "war",
  "economy",
  "development"
];

/* =========================================================
   CASTLE SYSTEM
========================================================= */

const MAX_CASTLE_LEVEL = 30;
const MAX_CASTLE_STARS = 5;

/*
  تكلفة تطوير القلعة.
  level = المستوى الحالي.
  عند المستوى 1 يتم دفع تكلفة المستوى 1 للوصول إلى 2.
*/

function getCastleUpgradeCost(level, stars) {

  if (level < MAX_CASTLE_LEVEL) {

    return {
      type: "level",
      nextLevel: level + 1,

      food: level * 1000,
      wood: level * 1000,
      iron: level * 250,
      gold: Math.floor(level * 100),

      power: 100 + level * 25
    };
  }

  if (stars < MAX_CASTLE_STARS) {

    return {
      type: "star",
      nextStars: stars + 1,

      food: 30000 + stars * 15000,
      wood: 30000 + stars * 15000,
      iron: 10000 + stars * 7500,
      gold: 5000 + stars * 2500,

      power: 1000 + stars * 500
    };
  }

  return null;
}

/* =========================================================
   BUILDING COST
========================================================= */

function getBuildingUpgradeCost(level) {

  return {
    food: level * 1200,
    wood: level * 1200,
    iron: level * 300,
    gold: Math.floor(level * 120)
  };
}

/* =========================================================
   DATABASE HELPERS
========================================================= */

function quoteIdentifier(identifier) {
  return '"' + String(identifier).replace(/"/g, '""') + '"';
}

/*
  PostgreSQL يسمح باستخدام:
  ALTER TABLE ... ADD COLUMN IF NOT EXISTS

  لذلك لا نعتمد فقط على CREATE TABLE IF NOT EXISTS.
  هذا مهم جدًا مع قاعدة البيانات القديمة.
*/

async function addColumnIfMissing(table, column, definition) {

  const sql = `
    ALTER TABLE ${quoteIdentifier(table)}
    ADD COLUMN IF NOT EXISTS ${quoteIdentifier(column)} ${definition}
  `;

  await pool.query(sql);

  console.log(
    `Checked column: ${table}.${column}`
  );
}

/* =========================================================
   DATABASE TABLES
========================================================= */

async function createTables() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT,
      power BIGINT DEFAULT 1000,
      castle_level INTEGER DEFAULT 1,
      castle_stars INTEGER DEFAULT 0,
      food BIGINT DEFAULT 5000,
      wood BIGINT DEFAULT 5000,
      iron BIGINT DEFAULT 1000,
      gold BIGINT DEFAULT 500,
      troops INTEGER DEFAULT 0,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0,
      commander_level INTEGER DEFAULT 1,
      commander_xp BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS heroes (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      name TEXT,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      rarity TEXT DEFAULT 'عادي',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS behemoths (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      name TEXT,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 500,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliances (
      id SERIAL PRIMARY KEY,
      name TEXT,
      leader_id INTEGER,
      power BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_members (
      id SERIAL PRIMARY KEY,
      alliance_id INTEGER,
      player_id INTEGER,
      role TEXT DEFAULT 'member'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS zombies (
      id SERIAL PRIMARY KEY,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS forts (
      id SERIAL PRIMARY KEY,
      name TEXT DEFAULT 'حصن',
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 1000,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marches (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      target_type TEXT DEFAULT 'zombie',
      target_id INTEGER,
      troops INTEGER DEFAULT 0,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'marching'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS battle_reports (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      result TEXT,
      enemy_type TEXT,
      enemy_id INTEGER,
      troops_sent INTEGER DEFAULT 0,
      power_change BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS buildings (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      type TEXT,
      name TEXT,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS research (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      type TEXT,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS talents (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      type TEXT,
      level INTEGER DEFAULT 1
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aircraft (
      id SERIAL PRIMARY KEY,
      player_id INTEGER,
      name TEXT,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 500,
      fuel INTEGER DEFAULT 100
    )
  `);
}

/* =========================================================
   FULL SAFE MIGRATION
========================================================= */

async function migrateDatabase() {

  console.log("======================================");
  console.log("Starting SAFE database migration...");
  console.log("Game version:", GAME_VERSION);
  console.log("======================================");

  /* PLAYERS */

  await addColumnIfMissing(
    "players",
    "name",
    "TEXT"
  );

  await addColumnIfMissing(
    "players",
    "power",
    "BIGINT DEFAULT 1000"
  );

  await addColumnIfMissing(
    "players",
    "castle_level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "players",
    "castle_stars",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "players",
    "food",
    "BIGINT DEFAULT 5000"
  );

  await addColumnIfMissing(
    "players",
    "wood",
    "BIGINT DEFAULT 5000"
  );

  await addColumnIfMissing(
    "players",
    "iron",
    "BIGINT DEFAULT 1000"
  );

  await addColumnIfMissing(
    "players",
    "gold",
    "BIGINT DEFAULT 500"
  );

  await addColumnIfMissing(
    "players",
    "troops",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "players",
    "x",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "players",
    "y",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "players",
    "commander_level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "players",
    "commander_xp",
    "BIGINT DEFAULT 0"
  );

  await addColumnIfMissing(
    "players",
    "created_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  /* HEROES */

  await addColumnIfMissing(
    "heroes",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "heroes",
    "name",
    "TEXT"
  );

  await addColumnIfMissing(
    "heroes",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "heroes",
    "power",
    "BIGINT DEFAULT 100"
  );

  await addColumnIfMissing(
    "heroes",
    "rarity",
    "TEXT DEFAULT 'عادي'"
  );

  await addColumnIfMissing(
    "heroes",
    "created_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  /* BEHEMOTHS */

  await addColumnIfMissing(
    "behemoths",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "behemoths",
    "name",
    "TEXT"
  );

  await addColumnIfMissing(
    "behemoths",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "behemoths",
    "power",
    "BIGINT DEFAULT 500"
  );

  await addColumnIfMissing(
    "behemoths",
    "created_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  /* ALLIANCES */

  await addColumnIfMissing(
    "alliances",
    "name",
    "TEXT"
  );

  await addColumnIfMissing(
    "alliances",
    "leader_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "alliances",
    "power",
    "BIGINT DEFAULT 0"
  );

  await addColumnIfMissing(
    "alliances",
    "created_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  /* ALLIANCE MEMBERS */

  await addColumnIfMissing(
    "alliance_members",
    "alliance_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "alliance_members",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "alliance_members",
    "role",
    "TEXT DEFAULT 'member'"
  );

  /* ZOMBIES */

  await addColumnIfMissing(
    "zombies",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "zombies",
    "power",
    "BIGINT DEFAULT 100"
  );

  await addColumnIfMissing(
    "zombies",
    "x",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "zombies",
    "y",
    "INTEGER DEFAULT 0"
  );

  /* FORTS */

  await addColumnIfMissing(
    "forts",
    "name",
    "TEXT DEFAULT 'حصن'"
  );

  await addColumnIfMissing(
    "forts",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "forts",
    "power",
    "BIGINT DEFAULT 1000"
  );

  await addColumnIfMissing(
    "forts",
    "x",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "forts",
    "y",
    "INTEGER DEFAULT 0"
  );

  /* MARCHES */

  await addColumnIfMissing(
    "marches",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "marches",
    "target_type",
    "TEXT DEFAULT 'zombie'"
  );

  await addColumnIfMissing(
    "marches",
    "target_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "marches",
    "troops",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "marches",
    "started_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  await addColumnIfMissing(
    "marches",
    "status",
    "TEXT DEFAULT 'marching'"
  );

  /* BATTLE REPORTS */

  await addColumnIfMissing(
    "battle_reports",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "battle_reports",
    "result",
    "TEXT"
  );

  await addColumnIfMissing(
    "battle_reports",
    "enemy_type",
    "TEXT"
  );

  await addColumnIfMissing(
    "battle_reports",
    "enemy_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "battle_reports",
    "troops_sent",
    "INTEGER DEFAULT 0"
  );

  await addColumnIfMissing(
    "battle_reports",
    "power_change",
    "BIGINT DEFAULT 0"
  );

  await addColumnIfMissing(
    "battle_reports",
    "created_at",
    "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
  );

  /* BUILDINGS */

  await addColumnIfMissing(
    "buildings",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "buildings",
    "type",
    "TEXT"
  );

  await addColumnIfMissing(
    "buildings",
    "name",
    "TEXT"
  );

  await addColumnIfMissing(
    "buildings",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "buildings",
    "power",
    "BIGINT DEFAULT 100"
  );

  /* RESEARCH */

  await addColumnIfMissing(
    "research",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "research",
    "type",
    "TEXT"
  );

  await addColumnIfMissing(
    "research",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "research",
    "power",
    "BIGINT DEFAULT 100"
  );

  /* TALENTS */

  await addColumnIfMissing(
    "talents",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "talents",
    "type",
    "TEXT"
  );

  await addColumnIfMissing(
    "talents",
    "level",
    "INTEGER DEFAULT 1"
  );

  /* AIRCRAFT */

  await addColumnIfMissing(
    "aircraft",
    "player_id",
    "INTEGER"
  );

  await addColumnIfMissing(
    "aircraft",
    "name",
    "TEXT"
  );

  await addColumnIfMissing(
    "aircraft",
    "level",
    "INTEGER DEFAULT 1"
  );

  await addColumnIfMissing(
    "aircraft",
    "power",
    "BIGINT DEFAULT 500"
  );

  await addColumnIfMissing(
    "aircraft",
    "fuel",
    "INTEGER DEFAULT 100"
  );

  /* =====================================================
     NORMALIZE OLD DATA
  ===================================================== */

  await pool.query(`
    UPDATE players
    SET
      name = COALESCE(NULLIF(TRIM(name), ''), 'مملكة-' || id),
      power = COALESCE(power, 1000),
      castle_level = GREATEST(
        1,
        LEAST(COALESCE(castle_level, 1), 30)
      ),
      castle_stars = GREATEST(
        0,
        LEAST(COALESCE(castle_stars, 0), 5)
      ),
      food = COALESCE(food, 5000),
      wood = COALESCE(wood, 5000),
      iron = COALESCE(iron, 1000),
      gold = COALESCE(gold, 500),
      troops = COALESCE(troops, 0),
      x = COALESCE(x, 0),
      y = COALESCE(y, 0),
      commander_level = COALESCE(commander_level, 1),
      commander_xp = COALESCE(commander_xp, 0),
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    UPDATE heroes
    SET
      name = COALESCE(NULLIF(TRIM(name), ''), 'بطل-' || id),
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 100),
      rarity = COALESCE(NULLIF(TRIM(rarity), ''), 'عادي'),
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    UPDATE behemoths
    SET
      name = COALESCE(NULLIF(TRIM(name), ''), 'البيهيومي-' || id),
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 500),
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    UPDATE alliances
    SET
      name = COALESCE(NULLIF(TRIM(name), ''), 'تحالف-' || id),
      power = COALESCE(power, 0),
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
  `);

  await pool.query(`
    UPDATE alliance_members
    SET role = COALESCE(NULLIF(TRIM(role), ''), 'member')
  `);

  await pool.query(`
    UPDATE zombies
    SET
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 100),
      x = COALESCE(x, 0),
      y = COALESCE(y, 0)
  `);

  await pool.query(`
    UPDATE forts
    SET
      name = COALESCE(NULLIF(TRIM(name), ''), 'حصن-' || id),
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 1000),
      x = COALESCE(x, 0),
      y = COALESCE(y, 0)
  `);

  await pool.query(`
    UPDATE marches
    SET
      target_type = COALESCE(
        NULLIF(TRIM(target_type), ''),
        'zombie'
      ),
      troops = COALESCE(troops, 0),
      started_at = COALESCE(
        started_at,
        CURRENT_TIMESTAMP
      ),
      status = COALESCE(
        NULLIF(TRIM(status), ''),
        'marching'
      )
  `);

  await pool.query(`
    UPDATE battle_reports
    SET
      troops_sent = COALESCE(troops_sent, 0),
      power_change = COALESCE(power_change, 0),
      created_at = COALESCE(created_at, CURRENT_TIMESTAMP)
  `);

  /*
    Buildings:
    إذا كان النوع مفقودًا نعطيه اسمًا قديمًا
    بدل وضع farm للجميع.
  */

  await pool.query(`
    UPDATE buildings
    SET
      type = COALESCE(
        NULLIF(TRIM(type), ''),
        'legacy_' || id
      ),
      name = COALESCE(
        NULLIF(TRIM(name), ''),
        'مبنى-' || id
      ),
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 100)
  `);

  for (const [type, config] of Object.entries(BUILDINGS)) {

    await pool.query(
      `
      UPDATE buildings
      SET name = $1
      WHERE type = $2
      `,
      [
        config.name,
        type
      ]
    );
  }

  await pool.query(`
    UPDATE research
    SET
      type = COALESCE(
        NULLIF(TRIM(type), ''),
        'legacy_' || id
      ),
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 100)
  `);

  await pool.query(`
    UPDATE talents
    SET
      type = COALESCE(
        NULLIF(TRIM(type), ''),
        'legacy_' || id
      ),
      level = GREATEST(1, COALESCE(level, 1))
  `);

  await pool.query(`
    UPDATE aircraft
    SET
      name = COALESCE(
        NULLIF(TRIM(name), ''),
        'Kardous Airship'
      ),
      level = GREATEST(1, COALESCE(level, 1)),
      power = COALESCE(power, 500),
      fuel = GREATEST(
        0,
        LEAST(COALESCE(fuel, 100), 100)
      )
  `);

  console.log("Old database data normalized.");
}

/* =========================================================
   SAFE PLAYER DATA SEED
========================================================= */

async function seedPlayerData(playerId, db = pool) {

  /* BUILDINGS */

  for (const [type, config] of Object.entries(BUILDINGS)) {

    const existing = await db.query(
      `
      SELECT id
      FROM buildings
      WHERE player_id = $1
      AND type = $2
      LIMIT 1
      `,
      [
        playerId,
        type
      ]
    );

    if (existing.rows.length === 0) {

      await db.query(
        `
        INSERT INTO buildings
        (
          player_id,
          type,
          name,
          level,
          power
        )
        VALUES
        ($1, $2, $3, 1, $4)
        `,
        [
          playerId,
          type,
          config.name,
          config.basePower
        ]
      );
    }
  }

  /* RESEARCH */

  for (const type of RESEARCH_TYPES) {

    const existing = await db.query(
      `
      SELECT id
      FROM research
      WHERE player_id = $1
      AND type = $2
      LIMIT 1
      `,
      [
        playerId,
        type
      ]
    );

    if (existing.rows.length === 0) {

      await db.query(
        `
        INSERT INTO research
        (
          player_id,
          type,
          level,
          power
        )
        VALUES
        ($1, $2, 1, 100)
        `,
        [
          playerId,
          type
        ]
      );
    }
  }

  /* TALENTS */

  for (const type of TALENT_TYPES) {

    const existing = await db.query(
      `
      SELECT id
      FROM talents
      WHERE player_id = $1
      AND type = $2
      LIMIT 1
      `,
      [
        playerId,
        type
      ]
    );

    if (existing.rows.length === 0) {

      await db.query(
        `
        INSERT INTO talents
        (
          player_id,
          type,
          level
        )
        VALUES
        ($1, $2, 1)
        `,
        [
          playerId,
          type
        ]
      );
    }
  }

  /* AIRCRAFT */

  const aircraft = await db.query(
    `
    SELECT id
    FROM aircraft
    WHERE player_id = $1
    LIMIT 1
    `,
    [playerId]
  );

  if (aircraft.rows.length === 0) {

    await db.query(
      `
      INSERT INTO aircraft
      (
        player_id,
        name,
        level,
        power,
        fuel
      )
      VALUES
      ($1, 'Kardous Airship', 1, 500, 100)
      `,
      [playerId]
    );
  }
}

/* =========================================================
   ENSURE PLAYER DATA
========================================================= */

async function ensurePlayerData(playerId) {

  const player = await pool.query(
    `
    SELECT id
    FROM players
    WHERE id = $1
    `,
    [playerId]
  );

  if (player.rows.length === 0) {
    return false;
  }

  await seedPlayerData(playerId);

  /* HEROES */

  const heroCount = await pool.query(
    `
    SELECT COUNT(*)::INTEGER AS count
    FROM heroes
    WHERE player_id = $1
    `,
    [playerId]
  );

  if (Number(heroCount.rows[0].count) === 0) {

    for (let i = 1; i <= 20; i++) {

      await pool.query(
        `
        INSERT INTO heroes
        (
          player_id,
          name,
          level,
          power,
          rarity
        )
        VALUES
        ($1, $2, 1, 100, 'عادي')
        `,
        [
          playerId,
          `البطل ${i}`
        ]
      );
    }
  }

  /* BEHEMOTHS */

  const behemothCount = await pool.query(
    `
    SELECT COUNT(*)::INTEGER AS count
    FROM behemoths
    WHERE player_id = $1
    `,
    [playerId]
  );

  if (Number(behemothCount.rows[0].count) === 0) {

    const names = [
      "البيهيومي الأول",
      "البيهيومي الثاني",
      "البيهيومي الثالث",
      "البيهيومي الرابع"
    ];

    for (const name of names) {

      await pool.query(
        `
        INSERT INTO behemoths
        (
          player_id,
          name,
          level,
          power
        )
        VALUES
        ($1, $2, 1, 500)
        `,
        [
          playerId,
          name
        ]
      );
    }
  }

  return true;
}

/* =========================================================
   STATUS
========================================================= */

app.get("/api/status", (req, res) => {

  res.json({
    success: true,
    game: "Kardous Survival",
    version: GAME_VERSION,
    server: "online",
    database: "connected",
    castle: {
      maxLevel: MAX_CASTLE_LEVEL,
      maxStars: MAX_CASTLE_STARS
    }
  });
});

/* =========================================================
   REGISTER
========================================================= */

app.post("/api/register", async (req, res) => {

  const client = await pool.connect();

  let transactionStarted = false;

  try {

    const name = String(
      req.body.name || ""
    ).trim();

    if (!name) {

      return res.status(400).json({
        success: false,
        message: "اكتب اسم المملكة"
      });
    }

    if (name.length < 2) {

      return res.status(400).json({
        success: false,
        message: "اسم المملكة قصير جدًا"
      });
    }

    if (name.length > 30) {

      return res.status(400).json({
        success: false,
        message: "اسم المملكة طويل جدًا"
      });
    }

    await client.query("BEGIN");
    transactionStarted = true;

    const existing = await client.query(
      `
      SELECT id
      FROM players
      WHERE LOWER(name) = LOWER($1)
      LIMIT 1
      `,
      [name]
    );

    if (existing.rows.length > 0) {

      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(409).json({
        success: false,
        message: "اسم المملكة مستخدم بالفعل"
      });
    }

    const playerResult = await client.query(
      `
      INSERT INTO players
      (
        name,
        power,
        castle_level,
        castle_stars,
        food,
        wood,
        iron,
        gold,
        troops,
        x,
        y,
        commander_level,
        commander_xp
      )
      VALUES
      (
        $1,
        1000,
        1,
        0,
        5000,
        5000,
        1000,
        500,
        0,
        0,
        0,
        1,
        0
      )
      RETURNING *
      `,
      [name]
    );

    const player = playerResult.rows[0];

    /* HEROES */

    for (let i = 1; i <= 20; i++) {

      await client.query(
        `
        INSERT INTO heroes
        (
          player_id,
          name,
          level,
          power,
          rarity
        )
        VALUES
        ($1, $2, 1, 100, 'عادي')
        `,
        [
          player.id,
          `البطل ${i}`
        ]
      );
    }

    /* BEHEMOTHS */

    const behemothNames = [
      "البيهيومي الأول",
      "البيهيومي الثاني",
      "البيهيومي الثالث",
      "البيهيومي الرابع"
    ];

    for (const name of behemothNames) {

      await client.query(
        `
        INSERT INTO behemoths
        (
          player_id,
          name,
          level,
          power
        )
        VALUES
        ($1, $2, 1, 500)
        `,
        [
          player.id,
          name
        ]
      );
    }

    /* BUILDINGS */

    for (const [type, config] of Object.entries(BUILDINGS)) {

      await client.query(
        `
        INSERT INTO buildings
        (
          player_id,
          type,
          name,
          level,
          power
        )
        VALUES
        ($1, $2, $3, 1, $4)
        `,
        [
          player.id,
          type,
          config.name,
          config.basePower
        ]
      );
    }

    /* RESEARCH */

    for (const type of RESEARCH_TYPES) {

      await client.query(
        `
        INSERT INTO research
        (
          player_id,
          type,
          level,
          power
        )
        VALUES
        ($1, $2, 1, 100)
        `,
        [
          player.id,
          type
        ]
      );
    }

    /* TALENTS */

    for (const type of TALENT_TYPES) {

      await client.query(
        `
        INSERT INTO talents
        (
          player_id,
          type,
          level
        )
        VALUES
        ($1, $2, 1)
        `,
        [
          player.id,
          type
        ]
      );
    }

    /* AIRCRAFT */

    await client.query(
      `
      INSERT INTO aircraft
      (
        player_id,
        name,
        level,
        power,
        fuel
      )
      VALUES
      ($1, 'Kardous Airship', 1, 500, 100)
      `,
      [player.id]
    );

    await client.query("COMMIT");
    transactionStarted = false;

    console.log(
      `New player registered: ${player.name} (${player.id})`
    );

    res.json({
      success: true,
      player
    });

  } catch (error) {

    if (transactionStarted) {

      try {
        await client.query("ROLLBACK");
      } catch {}
    }

    console.error(
      "Register error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "فشل تسجيل المملكة",
      error: error.message
    });

  } finally {

    client.release();
  }
});

/* =========================================================
   GET PLAYER
========================================================= */

app.get("/api/player/:id", async (req, res) => {

  try {

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {

      return res.status(400).json({
        success: false,
        message: "معرف اللاعب غير صحيح"
      });
    }

    const exists = await pool.query(
      `
      SELECT id
      FROM players
      WHERE id = $1
      `,
      [id]
    );

    if (exists.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message: "المملكة غير موجودة"
      });
    }

    await ensurePlayerData(id);

    const result = await pool.query(
      `
      SELECT *
      FROM players
      WHERE id = $1
      `,
      [id]
    );

    res.json(result.rows[0]);

  } catch (error) {

    console.error(
      "Player error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "حدث خطأ في السيرفر"
    });
  }
});

/* =========================================================
   COLLECT RESOURCES
========================================================= */

app.post(
  "/api/player/:id/collect",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists = await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const buildingsResult = await pool.query(
        `
        SELECT type, level
        FROM buildings
        WHERE player_id = $1
        `,
        [id]
      );

      let food = 500;
      let wood = 500;
      let iron = 100;
      let gold = 50;

      for (const building of buildingsResult.rows) {

        const level = Number(
          building.level
        );

        if (building.type === "farm") {
          food += level * 100;
        }

        if (building.type === "lumber_mill") {
          wood += level * 100;
        }

        if (building.type === "iron_mine") {
          iron += level * 25;
        }

        if (building.type === "gold_mine") {
          gold += level * 10;
        }
      }

      const result = await pool.query(
        `
        UPDATE players
        SET
          food = food + $1,
          wood = wood + $2,
          iron = iron + $3,
          gold = gold + $4
        WHERE id = $5
        RETURNING *
        `,
        [
          food,
          wood,
          iron,
          gold,
          id
        ]
      );

      res.json({
        success: true,

        gained: {
          food,
          wood,
          iron,
          gold
        },

        player: result.rows[0]
      });

    } catch (error) {

      console.error(
        "Collect error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل جمع الموارد"
      });
    }
  }
);

/* =========================================================
   CASTLE INFO
========================================================= */

app.get(
  "/api/player/:id/castle",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const result = await pool.query(
        `
        SELECT
          id,
          name,
          castle_level,
          castle_stars,
          power,
          food,
          wood,
          iron,
          gold
        FROM players
        WHERE id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const player = result.rows[0];

      const level = Number(
        player.castle_level
      );

      const stars = Number(
        player.castle_stars
      );

      const next = getCastleUpgradeCost(
        level,
        stars
      );

      res.json({
        success: true,

        castle: {
          level,
          stars,
          power: Number(player.power)
        },

        resources: {
          food: Number(player.food),
          wood: Number(player.wood),
          iron: Number(player.iron),
          gold: Number(player.gold)
        },

        next,

        maximum: {
          level: MAX_CASTLE_LEVEL,
          stars: MAX_CASTLE_STARS
        }
      });

    } catch (error) {

      console.error(
        "Castle info error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل القلعة"
      });
    }
  }
);

/* =========================================================
   UPGRADE CASTLE
========================================================= */

app.post(
  "/api/player/:id/upgrade-castle",
  async (req, res) => {

    const client = await pool.connect();

    let transactionStarted = false;

    try {

      const id = Number(req.params.id);

      if (!Number.isInteger(id) || id <= 0) {

        return res.status(400).json({
          success: false,
          message: "معرف المملكة غير صحيح"
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const result = await client.query(
        `
        SELECT *
        FROM players
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (result.rows.length === 0) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const player = result.rows[0];

      const level = Number(
        player.castle_level
      );

      const stars = Number(
        player.castle_stars
      );

      const upgrade = getCastleUpgradeCost(
        level,
        stars
      );

      if (!upgrade) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "وصلت القلعة إلى الحد الأقصى: المستوى 30 و5 نجوم"
        });
      }

      const food = Number(player.food);
      const wood = Number(player.wood);
      const iron = Number(player.iron);
      const gold = Number(player.gold);

      if (
        food < upgrade.food ||
        wood < upgrade.wood ||
        iron < upgrade.iron ||
        gold < upgrade.gold
      ) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "الموارد غير كافية",

          cost: {
            food: upgrade.food,
            wood: upgrade.wood,
            iron: upgrade.iron,
            gold: upgrade.gold
          },

          resources: {
            food,
            wood,
            iron,
            gold
          }
        });
      }

      let newLevel = level;
      let newStars = stars;

      if (upgrade.type === "level") {
        newLevel = upgrade.nextLevel;
      }

      if (upgrade.type === "star") {
        newStars = upgrade.nextStars;
      }

      const updated = await client.query(
        `
        UPDATE players
        SET
          castle_level = $1,
          castle_stars = $2,

          food = food - $3,
          wood = wood - $4,
          iron = iron - $5,
          gold = gold - $6,

          power = power + $7

        WHERE id = $8

        RETURNING *
        `,
        [
          newLevel,
          newStars,

          upgrade.food,
          upgrade.wood,
          upgrade.iron,
          upgrade.gold,

          upgrade.power,

          id
        ]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      io.emit(
        "castleUpgraded",
        {
          playerId: id,

          castle: {
            level: newLevel,
            stars: newStars
          }
        }
      );

      res.json({
        success: true,

        message:
          upgrade.type === "level"
            ? `تم تطوير القلعة إلى المستوى ${newLevel}`
            : `تم الحصول على النجمة ${newStars} ⭐`,

        upgrade,

        player: updated.rows[0]
      });

    } catch (error) {

      if (transactionStarted) {

        try {
          await client.query("ROLLBACK");
        } catch {}
      }

      console.error(
        "Castle upgrade error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير القلعة",
        error: error.message
      });

    } finally {

      client.release();
    }
  }
);

/* =========================================================
   BUILDINGS
========================================================= */

app.get(
  "/api/player/:id/buildings",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists = await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM buildings
        WHERE player_id = $1
        ORDER BY id
        `,
        [id]
      );

      const buildings = result.rows.map(
        building => {

          const level = Number(
            building.level
          );

          const config =
            BUILDINGS[building.type];

          return {
            ...building,

            level,

            power: Number(
              building.power
            ),

            next:
              level < 30
                ? {
                    level: level + 1,

                    ...getBuildingUpgradeCost(
                      level
                    ),

                    power:
                      config
                        ? config.basePower *
                          (level + 1)
                        : 100 *
                          (level + 1)
                  }
                : null
          };
        }
      );

      res.json({
        success: true,
        buildings
      });

    } catch (error) {

      console.error(
        "Buildings error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل المباني"
      });
    }
  }
);

/* =========================================================
   UPGRADE BUILDING
========================================================= */

app.post(
  "/api/player/:id/buildings/:type/upgrade",
  async (req, res) => {

    const client = await pool.connect();

    let transactionStarted = false;

    try {

      const id = Number(req.params.id);
      const type = String(
        req.params.type || ""
      );

      if (!BUILDINGS[type]) {

        return res.status(400).json({
          success: false,
          message: "المبنى غير موجود"
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const playerResult = await client.query(
        `
        SELECT *
        FROM players
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (playerResult.rows.length === 0) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const buildingResult = await client.query(
        `
        SELECT *
        FROM buildings
        WHERE player_id = $1
        AND type = $2
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
          type
        ]
      );

      if (buildingResult.rows.length === 0) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "المبنى غير موجود"
        });
      }

      const player =
        playerResult.rows[0];

      const building =
        buildingResult.rows[0];

      const level = Number(
        building.level
      );

      const castleLevel = Number(
        player.castle_level
      );

      if (level >= 30) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "وصل المبنى إلى المستوى الأقصى"
        });
      }

      if (level >= castleLevel) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message:
            "يجب أن تكون القلعة أعلى من مستوى المبنى"
        });
      }

      const cost =
        getBuildingUpgradeCost(level);

      if (
        Number(player.food) < cost.food ||
        Number(player.wood) < cost.wood ||
        Number(player.iron) < cost.iron ||
        Number(player.gold) < cost.gold
      ) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "الموارد غير كافية",
          cost
        });
      }

      const powerGain =
        BUILDINGS[type].basePower;

      const updatedBuilding =
        await client.query(
          `
          UPDATE buildings
          SET
            level = level + 1,
            power = power + $1,
            name = $2
          WHERE id = $3
          RETURNING *
          `,
          [
            powerGain,
            BUILDINGS[type].name,
            building.id
          ]
        );

      const updatedPlayer =
        await client.query(
          `
          UPDATE players
          SET
            food = food - $1,
            wood = wood - $2,
            iron = iron - $3,
            gold = gold - $4,
            power = power + $5
          WHERE id = $6
          RETURNING *
          `,
          [
            cost.food,
            cost.wood,
            cost.iron,
            cost.gold,
            powerGain,
            id
          ]
        );

      await client.query("COMMIT");
      transactionStarted = false;

      res.json({
        success: true,
        building: updatedBuilding.rows[0],
        player: updatedPlayer.rows[0]
      });

    } catch (error) {

      if (transactionStarted) {

        try {
          await client.query("ROLLBACK");
        } catch {}
      }

      console.error(
        "Building upgrade error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير المبنى",
        error: error.message
      });

    } finally {

      client.release();
    }
  }
);

/* =========================================================
   TRAIN TROOPS
========================================================= */

app.post(
  "/api/player/:id/train",
  async (req, res) => {

    const client = await pool.connect();

    let transactionStarted = false;

    try {

      const id = Number(req.params.id);

      const type =
        String(req.body.type || "مشاة");

      await client.query("BEGIN");
      transactionStarted = true;

      const result = await client.query(
        `
        SELECT *
        FROM players
        WHERE id = $1
        FOR UPDATE
        `,
        [id]
      );

      if (result.rows.length === 0) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const player = result.rows[0];

      const troopCount = 100;
      const foodCost = 500;
      const woodCost = 200;

      if (
        Number(player.food) < foodCost ||
        Number(player.wood) < woodCost
      ) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "الموارد غير كافية"
        });
      }

      const updated =
        await client.query(
          `
          UPDATE players
          SET
            food = food - $1,
            wood = wood - $2,
            troops = troops + $3,
            power = power + 200
          WHERE id = $4
          RETURNING *
          `,
          [
            foodCost,
            woodCost,
            troopCount,
            id
          ]
        );

      await client.query("COMMIT");
      transactionStarted = false;

      res.json({
        success: true,
        type,
        troopsTrained: troopCount,
        player: updated.rows[0]
      });

    } catch (error) {

      if (transactionStarted) {

        try {
          await client.query("ROLLBACK");
        } catch {}
      }

      console.error(
        "Training error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تدريب الجنود"
      });

    } finally {

      client.release();
    }
  }
);

/* =========================================================
   RESEARCH
========================================================= */

app.get(
  "/api/player/:id/research",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM research
        WHERE player_id = $1
        ORDER BY id
        `,
        [id]
      );

      res.json({
        success: true,
        research: result.rows
      });

    } catch (error) {

      console.error(
        "Research GET error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل الأبحاث"
      });
    }
  }
);

app.post(
  "/api/player/:id/research",
  async (req, res) => {

    const client = await pool.connect();

    let transactionStarted = false;

    try {

      const id = Number(req.params.id);
      const type = req.body.type;

      if (!RESEARCH_TYPES.includes(type)) {

        return res.status(400).json({
          success: false,
          message: "نوع البحث غير صحيح"
        });
      }

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const playerResult =
        await client.query(
          `
          SELECT *
          FROM players
          WHERE id = $1
          FOR UPDATE
          `,
          [id]
        );

      const researchResult =
        await client.query(
          `
          SELECT *
          FROM research
          WHERE player_id = $1
          AND type = $2
          LIMIT 1
          FOR UPDATE
          `,
          [
            id,
            type
          ]
        );

      if (
        playerResult.rows.length === 0 ||
        researchResult.rows.length === 0
      ) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "البحث غير موجود"
        });
      }

      const research =
        researchResult.rows[0];

      if (Number(research.level) >= 30) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "وصل البحث إلى المستوى الأقصى"
        });
      }

      const powerGain = 200;

      const updatedResearch =
        await client.query(
          `
          UPDATE research
          SET
            level = level + 1,
            power = power + $1
          WHERE id = $2
          RETURNING *
          `,
          [
            powerGain,
            research.id
          ]
        );

      const updatedPlayer =
        await client.query(
          `
          UPDATE players
          SET power = power + $1
          WHERE id = $2
          RETURNING *
          `,
          [
            powerGain,
            id
          ]
        );

      await client.query("COMMIT");
      transactionStarted = false;

      res.json({
        success: true,
        research:
          updatedResearch.rows[0],
        player:
          updatedPlayer.rows[0]
      });

    } catch (error) {

      if (transactionStarted) {

        try {
          await client.query("ROLLBACK");
        } catch {}
      }

      console.error(
        "Research error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير البحث"
      });

    } finally {

      client.release();
    }
  }
);

/* =========================================================
   HEROES
========================================================= */

app.get(
  "/api/player/:id/heroes",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM heroes
        WHERE player_id = $1
        ORDER BY id
        `,
        [id]
      );

      res.json({
        success: true,
        heroes: result.rows
      });

    } catch (error) {

      console.error(
        "Heroes error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل الأبطال"
      });
    }
  }
);

app.post(
  "/api/player/:id/heroes/:heroId/upgrade",
  async (req, res) => {

    try {

      const playerId =
        Number(req.params.id);

      const heroId =
        Number(req.params.heroId);

      const exists =
        await ensurePlayerData(playerId);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result =
        await pool.query(
          `
          UPDATE heroes
          SET
            level = level + 1,
            power = power + 100
          WHERE id = $1
          AND player_id = $2
          RETURNING *
          `,
          [
            heroId,
            playerId
          ]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "البطل غير موجود"
        });
      }

      await pool.query(
        `
        UPDATE players
        SET power = power + 100
        WHERE id = $1
        `,
        [playerId]
      );

      res.json({
        success: true,
        hero: result.rows[0]
      });

    } catch (error) {

      console.error(
        "Hero upgrade error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير البطل"
      });
    }
  }
);

/* =========================================================
   BEHEMOTHS
========================================================= */

app.get(
  "/api/player/:id/behemoths",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM behemoths
        WHERE player_id = $1
        ORDER BY id
        `,
        [id]
      );

      res.json({
        success: true,
        behemoths: result.rows
      });

    } catch (error) {

      console.error(
        "Behemoths error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل البيهيومي"
      });
    }
  }
);

app.post(
  "/api/player/:id/behemoths/:behemothId/upgrade",
  async (req, res) => {

    try {

      const playerId =
        Number(req.params.id);

      const behemothId =
        Number(req.params.behemothId);

      const exists =
        await ensurePlayerData(playerId);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result =
        await pool.query(
          `
          UPDATE behemoths
          SET
            level = level + 1,
            power = power + 250
          WHERE id = $1
          AND player_id = $2
          RETURNING *
          `,
          [
            behemothId,
            playerId
          ]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "البيهيومي غير موجود"
        });
      }

      await pool.query(
        `
        UPDATE players
        SET power = power + 250
        WHERE id = $1
        `,
        [playerId]
      );

      res.json({
        success: true,
        behemoth: result.rows[0]
      });

    } catch (error) {

      console.error(
        "Behemoth upgrade error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير البيهيومي"
      });
    }
  }
);

/* =========================================================
   TALENTS
========================================================= */

app.get(
  "/api/player/:id/talents",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM talents
        WHERE player_id = $1
        ORDER BY id
        `,
        [id]
      );

      res.json({
        success: true,
        talents: result.rows
      });

    } catch (error) {

      console.error(
        "Talents error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل المواهب"
      });
    }
  }
);

app.post(
  "/api/player/:id/talents/:type/upgrade",
  async (req, res) => {

    try {

      const playerId =
        Number(req.params.id);

      const type =
        req.params.type;

      if (!TALENT_TYPES.includes(type)) {

        return res.status(400).json({
          success: false,
          message: "نوع الموهبة غير صحيح"
        });
      }

      const exists =
        await ensurePlayerData(playerId);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result =
        await pool.query(
          `
          UPDATE talents
          SET level = level + 1
          WHERE player_id = $1
          AND type = $2
          RETURNING *
          `,
          [
            playerId,
            type
          ]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "الموهبة غير موجودة"
        });
      }

      res.json({
        success: true,
        talent: result.rows[0]
      });

    } catch (error) {

      console.error(
        "Talent upgrade error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير الموهبة"
      });
    }
  }
);

/* =========================================================
   AIRCRAFT
========================================================= */

app.get(
  "/api/player/:id/aircraft",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result = await pool.query(
        `
        SELECT *
        FROM aircraft
        WHERE player_id = $1
        LIMIT 1
        `,
        [id]
      );

      res.json({
        success: true,
        aircraft:
          result.rows[0] || null
      });

    } catch (error) {

      console.error(
        "Aircraft error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل الطائرة"
      });
    }
  }
);

app.post(
  "/api/player/:id/aircraft/upgrade",
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      const exists =
        await ensurePlayerData(id);

      if (!exists) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const result =
        await pool.query(
          `
          UPDATE aircraft
          SET
            level = level + 1,
            power = power + 500
          WHERE player_id = $1
          RETURNING *
          `,
          [id]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "الطائرة غير موجودة"
        });
      }

      await pool.query(
        `
        UPDATE players
        SET power = power + 500
        WHERE id = $1
        `,
        [id]
      );

      res.json({
        success: true,
        aircraft: result.rows[0]
      });

    } catch (error) {

      console.error(
        "Aircraft upgrade error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تطوير الطائرة"
      });
    }
  }
);

/* =========================================================
   ALLIANCES
========================================================= */

app.get(
  "/api/alliances",
  async (req, res) => {

    try {

      const result = await pool.query(
        `
        SELECT
          a.*,
          COUNT(am.player_id)::INTEGER AS members
        FROM alliances a
        LEFT JOIN alliance_members am
          ON am.alliance_id = a.id
        GROUP BY a.id
        ORDER BY a.power DESC
        `
      );

      res.json({
        success: true,
        alliances: result.rows
      });

    } catch (error) {

      console.error(
        "Alliances error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل التحالفات"
      });
    }
  }
);

app.post(
  "/api/alliances",
  async (req, res) => {

    try {

      const name =
        String(req.body.name || "")
          .trim();

      const leaderId =
        Number(req.body.leaderId);

      if (!name) {

        return res.status(400).json({
          success: false,
          message: "اكتب اسم التحالف"
        });
      }

      const existing =
        await pool.query(
          `
          SELECT id
          FROM alliances
          WHERE LOWER(name) = LOWER($1)
          LIMIT 1
          `,
          [name]
        );

      if (existing.rows.length > 0) {

        return res.status(409).json({
          success: false,
          message: "اسم التحالف مستخدم بالفعل"
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO alliances
          (
            name,
            leader_id,
            power
          )
          VALUES
          ($1, $2, 0)
          RETURNING *
          `,
          [
            name,
            leaderId
          ]
        );

      await pool.query(
        `
        INSERT INTO alliance_members
        (
          alliance_id,
          player_id,
          role
        )
        VALUES
        ($1, $2, 'leader')
        `,
        [
          result.rows[0].id,
          leaderId
        ]
      );

      res.json({
        success: true,
        alliance: result.rows[0]
      });

    } catch (error) {

      console.error(
        "Create alliance error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل إنشاء التحالف"
      });
    }
  }
);

app.get(
  "/api/alliances/:id",
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const alliance =
        await pool.query(
          `
          SELECT *
          FROM alliances
          WHERE id = $1
          `,
          [id]
        );

      if (alliance.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "التحالف غير موجود"
        });
      }

      const members =
        await pool.query(
          `
          SELECT
            p.id,
            p.name,
            p.power,
            am.role
          FROM alliance_members am
          JOIN players p
            ON p.id = am.player_id
          WHERE am.alliance_id = $1
          ORDER BY p.power DESC
          `,
          [id]
        );

      res.json({
        success: true,
        alliance:
          alliance.rows[0],
        members:
          members.rows
      });

    } catch (error) {

      console.error(
        "Alliance detail error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل التحالف"
      });
    }
  }
);

app.post(
  "/api/player/:id/alliance/join",
  async (req, res) => {

    try {

      const playerId =
        Number(req.params.id);

      const allianceId =
        Number(req.body.allianceId);

      const player =
        await pool.query(
          `
          SELECT id
          FROM players
          WHERE id = $1
          `,
          [playerId]
        );

      if (player.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const alliance =
        await pool.query(
          `
          SELECT *
          FROM alliances
          WHERE id = $1
          `,
          [allianceId]
        );

      if (alliance.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "التحالف غير موجود"
        });
      }

      const memberExists =
        await pool.query(
          `
          SELECT id
          FROM alliance_members
          WHERE alliance_id = $1
          AND player_id = $2
          LIMIT 1
          `,
          [
            allianceId,
            playerId
          ]
        );

      if (memberExists.rows.length === 0) {

        await pool.query(
          `
          INSERT INTO alliance_members
          (
            alliance_id,
            player_id,
            role
          )
          VALUES
          ($1, $2, 'member')
          `,
          [
            allianceId,
            playerId
          ]
        );
      }

      await pool.query(
        `
        UPDATE alliances
        SET power = COALESCE(
          (
            SELECT SUM(p.power)
            FROM alliance_members am
            JOIN players p
              ON p.id = am.player_id
            WHERE am.alliance_id = $1
          ),
          0
        )
        WHERE id = $1
        `,
        [allianceId]
      );

      res.json({
        success: true,
        message: "تم الانضمام إلى التحالف"
      });

    } catch (error) {

      console.error(
        "Join alliance error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل الانضمام إلى التحالف"
      });
    }
  }
);

/* =========================================================
   RANKINGS
========================================================= */

app.get(
  "/api/rankings/all",
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
          SELECT
            id,
            name,
            power,
            castle_level,
            castle_stars
          FROM players
          ORDER BY power DESC
          LIMIT 100
          `
        );

      res.json({
        success: true,
        rankings:
          result.rows
      });

    } catch (error) {

      console.error(
        "Rankings error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل التصنيف"
      });
    }
  }
);

/* =========================================================
   PROFILE
========================================================= */

app.get(
  "/api/player/:id/profile",
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const result =
        await pool.query(
          `
          SELECT
            id,
            name,
            power,
            castle_level,
            castle_stars,
            commander_level,
            commander_xp,
            x,
            y,
            created_at
          FROM players
          WHERE id = $1
          `,
          [id]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "اللاعب غير موجود"
        });
      }

      res.json({
        success: true,
        profile:
          result.rows[0]
      });

    } catch (error) {

      console.error(
        "Profile error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل الملف الشخصي"
      });
    }
  }
);

/* =========================================================
   WORLD MAP
========================================================= */

app.get(
  "/api/world",
  async (req, res) => {

    try {

      const players =
        await pool.query(
          `
          SELECT
            id,
            name,
            power,
            castle_level,
            castle_stars,
            x,
            y
          FROM players
          ORDER BY id
          `
        );

      const zombies =
        await pool.query(
          `
          SELECT *
          FROM zombies
          ORDER BY id
          `
        );

      const forts =
        await pool.query(
          `
          SELECT *
          FROM forts
          ORDER BY id
          `
        );

      res.json({
        success: true,
        players:
          players.rows,
        zombies:
          zombies.rows,
        forts:
          forts.rows
      });

    } catch (error) {

      console.error(
        "World error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل الخريطة"
      });
    }
  }
);

/* =========================================================
   MOVE PLAYER
========================================================= */

app.post(
  "/api/player/:id/move",
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const x =
        Number(req.body.x);

      const y =
        Number(req.body.y);

      if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {

        return res.status(400).json({
          success: false,
          message: "الإحداثيات غير صحيحة"
        });
      }

      const result =
        await pool.query(
          `
          UPDATE players
          SET
            x = $1,
            y = $2
          WHERE id = $3
          RETURNING *
          `,
          [
            Math.round(x),
            Math.round(y),
            id
          ]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      io.emit(
        "playerMoved",
        {
          player:
            result.rows[0]
        }
      );

      res.json({
        success: true,
        player:
          result.rows[0]
      });

    } catch (error) {

      console.error(
        "Move error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحريك المملكة"
      });
    }
  }
);

/* =========================================================
   MARCH
========================================================= */

app.post(
  "/api/player/:id/march",
  async (req, res) => {

    const client =
      await pool.connect();

    let transactionStarted = false;

    try {

      const playerId =
        Number(req.params.id);

      const targetType =
        String(
          req.body.targetType ||
          "zombie"
        );

      const targetId =
        Number(req.body.targetId);

      const troops =
        Number(req.body.troops);

      if (
        !Number.isInteger(troops) ||
        troops <= 0
      ) {

        return res.status(400).json({
          success: false,
          message: "عدد الجنود غير صحيح"
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      const playerResult =
        await client.query(
          `
          SELECT *
          FROM players
          WHERE id = $1
          FOR UPDATE
          `,
          [playerId]
        );

      if (playerResult.rows.length === 0) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "المملكة غير موجودة"
        });
      }

      const player =
        playerResult.rows[0];

      if (
        Number(player.troops) <
        troops
      ) {

        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "عدد الجنود غير كافٍ"
        });
      }

      const updatedPlayer =
        await client.query(
          `
          UPDATE players
          SET troops = troops - $1
          WHERE id = $2
          RETURNING *
          `,
          [
            troops,
            playerId
          ]
        );

      const march =
        await client.query(
          `
          INSERT INTO marches
          (
            player_id,
            target_type,
            target_id,
            troops,
            started_at,
            status
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            CURRENT_TIMESTAMP,
            'marching'
          )
          RETURNING *
          `,
          [
            playerId,
            targetType,
            targetId,
            troops
          ]
        );

      await client.query("COMMIT");
      transactionStarted = false;

      io.emit(
        "marchStarted",
        {
          march:
            march.rows[0]
        }
      );

      res.json({
        success: true,
        march:
          march.rows[0],
        player:
          updatedPlayer.rows[0]
      });

    } catch (error) {

      if (transactionStarted) {

        try {
          await client.query("ROLLBACK");
        } catch {}
      }

      console.error(
        "March error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل إرسال المسيرة"
      });

    } finally {

      client.release();
    }
  }
);

/* =========================================================
   REPORTS
========================================================= */

app.get(
  "/api/reports/:id",
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const result =
        await pool.query(
          `
          SELECT *
          FROM battle_reports
          WHERE player_id = $1
          ORDER BY created_at DESC
          LIMIT 100
          `,
          [id]
        );

      res.json({
        success: true,
        reports:
          result.rows
      });

    } catch (error) {

      console.error(
        "Reports error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "فشل تحميل التقارير"
      });
    }
  }
);

/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
  "connection",
  socket => {

    console.log(
      `Player connected: ${socket.id}`
    );

    socket.on(
      "joinGame",
      data => {

        console.log(
          "Player joined game:",
          data
        );

        socket.emit(
          "gameJoined",
          {
            success: true,

            playerId:
              data &&
              data.playerId
          }
        );
      }
    );

    socket.on(
      "disconnect",
      () => {

        console.log(
          `Player disconnected: ${socket.id}`
        );
      }
    );
  }
);

/* =========================================================
   PROCESS MARCHES
========================================================= */

async function processMarches() {

  try {

    const result =
      await pool.query(
        `
        SELECT *
        FROM marches
        WHERE status = 'marching'
        AND started_at <=
          NOW() - INTERVAL '10 seconds'
        ORDER BY id
        LIMIT 50
        `
      );

    for (
      const march of result.rows
    ) {

      const client =
        await pool.connect();

      let transactionStarted = false;

      try {

        await client.query("BEGIN");
        transactionStarted = true;

        const playerResult =
          await client.query(
            `
            SELECT *
            FROM players
            WHERE id = $1
            FOR UPDATE
            `,
            [march.player_id]
          );

        if (
          playerResult.rows.length === 0
        ) {

          await client.query(
            `
            UPDATE marches
            SET status = 'completed'
            WHERE id = $1
            `,
            [march.id]
          );

          await client.query("COMMIT");
          transactionStarted = false;

          continue;
        }

        const player =
          playerResult.rows[0];

        const troops =
          Number(march.troops);

        const enemyPower =
          Math.max(
            100,
            troops * 2
          );

        const playerPower =
          Number(player.power);

        const victory =
          playerPower >= enemyPower;

        let resultText =
          "defeat";

        let powerChange = 0;

        if (victory) {

          resultText =
            "victory";

          powerChange =
            troops * 3;

          await client.query(
            `
            UPDATE players
            SET power = power + $1
            WHERE id = $2
            `,
            [
              powerChange,
              march.player_id
            ]
          );
        }

        await client.query(
          `
          UPDATE marches
          SET status = 'completed'
          WHERE id = $1
          `,
          [march.id]
        );

        await client.query(
          `
          INSERT INTO battle_reports
          (
            player_id,
            result,
            enemy_type,
            enemy_id,
            troops_sent,
            power_change
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
          )
          `,
          [
            march.player_id,
            resultText,
            march.target_type,
            march.target_id,
            troops,
            powerChange
          ]
        );

        await client.query("COMMIT");
        transactionStarted = false;

        io.emit(
          "battleFinished",
          {
            playerId:
              march.player_id,

            result:
              resultText,

            powerChange
          }
        );

      } catch (error) {

        if (transactionStarted) {

          try {
            await client.query(
              "ROLLBACK"
            );
          } catch {}
        }

        console.error(
          "March processing error:",
          error
        );

      } finally {

        client.release();
      }
    }

  } catch (error) {

    console.error(
      "Process marches error:",
      error
    );
  }
}

/* =========================================================
   DATABASE TEST
========================================================= */

async function testDatabase() {

  const result =
    await pool.query(
      "SELECT NOW() AS time"
    );

  console.log(
    "PostgreSQL connected:",
    result.rows[0].time
  );
}

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {

  try {

    await testDatabase();

    await createTables();

    await migrateDatabase();

    server.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          "======================================"
        );

        console.log(
          "🏰 Kardous Survival ONLINE"
        );

        console.log(
          "Version:",
          GAME_VERSION
        );

        console.log(
          "Castle: Level 1 → 30 → ⭐⭐⭐⭐⭐"
        );

        console.log(
          "======================================"
        );
      }
    );

    setInterval(
      processMarches,
      5000
    );

  } catch (error) {

    console.error(
      "Server startup error:",
      error
    );

    process.exit(1);
  }
}

startServer();
