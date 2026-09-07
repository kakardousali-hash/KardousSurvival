const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Database = require("better-sqlite3");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

/* =========================================================
   DATABASE
========================================================= */

const db = new Database("kardous_survival.db");

db.pragma("journal_mode = WAL");


/* =========================================================
   PLAYERS
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS players (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    kingdom INTEGER NOT NULL DEFAULT 1,

    x INTEGER NOT NULL DEFAULT 0,

    y INTEGER NOT NULL DEFAULT 0,

    castle INTEGER NOT NULL DEFAULT 1,

    power INTEGER NOT NULL DEFAULT 0,

    food INTEGER NOT NULL DEFAULT 10000,

    wood INTEGER NOT NULL DEFAULT 10000,

    iron INTEGER NOT NULL DEFAULT 5000,

    gold INTEGER NOT NULL DEFAULT 1000,

    troops INTEGER NOT NULL DEFAULT 0,

    commander_level INTEGER NOT NULL DEFAULT 1,

    commander_xp INTEGER NOT NULL DEFAULT 0,

    commander_weapon INTEGER NOT NULL DEFAULT 1,

    commander_armor INTEGER NOT NULL DEFAULT 1,

    commander_helmet INTEGER NOT NULL DEFAULT 1,

    commander_boots INTEGER NOT NULL DEFAULT 1,

    commander_talent INTEGER NOT NULL DEFAULT 1,

    castle_upgrade_end INTEGER NOT NULL DEFAULT 0,

    training_end INTEGER NOT NULL DEFAULT 0,

    training_amount INTEGER NOT NULL DEFAULT 0,

    training_speedups INTEGER NOT NULL DEFAULT 0,

    building_speedups INTEGER NOT NULL DEFAULT 0,

    research_speedups INTEGER NOT NULL DEFAULT 0,

    research_name TEXT NOT NULL DEFAULT '',

    research_end INTEGER NOT NULL DEFAULT 0

);
`);


/* =========================================================
   MIGRATIONS
========================================================= */

function addColumnIfMissing(table, column, definition) {

    try {

        db.prepare(
            `SELECT ${column} FROM ${table} LIMIT 1`
        ).get();

    } catch (error) {

        db.exec(`
            ALTER TABLE ${table}
            ADD COLUMN ${column} ${definition}
        `);

    }

}

addColumnIfMissing(
    "players",
    "commander_weapon",
    "INTEGER NOT NULL DEFAULT 1"
);

addColumnIfMissing(
    "players",
    "commander_armor",
    "INTEGER NOT NULL DEFAULT 1"
);

addColumnIfMissing(
    "players",
    "commander_helmet",
    "INTEGER NOT NULL DEFAULT 1"
);

addColumnIfMissing(
    "players",
    "commander_boots",
    "INTEGER NOT NULL DEFAULT 1"
);

addColumnIfMissing(
    "players",
    "commander_talent",
    "INTEGER NOT NULL DEFAULT 1"
);


/* =========================================================
   HEROES
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS heroes (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    hero_key TEXT NOT NULL,

    name TEXT NOT NULL,

    level INTEGER NOT NULL DEFAULT 1,

    xp INTEGER NOT NULL DEFAULT 0,

    power INTEGER NOT NULL DEFAULT 100,

    skill_1 INTEGER NOT NULL DEFAULT 1,

    skill_2 INTEGER NOT NULL DEFAULT 1,

    skill_3 INTEGER NOT NULL DEFAULT 1,

    unlocked INTEGER NOT NULL DEFAULT 1,

    UNIQUE(player_id, hero_key)

);
`);


/* =========================================================
   BEHEMOTHS
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS behemoths (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    type TEXT NOT NULL,

    name TEXT NOT NULL,

    level INTEGER NOT NULL DEFAULT 1,

    xp INTEGER NOT NULL DEFAULT 0,

    power INTEGER NOT NULL DEFAULT 500,

    skill_1 INTEGER NOT NULL DEFAULT 1,

    skill_2 INTEGER NOT NULL DEFAULT 1,

    skill_3 INTEGER NOT NULL DEFAULT 1,

    active INTEGER NOT NULL DEFAULT 1,

    UNIQUE(player_id, type)

);
`);


/* =========================================================
   ALLIANCES
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS alliances (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL UNIQUE,

    tag TEXT NOT NULL UNIQUE,

    kingdom INTEGER NOT NULL DEFAULT 1,

    leader_id INTEGER NOT NULL,

    created_at INTEGER NOT NULL

);
`);


db.exec(`
CREATE TABLE IF NOT EXISTS alliance_members (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    alliance_id INTEGER NOT NULL,

    player_id INTEGER NOT NULL UNIQUE,

    role TEXT NOT NULL DEFAULT 'member',

    joined_at INTEGER NOT NULL

);
`);


/* =========================================================
   ZOMBIES
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS zombies (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    x INTEGER NOT NULL,

    y INTEGER NOT NULL,

    level INTEGER NOT NULL DEFAULT 1,

    power INTEGER NOT NULL DEFAULT 1000

);
`);


/* =========================================================
   FORTS
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS forts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    x INTEGER NOT NULL,

    y INTEGER NOT NULL,

    level INTEGER NOT NULL DEFAULT 1,

    power INTEGER NOT NULL DEFAULT 5000

);
`);


/* =========================================================
   MARCHES
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS marches (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    target_type TEXT NOT NULL,

    target_id INTEGER NOT NULL,

    troops INTEGER NOT NULL,

    start_x INTEGER NOT NULL,

    start_y INTEGER NOT NULL,

    target_x INTEGER NOT NULL,

    target_y INTEGER NOT NULL,

    start_time INTEGER NOT NULL,

    arrival_time INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'marching'

);
`);


/* =========================================================
   BATTLE REPORTS
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS battle_reports (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    target_type TEXT NOT NULL,

    target_id INTEGER NOT NULL,

    troops_sent INTEGER NOT NULL,

    result TEXT NOT NULL,

    created_at INTEGER NOT NULL

);
`);


/* =========================================================
   HERO NAMES
========================================================= */

const HEROES = [

    {
        key: "rayan",
        name: "Rayan",
        power: 150
    },

    {
        key: "nova",
        name: "Nova",
        power: 160
    },

    {
        key: "kael",
        name: "Kael",
        power: 170
    },

    {
        key: "mira",
        name: "Mira",
        power: 180
    },

    {
        key: "zane",
        name: "Zane",
        power: 190
    },

    {
        key: "lyra",
        name: "Lyra",
        power: 200
    },

    {
        key: "darius",
        name: "Darius",
        power: 210
    },

    {
        key: "aria",
        name: "Aria",
        power: 220
    },

    {
        key: "kairo",
        name: "Kairo",
        power: 230
    },

    {
        key: "selene",
        name: "Selene",
        power: 240
    },

    {
        key: "viktor",
        name: "Viktor",
        power: 250
    },

    {
        key: "nira",
        name: "Nira",
        power: 260
    },

    {
        key: "axel",
        name: "Axel",
        power: 270
    },

    {
        key: "tara",
        name: "Tara",
        power: 280
    },

    {
        key: "leon",
        name: "Leon",
        power: 290
    },

    {
        key: "maya",
        name: "Maya",
        power: 300
    },

    {
        key: "ronan",
        name: "Ronan",
        power: 310
    },

    {
        key: "elara",
        name: "Elara",
        power: 320
    },

    {
        key: "jax",
        name: "Jax",
        power: 330
    },

    {
        key: "sora",
        name: "Sora",
        power: 340
    }

];


/* =========================================================
   BEHEMOTHS
========================================================= */

const BEHEMOTHS = [

    {
        type: "trex",
        name: "T-Rex",
        power: 1000
    },

    {
        type: "monkey",
        name: "القرد العملاق",
        power: 900
    },

    {
        type: "lion",
        name: "الأسد الملكي",
        power: 950
    },

    {
        type: "bird",
        name: "العصفور الحربي",
        power: 850
    }

];


/* =========================================================
   CREATE HEROES
========================================================= */

function createHeroesForPlayer(playerId) {

    const insert = db.prepare(`
        INSERT OR IGNORE INTO heroes
        (
            player_id,
            hero_key,
            name,
            level,
            xp,
            power,
            skill_1,
            skill_2,
            skill_3,
            unlocked
        )
        VALUES (?, ?, ?, 1, 0, ?, 1, 1, 1, 1)
    `);

    for (const hero of HEROES) {

        insert.run(
            playerId,
            hero.key,
            hero.name,
            hero.power
        );

    }

}


/* =========================================================
   CREATE BEHEMOTHS
========================================================= */

function createBehemothsForPlayer(playerId) {

    const insert = db.prepare(`
        INSERT OR IGNORE INTO behemoths
        (
            player_id,
            type,
            name,
            level,
            xp,
            power,
            skill_1,
            skill_2,
            skill_3,
            active
        )
        VALUES (?, ?, ?, 1, 0, ?, 1, 1, 1, 1)
    `);

    for (const behemoth of BEHEMOTHS) {

        insert.run(
            playerId,
            behemoth.type,
            behemoth.name,
            behemoth.power
        );

    }

}


/* =========================================================
   DEFAULT PLAYER
========================================================= */

const playerCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM players"
    ).get().count;


if (playerCount === 0) {

    db.prepare(`
        INSERT INTO players
        (
            name,
            kingdom,
            x,
            y,
            castle,
            power,
            food,
            wood,
            iron,
            gold,
            troops
        )

        VALUES
        (
            'Kardous',
            1,
            0,
            0,
            1,
            0,
            10000,
            10000,
            5000,
            1000,
            0
        )
    `).run();

}


/* =========================================================
   GIVE HEROES / BEHEMOTHS TO ALL EXISTING PLAYERS
========================================================= */

const existingPlayers =
    db.prepare(
        "SELECT id FROM players"
    ).all();

for (const player of existingPlayers) {

    createHeroesForPlayer(player.id);

    createBehemothsForPlayer(player.id);

}


/* =========================================================
   DEFAULT ZOMBIES
========================================================= */

const zombieCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM zombies"
    ).get().count;


if (zombieCount === 0) {

    const insertZombie =
        db.prepare(`
            INSERT INTO zombies
            (name, x, y, level, power)

            VALUES (?, ?, ?, ?, ?)
        `);

    for (let i = 1; i <= 20; i++) {

        const x =
            Math.floor(Math.random() * 1800) - 900;

        const y =
            Math.floor(Math.random() * 1800) - 900;

        insertZombie.run(
            `Zombie ${i}`,
            x,
            y,
            Math.floor(Math.random() * 5) + 1,
            1000 + i * 500
        );

    }

}


/* =========================================================
   DEFAULT FORTS
========================================================= */

const fortCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM forts"
    ).get().count;


if (fortCount === 0) {

    const insertFort =
        db.prepare(`
            INSERT INTO forts
            (name, x, y, level, power)

            VALUES (?, ?, ?, ?, ?)
        `);

    for (let i = 1; i <= 5; i++) {

        const x =
            Math.floor(Math.random() * 1600) - 800;

        const y =
            Math.floor(Math.random() * 1600) - 800;

        insertFort.run(
            `حصن ${i}`,
            x,
            y,
            i,
            5000 * i
        );

    }

}


/* =========================================================
   PLAYER
========================================================= */

function getPlayer(id) {

    return db.prepare(`
        SELECT *
        FROM players
        WHERE id = ?
    `).get(id);

}


/* =========================================================
   COMMANDER
========================================================= */

function commanderXpNeeded(level) {

    return level * 1000;

}


function updateCommanderLevel(playerId) {

    let player =
        getPlayer(playerId);

    if (!player) return;

    let level =
        player.commander_level;

    let xp =
        player.commander_xp;

    while (
        level < 60 &&
        xp >= commanderXpNeeded(level)
    ) {

        xp -= commanderXpNeeded(level);

        level++;

    }

    if (
        level !== player.commander_level ||
        xp !== player.commander_xp
    ) {

        db.prepare(`
            UPDATE players

            SET
                commander_level = ?,
                commander_xp = ?

            WHERE id = ?
        `).run(
            level,
            xp,
            playerId
        );

    }

}


/* =========================================================
   CASTLE
========================================================= */

function getCastleUpgradeTime(level) {

    return (
        60 + ((level - 1) * 30)
    ) * 1000;

}


function getCastleCost(level) {

    return {

        wood: level * 1000,

        iron: level * 600,

        gold: level * 250,

        food: level * 500

    };

}


function getUpgradeInfo(level) {

    return {

        duration:
            getCastleUpgradeTime(level),

        cost:
            getCastleCost(level + 1),

        max:
            level >= 30

    };

}


/* =========================================================
   TRAINING
========================================================= */

function getTrainingTime(amount) {

    return 30000;

}


/* =========================================================
   RESEARCH
========================================================= */

function getResearchTime() {

    return 60000;

}


function getResearchCost() {

    return {

        food: 1000,

        wood: 1500,

        iron: 800,

        gold: 300

    };

}


/* =========================================================
   PUBLIC PLAYER
========================================================= */

function publicPlayer(player) {

    if (!player) return null;

    updateCommanderLevel(player.id);

    player =
        getPlayer(player.id);

    const upgradeInfo =
        getUpgradeInfo(player.castle);

    const alliance =
        db.prepare(`
            SELECT
                a.id,
                a.name,
                a.tag,
                am.role

            FROM alliance_members am

            JOIN alliances a
            ON a.id = am.alliance_id

            WHERE am.player_id = ?

            LIMIT 1
        `).get(player.id);

    return {

        id: player.id,

        name: player.name,

        kingdom: player.kingdom,

        x: player.x,

        y: player.y,

        castle: player.castle,

        power: player.power,

        food: player.food,

        wood: player.wood,

        iron: player.iron,

        gold: player.gold,

        troops: player.troops,

        commander: {

            name: "Kardous",

            level: player.commander_level,

            xp: player.commander_xp,

            talent: player.commander_talent,

            equipment: {

                weapon: player.commander_weapon,

                armor: player.commander_armor,

                helmet: player.commander_helmet,

                boots: player.commander_boots

            }

        },

        commander_level:
            player.commander_level,

        commander_xp:
            player.commander_xp,

        alliance:
            alliance || null,

        castleUpgrade: {

            active:
                player.castle_upgrade_end >
                Date.now(),

            endTime:
                player.castle_upgrade_end || 0,

            remaining:
                player.castle_upgrade_end >
                Date.now()
                    ? player.castle_upgrade_end - Date.now()
                    : 0,

            duration:
                upgradeInfo.duration,

            cost:
                upgradeInfo.cost,

            max:
                upgradeInfo.max

        },

        training: {

            active:
                player.training_end >
                Date.now(),

            endTime:
                player.training_end || 0,

            remaining:
                player.training_end >
                Date.now()
                    ? player.training_end - Date.now()
                    : 0,

            amount:
                player.training_amount || 0

        },

        speedups: {

            training:
                player.training_speedups || 0,

            building:
                player.building_speedups || 0,

            research:
                player.research_speedups || 0

        },

        research: {

            active:
                player.research_end >
                Date.now(),

            name:
                player.research_name || "",

            endTime:
                player.research_end || 0,

            remaining:
                player.research_end >
                Date.now()
                    ? player.research_end - Date.now()
                    : 0

        }

    };

}


/* =========================================================
   REGISTER
========================================================= */

app.post(
    "/api/register",
    (req, res) => {

        const name =
            String(req.body.name || "").trim();

        if (!name) {

            return res.status(400).json({
                error: "اكتب اسم اللاعب."
            });

        }

        if (name.length > 20) {

            return res.status(400).json({
                error: "اسم اللاعب طويل جدًا."
            });

        }

        let player =
            db.prepare(`
                SELECT *
                FROM players
                WHERE name = ?
                LIMIT 1
            `).get(name);

        if (!player) {

            const result =
                db.prepare(`
                    INSERT INTO players
                    (
                        name,
                        kingdom,
                        x,
                        y
                    )

                    VALUES (?, 1, ?, ?)
                `).run(
                    name,
                    Math.floor(Math.random() * 1800) - 900,
                    Math.floor(Math.random() * 1800) - 900
                );

            player =
                getPlayer(result.lastInsertRowid);

            createHeroesForPlayer(player.id);

            createBehemothsForPlayer(player.id);

        } else {

            createHeroesForPlayer(player.id);

            createBehemothsForPlayer(player.id);

        }

        res.json({

            success: true,

            player:
                publicPlayer(player)

        });

    }
);


/* =========================================================
   GET PLAYER
========================================================= */

app.get(
    "/api/player/:id",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        createHeroesForPlayer(player.id);

        createBehemothsForPlayer(player.id);

        res.json(
            publicPlayer(player)
        );

    }
);


/* =========================================================
   COMMANDER PROFILE
========================================================= */

app.get(
    "/api/player/:id/profile",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        res.json({

            commander: {

                name: "Kardous",

                level: player.commander_level,

                xp: player.commander_xp,

                nextXp:
                    commanderXpNeeded(
                        player.commander_level
                    ),

                talent:
                    player.commander_talent,

                equipment: {

                    weapon:
                        player.commander_weapon,

                    armor:
                        player.commander_armor,

                    helmet:
                        player.commander_helmet,

                    boots:
                        player.commander_boots

                }

            }

        });

    }
);


/* =========================================================
   HEROES
========================================================= */

app.get(
    "/api/player/:id/heroes",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        createHeroesForPlayer(player.id);

        const heroes =
            db.prepare(`
                SELECT *
                FROM heroes

                WHERE player_id = ?

                ORDER BY power DESC
            `).all(player.id);

        res.json({

            heroes

        });

    }
);


/* =========================================================
   HERO UPGRADE
========================================================= */

app.post(
    "/api/player/:id/heroes/:heroId/upgrade",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        const hero =
            db.prepare(`
                SELECT *
                FROM heroes

                WHERE id = ?

                AND player_id = ?
            `).get(
                req.params.heroId,
                player.id
            );

        if (!hero) {

            return res.status(404).json({
                error: "البطل غير موجود."
            });

        }

        const cost =
            hero.level * 500;

        if (player.food < cost) {

            return res.status(400).json({

                error: "🍎 الطعام غير كافٍ.",

                player:
                    publicPlayer(player)

            });

        }

        const newLevel =
            hero.level + 1;

        const newPower =
            hero.power + 100;

        db.prepare(`
            UPDATE players

            SET
                food = food - ?,
                power = power + 100,
                commander_xp = commander_xp + 50

            WHERE id = ?
        `).run(
            cost,
            player.id
        );

        db.prepare(`
            UPDATE heroes

            SET
                level = ?,
                power = ?,
                xp = xp + ?

            WHERE id = ?
        `).run(
            newLevel,
            newPower,
            100,
            hero.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "heroUpdated",
            {
                playerId: player.id,
                heroId: hero.id
            }
        );

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            hero:
                db.prepare(`
                    SELECT *
                    FROM heroes
                    WHERE id = ?
                `).get(hero.id),

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   BEHEMOTHS
========================================================= */

app.get(
    "/api/player/:id/behemoths",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        createBehemothsForPlayer(player.id);

        const behemoths =
            db.prepare(`
                SELECT *
                FROM behemoths

                WHERE player_id = ?

                ORDER BY power DESC
            `).all(player.id);

        res.json({

            behemoths

        });

    }
);


/* =========================================================
   BEHEMOTH UPGRADE
========================================================= */

app.post(
    "/api/player/:id/behemoths/:behemothId/upgrade",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        const behemoth =
            db.prepare(`
                SELECT *
                FROM behemoths

                WHERE id = ?

                AND player_id = ?
            `).get(
                req.params.behemothId,
                player.id
            );

        if (!behemoth) {

            return res.status(404).json({
                error: "البهيثومي غير موجود."
            });

        }

        const cost =
            behemoth.level * 1000;

        if (player.food < cost) {

            return res.status(400).json({

                error: "🍎 الطعام غير كافٍ.",

                player:
                    publicPlayer(player)

            });

        }

        db.prepare(`
            UPDATE players

            SET
                food = food - ?,
                power = power + 500,
                commander_xp = commander_xp + 100

            WHERE id = ?
        `).run(
            cost,
            player.id
        );

        db.prepare(`
            UPDATE behemoths

            SET
                level = level + 1,
                power = power + 500,
                xp = xp + 100

            WHERE id = ?
        `).run(
            behemoth.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "behemothUpdated",
            {
                playerId: player.id,
                behemothId: behemoth.id
            }
        );

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            behemoth:
                db.prepare(`
                    SELECT *
                    FROM behemoths
                    WHERE id = ?
                `).get(behemoth.id),

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   ALLIANCE HELPER
========================================================= */

function getPlayerAlliance(playerId) {

    return db.prepare(`
        SELECT
            a.*,
            am.role

        FROM alliances a

        JOIN alliance_members am
        ON am.alliance_id = a.id

        WHERE am.player_id = ?

        LIMIT 1
    `).get(playerId);

}


/* =========================================================
   CREATE ALLIANCE
========================================================= */

app.post(
    "/api/alliances",
    (req, res) => {

        const playerId =
            Number(req.body.playerId);

        const name =
            String(req.body.name || "")
            .trim()
            .slice(0, 30);

        const tag =
            String(req.body.tag || "")
            .trim()
            .slice(0, 6)
            .toUpperCase();

        const player =
            getPlayer(playerId);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (!name || !tag) {

            return res.status(400).json({
                error: "اكتب اسم التحالف والاختصار."
            });

        }

        if (getPlayerAlliance(player.id)) {

            return res.status(400).json({
                error: "أنت داخل تحالف بالفعل."
            });

        }

        try {

            const result =
                db.prepare(`
                    INSERT INTO alliances
                    (
                        name,
                        tag,
                        kingdom,
                        leader_id,
                        created_at
                    )

                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    name,
                    tag,
                    player.kingdom,
                    player.id,
                    Date.now()
                );

            db.prepare(`
                INSERT INTO alliance_members
                (
                    alliance_id,
                    player_id,
                    role,
                    joined_at
                )

                VALUES (?, ?, 'leader', ?)
            `).run(
                result.lastInsertRowid,
                player.id,
                Date.now()
            );

            res.json({

                success: true,

                alliance:
                    getAlliance(
                        result.lastInsertRowid
                    )

            });

        } catch (error) {

            return res.status(400).json({
                error: "اسم التحالف أو الاختصار مستخدم بالفعل."
            });

        }

    }
);


/* =========================================================
   JOIN ALLIANCE
========================================================= */

app.post(
    "/api/player/:id/alliance/join",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        const allianceId =
            Number(req.body.allianceId);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (getPlayerAlliance(player.id)) {

            return res.status(400).json({
                error: "أنت داخل تحالف بالفعل."
            });

        }

        const alliance =
            db.prepare(`
                SELECT *
                FROM alliances
                WHERE id = ?
            `).get(allianceId);

        if (!alliance) {

            return res.status(404).json({
                error: "التحالف غير موجود."
            });

        }

        db.prepare(`
            INSERT INTO alliance_members
            (
                alliance_id,
                player_id,
                role,
                joined_at
            )

            VALUES (?, ?, 'member', ?)
        `).run(
            alliance.id,
            player.id,
            Date.now()
        );

        io.emit(
            "allianceUpdated",
            {
                allianceId: alliance.id
            }
        );

        res.json({

            success: true,

            alliance:
                getAlliance(alliance.id),

            player:
                publicPlayer(
                    getPlayer(player.id)
                )

        });

    }
);


/* =========================================================
   LIST ALLIANCES
========================================================= */

app.get(
    "/api/alliances",
    (req, res) => {

        const alliances =
            db.prepare(`
                SELECT
                    a.id,
                    a.name,
                    a.tag,
                    a.kingdom,
                    a.leader_id,
                    COUNT(am.player_id) AS members

                FROM alliances a

                LEFT JOIN alliance_members am
                ON am.alliance_id = a.id

                GROUP BY a.id

                ORDER BY members DESC, a.id ASC

                LIMIT 100
            `).all();

        res.json({

            alliances

        });

    }
);


/* =========================================================
   GET ALLIANCE
========================================================= */

function getAlliance(id) {

    const alliance =
        db.prepare(`
            SELECT *
            FROM alliances
            WHERE id = ?
        `).get(id);

    if (!alliance) return null;

    const members =
        db.prepare(`
            SELECT
                p.id,
                p.name,
                p.kingdom,
                p.castle,
                p.power,
                p.troops,
                am.role

            FROM alliance_members am

            JOIN players p
            ON p.id = am.player_id

            WHERE am.alliance_id = ?

            ORDER BY p.power DESC
        `).all(id);

    let power = 0;

    let warPower = 0;

    for (const member of members) {

        power += member.power || 0;

        warPower +=
            (member.power || 0) +
            ((member.troops || 0) * 10);

    }

    return {

        id: alliance.id,

        name: alliance.name,

        tag: alliance.tag,

        kingdom: alliance.kingdom,

        leader_id: alliance.leader_id,

        power,

        warPower,

        members

    };

}


app.get(
    "/api/alliance/:id",
    (req, res) => {

        const alliance =
            getAlliance(req.params.id);

        if (!alliance) {

            return res.status(404).json({
                error: "التحالف غير موجود."
            });

        }

        res.json(alliance);

    }
);


/* =========================================================
   COLLECT RESOURCES
========================================================= */

app.post(
    "/api/player/:id/collect",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        db.prepare(`
            UPDATE players

            SET
                food = food + 1000,
                wood = wood + 1000,
                iron = iron + 500,
                gold = gold + 100

            WHERE id = ?
        `).run(player.id);

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   TRAINING
========================================================= */

app.post(
    "/api/player/:id/train",
    (req, res) => {

        let player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (
            player.training_end >
            Date.now()
        ) {

            return res.status(400).json({

                error:
                    "⚔️ يوجد تدريب جارٍ بالفعل.",

                remaining:
                    player.training_end - Date.now(),

                player:
                    publicPlayer(player)

            });

        }

        if (
            player.training_end > 0 &&
            player.training_end <= Date.now()
        ) {

            completeTraining(player);

            player =
                getPlayer(player.id);

        }

        const amount = 100;

        const foodCost = 500;

        if (player.food < foodCost) {

            return res.status(400).json({

                error:
                    "🍎 الطعام غير كافٍ.",

                player:
                    publicPlayer(player)

            });

        }

        let duration =
            getTrainingTime(amount);

        if (
            player.training_speedups > 0
        ) {

            duration =
                Math.max(
                    1000,
                    duration - 10000
                );

            db.prepare(`
                UPDATE players

                SET
                    training_speedups =
                        training_speedups - 1

                WHERE id = ?
            `).run(player.id);

        }

        const endTime =
            Date.now() + duration;

        db.prepare(`
            UPDATE players

            SET
                food = food - ?,
                training_end = ?,
                training_amount = ?

            WHERE id = ?
        `).run(
            foodCost,
            endTime,
            amount,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            message:
                "⚔️ بدأ تدريب 100 جندي.",

            duration,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   COMPLETE TRAINING
========================================================= */

function completeTraining(player) {

    if (!player) return;

    if (
        !player.training_end ||
        player.training_end <= 0
    ) return;

    if (
        player.training_end >
        Date.now()
    ) return;

    const amount =
        player.training_amount || 0;

    if (amount <= 0) {

        db.prepare(`
            UPDATE players

            SET
                training_end = 0,
                training_amount = 0

            WHERE id = ?
        `).run(player.id);

        return;

    }

    const powerGain =
        Math.floor(amount * 1.3);

    db.prepare(`
        UPDATE players

        SET
            troops = troops + ?,

            power = power + ?,

            training_end = 0,

            training_amount = 0,

            commander_xp =
                commander_xp + ?

        WHERE id = ?
    `).run(
        amount,
        powerGain,
        amount,
        player.id
    );

    updateCommanderLevel(player.id);

    const updated =
        getPlayer(player.id);

    io.emit(
        "trainingFinished",
        {
            playerId: player.id,
            amount
        }
    );

    io.emit(
        "playerUpdated",
        publicPlayer(updated)
    );

}


/* =========================================================
   SPEEDUP TRAINING
========================================================= */

app.post(
    "/api/player/:id/speedup-training",
    (req, res) => {

        let player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (
            player.training_end <=
            Date.now()
        ) {

            return res.status(400).json({
                error: "لا يوجد تدريب جارٍ."
            });

        }

        if (
            player.training_speedups <= 0
        ) {

            return res.status(400).json({

                error:
                    "⚡ لا يوجد لديك تسريع تدريب."

            });

        }

        const remaining =
            player.training_end - Date.now();

        const reduction =
            Math.min(10000, remaining);

        const newEnd =
            player.training_end - reduction;

        db.prepare(`
            UPDATE players

            SET
                training_end = ?,

                training_speedups =
                    training_speedups - 1

            WHERE id = ?
        `).run(
            newEnd,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   CASTLE UPGRADE
========================================================= */

app.post(
    "/api/player/:id/upgrade-castle",
    (req, res) => {

        let player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (
            player.castle_upgrade_end >
            Date.now()
        ) {

            return res.status(400).json({

                error:
                    "🏗️ توجد ترقية جارية.",

                player:
                    publicPlayer(player)

            });

        }

        if (
            player.castle_upgrade_end > 0 &&
            player.castle_upgrade_end <= Date.now()
        ) {

            completeCastleUpgrade(player);

            player =
                getPlayer(player.id);

        }

        if (player.castle >= 30) {

            return res.status(400).json({

                error:
                    "⭐ وصلت إلى المستوى 30.",

                player:
                    publicPlayer(player)

            });

        }

        const nextLevel =
            player.castle + 1;

        const cost =
            getCastleCost(nextLevel);

        if (
            player.food < cost.food ||
            player.wood < cost.wood ||
            player.iron < cost.iron ||
            player.gold < cost.gold
        ) {

            return res.status(400).json({

                error:
                    "❌ الموارد غير كافية.",

                cost,

                player:
                    publicPlayer(player)

            });

        }

        let duration =
            getCastleUpgradeTime(
                player.castle
            );

        if (
            player.building_speedups > 0
        ) {

            duration =
                Math.max(
                    1000,
                    duration - 10000
                );

            db.prepare(`
                UPDATE players

                SET
                    building_speedups =
                        building_speedups - 1

                WHERE id = ?
            `).run(player.id);

        }

        const endTime =
            Date.now() + duration;

        db.prepare(`
            UPDATE players

            SET
                food = food - ?,

                wood = wood - ?,

                iron = iron - ?,

                gold = gold - ?,

                castle_upgrade_end = ?

            WHERE id = ?
        `).run(
            cost.food,
            cost.wood,
            cost.iron,
            cost.gold,
            endTime,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            duration,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   COMPLETE CASTLE
========================================================= */

function completeCastleUpgrade(player) {

    if (!player) return;

    if (!player.castle_upgrade_end) return;

    if (
        player.castle_upgrade_end >
        Date.now()
    ) return;

    if (player.castle >= 30) {

        db.prepare(`
            UPDATE players

            SET castle_upgrade_end = 0

            WHERE id = ?
        `).run(player.id);

        return;

    }

    db.prepare(`
        UPDATE players

        SET
            castle = castle + 1,

            power = power + 1000,

            commander_xp =
                commander_xp + 100,

            castle_upgrade_end = 0

        WHERE id = ?
    `).run(player.id);

    updateCommanderLevel(player.id);

    const updated =
        getPlayer(player.id);

    io.emit(
        "castleUpgradeFinished",
        publicPlayer(updated)
    );

    io.emit(
        "playerUpdated",
        publicPlayer(updated)
    );

}


/* =========================================================
   BUILDING SPEEDUP
========================================================= */

app.post(
    "/api/player/:id/speedup-building",
    (req, res) => {

        let player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (
            player.castle_upgrade_end <=
            Date.now()
        ) {

            return res.status(400).json({
                error: "لا توجد ترقية بناء جارية."
            });

        }

        if (
            player.building_speedups <= 0
        ) {

            return res.status(400).json({

                error:
                    "⚡ لا يوجد لديك تسريع بناء."

            });

        }

        const remaining =
            player.castle_upgrade_end -
            Date.now();

        const reduction =
            Math.min(10000, remaining);

        const newEnd =
            player.castle_upgrade_end -
            reduction;

        db.prepare(`
            UPDATE players

            SET
                castle_upgrade_end = ?,

                building_speedups =
                    building_speedups - 1

            WHERE id = ?
        `).run(
            newEnd,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   RESEARCH
========================================================= */

app.post(
    "/api/player/:id/research",
    (req, res) => {

        let player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (
            player.research_end >
            Date.now()
        ) {

            return res.status(400).json({

                error:
                    "🔬 يوجد بحث جارٍ بالفعل.",

                player:
                    publicPlayer(player)

            });

        }

        if (
            player.research_end > 0 &&
            player.research_end <= Date.now()
        ) {

            completeResearch(player);

            player =
                getPlayer(player.id);

        }

        const researchName =
            String(
                req.body.name ||
                "تكنولوجيا البداية"
            )
            .trim()
            .slice(0, 50);

        const cost =
            getResearchCost();

        if (
            player.food < cost.food ||
            player.wood < cost.wood ||
            player.iron < cost.iron ||
            player.gold < cost.gold
        ) {

            return res.status(400).json({

                error:
                    "❌ موارد البحث غير كافية.",

                cost,

                player:
                    publicPlayer(player)

            });

        }

        let duration =
            getResearchTime();

        if (
            player.research_speedups > 0
        ) {

            duration =
                Math.max(
                    1000,
                    duration - 10000
                );

            db.prepare(`
                UPDATE players

                SET
                    research_speedups =
                        research_speedups - 1

                WHERE id = ?
            `).run(player.id);

        }

        const endTime =
            Date.now() + duration;

        db.prepare(`
            UPDATE players

            SET
                food = food - ?,

                wood = wood - ?,

                iron = iron - ?,

                gold = gold - ?,

                research_name = ?,

                research_end = ?

            WHERE id = ?
        `).run(
            cost.food,
            cost.wood,
            cost.iron,
            cost.gold,
            researchName,
            endTime,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            duration,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   COMPLETE RESEARCH
========================================================= */

function completeResearch(player) {

    if (!player) return;

    if (!player.research_end) return;

    if (
        player.research_end >
        Date.now()
    ) return;

    const name =
        player.research_name ||
        "بحث";

    db.prepare(`
        UPDATE players

        SET
            research_end = 0,

            research_name = '',

            power = power + 500,

            commander_xp =
                commander_xp + 50

        WHERE id = ?
    `).run(player.id);

    updateCommanderLevel(player.id);

    const updated =
        getPlayer(player.id);

    io.emit(
        "researchFinished",
        {
            playerId: player.id,
            name
        }
    );

    io.emit(
        "playerUpdated",
        publicPlayer(updated)
    );

}


/* =========================================================
   RESEARCH SPEEDUP
========================================================= */

app.post(
    "/api/player/:id/speedup-research",
    (req, res) => {

        let player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        if (
            player.research_end <=
            Date.now()
        ) {

            return res.status(400).json({
                error: "لا يوجد بحث جارٍ."
            });

        }

        if (
            player.research_speedups <= 0
        ) {

            return res.status(400).json({

                error:
                    "⚡ لا يوجد لديك تسريع بحث."

            });

        }

        const remaining =
            player.research_end -
            Date.now();

        const reduction =
            Math.min(10000, remaining);

        const newEnd =
            player.research_end -
            reduction;

        db.prepare(`
            UPDATE players

            SET
                research_end = ?,

                research_speedups =
                    research_speedups - 1

            WHERE id = ?
        `).run(
            newEnd,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   ADD SPEEDUPS
========================================================= */

app.post(
    "/api/player/:id/add-speedups",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        let amount =
            Number(req.body.amount || 1);

        if (
            !Number.isFinite(amount) ||
            amount < 1
        ) {
            amount = 1;
        }

        amount =
            Math.min(
                Math.floor(amount),
                100000
            );

        db.prepare(`
            UPDATE players

            SET
                training_speedups =
                    training_speedups + ?,

                building_speedups =
                    building_speedups + ?,

                research_speedups =
                    research_speedups + ?

            WHERE id = ?
        `).run(
            amount,
            amount,
            amount,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        res.json({

            success: true,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   WORLD
========================================================= */

function getWorldData() {

    return {

        players:
            db.prepare(`
                SELECT
                    id,
                    name,
                    kingdom,
                    x,
                    y,
                    castle,
                    power
                FROM players
            `).all(),

        zombies:
            db.prepare(`
                SELECT *
                FROM zombies
            `).all(),

        forts:
            db.prepare(`
                SELECT *
                FROM forts
            `).all(),

        marches:
            db.prepare(`
                SELECT *
                FROM marches

                WHERE status = 'marching'
            `).all()

    };

}


app.get(
    "/api/world",
    (req, res) => {

        res.json(
            getWorldData()
        );

    }
);


/* =========================================================
   BASIC RANKING
========================================================= */

app.get(
    "/api/ranking",
    (req, res) => {

        const players =
            db.prepare(`
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
            `).all();

        res.json({
            players
        });

    }
);


/* =========================================================
   ALL RANKINGS
========================================================= */

app.get(
    "/api/rankings/all",
    (req, res) => {

        const kingdom =
            db.prepare(`
                SELECT
                    kingdom,
                    SUM(power) AS power

                FROM players

                GROUP BY kingdom

                ORDER BY power DESC

                LIMIT 100
            `).all();

        const power =
            db.prepare(`
                SELECT
                    id,
                    name,
                    kingdom,
                    power

                FROM players

                ORDER BY power DESC

                LIMIT 100
            `).all();

        const war =
            db.prepare(`
                SELECT
                    id,
                    name,
                    kingdom,
                    power,
                    troops,
                    (power + troops * 10) AS war_power

                FROM players

                ORDER BY war_power DESC

                LIMIT 100
            `).all();

        const castle =
            db.prepare(`
                SELECT
                    id,
                    name,
                    kingdom,
                    castle,
                    power

                FROM players

                ORDER BY castle DESC, power DESC

                LIMIT 100
            `).all();

        const hero =
            db.prepare(`
                SELECT
                    p.id AS player_id,
                    p.name AS player_name,
                    h.name AS hero_name,
                    h.level,
                    h.power

                FROM heroes h

                JOIN players p
                ON p.id = h.player_id

                ORDER BY h.power DESC

                LIMIT 100
            `).all();

        const heroes =
            db.prepare(`
                SELECT
                    p.id AS player_id,
                    p.name AS player_name,
                    SUM(h.power) AS heroes_power

                FROM heroes h

                JOIN players p
                ON p.id = h.player_id

                GROUP BY p.id

                ORDER BY heroes_power DESC

                LIMIT 100
            `).all();

        const behemoth =
            db.prepare(`
                SELECT
                    p.id AS player_id,
                    p.name AS player_name,
                    b.name AS behemoth_name,
                    b.level,
                    b.power

                FROM behemoths b

                JOIN players p
                ON p.id = b.player_id

                ORDER BY b.power DESC

                LIMIT 100
            `).all();

        const alliances =
            db.prepare(`
                SELECT
                    a.id,
                    a.name,
                    a.tag,
                    COUNT(am.player_id) AS members,
                    COALESCE(
                        SUM(p.power),
                        0
                    ) AS alliance_power

                FROM alliances a

                LEFT JOIN alliance_members am
                ON am.alliance_id = a.id

                LEFT JOIN players p
                ON p.id = am.player_id

                GROUP BY a.id

                ORDER BY alliance_power DESC

                LIMIT 100
            `).all();

        const allianceWar =
            alliances.map(alliance => {

                return {

                    ...alliance,

                    war_power:
                        Number(alliance.alliance_power || 0)

                };

            })
            .sort(
                (a, b) =>
                    b.war_power -
                    a.war_power
            );

        res.json({

            kingdom,

            power,

            war,

            castle,

            hero,

            heroes,

            behemoth,

            alliances,

            allianceWar

        });

    }
);


/* =========================================================
   MOVE PLAYER
========================================================= */

app.post(
    "/api/player/:id/move",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        const x =
            Number(req.body.x);

        const y =
            Number(req.body.y);

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {

            return res.status(400).json({
                error: "إحداثيات غير صحيحة."
            });

        }

        const safeX =
            Math.max(-1000, Math.min(1000, x));

        const safeY =
            Math.max(-1000, Math.min(1000, y));

        db.prepare(`
            UPDATE players

            SET
                x = ?,
                y = ?

            WHERE id = ?
        `).run(
            safeX,
            safeY,
            player.id
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        io.emit(
            "worldUpdated",
            getWorldData()
        );

        res.json({

            success: true,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   MARCH
========================================================= */

app.post(
    "/api/player/:id/march",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود."
            });

        }

        const targetType =
            String(
                req.body.targetType || ""
            );

        const targetId =
            Number(req.body.targetId);

        let troops =
            Number(req.body.troops);

        if (
            targetType !== "zombie" &&
            targetType !== "fort"
        ) {

            return res.status(400).json({
                error: "الهدف غير مدعوم."
            });

        }

        if (
            !Number.isInteger(targetId)
        ) {

            return res.status(400).json({
                error: "الهدف غير صحيح."
            });

        }

        if (
            !Number.isInteger(troops) ||
            troops <= 0
        ) {

            return res.status(400).json({
                error: "عدد الجنود غير صحيح."
            });

        }

        if (player.troops <= 0) {

            return res.status(400).json({
                error: "ليس لديك جنود."
            });

        }

        if (
            troops > player.troops
        ) {

            troops =
                player.troops;

        }

        let target;

        if (
            targetType === "zombie"
        ) {

            target =
                db.prepare(`
                    SELECT *
                    FROM zombies
                    WHERE id = ?
                `).get(targetId);

        } else {

            target =
                db.prepare(`
                    SELECT *
                    FROM forts
                    WHERE id = ?
                `).get(targetId);

        }

        if (!target) {

            return res.status(404).json({
                error: "الهدف غير موجود."
            });

        }

        const distance =
            Math.sqrt(
                Math.pow(
                    target.x - player.x,
                    2
                ) +
                Math.pow(
                    target.y - player.y,
                    2
                )
            );

        const travelTime =
            Math.max(
                5000,
                Math.floor(distance * 50)
            );

        const now =
            Date.now();

        const arrival =
            now + travelTime;

        db.prepare(`
            UPDATE players

            SET
                troops = troops - ?

            WHERE id = ?
        `).run(
            troops,
            player.id
        );

        db.prepare(`
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
            (
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, 'marching'
            )
        `).run(
            player.id,
            targetType,
            targetId,
            troops,
            player.x,
            player.y,
            target.x,
            target.y,
            now,
            arrival
        );

        const updated =
            getPlayer(player.id);

        io.emit(
            "playerUpdated",
            publicPlayer(updated)
        );

        io.emit(
            "worldUpdated",
            getWorldData()
        );

        res.json({

            success: true,

            arrivalTime:
                arrival,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================================================
   BATTLE
========================================================= */

function processMarches() {

    const now =
        Date.now();

    const marches =
        db.prepare(`
            SELECT *
            FROM marches

            WHERE status = 'marching'

            AND arrival_time <= ?
        `).all(now);

    for (const march of marches) {

        processBattle(march);

    }

}


function processBattle(march) {

    const player =
        getPlayer(march.player_id);

    if (!player) {

        db.prepare(`
            UPDATE marches

            SET status = 'finished'

            WHERE id = ?
        `).run(march.id);

        return;

    }

    let target;

    if (
        march.target_type ===
        "zombie"
    ) {

        target =
            db.prepare(`
                SELECT *
                FROM zombies
                WHERE id = ?
            `).get(
                march.target_id
            );

    } else {

        target =
            db.prepare(`
                SELECT *
                FROM forts
                WHERE id = ?
            `).get(
                march.target_id
            );

    }

    let result =
        "⚔️ فوز";

    if (!target) {

        result =
            "❌ الهدف اختفى";

    } else {

        const armyPower =
            march.troops * 10;

        if (
            armyPower >=
            target.power
        ) {

            result =
                "🏆 انتصار";

            db.prepare(`
                UPDATE players

                SET
                    power =
                        power + ?,

                    commander_xp =
                        commander_xp + ?

                WHERE id = ?
            `).run(
                target.power,
                Math.floor(target.power / 10),
                player.id
            );

            if (
                march.target_type ===
                "zombie"
            ) {

                db.prepare(`
                    DELETE FROM zombies
                    WHERE id = ?
                `).run(
                    march.target_id
                );

            } else {

                db.prepare(`
                    DELETE FROM forts
                    WHERE id = ?
                `).run(
                    march.target_id
                );

            }

        } else {

            result =
                "💥 هزيمة";

        }

    }

    db.prepare(`
        INSERT INTO battle_reports
        (
            player_id,
            target_type,
            target_id,
            troops_sent,
            result,
            created_at
        )

        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        player.id,
        march.target_type,
        march.target_id,
        march.troops,
        result,
        Date.now()
    );

    db.prepare(`
        UPDATE marches

        SET status = 'finished'

        WHERE id = ?
    `).run(
        march.id
    );

    updateCommanderLevel(player.id);

    const updated =
        getPlayer(player.id);

    io.emit(
        "battleFinished",
        {
            playerId: player.id,
            result,
            marchId: march.id
        }
    );

    io.emit(
        "playerUpdated",
        publicPlayer(updated)
    );

    io.emit(
        "worldUpdated",
        getWorldData()
    );

}


/* =========================================================
   REPORTS
========================================================= */

app.get(
    "/api/reports/:playerId",
    (req, res) => {

        const reports =
            db.prepare(`
                SELECT *
                FROM battle_reports

                WHERE player_id = ?

                ORDER BY id DESC

                LIMIT 100
            `).all(
                req.params.playerId
            );

        res.json(
            reports
        );

    }
);


/* =========================================================
   PROCESS TRAINING
========================================================= */

function processTraining() {

    const now =
        Date.now();

    const players =
        db.prepare(`
            SELECT *
            FROM players

            WHERE training_end > 0

            AND training_end <= ?
        `).all(now);

    for (const player of players) {

        completeTraining(player);

    }

}


/* =========================================================
   PROCESS CASTLE
========================================================= */

function processCastleUpgrades() {

    const now =
        Date.now();

    const players =
        db.prepare(`
            SELECT *
            FROM players

            WHERE castle_upgrade_end > 0

            AND castle_upgrade_end <= ?
        `).all(now);

    for (const player of players) {

        completeCastleUpgrade(player);

    }

}


/* =========================================================
   PROCESS RESEARCH
========================================================= */

function processResearch() {

    const now =
        Date.now();

    const players =
        db.prepare(`
            SELECT *
            FROM players

            WHERE research_end > 0

            AND research_end <= ?
        `).all(now);

    for (const player of players) {

        completeResearch(player);

    }

}


/* =========================================================
   STATUS
========================================================= */

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            online: true,

            version: "11.0",

            game:
                "Kardous Survival",

            systems: {

                commander: true,

                heroes: true,

                heroesCount: 20,

                behemoths: true,

                behemothTypes: 4,

                alliances: true,

                rankings: true,

                training: true,

                buildingSpeedup: true,

                trainingSpeedup: true,

                research: true,

                researchSpeedup: true,

                multiplayer: true,

                battles: true,

                worldMap: true

            }

        });

    }
);


/* =========================================================
   SOCKET.IO
========================================================= */

io.on(
    "connection",
    (socket) => {

        console.log(
            "🟢 لاعب اتصل:",
            socket.id
        );

        socket.emit(
            "worldUpdated",
            getWorldData()
        );

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "🔴 لاعب خرج:",
                    socket.id
                );

            }
        );

    }
);


/* =========================================================
   GAME LOOP
========================================================= */

setInterval(
    () => {

        processTraining();

        processCastleUpgrades();

        processResearch();

        processMarches();

    },
    1000
);


/* =========================================================
   ERROR HANDLING
========================================================= */

app.use(
    (err, req, res, next) => {

        console.error(
            "Server error:",
            err
        );

        res.status(500).json({

            error:
                "حدث خطأ في الخادم."

        });

    }
);


/* =========================================================
   START
========================================================= */

server.listen(
    PORT,
    () => {

        console.log(
            "🏰 Kardous Survival v11.0"
        );

        console.log(
            `🚀 Server running on port ${PORT}`
        );

    }
);
