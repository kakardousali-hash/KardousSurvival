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
   DATABASE
========================= */

async function initDatabase() {

  await query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      kingdom INTEGER DEFAULT 1,
      x INTEGER DEFAULT 0,
      y INTEGER DEFAULT 0,
      castle INTEGER DEFAULT 1,
      power INTEGER DEFAULT 0,
      food INTEGER DEFAULT 10000,
      wood INTEGER DEFAULT 10000,
      iron INTEGER DEFAULT 5000,
      gold INTEGER DEFAULT 1000,
      troops INTEGER DEFAULT 0,

      commander_level INTEGER DEFAULT 1,
      commander_xp INTEGER DEFAULT 0,

      commander_weapon INTEGER DEFAULT 1,
      commander_armor INTEGER DEFAULT 1,
      commander_helmet INTEGER DEFAULT 1,
      commander_boots INTEGER DEFAULT 1,
      commander_talent INTEGER DEFAULT 1,

      castle_upgrade_end BIGINT DEFAULT 0,

      training_end BIGINT DEFAULT 0,
      training_amount INTEGER DEFAULT 0,

      training_speedups INTEGER DEFAULT 0,
      building_speedups INTEGER DEFAULT 0,
      research_speedups INTEGER DEFAULT 0,

      research_name TEXT DEFAULT '',
      research_end BIGINT DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS heroes (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL,
      hero_key TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      power INTEGER DEFAULT 100,
      skill_1 INTEGER DEFAULT 1,
      skill_2 INTEGER DEFAULT 1,
      skill_3 INTEGER DEFAULT 1,
      unlocked INTEGER DEFAULT 1,
      UNIQUE(player_id, hero_key)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS behemoths (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      power INTEGER DEFAULT 500,
      skill_1 INTEGER DEFAULT 1,
      skill_2 INTEGER DEFAULT 1,
      skill_3 INTEGER DEFAULT 1,
      active INTEGER DEFAULT 1,
      UNIQUE(player_id, type)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alliances (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      tag TEXT UNIQUE NOT NULL,
      kingdom INTEGER DEFAULT 1,
      leader_id INTEGER NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS alliance_members (
      id SERIAL PRIMARY KEY,
      alliance_id INTEGER NOT NULL,
      player_id INTEGER UNIQUE NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at BIGINT NOT NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS zombies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      power INTEGER DEFAULT 1000
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS forts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      level INTEGER DEFAULT 1,
      power INTEGER DEFAULT 5000
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS marches (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      troops INTEGER NOT NULL,

      start_x INTEGER NOT NULL,
      start_y INTEGER NOT NULL,

      target_x INTEGER NOT NULL,
      target_y INTEGER NOT NULL,

      start_time BIGINT NOT NULL,
      arrival_time BIGINT NOT NULL,

      status TEXT DEFAULT 'marching'
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS battle_reports (
      id SERIAL PRIMARY KEY,
      player_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      troops_sent INTEGER NOT NULL,
      result TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  /* اللاعب الأساسي */

  await query(`
    INSERT INTO players
    (id,name,kingdom,x,y,castle,power,food,wood,iron,gold,troops)
    VALUES
    (1,'Kardous',1,0,0,1,0,10000,10000,5000,1000,0)
    ON CONFLICT(id) DO NOTHING
  `);

  await query(`
    SELECT setval(
      pg_get_serial_sequence('players','id'),
      GREATEST(
        COALESCE((SELECT MAX(id) FROM players),1),
        1
      ),
      true
    )
  `);

  await createHeroes(1);
  await createBehemoths(1);

  /* الزومبي */

  const zombieCount =
    await query(`SELECT COUNT(*)::int AS count FROM zombies`);

  if (zombieCount.rows[0].count === 0) {

    for (let i = 1; i <= 20; i++) {

      const x = Math.floor(Math.random() * 1800) - 900;
      const y = Math.floor(Math.random() * 1800) - 900;

      await query(`
        INSERT INTO zombies
        (name,x,y,level,power)
        VALUES($1,$2,$3,$4,$5)
      `, [
        `Zombie ${i}`,
        x,
        y,
        Math.floor(Math.random() * 5) + 1,
        1000 + i * 500
      ]);
    }
  }

  /* الحصون */

  const fortCount =
    await query(`SELECT COUNT(*)::int AS count FROM forts`);

  if (fortCount.rows[0].count === 0) {

    for (let i = 1; i <= 5; i++) {

      const x = Math.floor(Math.random() * 1600) - 800;
      const y = Math.floor(Math.random() * 1600) - 800;

      await query(`
        INSERT INTO forts
        (name,x,y,level,power)
        VALUES($1,$2,$3,$4,$5)
      `, [
        `Fort ${i}`,
        x,
        y,
        i,
        i * 5000
      ]);
    }
  }
}

/* =========================
   HEROES
========================= */

const HEROES = [
  ["rayan","Rayan",150],
  ["nova","Nova",160],
  ["kael","Kael",170],
  ["mira","Mira",180],
  ["zane","Zane",190],
  ["lyra","Lyra",200],
  ["darius","Darius",210],
  ["aria","Aria",220],
  ["kairo","Kairo",230],
  ["selene","Selene",240],
  ["viktor","Viktor",250],
  ["nira","Nira",260],
  ["axel","Axel",270],
  ["tara","Tara",280],
  ["leon","Leon",290],
  ["maya","Maya",300],
  ["ronan","Ronan",310],
  ["elara","Elara",320],
  ["jax","Jax",330],
  ["sora","Sora",340]
];

async function createHeroes(playerId) {

  for (const hero of HEROES) {

    await query(`
      INSERT INTO heroes
      (player_id,hero_key,name,level,xp,power,skill_1,skill_2,skill_3,unlocked)
      VALUES($1,$2,$3,1,0,$4,1,1,1,1)
      ON CONFLICT(player_id,hero_key) DO NOTHING
    `, [
      playerId,
      hero[0],
      hero[1],
      hero[2]
    ]);
  }
}

/* =========================
   BEHEMOTHS
========================= */

const BEHEMOTHS = [
  ["trex","T-Rex",1000],
  ["monkey","القرد العملاق",900],
  ["lion","الأسد الملكي",950],
  ["bird","العصفور الحربي",850]
];

async function createBehemoths(playerId) {

  for (const b of BEHEMOTHS) {

    await query(`
      INSERT INTO behemoths
      (player_id,type,name,level,xp,power,skill_1,skill_2,skill_3,active)
      VALUES($1,$2,$3,1,0,$4,1,1,1,1)
      ON CONFLICT(player_id,type) DO NOTHING
    `, [
      playerId,
      b[0],
      b[1],
      b[2]
    ]);
  }
}

/* =========================
   PLAYER
========================= */

async function getPlayer(id) {

  const result =
    await query(
      `SELECT * FROM players WHERE id=$1`,
      [id]
    );

  return result.rows[0];
}

function commanderXP(level) {
  return level * 1000;
}

async function checkCommander(playerId) {

  const player = await getPlayer(playerId);

  if (!player) return;

  let level = num(player.commander_level);
  let xp = num(player.commander_xp);

  while (
    level < 60 &&
    xp >= commanderXP(level)
  ) {

    xp -= commanderXP(level);
    level++;
  }

  await query(`
    UPDATE players
    SET commander_level=$1,
        commander_xp=$2
    WHERE id=$3
  `, [
    level,
    xp,
    playerId
  ]);
}

async function finishTimers(playerId) {

  let player = await getPlayer(playerId);

  if (!player) return;

  const now = Date.now();

  /* القلعة */

  if (
    num(player.castle_upgrade_end) > 0 &&
    num(player.castle_upgrade_end) <= now
  ) {

    await query(`
      UPDATE players
      SET castle=LEAST(castle+1,30),
          power=power+1000,
          castle_upgrade_end=0
      WHERE id=$1
    `,[playerId]);
  }

  player = await getPlayer(playerId);

  /* التدريب */

  if (
    num(player.training_end) > 0 &&
    num(player.training_end) <= now
  ) {

    await query(`
      UPDATE players
      SET troops=troops+training_amount,
          power=power+training_amount,
          training_end=0,
          training_amount=0
      WHERE id=$1
    `,[playerId]);
  }

  player = await getPlayer(playerId);

  /* البحث */

  if (
    num(player.research_end) > 0 &&
    num(player.research_end) <= now
  ) {

    await query(`
      UPDATE players
      SET research_end=0,
          research_name='',
          power=power+500
      WHERE id=$1
    `,[playerId]);
  }

  await checkCommander(playerId);
}

/* =========================
   PUBLIC PLAYER
========================= */

async function publicPlayer(player) {

  if (!player) return null;

  const alliance =
    await query(`
      SELECT
        a.id,
        a.name,
        a.tag,
        am.role
      FROM alliance_members am
      JOIN alliances a
      ON a.id=am.alliance_id
      WHERE am.player_id=$1
      LIMIT 1
    `,[player.id]);

  return {

    id:num(player.id),
    name:player.name,
    kingdom:num(player.kingdom),

    x:num(player.x),
    y:num(player.y),

    castle:num(player.castle),
    power:num(player.power),

    food:num(player.food),
    wood:num(player.wood),
    iron:num(player.iron),
    gold:num(player.gold),

    troops:num(player.troops),

    commander:{
      name:"Kardous",
      level:num(player.commander_level),
      xp:num(player.commander_xp),

      talent:num(player.commander_talent),

      equipment:{
        weapon:num(player.commander_weapon),
        armor:num(player.commander_armor),
        helmet:num(player.commander_helmet),
        boots:num(player.commander_boots)
      }
    },

    alliance:alliance.rows[0] || null,

    castleUpgrade:{
      active:num(player.castle_upgrade_end) > Date.now(),
      endTime:num(player.castle_upgrade_end)
    },

    training:{
      active:num(player.training_end) > Date.now(),
      endTime:num(player.training_end),
      amount:num(player.training_amount)
    },

    speedups:{
      training:num(player.training_speedups),
      building:num(player.building_speedups),
      research:num(player.research_speedups)
    },

    research:{
      active:num(player.research_end) > Date.now(),
      name:player.research_name || "",
      endTime:num(player.research_end)
    }
  };
}

/* =========================
   REGISTER
========================= */

app.post("/api/register",async(req,res)=>{

  try {

    const name =
      String(req.body.name || "").trim();

    if (!name)
      return res.status(400).json({
        error:"اكتب اسم اللاعب."
      });

    let result =
      await query(
        `SELECT * FROM players WHERE name=$1`,
        [name]
      );

    let player=result.rows[0];

    if (!player) {

      const x =
        Math.floor(Math.random()*1800)-900;

      const y =
        Math.floor(Math.random()*1800)-900;

      result =
        await query(`
          INSERT INTO players
          (name,kingdom,x,y)
          VALUES($1,1,$2,$3)
          RETURNING *
        `,[name,x,y]);

      player=result.rows[0];

      await createHeroes(player.id);
      await createBehemoths(player.id);
    }

    res.json({
      success:true,
      player:await publicPlayer(player)
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"حدث خطأ في إنشاء اللاعب."
    });
  }
});

/* =========================
   PLAYER
========================= */

app.get("/api/player/:id",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await finishTimers(id);

    const player=await getPlayer(id);

    if (!player)
      return res.status(404).json({
        error:"اللاعب غير موجود."
      });

    res.json(
      await publicPlayer(player)
    );

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"خطأ في تحميل اللاعب."
    });
  }
});

/* =========================
   COLLECT
========================= */

app.post("/api/player/:id/collect",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await query(`
      UPDATE players
      SET food=food+1000,
          wood=wood+1000,
          iron=iron+500,
          gold=gold+100
      WHERE id=$1
    `,[id]);

    res.json({
      success:true,
      player:
        await publicPlayer(
          await getPlayer(id)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر جمع الموارد."
    });
  }
});

/* =========================
   CASTLE
========================= */

app.post("/api/player/:id/upgrade-castle",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await finishTimers(id);

    const player=await getPlayer(id);

    if (!player)
      return res.status(404).json({
        error:"اللاعب غير موجود."
      });

    if (num(player.castle)>=30)
      return res.status(400).json({
        error:"وصلت القلعة إلى المستوى 30."
      });

    if (num(player.castle_upgrade_end)>Date.now())
      return res.status(400).json({
        error:"ترقية القلعة جارية."
      });

    const level=num(player.castle)+1;

    const food=level*500;
    const wood=level*1000;
    const iron=level*600;
    const gold=level*250;

    if (
      num(player.food)<food ||
      num(player.wood)<wood ||
      num(player.iron)<iron ||
      num(player.gold)<gold
    )
      return res.status(400).json({
        error:"الموارد غير كافية."
      });

    const duration =
      (60+(level-1)*30)*1000;

    await query(`
      UPDATE players
      SET food=food-$1,
          wood=wood-$2,
          iron=iron-$3,
          gold=gold-$4,
          castle_upgrade_end=$5
      WHERE id=$6
    `,[
      food,
      wood,
      iron,
      gold,
      Date.now()+duration,
      id
    ]);

    res.json({
      success:true,
      player:
        await publicPlayer(
          await getPlayer(id)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر بدء ترقية القلعة."
    });
  }
});

/* =========================
   TRAIN
========================= */

app.post("/api/player/:id/train",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await finishTimers(id);

    const player=await getPlayer(id);

    if (!player)
      return res.status(404).json({
        error:"اللاعب غير موجود."
      });

    if (num(player.training_end)>Date.now())
      return res.status(400).json({
        error:"التدريب جارٍ."
      });

    if (num(player.food)<500)
      return res.status(400).json({
        error:"الطعام غير كافٍ."
      });

    await query(`
      UPDATE players
      SET food=food-500,
          training_end=$1,
          training_amount=100
      WHERE id=$2
    `,[
      Date.now()+30000,
      id
    ]);

    res.json({
      success:true,
      player:
        await publicPlayer(
          await getPlayer(id)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر بدء التدريب."
    });
  }
});

/* =========================
   RESEARCH
========================= */

app.post("/api/player/:id/research",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await finishTimers(id);

    const player=await getPlayer(id);

    if (!player)
      return res.status(404).json({
        error:"اللاعب غير موجود."
      });

    if (num(player.research_end)>Date.now())
      return res.status(400).json({
        error:"البحث جارٍ."
      });

    const food=1000;
    const wood=1500;
    const iron=800;
    const gold=300;

    if (
      num(player.food)<food ||
      num(player.wood)<wood ||
      num(player.iron)<iron ||
      num(player.gold)<gold
    )
      return res.status(400).json({
        error:"الموارد غير كافية."
      });

    const name =
      String(req.body.name || "Technology")
      .slice(0,80);

    await query(`
      UPDATE players
      SET food=food-$1,
          wood=wood-$2,
          iron=iron-$3,
          gold=gold-$4,
          research_name=$5,
          research_end=$6
      WHERE id=$7
    `,[
      food,
      wood,
      iron,
      gold,
      name,
      Date.now()+60000,
      id
    ]);

    res.json({
      success:true,
      player:
        await publicPlayer(
          await getPlayer(id)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر بدء البحث."
    });
  }
});

/* =========================
   HEROES
========================= */

app.get("/api/player/:id/heroes",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await createHeroes(id);

    const result =
      await query(`
        SELECT *
        FROM heroes
        WHERE player_id=$1
        ORDER BY id
      `,[id]);

    res.json({
      heroes:result.rows
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل الأبطال."
    });
  }
});

app.post("/api/player/:id/heroes/:heroId/upgrade",async(req,res)=>{

  try {

    const playerId=num(req.params.id);
    const heroId=num(req.params.heroId);

    const heroResult =
      await query(`
        SELECT *
        FROM heroes
        WHERE id=$1
        AND player_id=$2
      `,[
        heroId,
        playerId
      ]);

    const hero=heroResult.rows[0];

    if (!hero)
      return res.status(404).json({
        error:"البطل غير موجود."
      });

    const cost=num(hero.level)*500;

    const player=await getPlayer(playerId);

    if (num(player.food)<cost)
      return res.status(400).json({
        error:"الطعام غير كافٍ."
      });

    await query(`
      UPDATE players
      SET food=food-$1,
          power=power+100
      WHERE id=$2
    `,[cost,playerId]);

    await query(`
      UPDATE heroes
      SET level=level+1,
          power=power+100
      WHERE id=$1
    `,[heroId]);

    const updated =
      (await query(
        `SELECT * FROM heroes WHERE id=$1`,
        [heroId]
      )).rows[0];

    res.json({
      success:true,
      hero:updated,
      player:
        await publicPlayer(
          await getPlayer(playerId)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تطوير البطل."
    });
  }
});

/* =========================
   BEHEMOTHS
========================= */

app.get("/api/player/:id/behemoths",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await createBehemoths(id);

    const result =
      await query(`
        SELECT *
        FROM behemoths
        WHERE player_id=$1
        ORDER BY id
      `,[id]);

    res.json({
      behemoths:result.rows
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل البهيثومي."
    });
  }
});

app.post("/api/player/:id/behemoths/:behemothId/upgrade",async(req,res)=>{

  try {

    const playerId=num(req.params.id);
    const id=num(req.params.behemothId);

    const result =
      await query(`
        SELECT *
        FROM behemoths
        WHERE id=$1
        AND player_id=$2
      `,[
        id,
        playerId
      ]);

    const b=result.rows[0];

    if (!b)
      return res.status(404).json({
        error:"البهيثومي غير موجود."
      });

    const cost=num(b.level)*1000;

    const player=await getPlayer(playerId);

    if (num(player.food)<cost)
      return res.status(400).json({
        error:"الطعام غير كافٍ."
      });

    await query(`
      UPDATE players
      SET food=food-$1,
          power=power+200
      WHERE id=$2
    `,[cost,playerId]);

    await query(`
      UPDATE behemoths
      SET level=level+1,
          power=power+200
      WHERE id=$1
    `,[id]);

    const updated =
      (await query(
        `SELECT * FROM behemoths WHERE id=$1`,
        [id]
      )).rows[0];

    res.json({
      success:true,
      behemoth:updated,
      player:
        await publicPlayer(
          await getPlayer(playerId)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تطوير البهيثومي."
    });
  }
});

/* =========================
   MOVE
========================= */

app.post("/api/player/:id/move",async(req,res)=>{

  try {

    const id=num(req.params.id);

    const x=num(req.body.x);
    const y=num(req.body.y);

    await query(`
      UPDATE players
      SET x=$1,y=$2
      WHERE id=$3
    `,[
      x,
      y,
      id
    ]);

    res.json({
      success:true,
      player:
        await publicPlayer(
          await getPlayer(id)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحريك المدينة."
    });
  }
});

/* =========================
   WORLD
========================= */

app.get("/api/world",async(req,res)=>{

  try {

    const players =
      (await query(`
        SELECT id,name,kingdom,x,y,castle,power,troops
        FROM players
      `)).rows;

    const zombies =
      (await query(
        `SELECT * FROM zombies ORDER BY id`
      )).rows;

    const forts =
      (await query(
        `SELECT * FROM forts ORDER BY id`
      )).rows;

    const marches =
      (await query(`
        SELECT m.*,
               p.name AS player_name
        FROM marches m
        LEFT JOIN players p
        ON p.id=m.player_id
        WHERE m.status='marching'
      `)).rows;

    res.json({
      players,
      zombies,
      forts,
      marches
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل العالم."
    });
  }
});

/* =========================
   MARCH
========================= */

app.post("/api/player/:id/march",async(req,res)=>{

  try {

    const playerId=num(req.params.id);

    const targetType=
      String(req.body.targetType || "");

    const targetId=num(req.body.targetId);

    const troops=num(req.body.troops);

    const player=await getPlayer(playerId);

    if (!player)
      return res.status(404).json({
        error:"اللاعب غير موجود."
      });

    if (troops<=0)
      return res.status(400).json({
        error:"عدد الجنود غير صحيح."
      });

    if (troops>num(player.troops))
      return res.status(400).json({
        error:"عدد الجنود غير كافٍ."
      });

    if (
      targetType!=="zombie" &&
      targetType!=="fort"
    )
      return res.status(400).json({
        error:"الهدف غير صالح."
      });

    const table =
      targetType==="zombie"
      ? "zombies"
      : "forts";

    const target =
      (await query(
        `SELECT * FROM ${table} WHERE id=$1`,
        [targetId]
      )).rows[0];

    if (!target)
      return res.status(404).json({
        error:"الهدف غير موجود."
      });

    const dx=
      num(target.x)-num(player.x);

    const dy=
      num(target.y)-num(player.y);

    const distance=
      Math.sqrt(dx*dx+dy*dy);

    const travel=
      Math.max(
        5000,
        Math.round(distance*100)
      );

    const now=Date.now();

    await query(`
      UPDATE players
      SET troops=troops-$1
      WHERE id=$2
    `,[
      troops,
      playerId
    ]);

    const march =
      await query(`
        INSERT INTO marches
        (
          player_id,
          target_type,
          target_id,
          troops,
          start_x,
          start_y,
          target_x,
          target_y,
          start_time,
          arrival_time,
          status
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'marching')
        RETURNING *
      `,[
        playerId,
        targetType,
        targetId,
        troops,
        num(player.x),
        num(player.y),
        num(target.x),
        num(target.y),
        now,
        now+travel
      ]);

    res.json({
      success:true,
      arrivalTime:now+travel,
      march:march.rows[0],
      player:
        await publicPlayer(
          await getPlayer(playerId)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر إرسال الجيش."
    });
  }
});

/* =========================
   REPORTS
========================= */

app.get("/api/reports/:playerId",async(req,res)=>{

  try {

    const id=num(req.params.playerId);

    const result =
      await query(`
        SELECT *
        FROM battle_reports
        WHERE player_id=$1
        ORDER BY id DESC
        LIMIT 100
      `,[id]);

    res.json(result.rows);

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل التقارير."
    });
  }
});

/* =========================
   ALLIANCES
========================= */

app.post("/api/alliances",async(req,res)=>{

  try {

    const playerId=num(req.body.playerId);

    const name=
      String(req.body.name || "").trim();

    const tag=
      String(req.body.tag || "").trim();

    if (!name || !tag)
      return res.status(400).json({
        error:"اسم التحالف والاختصار مطلوبان."
      });

    const existing =
      await query(`
        SELECT *
        FROM alliance_members
        WHERE player_id=$1
      `,[playerId]);

    if (existing.rows.length)
      return res.status(400).json({
        error:"أنت داخل تحالف بالفعل."
      });

    const result =
      await query(`
        INSERT INTO alliances
        (name,tag,kingdom,leader_id,created_at)
        VALUES($1,$2,1,$3,$4)
        RETURNING *
      `,[
        name,
        tag,
        playerId,
        Date.now()
      ]);

    const alliance=result.rows[0];

    await query(`
      INSERT INTO alliance_members
      (alliance_id,player_id,role,joined_at)
      VALUES($1,$2,'leader',$3)
    `,[
      alliance.id,
      playerId,
      Date.now()
    ]);

    res.json({
      success:true,
      alliance
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر إنشاء التحالف."
    });
  }
});

app.get("/api/alliances",async(req,res)=>{

  try {

    const result =
      await query(`
        SELECT
          a.id,
          a.name,
          a.tag,
          a.kingdom,
          a.leader_id,
          COUNT(am.player_id)::int AS members
        FROM alliances a
        LEFT JOIN alliance_members am
        ON am.alliance_id=a.id
        GROUP BY a.id
        ORDER BY a.id DESC
      `);

    res.json({
      alliances:result.rows
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل التحالفات."
    });
  }
});

app.post("/api/player/:id/alliance/join",async(req,res)=>{

  try {

    const playerId=num(req.params.id);
    const allianceId=num(req.body.allianceId);

    const alliance =
      (await query(`
        SELECT *
        FROM alliances
        WHERE id=$1
      `,[allianceId])).rows[0];

    if (!alliance)
      return res.status(404).json({
        error:"التحالف غير موجود."
      });

    const existing =
      await query(`
        SELECT *
        FROM alliance_members
        WHERE player_id=$1
      `,[playerId]);

    if (existing.rows.length)
      return res.status(400).json({
        error:"أنت داخل تحالف بالفعل."
      });

    await query(`
      INSERT INTO alliance_members
      (alliance_id,player_id,role,joined_at)
      VALUES($1,$2,'member',$3)
    `,[
      allianceId,
      playerId,
      Date.now()
    ]);

    res.json({
      success:true,
      alliance,
      player:
        await publicPlayer(
          await getPlayer(playerId)
        )
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر الانضمام للتحالف."
    });
  }
});

app.get("/api/alliance/:id",async(req,res)=>{

  try {

    const id=num(req.params.id);

    const alliance =
      (await query(`
        SELECT *
        FROM alliances
        WHERE id=$1
      `,[id])).rows[0];

    if (!alliance)
      return res.status(404).json({
        error:"التحالف غير موجود."
      });

    const members =
      (await query(`
        SELECT
          p.id,
          p.name,
          p.kingdom,
          p.castle,
          p.power,
          am.role
        FROM alliance_members am
        JOIN players p
        ON p.id=am.player_id
        WHERE am.alliance_id=$1
        ORDER BY p.power DESC
      `,[id])).rows;

    res.json({
      ...alliance,
      members
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل التحالف."
    });
  }
});

/* =========================
   RANKING
========================= */

app.get("/api/ranking",async(req,res)=>{

  try {

    const result =
      await query(`
        SELECT
          id,
          name,
          kingdom,
          castle,
          power,
          troops
        FROM players
        ORDER BY power DESC
        LIMIT 100
      `);

    res.json(result.rows);

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل الترتيب."
    });
  }
});

app.get("/api/rankings/all",async(req,res)=>{

  try {

    const players =
      (await query(`
        SELECT
          id,name,kingdom,castle,power,troops
        FROM players
        ORDER BY power DESC
        LIMIT 100
      `)).rows;

    const heroes =
      (await query(`
        SELECT
          p.id,
          p.name,
          COALESCE(SUM(h.power),0)::bigint AS hero_power
        FROM players p
        LEFT JOIN heroes h
        ON h.player_id=p.id
        GROUP BY p.id
        ORDER BY hero_power DESC
        LIMIT 100
      `)).rows;

    const behemoths =
      (await query(`
        SELECT
          p.id,
          p.name,
          COALESCE(SUM(b.power),0)::bigint AS behemoth_power
        FROM players p
        LEFT JOIN behemoths b
        ON b.player_id=p.id
        GROUP BY p.id
        ORDER BY behemoth_power DESC
        LIMIT 100
      `)).rows;

    const alliances =
      (await query(`
        SELECT
          a.id,
          a.name,
          a.tag,
          a.kingdom,
          COUNT(am.player_id)::int AS members,
          COALESCE(SUM(p.power),0)::bigint AS power
        FROM alliances a
        LEFT JOIN alliance_members am
        ON am.alliance_id=a.id
        LEFT JOIN players p
        ON p.id=am.player_id
        GROUP BY a.id
        ORDER BY power DESC
        LIMIT 100
      `)).rows;

    res.json({

      kingdom:players,

      power:players,

      castle:
        [...players]
        .sort(
          (a,b)=>
            num(b.castle)-num(a.castle)
        ),

      hero:heroes,

      heroes:heroes,

      behemoth:behemoths,

      alliances:alliances,

      allianceWar:alliances,

      war:players
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل التصنيفات."
    });
  }
});

/* =========================
   COMMANDER PROFILE
========================= */

app.get("/api/player/:id/profile",async(req,res)=>{

  try {

    const id=num(req.params.id);

    await checkCommander(id);

    const player=await getPlayer(id);

    if (!player)
      return res.status(404).json({
        error:"اللاعب غير موجود."
      });

    res.json({

      commander:{

        name:"Kardous",

        level:num(player.commander_level),

        xp:num(player.commander_xp),

        nextXp:
          commanderXP(
            num(player.commander_level)
          ),

        talent:
          num(player.commander_talent),

        equipment:{

          weapon:
            num(player.commander_weapon),

          armor:
            num(player.commander_armor),

          helmet:
            num(player.commander_helmet),

          boots:
            num(player.commander_boots)
        }
      }

    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      error:"تعذر تحميل القائد."
    });
  }
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection",socket=>{

  socket.emit(
    "serverMessage",
    {
      message:"Kardous Survival متصل بالخادم."
    }
  );

  socket.on(
    "joinPlayer",
    playerId=>{
      if (playerId)
        socket.join(
          `player:${playerId}`
        );
    }
  );
});

/* =========================
   BATTLE SYSTEM
========================= */

let battleRunning=false;

async function processBattles(){

  if (battleRunning)
    return;

  battleRunning=true;

  try {

    const now=Date.now();

    const result =
      await query(`
        SELECT *
        FROM marches
        WHERE status='marching'
        AND arrival_time <= $1
        ORDER BY id
        LIMIT 50
      `,[now]);

    for (const march of result.rows) {

      const table =
        march.target_type==="zombie"
        ? "zombies"
        : march.target_type==="fort"
        ? "forts"
        : null;

      if (!table) {

        await query(`
          UPDATE marches
          SET status='completed'
          WHERE id=$1
        `,[march.id]);

        continue;
      }

      const target =
        (await query(
          `SELECT * FROM ${table} WHERE id=$1`,
          [march.target_id]
        )).rows[0];

      let outcome="defeat";

      if (target) {

        if (
          num(march.troops)
          >=
          num(target.power)/10
        ) {

          outcome="victory";

          await query(
            `DELETE FROM ${table} WHERE id=$1`,
            [march.target_id]
          );

          await query(`
            UPDATE players
            SET power=power+$1,
                commander_xp=commander_xp+$2
            WHERE id=$3
          `,[
            Math.max(100,num(target.power)),
            Math.max(100,num(target.power)),
            march.player_id
          ]);
        }
      }

      await query(`
        INSERT INTO battle_reports
        (player_id,target_type,target_id,troops_sent,result,created_at)
        VALUES($1,$2,$3,$4,$5,$6)
      `,[
        march.player_id,
        march.target_type,
        march.target_id,
        num(march.troops),
        outcome,
        now
      ]);

      await query(`
        UPDATE marches
        SET status='completed'
        WHERE id=$1
      `,[march.id]);

      io.to(
        `player:${march.player_id}`
      ).emit(
        "battleResult",
        {
          result:outcome,
          targetType:march.target_type,
          targetId:num(march.target_id)
        }
      );
    }

  } catch(error) {

    console.error(
      "Battle error:",
      error
    );

  } finally {

    battleRunning=false;
  }
}

setInterval(
  processBattles,
  1000
);

/* =========================
   STATUS
========================= */

app.get("/api/status",async(req,res)=>{

  try {

    const result =
      await query(`
        SELECT COUNT(*)::int AS players
        FROM players
      `);

    res.json({

      ok:true,

      game:"Kardous Survival",

      version:"12.0",

      database:"PostgreSQL",

      players:
        num(result.rows[0].players),

      time:Date.now()
    });

  } catch(error) {

    console.error(error);

    res.status(500).json({
      ok:false,
      database:"error"
    });
  }
});

/* =========================
   START
========================= */

app.get("/",(req,res)=>{

  res.sendFile(
    __dirname + "/index.html"
  );

});

initDatabase()
.then(()=>{

  server.listen(
    PORT,
    ()=>{
      console.log(
        `Kardous Survival running on port ${PORT}`
      );

      console.log(
        "PostgreSQL connected."
      );
    }
  );

})
.catch(error=>{

  console.error(
    "Database initialization failed:",
    error
  );

  process.exit(1);
});

process.on(
  "SIGTERM",
  async()=>{
    await pool.end();
    process.exit(0);
  }
);
