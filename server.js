const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

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


// =====================================================
// DATABASE
// =====================================================

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
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
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      rarity TEXT DEFAULT 'common',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS behemoths (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 500,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliances (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      leader_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      power BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS alliance_members (
      id SERIAL PRIMARY KEY,
      alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(alliance_id, player_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS zombies (
      id SERIAL PRIMARY KEY,
      name TEXT DEFAULT 'Zombie',
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS forts (
      id SERIAL PRIMARY KEY,
      name TEXT DEFAULT 'Fort',
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 500,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marches (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      target_x INTEGER NOT NULL,
      target_y INTEGER NOT NULL,
      troops INTEGER DEFAULT 0,
      status TEXT DEFAULT 'marching',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS battle_reports (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      result TEXT,
      enemy TEXT,
      power_change BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ===================================================
  // BUILDINGS
  // ===================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS buildings (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(player_id, type)
    )
  `);

  // ===================================================
  // RESEARCH
  // ===================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS research (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 200,
      UNIQUE(player_id, type)
    )
  `);

  // ===================================================
  // TALENTS
  // ===================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS talents (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      UNIQUE(player_id, type)
    )
  `);

  // ===================================================
  // AIRCRAFT
  // ===================================================

  await pool.query(`
    CREATE TABLE IF NOT EXISTS aircraft (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      name TEXT DEFAULT 'Kardous Airship',
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 500,
      fuel INTEGER DEFAULT 100,
      UNIQUE(player_id)
    )
  `);

  console.log("Database initialized");
}


// =====================================================
// BUILDING CONFIG
// =====================================================

const BUILDINGS = {
  farm: {
    name: "Farm",
    arabic: "المزرعة",
    basePower: 100
  },

  lumber_mill: {
    name: "Lumber Mill",
    arabic: "منشرة الخشب",
    basePower: 100
  },

  iron_mine: {
    name: "Iron Mine",
    arabic: "منجم الحديد",
    basePower: 150
  },

  gold_mine: {
    name: "Gold Mine",
    arabic: "منجم الذهب",
    basePower: 200
  },

  barracks: {
    name: "Barracks",
    arabic: "الثكنة",
    basePower: 250
  },

  hospital: {
    name: "Hospital",
    arabic: "المستشفى",
    basePower: 250
  },

  research_center: {
    name: "Research Center",
    arabic: "مركز الأبحاث",
    basePower: 300
  },

  warehouse: {
    name: "Warehouse",
    arabic: "المخزن",
    basePower: 200
  },

  watchtower: {
    name: "Watchtower",
    arabic: "برج المراقبة",
    basePower: 300
  },

  alliance_center: {
    name: "Alliance Center",
    arabic: "مركز التحالف",
    basePower: 300
  },

  airfield: {
    name: "Airfield",
    arabic: "المطار",
    basePower: 500
  }
};


function getBuildingCost(level) {
  return {
    food: level * 1200,
    wood: level * 1200,
    iron: level * 300,
    gold: Math.floor(level * 120)
  };
}


function getBuildingPower(type, level) {
  const building = BUILDINGS[type];

  if (!building) {
    return level * 100;
  }

  return building.basePower * level;
}


// =====================================================
// CASTLE CONFIG
// =====================================================

function getCastleLevelCost(level) {
  return {
    food: level * 1000,
    wood: level * 1000,
    iron: level * 250,
    gold: Math.floor(level * 100)
  };
}


function getCastleLevelPower(level) {
  return 500 + level * 100;
}


function getStarCost(star) {
  return {
    food: 30000 + star * 15000,
    wood: 30000 + star * 15000,
    iron: 10000 + star * 7500,
    gold: 5000 + star * 2500
  };
}


function getStarPower(star) {
  return 5000 + star * 1000;
}


// =====================================================
// HEALTH
// =====================================================

app.get("/api/status", async (req, res) => {
  res.json({
    ok: true,
    game: "Kardous Survival",
    version: "14.0",
    server: "online"
  });
});


// =====================================================
// REGISTER
// =====================================================

app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "Kardous").trim();

    if (!name) {
      return res.status(400).json({
        ok: false,
        error: "Name is required"
      });
    }

    const playerResult = await pool.query(
      `
      INSERT INTO players (name)
      VALUES ($1)
      RETURNING *
      `,
      [name]
    );

    const player = playerResult.rows[0];

    // Heroes
    const heroNames = [
      "Kardous",
      "Luna",
      "Ryuzu",
      "Raquel",
      "Hulk",
      "Storm",
      "Aquila",
      "Raven",
      "Nova",
      "Titan",
      "Blaze",
      "Shadow",
      "Hunter",
      "Viper",
      "Falcon",
      "Wolf",
      "Phoenix",
      "Guardian",
      "Knight",
      "Legend"
    ];

    for (let i = 0; i < heroNames.length; i++) {
      await pool.query(
        `
        INSERT INTO heroes
        (player_id, name, level, power, rarity)
        VALUES ($1, $2, 1, $3, $4)
        `,
        [
          player.id,
          heroNames[i],
          100 + i * 20,
          i === 0 ? "legendary" : "common"
        ]
      );
    }

    // Behemoths
    const behemothNames = [
      "البھيثومي الأول",
      "البھيثومي الثاني",
      "البھيثومي الثالث",
      "البھيثومي الرابع"
    ];

    for (let i = 0; i < behemothNames.length; i++) {
      await pool.query(
        `
        INSERT INTO behemoths
        (player_id, name, level, power)
        VALUES ($1, $2, 1, $3)
        `,
        [
          player.id,
          behemothNames[i],
          500 + i * 200
        ]
      );
    }

    // Buildings
    for (const [type, data] of Object.entries(BUILDINGS)) {
      await pool.query(
        `
        INSERT INTO buildings
        (player_id, type, name, level, power)
        VALUES ($1, $2, $3, 1, $4)
        ON CONFLICT (player_id, type) DO NOTHING
        `,
        [
          player.id,
          type,
          data.arabic,
          data.basePower
        ]
      );
    }

    // Research
    const researchTypes = [
      "economy",
      "construction",
      "military",
      "defense",
      "troops",
      "technology"
    ];

    for (const type of researchTypes) {
      await pool.query(
        `
        INSERT INTO research
        (player_id, type, level, power)
        VALUES ($1, $2, 1, 200)
        ON CONFLICT (player_id, type) DO NOTHING
        `,
        [player.id, type]
      );
    }

    // Talents
    const talentTypes = [
      "war",
      "economy",
      "development"
    ];

    for (const type of talentTypes) {
      await pool.query(
        `
        INSERT INTO talents
        (player_id, type, level)
        VALUES ($1, $2, 0)
        ON CONFLICT (player_id, type) DO NOTHING
        `,
        [player.id, type]
      );
    }

    // Aircraft
    await pool.query(
      `
      INSERT INTO aircraft
      (player_id, name, level, power, fuel)
      VALUES ($1, 'Kardous Airship', 1, 500, 100)
      ON CONFLICT (player_id) DO NOTHING
      `,
      [player.id]
    );

    res.json({
      ok: true,
      player
    });

  } catch (error) {
    console.error("Register error:", error);

    res.status(500).json({
      ok: false,
      error: "Registration failed"
    });
  }
});


// =====================================================
// PLAYER
// =====================================================

app.get("/api/player/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `SELECT * FROM players WHERE id = $1`,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      player: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load player"
    });
  }
});


// =====================================================
// COLLECT RESOURCES
// =====================================================

app.post("/api/player/:id/collect", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const buildingResult = await pool.query(
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

    for (const building of buildingResult.rows) {
      const level = Number(building.level);

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
      [food, wood, iron, gold, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      gained: {
        food,
        wood,
        iron,
        gold
      },
      player: result.rows[0]
    });

  } catch (error) {
    console.error("Collect error:", error);

    res.status(500).json({
      ok: false,
      error: "Collection failed"
    });
  }
});


// =====================================================
// CASTLE INFO
// =====================================================

app.get("/api/player/:id/castle", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT
        castle_level,
        castle_stars,
        power
      FROM players
      WHERE id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    const player = result.rows[0];

    let next = null;

    if (player.castle_level < 30) {
      const nextLevel = player.castle_level + 1;

      next = {
        type: "level",
        level: nextLevel,
        stars: player.castle_stars,
        cost: getCastleLevelCost(player.castle_level),
        power: getCastleLevelPower(nextLevel)
      };
    } else if (player.castle_stars < 5) {
      const nextStar = player.castle_stars + 1;

      next = {
        type: "star",
        level: 30,
        stars: nextStar,
        cost: getStarCost(player.castle_stars),
        power: getStarPower(nextStar)
      };
    }

    res.json({
      ok: true,

      // Nested version
      current: {
        level: player.castle_level,
        stars: player.castle_stars,
        power: Number(player.power)
      },

      next,

      maximum: {
        level: 30,
        stars: 5
      },

      // Flat compatibility fields
      level: player.castle_level,
      stars: player.castle_stars,
      power: Number(player.power)
    });

  } catch (error) {
    console.error("Castle info error:", error);

    res.status(500).json({
      ok: false,
      error: "Failed to load castle"
    });
  }
});


// =====================================================
// UPGRADE CASTLE
// =====================================================

app.post("/api/player/:id/upgrade-castle", async (req, res) => {
  const client = await pool.connect();

  try {
    const id = Number(req.params.id);

    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT *
      FROM players
      WHERE id = $1
      FOR UPDATE
      `,
      [id]
    );

    if (!result.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    const player = result.rows[0];

    // Level 1 -> 30
    if (player.castle_level < 30) {
      const currentLevel = player.castle_level;
      const cost = getCastleLevelCost(currentLevel);

      if (
        Number(player.food) < cost.food ||
        Number(player.wood) < cost.wood ||
        Number(player.iron) < cost.iron ||
        Number(player.gold) < cost.gold
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          ok: false,
          error: "Not enough resources",
          cost
        });
      }

      const newLevel = currentLevel + 1;
      const powerGain = getCastleLevelPower(newLevel);

      const updated = await client.query(
        `
        UPDATE players
        SET
          food = food - $1,
          wood = wood - $2,
          iron = iron - $3,
          gold = gold - $4,
          castle_level = $5,
          power = power + $6
        WHERE id = $7
        RETURNING *
        `,
        [
          cost.food,
          cost.wood,
          cost.iron,
          cost.gold,
          newLevel,
          powerGain,
          id
        ]
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        type: "level",
        player: updated.rows[0]
      });
    }

    // Level 30 -> stars 1 -> 5
    if (player.castle_stars < 5) {
      const currentStar = player.castle_stars;
      const cost = getStarCost(currentStar);
      const newStar = currentStar + 1;
      const powerGain = getStarPower(newStar);

      if (
        Number(player.food) < cost.food ||
        Number(player.wood) < cost.wood ||
        Number(player.iron) < cost.iron ||
        Number(player.gold) < cost.gold
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          ok: false,
          error: "Not enough resources",
          cost
        });
      }

      const updated = await client.query(
        `
        UPDATE players
        SET
          food = food - $1,
          wood = wood - $2,
          iron = iron - $3,
          gold = gold - $4,
          castle_stars = $5,
          power = power + $6
        WHERE id = $7
        RETURNING *
        `,
        [
          cost.food,
          cost.wood,
          cost.iron,
          cost.gold,
          newStar,
          powerGain,
          id
        ]
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        type: "star",
        player: updated.rows[0]
      });
    }

    await client.query("ROLLBACK");

    res.json({
      ok: false,
      error: "Castle already at maximum level"
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Castle upgrade error:", error);

    res.status(500).json({
      ok: false,
      error: "Castle upgrade failed"
    });
  } finally {
    client.release();
  }
});


// =====================================================
// BUILDINGS LIST
// =====================================================

app.get("/api/player/:id/buildings", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT
        id,
        type,
        name,
        level,
        power
      FROM buildings
      WHERE player_id = $1
      ORDER BY id
      `,
      [id]
    );

    res.json({
      ok: true,
      buildings: result.rows.map(building => {
        const nextLevel =
          Number(building.level) < 30
            ? Number(building.level) + 1
            : null;

        return {
          ...building,
          level: Number(building.level),
          power: Number(building.power),
          maximumLevel: 30,
          next: nextLevel
            ? {
                level: nextLevel,
                cost: getBuildingCost(Number(building.level)),
                power: getBuildingPower(
                  building.type,
                  nextLevel
                )
              }
            : null
        };
      })
    });

  } catch (error) {
    console.error("Buildings error:", error);

    res.status(500).json({
      ok: false,
      error: "Failed to load buildings"
    });
  }
});


// =====================================================
// UPGRADE BUILDING
// =====================================================

app.post("/api/player/:id/buildings/:type/upgrade", async (req, res) => {
  const client = await pool.connect();

  try {
    const playerId = Number(req.params.id);
    const type = String(req.params.type);

    if (!BUILDINGS[type]) {
      return res.status(400).json({
        ok: false,
        error: "Unknown building"
      });
    }

    await client.query("BEGIN");

    const playerResult = await client.query(
      `
      SELECT *
      FROM players
      WHERE id = $1
      FOR UPDATE
      `,
      [playerId]
    );

    if (!playerResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    const buildingResult = await client.query(
      `
      SELECT *
      FROM buildings
      WHERE player_id = $1
        AND type = $2
      FOR UPDATE
      `,
      [playerId, type]
    );

    if (!buildingResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        error: "Building not found"
      });
    }

    const player = playerResult.rows[0];
    const building = buildingResult.rows[0];

    const currentLevel = Number(building.level);

    if (currentLevel >= 30) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        ok: false,
        error: "Building is already at maximum level"
      });
    }

    // Building cannot exceed castle level
    if (currentLevel >= Number(player.castle_level)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        ok: false,
        error: "Upgrade your castle first",
        castleLevel: Number(player.castle_level),
        buildingLevel: currentLevel
      });
    }

    const cost = getBuildingCost(currentLevel);

    if (
      Number(player.food) < cost.food ||
      Number(player.wood) < cost.wood ||
      Number(player.iron) < cost.iron ||
      Number(player.gold) < cost.gold
    ) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        ok: false,
        error: "Not enough resources",
        cost
      });
    }

    const newLevel = currentLevel + 1;
    const newPower = getBuildingPower(type, newLevel);

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
      `,
      [
        cost.food,
        cost.wood,
        cost.iron,
        cost.gold,
        BUILDINGS[type].basePower,
        playerId
      ]
    );

    const updated = await client.query(
      `
      UPDATE buildings
      SET
        level = $1,
        power = $2
      WHERE player_id = $3
        AND type = $4
      RETURNING *
      `,
      [
        newLevel,
        newPower,
        playerId,
        type
      ]
    );

    await client.query("COMMIT");

    res.json({
      ok: true,
      building: updated.rows[0],
      cost
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Building upgrade error:", error);

    res.status(500).json({
      ok: false,
      error: "Building upgrade failed"
    });
  } finally {
    client.release();
  }
});


// =====================================================
// SPEEDUP BUILDING
// =====================================================

app.post("/api/player/:id/speedup-building", async (req, res) => {
  res.json({
    ok: true,
    message: "Building speedup system ready"
  });
});


// =====================================================
// TRAIN TROOPS
// =====================================================

app.post("/api/player/:id/train", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const type = String(req.body.type || "infantry");

    const troopAmount = 100;
    const foodCost = 500;
    const woodCost = 200;

    const result = await pool.query(
      `
      UPDATE players
      SET
        food = food - $1,
        wood = wood - $2,
        troops = troops + $3,
        power = power + $4
      WHERE id = $5
        AND food >= $1
        AND wood >= $2
      RETURNING *
      `,
      [
        foodCost,
        woodCost,
        troopAmount,
        troopAmount * 2,
        id
      ]
    );

    if (!result.rows.length) {
      return res.status(400).json({
        ok: false,
        error: "Not enough resources"
      });
    }

    res.json({
      ok: true,
      type,
      trained: troopAmount,
      player: result.rows[0]
    });

  } catch (error) {
    console.error("Train error:", error);

    res.status(500).json({
      ok: false,
      error: "Training failed"
    });
  }
});


// =====================================================
// SPEEDUP TRAINING
// =====================================================

app.post("/api/player/:id/speedup-training", async (req, res) => {
  res.json({
    ok: true,
    message: "Training speedup system ready"
  });
});


// =====================================================
// RESEARCH
// =====================================================

app.post("/api/player/:id/research", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const type = String(req.body.type || "technology");

    const result = await pool.query(
      `
      UPDATE players
      SET power = power + 200
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      type,
      player: result.rows[0]
    });

  } catch (error) {
    console.error("Research error:", error);

    res.status(500).json({
      ok: false,
      error: "Research failed"
    });
  }
});


// =====================================================
// RESEARCH LIST
// =====================================================

app.get("/api/player/:id/research", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
      ok: true,
      research: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load research"
    });
  }
});


// =====================================================
// SPEEDUP RESEARCH
// =====================================================

app.post("/api/player/:id/speedup-research", async (req, res) => {
  res.json({
    ok: true,
    message: "Research speedup system ready"
  });
});


// =====================================================
// PROFILE
// =====================================================

app.get("/api/player/:id/profile", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT
        id,
        name,
        power,
        castle_level,
        castle_stars,
        commander_level,
        commander_xp,
        troops,
        x,
        y
      FROM players
      WHERE id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      profile: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load profile"
    });
  }
});


// =====================================================
// HEROES
// =====================================================

app.get("/api/player/:id/heroes", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
      ok: true,
      heroes: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load heroes"
    });
  }
});


// =====================================================
// UPGRADE HERO
// =====================================================

app.post("/api/player/:id/heroes/:heroId/upgrade", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const heroId = Number(req.params.heroId);

    const result = await pool.query(
      `
      UPDATE heroes
      SET
        level = level + 1,
        power = power + 100
      WHERE id = $1
        AND player_id = $2
      RETURNING *
      `,
      [heroId, playerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Hero not found"
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
      ok: true,
      hero: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Hero upgrade failed"
    });
  }
});


// =====================================================
// BEHEMOTHS - البھيثومي
// =====================================================

app.get("/api/player/:id/behemoths", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
      ok: true,
      behemoths: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load behemoths"
    });
  }
});


// =====================================================
// UPGRADE BEHEMOTH
// =====================================================

app.post(
  "/api/player/:id/behemoths/:behemothId/upgrade",
  async (req, res) => {
    try {
      const playerId = Number(req.params.id);
      const behemothId = Number(req.params.behemothId);

      const result = await pool.query(
        `
        UPDATE behemoths
        SET
          level = level + 1,
          power = power + 250
        WHERE id = $1
          AND player_id = $2
        RETURNING *
        `,
        [behemothId, playerId]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          ok: false,
          error: "Behemoth not found"
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
        ok: true,
        behemoth: result.rows[0]
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        error: "Behemoth upgrade failed"
      });
    }
  }
);


// =====================================================
// TALENTS
// =====================================================

app.get("/api/player/:id/talents", async (req, res) => {
  try {
    const id = Number(req.params.id);

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
      ok: true,
      talents: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load talents"
    });
  }
});


app.post("/api/player/:id/talents/:type/upgrade", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const type = String(req.params.type);

    const result = await pool.query(
      `
      UPDATE talents
      SET level = level + 1
      WHERE player_id = $1
        AND type = $2
      RETURNING *
      `,
      [playerId, type]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Talent not found"
      });
    }

    res.json({
      ok: true,
      talent: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Talent upgrade failed"
    });
  }
});


// =====================================================
// AIRCRAFT
// =====================================================

app.get("/api/player/:id/aircraft", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT *
      FROM aircraft
      WHERE player_id = $1
      `,
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Aircraft not found"
      });
    }

    res.json({
      ok: true,
      aircraft: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load aircraft"
    });
  }
});


app.post("/api/player/:id/aircraft/upgrade", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const result = await pool.query(
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

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Aircraft not found"
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
      ok: true,
      aircraft: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Aircraft upgrade failed"
    });
  }
});


// =====================================================
// ALLIANCES
// =====================================================

app.get("/api/alliances", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        a.*,
        COUNT(am.player_id)::INTEGER AS members
      FROM alliances a
      LEFT JOIN alliance_members am
        ON a.id = am.alliance_id
      GROUP BY a.id
      ORDER BY a.power DESC
      `
    );

    res.json({
      ok: true,
      alliances: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load alliances"
    });
  }
});


// =====================================================
// CREATE ALLIANCE
// =====================================================

app.post("/api/alliances", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const leaderId = Number(req.body.leaderId);

    if (!name || !leaderId) {
      return res.status(400).json({
        ok: false,
        error: "Alliance name and leader are required"
      });
    }

    const result = await pool.query(
      `
      INSERT INTO alliances
      (name, leader_id, power)
      VALUES ($1, $2, 1000)
      RETURNING *
      `,
      [name, leaderId]
    );

    await pool.query(
      `
      INSERT INTO alliance_members
      (alliance_id, player_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [
        result.rows[0].id,
        leaderId
      ]
    );

    res.json({
      ok: true,
      alliance: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Alliance creation failed"
    });
  }
});


// =====================================================
// ALLIANCE DETAIL
// =====================================================

app.get("/api/alliances/:id", async (req, res) => {
  try {
    const allianceId = Number(req.params.id);

    const alliance = await pool.query(
      `
      SELECT *
      FROM alliances
      WHERE id = $1
      `,
      [allianceId]
    );

    if (!alliance.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Alliance not found"
      });
    }

    const members = await pool.query(
      `
      SELECT
        p.id,
        p.name,
        p.power,
        p.castle_level,
        p.castle_stars
      FROM alliance_members am
      JOIN players p
        ON p.id = am.player_id
      WHERE am.alliance_id = $1
      ORDER BY p.power DESC
      `,
      [allianceId]
    );

    res.json({
      ok: true,
      alliance: alliance.rows[0],
      members: members.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load alliance"
    });
  }
});


// =====================================================
// JOIN ALLIANCE
// =====================================================

app.post("/api/player/:id/alliance/join", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const allianceId = Number(req.body.allianceId);

    if (!allianceId) {
      return res.status(400).json({
        ok: false,
        error: "Alliance ID required"
      });
    }

    const alliance = await pool.query(
      `
      SELECT *
      FROM alliances
      WHERE id = $1
      `,
      [allianceId]
    );

    if (!alliance.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Alliance not found"
      });
    }

    await pool.query(
      `
      INSERT INTO alliance_members
      (alliance_id, player_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [allianceId, playerId]
    );

    res.json({
      ok: true,
      message: "Joined alliance"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to join alliance"
    });
  }
});


// =====================================================
// RANKINGS
// =====================================================

app.get("/api/rankings/all", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        power,
        castle_level,
        castle_stars,
        troops
      FROM players
      ORDER BY power DESC
      LIMIT 100
      `
    );

    res.json({
      ok: true,
      rankings: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load rankings"
    });
  }
});


// =====================================================
// WORLD
// =====================================================

app.get("/api/world", async (req, res) => {
  try {
    const players = await pool.query(
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
      `
    );

    const zombies = await pool.query(
      `
      SELECT *
      FROM zombies
      `
    );

    const forts = await pool.query(
      `
      SELECT *
      FROM forts
      `
    );

    res.json({
      ok: true,
      players: players.rows,
      zombies: zombies.rows,
      forts: forts.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load world"
    });
  }
});


// =====================================================
// MOVE PLAYER
// =====================================================

app.post("/api/player/:id/move", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const x = Number(req.body.x);
    const y = Number(req.body.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid coordinates"
      });
    }

    const result = await pool.query(
      `
      UPDATE players
      SET
        x = $1,
        y = $2
      WHERE id = $3
      RETURNING *
      `,
      [x, y, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    io.emit("playerMoved", {
      id,
      x,
      y
    });

    res.json({
      ok: true,
      player: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Move failed"
    });
  }
});


// =====================================================
// MARCH
// =====================================================

app.post("/api/player/:id/march", async (req, res) => {
  const client = await pool.connect();

  try {
    const playerId = Number(req.params.id);
    const targetX = Number(req.body.x);
    const targetY = Number(req.body.y);
    const troops = Math.max(
      1,
      Number(req.body.troops || 100)
    );

    await client.query("BEGIN");

    const playerResult = await client.query(
      `
      SELECT *
      FROM players
      WHERE id = $1
      FOR UPDATE
      `,
      [playerId]
    );

    if (!playerResult.rows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        ok: false,
        error: "Player not found"
      });
    }

    const player = playerResult.rows[0];

    if (Number(player.troops) < troops) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        ok: false,
        error: "Not enough troops"
      });
    }

    await client.query(
      `
      UPDATE players
      SET troops = troops - $1
      WHERE id = $2
      `,
      [troops, playerId]
    );

    const marchResult = await client.query(
      `
      INSERT INTO marches
      (player_id, target_x, target_y, troops, status)
      VALUES ($1, $2, $3, $4, 'marching')
      RETURNING *
      `,
      [
        playerId,
        targetX,
        targetY,
        troops
      ]
    );

    await client.query("COMMIT");

    const march = marchResult.rows[0];

    io.emit("marchStarted", {
      id: march.id,
      playerId,
      targetX,
      targetY,
      troops
    });

    res.json({
      ok: true,
      march
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error("March error:", error);

    res.status(500).json({
      ok: false,
      error: "March failed"
    });
  } finally {
    client.release();
  }
});


// =====================================================
// REPORTS
// =====================================================

app.get("/api/reports/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);

    const result = await pool.query(
      `
      SELECT *
      FROM battle_reports
      WHERE player_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [playerId]
    );

    res.json({
      ok: true,
      reports: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Failed to load reports"
    });
  }
});


// =====================================================
// SOCKET.IO
// =====================================================

io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  socket.on("joinGame", data => {
    console.log("Player joined game:", data);

    socket.join("game");

    socket.emit("gameJoined", {
      ok: true
    });
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});


// =====================================================
// PROCESS MARCHES
// =====================================================

async function processMarches() {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM marches
      WHERE status = 'marching'
        AND started_at <= NOW() - INTERVAL '10 seconds'
      `
    );

    for (const march of result.rows) {
      const playerId = march.player_id;

      const enemyPower = Math.max(
        100,
        Number(march.troops) * 2
      );

      const playerResult = await pool.query(
        `
        SELECT power
        FROM players
        WHERE id = $1
        `,
        [playerId]
      );

      if (!playerResult.rows.length) {
        continue;
      }

      const playerPower = Number(
        playerResult.rows[0].power
      );

      const won = playerPower >= enemyPower;

      const resultText = won
        ? "Victory"
        : "Defeat";

      const powerChange = won
        ? Math.floor(Number(march.troops) * 3)
        : -Math.floor(Number(march.troops));

      if (won) {
        await pool.query(
          `
          UPDATE players
          SET power = GREATEST(0, power + $1)
          WHERE id = $2
          `,
          [powerChange, playerId]
        );
      }

      await pool.query(
        `
        INSERT INTO battle_reports
        (player_id, result, enemy, power_change)
        VALUES ($1, $2, $3, $4)
        `,
        [
          playerId,
          resultText,
          `Enemy at ${march.target_x},${march.target_y}`,
          powerChange
        ]
      );

      await pool.query(
        `
        UPDATE marches
        SET
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [march.id]
      );

      io.emit("battleFinished", {
        marchId: march.id,
        playerId,
        result: resultText,
        powerChange
      });
    }

  } catch (error) {
    console.error("Process marches error:", error);
  }
}


// =====================================================
// START SERVER
// =====================================================

async function start() {
  try {
    await initDatabase();

    server.listen(PORT, () => {
      console.log(
        `Kardous Survival server running on port ${PORT}`
      );
    });

    setInterval(processMarches, 5000);

  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
}

start();
