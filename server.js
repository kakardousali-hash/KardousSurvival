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

/* =========================
   DATABASE
========================= */

const db = new Database("kardous_survival.db");

db.pragma("journal_mode = WAL");


/* =========================
   PLAYERS TABLE
========================= */

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


/* =========================
   MIGRATIONS
========================= */

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
    "castle_upgrade_end",
    "INTEGER NOT NULL DEFAULT 0"
);

addColumnIfMissing(
    "players",
    "training_end",
    "INTEGER NOT NULL DEFAULT 0"
);

addColumnIfMissing(
    "players",
    "training_amount",
    "INTEGER NOT NULL DEFAULT 0"
);

addColumnIfMissing(
    "players",
    "training_speedups",
    "INTEGER NOT NULL DEFAULT 0"
);

addColumnIfMissing(
    "players",
    "building_speedups",
    "INTEGER NOT NULL DEFAULT 0"
);

addColumnIfMissing(
    "players",
    "research_speedups",
    "INTEGER NOT NULL DEFAULT 0"
);

addColumnIfMissing(
    "players",
    "research_name",
    "TEXT NOT NULL DEFAULT ''"
);

addColumnIfMissing(
    "players",
    "research_end",
    "INTEGER NOT NULL DEFAULT 0"
);


/* =========================
   ZOMBIES
========================= */

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


/* =========================
   FORTS
========================= */

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


/* =========================
   MARCHES
========================= */

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


/* =========================
   BATTLE REPORTS
========================= */

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


/* =========================
   DEFAULT PLAYER
========================= */

const playerCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM players"
    ).get().count;

if (playerCount === 0) {

    db.prepare(`
        INSERT INTO players (
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

        VALUES (
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


/* =========================
   DEFAULT ZOMBIES
========================= */

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


/* =========================
   DEFAULT FORTS
========================= */

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


/* =========================
   PLAYER
========================= */

function getPlayer(id) {

    return db.prepare(`
        SELECT *
        FROM players
        WHERE id = ?
    `).get(id);

}


/* =========================
   CASTLE
========================= */

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


/* =========================
   TRAINING
========================= */

function getTrainingTime(amount) {

    return 30000;

}


/* =========================
   RESEARCH
========================= */

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


/* =========================
   PUBLIC PLAYER
========================= */

function publicPlayer(player) {

    if (!player) {
        return null;
    }

    const upgradeInfo =
        getUpgradeInfo(player.castle);

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

        commander_level:
            player.commander_level,

        commander_xp:
            player.commander_xp,

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


/* =========================
   REGISTER
========================= */

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
                    INSERT INTO players (
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

        }

        res.json({

            success: true,

            player:
                publicPlayer(player)

        });

    }
);


/* =========================
   GET PLAYER
========================= */

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

        res.json(
            publicPlayer(player)
        );

    }
);


/* =========================
   COLLECT RESOURCES
========================= */

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


/* =========================
   START TRAINING
========================= */

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

        /*
           استخدام تسريع تلقائي
           فقط إذا كان لدى اللاعب تسريع
        */

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


/* =========================
   COMPLETE TRAINING
========================= */

function completeTraining(player) {

    if (!player) {
        return;
    }

    if (
        !player.training_end ||
        player.training_end <= 0
    ) {
        return;
    }

    if (
        player.training_end >
        Date.now()
    ) {
        return;
    }

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


/* =========================
   USE TRAINING SPEEDUP
========================= */

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

        /*
           التصحيح:
           لا يمكن استعمال التسريع
           إذا كان المخزون صفرًا
        */

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

            message:
                "⚡ تم تسريع التدريب.",

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   CASTLE UPGRADE
========================= */

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

        /*
           استخدام تسريع البناء
           فقط إذا كان موجودًا
        */

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

            message:
                "🏗️ بدأت ترقية القلعة.",

            duration,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   COMPLETE CASTLE
========================= */

function completeCastleUpgrade(player) {

    if (!player) {
        return;
    }

    if (
        !player.castle_upgrade_end
    ) {
        return;
    }

    if (
        player.castle_upgrade_end >
        Date.now()
    ) {
        return;
    }

    if (player.castle >= 30) {

        db.prepare(`
            UPDATE players

            SET
                castle_upgrade_end = 0

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


/* =========================
   USE BUILDING SPEEDUP
========================= */

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

        /*
           التصحيح:
           يجب امتلاك تسريع
        */

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

            message:
                "⚡ تم تسريع البناء.",

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   START RESEARCH
========================= */

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
            ).trim().slice(0, 50);

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

        /*
           استخدام تسريع البحث
           فقط إذا كان موجودًا
        */

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

            message:
                "🔬 بدأ البحث.",

            duration,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   COMPLETE RESEARCH
========================= */

function completeResearch(player) {

    if (!player) {
        return;
    }

    if (!player.research_end) {
        return;
    }

    if (
        player.research_end >
        Date.now()
    ) {
        return;
    }

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


/* =========================
   RESEARCH SPEEDUP
========================= */

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

        /*
           التصحيح:
           يجب امتلاك تسريع بحث
        */

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

            message:
                "⚡ تم تسريع البحث.",

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   SPEEDUP INVENTORY
========================= */

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
            Math.floor(amount);

        /*
           حماية من أرقام ضخمة
        */

        amount =
            Math.min(amount, 100000);

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

            message:
                "⚡ تمت إضافة التسريعات.",

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   WORLD
========================= */

app.get(
    "/api/world",
    (req, res) => {

        res.json(
            getWorldData()
        );

    }
);


/* =========================
   RANKING
========================= */

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


/* =========================
   MOVE PLAYER
========================= */

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

        /*
           حدود الخريطة
        */

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


/* =========================
   MARCH
========================= */

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
            INSERT INTO marches (

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

            VALUES (
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

            message:
                "🚶 تم إرسال الجيش.",

            arrivalTime:
                arrival,

            player:
                publicPlayer(updated)

        });

    }
);


/* =========================
   BATTLE PROCESSOR
========================= */

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

    for (
        const march of marches
    ) {

        processBattle(march);

    }

}


function processBattle(march) {

    const player =
        getPlayer(march.player_id);

    if (!player) {

        db.prepare(`
            UPDATE marches

            SET
                status = 'finished'

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
        INSERT INTO battle_reports (

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

        SET
            status = 'finished'

        WHERE id = ?
    `).run(
        march.id
    );

    const updated =
        getPlayer(player.id);

    io.emit(
        "battleFinished",
        {
            playerId: player.id,
            result: result,
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


/* =========================
   WORLD DATA
========================= */

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


/* =========================
   REPORTS
========================= */

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


/* =========================
   STATUS
========================= */

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            online: true,

            version: "10.1",

            game:
                "Kardous Survival",

            systems: {

                training: true,

                buildingSpeedup: true,

                trainingSpeedup: true,

                research: true,

                researchSpeedup: true,

                multiplayer: true,

                battles: true

            }

        });

    }
);


/* =========================
   SOCKET.IO
========================= */

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


/* =========================
   PROCESS TRAINING
========================= */

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

    for (
        const player of players
    ) {

        completeTraining(player);

    }

}


/* =========================
   PROCESS CASTLE
========================= */

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

    for (
        const player of players
    ) {

        completeCastleUpgrade(player);

    }

}


/* =========================
   PROCESS RESEARCH
========================= */

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

    for (
        const player of players
    ) {

        completeResearch(player);

    }

}


/* =========================
   GAME LOOP
========================= */

setInterval(
    () => {

        processTraining();

        processCastleUpgrades();

        processResearch();

        processMarches();

    },
    1000
);


/* =========================
   ERROR HANDLING
========================= */

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


/* =========================
   START SERVER
========================= */

server.listen(
    PORT,
    () => {

        console.log(
            "🏰 Kardous Survival v10.1"
        );

        console.log(
            `🚀 Server running on port ${PORT}`
        );

    }
);
