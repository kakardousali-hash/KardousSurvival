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

  // إضافة troops للاعبين القدامى إذا كان الجدول موجودًا من قبل
  await query(`
    ALTER TABLE players
    ADD COLUMN IF NOT EXISTS troops INTEGER DEFAULT 0
  `);

  const player = await query(
    `SELECT id FROM players WHERE id = 1`
  );

  if (player.rows.length === 0) {
    await query(`
      INSERT INTO players
      (id, name, power, castle_level, food, wood, iron, gold, troops)
      VALUES
      (1, 'Kardous', 1000, 1, 5000, 5000, 1000, 500, 0)
    `);

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
        `INSERT INTO heroes
        (player_id, name, level, power, skill_level)
        VALUES ($1, $2, 1, 100, 1)`,
        [1, name]
      );
    }

    const behemoths = [
      "T-Rex",
      "Giant Monkey",
      "Lion",
      "Thunder Bird"
    ];

    for (const name of behemoths) {
      await query(
        `INSERT INTO behemoths
        (player_id, name, level, power)
        VALUES ($1, $2, 1, 500)`,
        [1, name]
      );
    }
  }

  const zombies = await query(
    `SELECT COUNT(*) FROM zombies`
  );

  if (Number(zombies.rows[0].count) === 0) {
    for (let i = 0; i < 20; i++) {
      await query(
        `INSERT INTO zombies
        (level, power, x, y)
        VALUES ($1, $2, $3, $4)`,
        [1 + (i % 5), 100 + i * 25, i * 5, i * 3]
      );
    }
  }

  const forts = await query(
    `SELECT COUNT(*) FROM forts`
  );

  if (Number(forts.rows[0].count) === 0) {
    for (let i = 0; i < 5; i++) {
      await query(
        `INSERT INTO forts
        (level, power, x, y)
        VALUES ($1, $2, $3, $4)`,
        [1 + i, 1000 + i * 500, 20 + i * 10, 20 + i * 5]
      );
    }
  }
}

app.get("/api/status", async (req, res) => {
  try {
    await query("SELECT 1");

    res.json({
      ok: true,
      database: "PostgreSQL / Neon",
      version: "12.0",
      game: "Kardous Survival"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

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

app.post("/api/register", async (req, res) => {
  try {
    const name = String(
      req.body.name || "Player"
    ).trim();

    const result = await query(
      `INSERT INTO players
       (name, power, castle_level, food, wood, iron, gold, troops)
       VALUES ($1, 1000, 1, 5000, 5000, 1000, 500, 0)
       RETURNING *`,
      [name]
    );

    const player = result.rows[0];

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

    for (const hero of heroes) {
      await query(
        `INSERT INTO heroes
         (player_id, name, level, power, skill_level)
         VALUES ($1, $2, 1, 100, 1)`,
        [player.id, hero]
      );
    }

    for (const name of [
      "T-Rex",
      "Giant Monkey",
      "Lion",
      "Thunder Bird"
    ]) {
      await query(
        `INSERT INTO behemoths
         (player_id, name, level, power)
         VALUES ($1, $2, 1, 500)`,
        [player.id, name]
      );
    }

    // الإصلاح المهم:
    res.json({
      ok: true,
      player: player
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/collect", async (req, res) => {
  try {
    const result = await query(
      `UPDATE players
       SET food = food + 500,
           wood = wood + 500,
           iron = iron + 100,
           gold = gold + 50
       WHERE id = $1
       RETURNING *`,
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
    const nextLevel =
      Number(player.castle_level) + 1;

    if (nextLevel > 30) {
      return res.status(400).json({
        error: "Maximum castle level reached"
      });
    }

    const costFood = nextLevel * 1000;
    const costWood = nextLevel * 1000;
    const costIron = nextLevel * 250;

    if (
      Number(player.food) < costFood ||
      Number(player.wood) < costWood ||
      Number(player.iron) < costIron
    ) {
      return res.status(400).json({
        error: "Not enough resources"
      });
    }

    const result = await query(
      `UPDATE players
       SET castle_level = castle_level + 1,
           power = power + 500,
           food = food - $1,
           wood = wood - $2,
           iron = iron - $3
       WHERE id = $4
       RETURNING *`,
      [
        costFood,
        costWood,
        costIron,
        req.params.id
      ]
    );

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

app.post("/api/player/:id/speedup-building", async (req, res) => {
  res.json({
    ok: true,
    message: "Building speedup applied"
  });
});

app.post("/api/player/:id/train", async (req, res) => {
  try {
    const troops = Math.max(
      1,
      num(req.body.troops) || 100
    );

    const result = await query(
      `UPDATE players
       SET troops = troops + $1,
           power = power + ($1 * 10)
       WHERE id = $2
       RETURNING *`,
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
      troops: troops,
      player: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/speedup-training", async (req, res) => {
  res.json({
    ok: true,
    message: "Training speedup applied"
  });
});

app.post("/api/player/:id/research", async (req, res) => {
  try {
    const result = await query(
      `UPDATE players
       SET power = power + 200
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Player not found"
      });
    }

    res.json({
      ok: true,
      research: req.body.name || "Research",
      player: result.rows[0]
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/speedup-research", async (req, res) => {
  res.json({
    ok: true,
    message: "Research speedup applied"
  });
});

app.get("/api/player/:id/profile", async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, power, castle_level,
              castle_stars, commander_level,
              commander_xp, x, y, troops
       FROM players
       WHERE id = $1`,
      [req.params.id]
    );

    res.json(result.rows[0] || {});
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/player/:id/heroes", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM heroes
       WHERE player_id = $1
       ORDER BY id`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/heroes/:heroId/upgrade", async (req, res) => {
  try {
    const result = await query(
      `UPDATE heroes
       SET level = level + 1,
           power = power + 100,
           skill_level = skill_level + 1
       WHERE id = $1
       AND player_id = $2
       RETURNING *`,
      [
        req.params.heroId,
        req.params.id
      ]
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

app.get("/api/player/:id/behemoths", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM behemoths
       WHERE player_id = $1
       ORDER BY id`,
      [req.params.id]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/behemoths/:behemothId/upgrade", async (req, res) => {
  try {
    const result = await query(
      `UPDATE behemoths
       SET level = level + 1,
           power = power + 250
       WHERE id = $1
       AND player_id = $2
       RETURNING *`,
      [
        req.params.behemothId,
        req.params.id
      ]
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

app.get("/api/alliances", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM alliances
       ORDER BY power DESC`
    );

    res.json(result.rows);
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
    );

    const tag = String(
      req.body.tag || "KDS"
    );

    const playerId = req.body.playerId;

    const result = await query(
      `INSERT INTO alliances
       (name, tag, power)
       VALUES ($1, $2, 1000)
       RETURNING *`,
      [name, tag]
    );

    const alliance = result.rows[0];

    if (playerId) {
      await query(
        `INSERT INTO alliance_members
         (alliance_id, player_id, rank)
         VALUES ($1, $2, 'leader')`,
        [
          alliance.id,
          playerId
        ]
      );
    }

    res.json(alliance);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/alliance/:id", async (req, res) => {
  try {
    const alliance = await query(
      `SELECT * FROM alliances
       WHERE id = $1`,
      [req.params.id]
    );

    const members = await query(
      `SELECT p.id, p.name, p.power, am.rank
       FROM alliance_members am
       JOIN players p
       ON p.id = am.player_id
       WHERE am.alliance_id = $1`,
      [req.params.id]
    );

    res.json({
      alliance: alliance.rows[0] || null,
      members: members.rows
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/alliance/join", async (req, res) => {
  try {
    await query(
      `INSERT INTO alliance_members
       (alliance_id, player_id, rank)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [
        req.body.allianceId,
        req.params.id
      ]
    );

    res.json({
      ok: true
    });

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/rankings/all", async (req, res) => {
  try {
    const kingdom = await query(`
      SELECT id, name, power, castle_level
      FROM players
      ORDER BY power DESC
      LIMIT 100
    `);

    const heroes = await query(`
      SELECT id, name, level, power
      FROM heroes
      ORDER BY power DESC
      LIMIT 100
    `);

    const behemoths = await query(`
      SELECT id, name, level, power
      FROM behemoths
      ORDER BY power DESC
      LIMIT 100
    `);

    const alliances = await query(`
      SELECT id, name, tag, power
      FROM alliances
      ORDER BY power DESC
      LIMIT 100
    `);

    res.json({
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

app.get("/api/world", async (req, res) => {
  try {
    const zombies = await query(
      `SELECT * FROM zombies
       ORDER BY id`
    );

    const forts = await query(
      `SELECT * FROM forts
       ORDER BY id`
    );

    const players = await query(`
      SELECT id, name, power, castle_level,
             x, y, troops
      FROM players
    `);

    const marches = await query(`
      SELECT * FROM marches
      WHERE status = 'marching'
    `);

    res.json({
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

app.post("/api/player/:id/move", async (req, res) => {
  try {
    const x = num(req.body.x);
    const y = num(req.body.y);

    const result = await query(
      `UPDATE players
       SET x = $1, y = $2
       WHERE id = $3
       RETURNING *`,
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

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/api/player/:id/march", async (req, res) => {
  try {
    const targetType = String(
      req.body.targetType || "zombie"
    );

    const targetId = num(
      req.body.targetId
    );

    const troops = Math.max(
      1,
      num(req.body.troops) || 10
    );

    const result = await query(
      `INSERT INTO marches
       (player_id, target_type, target_id,
        troops, status)
       VALUES ($1, $2, $3, $4, 'marching')
       RETURNING *`,
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

    res.json(result.rows[0]);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/reports/:playerId", async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM battle_reports
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.params.playerId]
    );

    res.json(result.rows);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

io.on("connection", socket => {
  socket.emit("connected", {
    ok: true,
    game: "Kardous Survival"
  });

  socket.on("joinGame", data => {
    if (data && data.playerId) {
      socket.join(
        `player_${data.playerId}`
      );
    }
  });
});

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
      const casualties = Math.floor(
        Number(march.troops) * 0.1
      );

      const battleResult =
        Number(march.troops) > casualties
          ? "victory"
          : "defeat";

      await query(
        `UPDATE marches
         SET status = 'completed'
         WHERE id = $1`,
        [march.id]
      );

      await query(
        `INSERT INTO battle_reports
         (player_id, result, target_type,
          target_id, troops_sent, casualties)
         VALUES ($1, $2, $3, $4, $5, $6)`,
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
