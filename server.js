const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Pool } = require("pg");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is missing");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(express.static(__dirname));

async function query(text, params = []) {
  return pool.query(text, params);
}

function num(value) {
  return Number(value || 0);
}

/* =========================
   CASTLE CONFIG
========================= */

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

/* =========================
   BUILDINGS CONFIG
========================= */

const BUILDING_CONFIG = {
  barracks: {
    name: "الثكنة",
    icon: "⚔️",
    description: "تدريب وتطوير القوات",
    basePower: 150
  },

  hospital: {
    name: "المستشفى",
    icon: "🏥",
    description: "علاج القوات المصابة",
    basePower: 120
  },

  farm: {
    name: "مزرعة الطعام",
    icon: "🌾",
    description: "إنتاج الطعام",
    basePower: 100
  },

  lumbermill: {
    name: "منشرة الخشب",
    icon: "🪵",
    description: "إنتاج الخشب",
    basePower: 100
  },

  ironmine: {
    name: "منجم الحديد",
    icon: "⛓️",
    description: "إنتاج الحديد",
    basePower: 130
  },

  goldmine: {
    name: "منجم الذهب",
    icon: "🪙",
    description: "إنتاج الذهب",
    basePower: 180
  },

  research: {
    name: "مركز الأبحاث",
    icon: "🔬",
    description: "تطوير التقنيات",
    basePower: 200
  },

  warehouse: {
    name: "المستودع",
    icon: "📦",
    description: "حماية وتخزين الموارد",
    basePower: 120
  }
};

function getBuildingCost(level) {
  return {
    food: level * 1200,
    wood: level * 1400,
    iron: level * 400,
    gold: level * 150
  };
}

function getBuildingPower(level, type) {
  const base =
    BUILDING_CONFIG[type]?.basePower || 100;

  return base + level * 75;
}

/* =========================
   DATABASE
========================= */

async function initDatabase() {

  await query(`
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
    );

    CREATE TABLE IF NOT EXISTS heroes (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      skill_level INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS behemoths (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 500
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      UNIQUE(player_id, type)
    );

    CREATE TABLE IF NOT EXISTS alliances (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      power BIGINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alliance_members (
      alliance_id INTEGER REFERENCES alliances(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      rank TEXT DEFAULT 'member',
      PRIMARY KEY (alliance_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS zombies (
      id SERIAL PRIMARY KEY,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 100,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forts (
      id SERIAL PRIMARY KEY,
      level INTEGER DEFAULT 1,
      power BIGINT DEFAULT 1000,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS marches (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      target_type TEXT,
      target_id INTEGER,
      troops INTEGER DEFAULT 0,
      status TEXT DEFAULT 'marching',
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS battle_reports (
      id SERIAL PRIMARY KEY,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      result TEXT,
      target_type TEXT,
      target_id INTEGER,
      troops_sent INTEGER DEFAULT 0,
      casualties INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    ALTER TABLE players
    ADD COLUMN IF NOT EXISTS troops INTEGER DEFAULT 0
  `);

  await query(`
    ALTER TABLE players
    ADD COLUMN IF NOT EXISTS castle_stars INTEGER DEFAULT 0
  `);

  /* =========================
     DEFAULT PLAYER
  ========================= */

  const player = await query(
    `SELECT id FROM players WHERE id = 1`
  );

  if (player.rows.length === 0) {

    await query(`
      INSERT INTO players
      (
        id,
        name,
        power,
        castle_level,
        castle_stars,
        food,
        wood,
        iron,
        gold,
        troops
      )
      VALUES
      (
        1,
        'Kardous',
        1000,
        1,
        0,
        5000,
        5000,
        1000,
        500,
        0
      )
    `);

    await createStartingHeroes(1);
    await createStartingBehemoths(1);
    await createStartingBuildings(1);
  }

  /* =========================
     EXISTING PLAYERS
  ========================= */

  const playersResult = await query(
    `SELECT id FROM players`
  );

  for (const p of playersResult.rows) {
    await createStartingBuildings(p.id);
  }

  /* =========================
     ZOMBIES
  ========================= */

  const zombies = await query(
    `SELECT COUNT(*) FROM zombies`
  );

  if (Number(zombies.rows[0].count) === 0) {

    for (let i = 0; i < 20; i++) {

      await query(
        `
        INSERT INTO zombies
        (
          level,
          power,
          x,
          y
        )
        VALUES
        ($1,$2,$3,$4)
        `,
        [
          1 + (i % 5),
          100 + i * 25,
          i * 5,
          i * 3
        ]
      );
    }
  }

  /* =========================
     FORTS
  ========================= */

  const forts = await query(
    `SELECT COUNT(*) FROM forts`
  );

  if (Number(forts.rows[0].count) === 0) {

    for (let i = 0; i < 5; i++) {

      await query(
        `
        INSERT INTO forts
        (
          level,
          power,
          x,
          y
        )
        VALUES
        ($1,$2,$3,$4)
        `,
        [
          1 + i,
          1000 + i * 500,
          20 + i * 10,
          20 + i * 5
        ]
      );
    }
  }
}

/* =========================
   STARTING DATA
========================= */

async function createStartingHeroes(playerId) {

  const heroes = [
    "Kairo",
    "Raven",
    "Luna",
    "Drake",
    "Nova",
    "Axel",
    "Mira",
    "Rex",
    "Vega",
    "Zane",
    "Aria",
    "Blaze",
    "Nora",
    "Damon",
    "Iris",
    "Titan",
    "Echo",
    "Skye",
    "Orion",
    "Kira"
  ];

  for (const name of heroes) {

    await query(
      `
      INSERT INTO heroes
      (
        player_id,
        name,
        level,
        power,
        skill_level
      )
      VALUES
      ($1,$2,1,100,1)
      ON CONFLICT DO NOTHING
      `,
      [playerId, name]
    );
  }
}

async function createStartingBehemoths(playerId) {

  const behemoths = [
    "البهيثومي الأول",
    "البهيثومي العملاق",
    "البهيثومي الأسد",
    "البهيثومي الرعد"
  ];

  for (const name of behemoths) {

    await query(
      `
      INSERT INTO behemoths
      (
        player_id,
        name,
        level,
        power
      )
      VALUES
      ($1,$2,1,500)
      `,
      [playerId, name]
    );
  }
}

async function createStartingBuildings(playerId) {

  for (const type of Object.keys(BUILDING_CONFIG)) {

    await query(
      `
      INSERT INTO buildings
      (
        player_id,
        type,
        level,
        power
      )
      VALUES
      ($1,$2,1,$3)
      ON CONFLICT (player_id,type)
      DO NOTHING
      `,
      [
        playerId,
        type,
        getBuildingPower(1, type)
      ]
    );
  }
}

/* =========================
   STATUS
========================= */

app.get("/api/status", async (req, res) => {

  try {

    await query("SELECT 1");

    res.json({
      ok: true,
      database: "PostgreSQL / Neon",
      version: "14.0",
      game: "Kardous Survival"
    });

  } catch (error) {

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/* =========================
   PLAYER
========================= */

app.get("/api/player/:id", async (req, res) => {

  try {

    const result = await query(
      `SELECT * FROM players WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});

/* =========================
   CASTLE INFO
========================= */

app.get("/api/player/:id/castle", async (req, res) => {

  try {

    const result = await query(
      `
      SELECT
        id,
        name,
        power,
        castle_level,
        castle_stars,
        food,
        wood,
        iron,
        gold
      FROM players
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    const player = result.rows[0];

    const level =
      Number(player.castle_level || 1);

    const stars =
      Number(player.castle_stars || 0);

    let next = null;

    if (level < 30) {

      const nextLevel = level + 1;

      next = {
        type: "level",
        level: nextLevel,
        stars: 0,
        cost: getCastleLevelCost(nextLevel),
        powerGain: getCastleLevelPower(nextLevel)
      };

    } else if (stars < 5) {

      const nextStar = stars + 1;

      next = {
        type: "star",
        level: 30,
        stars: nextStar,
        cost: getStarCost(nextStar),
        powerGain: getStarPower(nextStar)
      };
    }

    const castle = {
      level,
      stars,
      power: Number(player.power || 0),
      next,
      max: level >= 30 && stars >= 5
    };

    res.json({
      ok: true,
      castle,
      current: {
        level,
        stars,
        power: Number(player.power || 0)
      },
      next,
      maximum: castle.max,
      player
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});

/* =========================
   REGISTER
========================= */

app.post("/api/register", async (req, res) => {

  try {

    const name = String(
      req.body.name || "Player"
    ).trim().slice(0, 20);

    if (!name) {

      return res.status(400).json({
        error: "Invalid player name"
      });
    }

    const result = await query(
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
        troops
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
        0
      )
      RETURNING *
      `,
      [name]
    );

    const player = result.rows[0];

    await createStartingHeroes(player.id);
    await createStartingBehemoths(player.id);
    await createStartingBuildings(player.id);

    res.json({
      ok: true,
      player
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});

/* =========================
   COLLECT
========================= */

app.post("/api/player/:id/collect", async (req, res) => {

  try {

    const result = await query(
      `
      UPDATE players
      SET
        food = food + 500,
        wood = wood + 500,
        iron = iron + 100,
        gold = gold + 50
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      player: result.rows[0]
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});

/* =====================================================
   CASTLE UPGRADE
===================================================== */

app.post("/api/player/:id/upgrade-castle", async (req, res) => {

  try {

    const playerResult = await query(
      `SELECT * FROM players WHERE id = $1`,
      [req.params.id]
    );

    if (playerResult.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    const player = playerResult.rows[0];

    const level =
      Number(player.castle_level || 1);

    const stars =
      Number(player.castle_stars || 0);

    if (level >= 30 && stars >= 5) {

      return res.status(400).json({
        error: "Maximum castle reached",
        message:
          "القلعة وصلت إلى المستوى 30 ⭐⭐⭐⭐⭐"
      });
    }

    if (level >= 30) {

      const nextStar = stars + 1;

      const cost =
        getStarCost(nextStar);

      const powerGain =
        getStarPower(nextStar);

      if (
        Number(player.food) < cost.food ||
        Number(player.wood) < cost.wood ||
        Number(player.iron) < cost.iron ||
        Number(player.gold) < cost.gold
      ) {

        return res.status(400).json({
          error: "Not enough resources",
          message:
            "الموارد غير كافية للنجمة التالية",
          cost
        });
      }

      const result = await query(
        `
        UPDATE players
        SET
          castle_level = 30,
          castle_stars = $1,
          power = power + $2,
          food = food - $3,
          wood = wood - $4,
          iron = iron - $5,
          gold = gold - $6
        WHERE id = $7
        RETURNING *
        `,
        [
          nextStar,
          powerGain,
          cost.food,
          cost.wood,
          cost.iron,
          cost.gold,
          req.params.id
        ]
      );

      return res.json({
        ok: true,
        type: "star",
        player: result.rows[0],
        message:
          `⭐ وصلت القلعة إلى النجمة ${nextStar}`,
        cost,
        powerGain
      });
    }

    const nextLevel = level + 1;

    const cost =
      getCastleLevelCost(nextLevel);

    const powerGain =
      getCastleLevelPower(nextLevel);

    if (
      Number(player.food) < cost.food ||
      Number(player.wood) < cost.wood ||
      Number(player.iron) < cost.iron ||
      Number(player.gold) < cost.gold
    ) {

      return res.status(400).json({
        error: "Not enough resources",
        message:
          "الموارد غير كافية لتطوير القلعة",
        cost
      });
    }

    const result = await query(
      `
      UPDATE players
      SET
        castle_level = $1,
        castle_stars = 0,
        power = power + $2,
        food = food - $3,
        wood = wood - $4,
        iron = iron - $5,
        gold = gold - $6
      WHERE id = $7
      RETURNING *
      `,
      [
        nextLevel,
        powerGain,
        cost.food,
        cost.wood,
        cost.iron,
        cost.gold,
        req.params.id
      ]
    );

    res.json({
      ok: true,
      type: "level",
      player: result.rows[0],
      message:
        `🏰 وصلت القلعة إلى المستوى ${nextLevel}`,
      cost,
      powerGain
    });

  } catch (error) {

    console.error(
      "Castle upgrade error:",
      error.message
    );

    res.status(500).json({
      error: error.message
    });
  }
});

/* =====================================================
   BUILDINGS
===================================================== */

/* GET BUILDINGS */

app.get("/api/player/:id/buildings", async (req, res) => {

  try {

    const result = await query(
      `
      SELECT *
      FROM buildings
      WHERE player_id = $1
      ORDER BY id
      `,
      [req.params.id]
    );

    const buildings =
      result.rows.map(building => {

        const type = building.type;
        const level = Number(building.level || 1);

        const config =
          BUILDING_CONFIG[type];

        return {
          id: building.id,
          type,
          name: config?.name || type,
          icon: config?.icon || "🏗️",
          description:
            config?.description || "",
          level,
          power: Number(building.power || 0),
          maxLevel: 30,
          next:
            level < 30
              ? {
                  level: level + 1,
                  cost:
                    getBuildingCost(level + 1),
                  powerGain:
                    getBuildingPower(
                      level + 1,
                      type
                    ) -
                    Number(building.power || 0)
                }
              : null
        };
      });

    res.json({
      ok: true,
      buildings
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* UPGRADE BUILDING */

app.post(
  "/api/player/:id/buildings/:buildingType/upgrade",
  async (req, res) => {

    try {

      const playerId =
        req.params.id;

      const type =
        req.params.buildingType;

      if (!BUILDING_CONFIG[type]) {

        return res.status(400).json({
          error: "Unknown building"
        });
      }

      const playerResult =
        await query(
          `SELECT * FROM players WHERE id = $1`,
          [playerId]
        );

      if (playerResult.rows.length === 0) {

        return res.status(404).json({
          error: "Player not found"
        });
      }

      const player =
        playerResult.rows[0];

      const buildingResult =
        await query(
          `
          SELECT *
          FROM buildings
          WHERE player_id = $1
          AND type = $2
          `,
          [
            playerId,
            type
          ]
        );

      if (buildingResult.rows.length === 0) {

        return res.status(404).json({
          error: "Building not found"
        });
      }

      const building =
        buildingResult.rows[0];

      const level =
        Number(building.level || 1);

      if (level >= 30) {

        return res.status(400).json({
          error: "Maximum building level reached",
          message:
            "وصل المبنى إلى المستوى 30"
        });
      }

      const nextLevel =
        level + 1;

      const cost =
        getBuildingCost(nextLevel);

      const oldPower =
        Number(building.power || 0);

      const newPower =
        getBuildingPower(
          nextLevel,
          type
        );

      const powerGain =
        newPower - oldPower;

      if (
        Number(player.food) < cost.food ||
        Number(player.wood) < cost.wood ||
        Number(player.iron) < cost.iron ||
        Number(player.gold) < cost.gold
      ) {

        return res.status(400).json({
          error: "Not enough resources",
          message:
            "الموارد غير كافية لتطوير المبنى",
          cost
        });
      }

      await query("BEGIN");

      try {

        const updatedBuilding =
          await query(
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
              nextLevel,
              newPower,
              playerId,
              type
            ]
          );

        const updatedPlayer =
          await query(
            `
            UPDATE players
            SET
              power = power + $1,
              food = food - $2,
              wood = wood - $3,
              iron = iron - $4,
              gold = gold - $5
            WHERE id = $6
            RETURNING *
            `,
            [
              powerGain,
              cost.food,
              cost.wood,
              cost.iron,
              cost.gold,
              playerId
            ]
          );

        await query("COMMIT");

        res.json({
          ok: true,
          building: updatedBuilding.rows[0],
          player: updatedPlayer.rows[0],
          message:
            `🏗️ تم تطوير ${BUILDING_CONFIG[type].name} إلى المستوى ${nextLevel}`,
          cost,
          powerGain
        });

      } catch (transactionError) {

        await query("ROLLBACK");

        throw transactionError;
      }

    } catch (error) {

      console.error(
        "Building upgrade error:",
        error.message
      );

      res.status(500).json({
        error: error.message
      });
    }
  }
);


/* BUILDING SPEEDUP */

app.post(
  "/api/player/:id/speedup-building",
  async (req, res) => {

    res.json({
      ok: true,
      message:
        "تم تسريع البناء"
    });
  }
);


/* =========================
   TRAIN
========================= */

app.post("/api/player/:id/train", async (req, res) => {

  try {

    const troops = Math.max(
      1,
      num(req.body.troops) || 100
    );

    const result = await query(
      `
      UPDATE players
      SET
        troops = troops + $1,
        power = power + ($1 * 10)
      WHERE id = $2
      RETURNING *
      `,
      [
        troops,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      troops,
      type: req.body.type || "soldier",
      player: result.rows[0]
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   TRAINING SPEEDUP
========================= */

app.post(
  "/api/player/:id/speedup-training",
  async (req, res) => {

    res.json({
      ok: true,
      message:
        "تم تسريع التدريب"
    });
  }
);


/* =========================
   RESEARCH
========================= */

app.post("/api/player/:id/research", async (req, res) => {

  try {

    const result = await query(
      `
      UPDATE players
      SET power = power + 200
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      research:
        req.body.name || req.body.type || "Research",
      player:
        result.rows[0]
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   RESEARCH SPEEDUP
========================= */

app.post(
  "/api/player/:id/speedup-research",
  async (req, res) => {

    res.json({
      ok: true,
      message:
        "تم تسريع البحث"
    });
  }
);


/* =========================
   PROFILE
========================= */

app.get("/api/player/:id/profile", async (req, res) => {

  try {

    const result = await query(
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
        troops
      FROM players
      WHERE id = $1
      `,
      [req.params.id]
    );

    res.json(
      result.rows[0] || {}
    );

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   HEROES
========================= */

app.get("/api/player/:id/heroes", async (req, res) => {

  try {

    const result = await query(
      `
      SELECT *
      FROM heroes
      WHERE player_id = $1
      ORDER BY id
      `,
      [req.params.id]
    );

    res.json({
      ok: true,
      heroes: result.rows
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


app.post(
  "/api/player/:id/heroes/:heroId/upgrade",
  async (req, res) => {

    try {

      const result = await query(
        `
        UPDATE heroes
        SET
          level = level + 1,
          power = power + 100,
          skill_level = skill_level + 1
        WHERE id = $1
        AND player_id = $2
        RETURNING *
        `,
        [
          req.params.heroId,
          req.params.id
        ]
      );

      res.json({
        ok: true,
        hero: result.rows[0] || null
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


/* =========================
   البهيثومي
========================= */

app.get(
  "/api/player/:id/behemoths",
  async (req, res) => {

    try {

      const result = await query(
        `
        SELECT *
        FROM behemoths
        WHERE player_id = $1
        ORDER BY id
        `,
        [req.params.id]
      );

      res.json({
        ok: true,
        behemoths: result.rows
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


app.post(
  "/api/player/:id/behemoths/:behemothId/upgrade",
  async (req, res) => {

    try {

      const result = await query(
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
          req.params.behemothId,
          req.params.id
        ]
      );

      res.json({
        ok: true,
        behemoth:
          result.rows[0] || null
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


/* =========================
   ALLIANCES
========================= */

app.get("/api/alliances", async (req, res) => {

  try {

    const result = await query(
      `
      SELECT
        a.*,
        COUNT(am.player_id) AS member_count
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

    res.status(500).json({
      error: error.message
    });
  }
});


app.post("/api/alliances", async (req, res) => {

  try {

    const name = String(
      req.body.name || "Kardous Alliance"
    ).trim();

    const tag = String(
      req.body.tag || "KDS"
    ).trim();

    const playerId =
      req.body.playerId;

    const result = await query(
      `
      INSERT INTO alliances
      (
        name,
        tag,
        power
      )
      VALUES
      ($1,$2,1000)
      RETURNING *
      `,
      [
        name,
        tag
      ]
    );

    const alliance =
      result.rows[0];

    if (playerId) {

      await query(
        `
        INSERT INTO alliance_members
        (
          alliance_id,
          player_id,
          rank
        )
        VALUES
        ($1,$2,'leader')
        ON CONFLICT DO NOTHING
        `,
        [
          alliance.id,
          playerId
        ]
      );
    }

    res.json({
      ok: true,
      alliance
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


app.get("/api/alliance/:id", async (req, res) => {

  try {

    const alliance =
      await query(
        `
        SELECT *
        FROM alliances
        WHERE id = $1
        `,
        [req.params.id]
      );

    const members =
      await query(
        `
        SELECT
          p.id,
          p.name,
          p.power,
          p.castle_level,
          p.castle_stars,
          am.rank
        FROM alliance_members am
        JOIN players p
        ON p.id = am.player_id
        WHERE am.alliance_id = $1
        `,
        [req.params.id]
      );

    res.json({
      ok: true,
      alliance:
        alliance.rows[0] || null,
      members:
        members.rows
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


app.post(
  "/api/player/:id/alliance/join",
  async (req, res) => {

    try {

      await query(
        `
        INSERT INTO alliance_members
        (
          alliance_id,
          player_id,
          rank
        )
        VALUES
        ($1,$2,'member')
        ON CONFLICT DO NOTHING
        `,
        [
          req.body.allianceId,
          req.params.id
        ]
      );

      res.json({
        ok: true,
        message:
          "تم الانضمام إلى التحالف"
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


/* =========================
   RANKINGS
========================= */

app.get("/api/rankings/all", async (req, res) => {

  try {

    const kingdom =
      await query(`
        SELECT
          id,
          name,
          power,
          castle_level,
          castle_stars
        FROM players
        ORDER BY power DESC
        LIMIT 100
      `);

    const heroes =
      await query(`
        SELECT
          id,
          name,
          level,
          power
        FROM heroes
        ORDER BY power DESC
        LIMIT 100
      `);

    const behemoths =
      await query(`
        SELECT
          id,
          name,
          level,
          power
        FROM behemoths
        ORDER BY power DESC
        LIMIT 100
      `);

    const alliances =
      await query(`
        SELECT
          id,
          name,
          tag,
          power
        FROM alliances
        ORDER BY power DESC
        LIMIT 100
      `);

    res.json({
      ok: true,
      kingdom: kingdom.rows,
      power: kingdom.rows,
      war: kingdom.rows,
      castle: kingdom.rows,
      hero: heroes.rows,
      heroes: heroes.rows,
      behemoth: behemoths.rows,
      alliancePower: alliances.rows,
      allianceWar: alliances.rows
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   WORLD
========================= */

app.get("/api/world", async (req, res) => {

  try {

    const zombies =
      await query(`
        SELECT *
        FROM zombies
        ORDER BY id
      `);

    const forts =
      await query(`
        SELECT *
        FROM forts
        ORDER BY id
      `);

    const players =
      await query(`
        SELECT
          id,
          name,
          power,
          castle_level,
          castle_stars,
          x,
          y,
          troops
        FROM players
      `);

    const marches =
      await query(`
        SELECT *
        FROM marches
        WHERE status = 'marching'
      `);

    res.json({
      ok: true,
      zombies: zombies.rows,
      forts: forts.rows,
      players: players.rows,
      marches: marches.rows
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   MOVE PLAYER
========================= */

app.post("/api/player/:id/move", async (req, res) => {

  try {

    const x = num(req.body.x);
    const y = num(req.body.y);

    const result = await query(
      `
      UPDATE players
      SET
        x = $1,
        y = $2
      WHERE id = $3
      RETURNING *
      `,
      [
        x,
        y,
        req.params.id
      ]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    io.emit("playerMoved", {
      id: Number(req.params.id),
      x,
      y
    });

    res.json({
      ok: true,
      player: result.rows[0]
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   MARCH
========================= */

app.post("/api/player/:id/march", async (req, res) => {

  try {

    const targetType =
      String(
        req.body.targetType || "zombie"
      );

    const targetId =
      num(req.body.targetId);

    const troops =
      Math.max(
        1,
        num(req.body.troops) || 10
      );

    const playerResult = await query(
      `
      SELECT troops
      FROM players
      WHERE id = $1
      `,
      [req.params.id]
    );

    if (playerResult.rows.length === 0) {

      return res.status(404).json({
        error: "Player not found"
      });
    }

    const available =
      Number(
        playerResult.rows[0].troops || 0
      );

    if (available < troops) {

      return res.status(400).json({
        error: "Not enough troops",
        message:
          "عدد القوات غير كافٍ"
      });
    }

    await query(
      `
      UPDATE players
      SET troops = troops - $1
      WHERE id = $2
      `,
      [
        troops,
        req.params.id
      ]
    );

    const result = await query(
      `
      INSERT INTO marches
      (
        player_id,
        target_type,
        target_id,
        troops,
        status
      )
      VALUES
      ($1,$2,$3,$4,'marching')
      RETURNING *
      `,
      [
        req.params.id,
        targetType,
        targetId,
        troops
      ]
    );

    io.emit(
      "marchStarted",
      result.rows[0]
    );

    res.json({
      ok: true,
      march: result.rows[0]
    });

  } catch (error) {

    res.status(500).json({
      error: error.message
    });
  }
});


/* =========================
   REPORTS
========================= */

app.get(
  "/api/reports/:playerId",
  async (req, res) => {

    try {

      const result = await query(
        `
        SELECT *
        FROM battle_reports
        WHERE player_id = $1
        ORDER BY created_at DESC
        LIMIT 100
        `,
        [req.params.playerId]
      );

      res.json({
        ok: true,
        reports: result.rows
      });

    } catch (error) {

      res.status(500).json({
        error: error.message
      });
    }
  }
);


/* =========================
   SOCKET.IO
========================= */

io.on("connection", socket => {

  socket.emit("connected", {
    ok: true,
    game: "Kardous Survival"
  });

  socket.on("joinGame", data => {

    if (
      data &&
      data.playerId
    ) {

      socket.join(
        `player_${data.playerId}`
      );
    }
  });

});


/* =========================
   PROCESS MARCHES
========================= */

async function processMarches() {

  try {

    const result = await query(`
      SELECT *
      FROM marches
      WHERE status = 'marching'
      ORDER BY started_at
      LIMIT 20
    `);

    for (const march of result.rows) {

      const casualties =
        Math.floor(
          Number(march.troops) * 0.1
        );

      const battleResult =
        Number(march.troops) > casualties
          ? "victory"
          : "defeat";

      await query(
        `
        UPDATE marches
        SET status = 'completed'
        WHERE id = $1
        `,
        [march.id]
      );

      await query(
        `
        INSERT INTO battle_reports
        (
          player_id,
          result,
          target_type,
          target_id,
          troops_sent,
          casualties
        )
        VALUES
        ($1,$2,$3,$4,$5,$6)
        `,
        [
          march.player_id,
          battleResult,
          march.target_type,
          march.target_id,
          march.troops,
          casualties
        ]
      );

      io.to(
        `player_${march.player_id}`
      ).emit(
        "battleFinished",
        {
          result: battleResult,
          casualties
        }
      );
    }

  } catch (error) {

    console.error(
      "March processor error:",
      error.message
    );
  }
}


/* =========================
   START
========================= */

async function start() {

  try {

    await initDatabase();

    server.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `🏰 Kardous Survival server running on port ${PORT}`
        );
      }
    );

    setInterval(
      processMarches,
      5000
    );

  } catch (error) {

    console.error(
      "Database initialization failed:"
    );

    console.error(error);

    process.exit(1);
  }
}

start();
