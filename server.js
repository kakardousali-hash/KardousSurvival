const express = require("express");
const path = require("path");
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
   CREATE TABLES
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS players (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT UNIQUE NOT NULL,

    kingdom INTEGER NOT NULL DEFAULT 1,

    x REAL NOT NULL DEFAULT 50,

    y REAL NOT NULL DEFAULT 50,

    castle INTEGER NOT NULL DEFAULT 1,

    power INTEGER NOT NULL DEFAULT 5000,

    food INTEGER NOT NULL DEFAULT 15000,

    wood INTEGER NOT NULL DEFAULT 12000,

    iron INTEGER NOT NULL DEFAULT 8000,

    gold INTEGER NOT NULL DEFAULT 3000,

    troops INTEGER NOT NULL DEFAULT 1000,

    commander_level INTEGER NOT NULL DEFAULT 1,

    commander_xp INTEGER NOT NULL DEFAULT 0,

    castle_upgrade_end INTEGER NOT NULL DEFAULT 0,

    training_end INTEGER NOT NULL DEFAULT 0,

    training_amount INTEGER NOT NULL DEFAULT 0

);

CREATE TABLE IF NOT EXISTS zombies (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    x REAL NOT NULL,

    y REAL NOT NULL,

    level INTEGER NOT NULL DEFAULT 1,

    power INTEGER NOT NULL DEFAULT 1000

);

CREATE TABLE IF NOT EXISTS forts (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    x REAL NOT NULL,

    y REAL NOT NULL,

    level INTEGER NOT NULL DEFAULT 1,

    power INTEGER NOT NULL DEFAULT 5000

);

CREATE TABLE IF NOT EXISTS marches (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    target_type TEXT NOT NULL,

    target_id INTEGER NOT NULL,

    start_x REAL NOT NULL,

    start_y REAL NOT NULL,

    target_x REAL NOT NULL,

    target_y REAL NOT NULL,

    troops INTEGER NOT NULL,

    start_time INTEGER NOT NULL,

    arrival_time INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'marching'

);

CREATE TABLE IF NOT EXISTS battle_reports (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    target_type TEXT NOT NULL,

    target_id INTEGER NOT NULL,

    result TEXT NOT NULL,

    troops_sent INTEGER NOT NULL,

    troops_lost INTEGER NOT NULL,

    enemy_power INTEGER NOT NULL,

    created_at INTEGER NOT NULL

);
`);

/* =========================
   DATABASE MIGRATIONS
========================= */

try {

    db.prepare(
        "SELECT castle_upgrade_end FROM players LIMIT 1"
    ).get();

} catch (error) {

    db.exec(`
        ALTER TABLE players
        ADD COLUMN castle_upgrade_end
        INTEGER NOT NULL DEFAULT 0
    `);
}


try {

    db.prepare(
        "SELECT training_end FROM players LIMIT 1"
    ).get();

} catch (error) {

    db.exec(`
        ALTER TABLE players
        ADD COLUMN training_end
        INTEGER NOT NULL DEFAULT 0
    `);
}


try {

    db.prepare(
        "SELECT training_amount FROM players LIMIT 1"
    ).get();

} catch (error) {

    db.exec(`
        ALTER TABLE players
        ADD COLUMN training_amount
        INTEGER NOT NULL DEFAULT 0
    `);
}

/* =========================
   DEFAULT PLAYER
========================= */

const playerCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM players"
    ).get().count;

if (playerCount === 0) {

    db.prepare(`
        INSERT INTO players
        (name, kingdom, x, y)
        VALUES (?, ?, ?, ?)
    `).run(
        "Kardous",
        1,
        50,
        50
    );
}

/* =========================
   ZOMBIES
========================= */

const zombieCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM zombies"
    ).get().count;

if (zombieCount === 0) {

    const addZombie =
        db.prepare(`
            INSERT INTO zombies
            (name, x, y, level, power)
            VALUES (?, ?, ?, ?, ?)
        `);

    for (let i = 1; i <= 20; i++) {

        const x =
            Math.random() * 90 + 5;

        const y =
            Math.random() * 90 + 5;

        const level =
            Math.floor(
                Math.random() * 10
            ) + 1;

        const power =
            level * 1000;

        addZombie.run(
            "Zombie " + i,
            x,
            y,
            level,
            power
        );
    }
}

/* =========================
   FORTS
========================= */

const fortCount =
    db.prepare(
        "SELECT COUNT(*) AS count FROM forts"
    ).get().count;

if (fortCount === 0) {

    const addFort =
        db.prepare(`
            INSERT INTO forts
            (name, x, y, level, power)
            VALUES (?, ?, ?, ?, ?)
        `);

    for (let i = 1; i <= 5; i++) {

        const x =
            Math.random() * 80 + 10;

        const y =
            Math.random() * 80 + 10;

        const level = i;

        const power =
            level * 10000;

        addFort.run(
            "Fort " + i,
            x,
            y,
            level,
            power
        );
    }
}

/* =========================
   CASTLE SYSTEM
========================= */

function getCastleUpgradeTime(level) {

    return (
        60 +
        ((level - 1) * 30)
    ) * 1000;
}


function getCastleCost(level) {

    return {

        wood:
            level * 1000,

        iron:
            level * 600,

        gold:
            level * 250,

        food:
            level * 500
    };
}


function getUpgradeInfo(level) {

    if (level >= 30) {

        return {

            max: true,

            time: 0,

            cost: {

                wood: 0,

                iron: 0,

                gold: 0,

                food: 0
            }
        };
    }

    return {

        max: false,

        time:
            getCastleUpgradeTime(level),

        cost:
            getCastleCost(level)
    };
}

/* =========================
   HELPERS
========================= */

function getPlayer(id) {

    return db.prepare(`
        SELECT *
        FROM players
        WHERE id = ?
    `).get(id);
}


function publicPlayer(player) {

    if (!player) {

        return null;
    }

    const upgrade =
        getUpgradeInfo(
            player.castle
        );

    const now =
        Date.now();

    let castleRemaining = 0;

    if (
        player.castle_upgrade_end &&
        player.castle_upgrade_end > now
    ) {

        castleRemaining =
            player.castle_upgrade_end - now;
    }


    let trainingRemaining = 0;

    if (
        player.training_end &&
        player.training_end > now
    ) {

        trainingRemaining =
            player.training_end - now;
    }


    return {

        id:
            player.id,

        name:
            player.name,

        kingdom:
            player.kingdom,

        x:
            player.x,

        y:
            player.y,

        castle:
            player.castle,

        power:
            player.power,

        food:
            player.food,

        wood:
            player.wood,

        iron:
            player.iron,

        gold:
            player.gold,

        troops:
            player.troops,

        commander: {

            level:
                player.commander_level,

            experience:
                player.commander_xp
        },

        castleUpgrade: {

            active:
                castleRemaining > 0,

            endTime:
                player.castle_upgrade_end || 0,

            remaining:
                castleRemaining,

            duration:
                upgrade.time,

            cost:
                upgrade.cost,

            max:
                upgrade.max
        },

        training: {

            active:
                trainingRemaining > 0,

            endTime:
                player.training_end || 0,

            remaining:
                trainingRemaining,

            amount:
                player.training_amount || 0
        }
    };
}

/* =========================
   MAIN PAGE
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
});

/* =========================
   REGISTER / LOGIN
========================= */

app.post(
    "/api/register",
    (req, res) => {

        const name =
            String(
                req.body.name || ""
            ).trim();

        if (!name) {

            return res.status(400).json({

                error:
                    "اكتب اسم اللاعب"
            });
        }

        if (
            name.length < 3 ||
            name.length > 20
        ) {

            return res.status(400).json({

                error:
                    "اسم اللاعب يجب أن يكون بين 3 و20 حرفًا"
            });
        }

        const existing =
            db.prepare(`
                SELECT *
                FROM players
                WHERE LOWER(name) = LOWER(?)
            `).get(name);

        if (existing) {

            return res.json({

                success: true,

                login: true,

                message:
                    "👑 مرحبًا بعودتك!",

                player:
                    publicPlayer(existing)
            });
        }

        const result =
            db.prepare(`
                INSERT INTO players
                (name, kingdom, x, y)
                VALUES (?, 1, 50, 50)
            `).run(name);

        const player =
            getPlayer(
                result.lastInsertRowid
            );

        res.json({

            success: true,

            login: false,

            message:
                "🎉 تم إنشاء اللاعب!",

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

        let player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
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

        if (
            player.training_end > 0 &&
            player.training_end <= Date.now()
        ) {

            completeTraining(player);

            player =
                getPlayer(player.id);
        }

        res.json(
            publicPlayer(player)
        );
    }
);

/* =========================
   CASTLE UPGRADE INFO
========================= */

app.get(
    "/api/player/:id/castle-upgrade",
    (req, res) => {

        let player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
            });
        }

        if (
            player.castle_upgrade_end > 0 &&
            player.castle_upgrade_end <= Date.now()
        ) {

            completeCastleUpgrade(player);
        }

        player =
            getPlayer(player.id);

        res.json(
            publicPlayer(player)
        );
    }
);

/* =========================
   START CASTLE UPGRADE
========================= */

app.post(
    "/api/player/:id/upgrade-castle",
    (req, res) => {

        let player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
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
                    "🏰 القلعة وصلت إلى المستوى 30!"
            });
        }

        if (
            player.castle_upgrade_end >
            Date.now()
        ) {

            const remaining =
                player.castle_upgrade_end -
                Date.now();

            return res.status(400).json({

                error:
                    "🏗️ القلعة قيد الترقية بالفعل.",

                remaining
            });
        }

        const level =
            player.castle;

        const cost =
            getCastleCost(level);

        if (
            player.wood < cost.wood ||
            player.iron < cost.iron ||
            player.gold < cost.gold ||
            player.food < cost.food
        ) {

            return res.status(400).json({

                error:
                    "❌ الموارد غير كافية.",

                cost
            });
        }

        const duration =
            getCastleUpgradeTime(level);

        const endTime =
            Date.now() + duration;

        db.prepare(`
            UPDATE players

            SET

                wood = wood - ?,

                iron = iron - ?,

                gold = gold - ?,

                food = food - ?,

                castle_upgrade_end = ?

            WHERE id = ?
        `).run(

            cost.wood,

            cost.iron,

            cost.gold,

            cost.food,

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
                `🏗️ بدأت ترقية القلعة ${level} → ${level + 1}!`,

            player:
                publicPlayer(updated)
        });
    }
);

/* =========================
   COMPLETE CASTLE UPGRADE
========================= */

function completeCastleUpgrade(player) {

    if (!player) {
        return;
    }

    if (
        !player.castle_upgrade_end ||
        player.castle_upgrade_end <= 0
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

            SET castle_upgrade_end = 0

            WHERE id = ?
        `).run(player.id);

        return;
    }

    const oldLevel =
        player.castle;

    const newLevel =
        oldLevel + 1;

    const powerGain =
        oldLevel * 1000;

    const xpGain =
        oldLevel * 100;

    db.prepare(`
        UPDATE players

        SET

            castle = ?,

            power = power + ?,

            commander_xp =
                commander_xp + ?,

            castle_upgrade_end = 0

        WHERE id = ?
    `).run(

        newLevel,

        powerGain,

        xpGain,

        player.id
    );

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
   CASTLE TIMER
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

    for (const player of players) {

        completeCastleUpgrade(player);
    }
}

setInterval(
    processCastleUpgrades,
    1000
);

/* =========================
   COLLECT RESOURCES
========================= */

app.post(
    "/api/player/:id/collect",
    (req, res) => {

        const player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
            });
        }

        db.prepare(`
            UPDATE players

            SET

                food = food + 1000,

                wood = wood + 1000,

                iron = iron + 500,

                gold = gold + 200

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

            message:
                "🌾 تم جمع الموارد!",

            player:
                publicPlayer(updated)
        });
    }
);

/* =========================
   TRAINING SYSTEM
========================= */

/*
   كل تدريب = 100 جندي
   الطعام = 500
   الوقت = 30 ثانية
*/

function getTrainingTime(amount) {

    return 30000;
}


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
        Math.floor(
            amount * 1.3
        );

    db.prepare(`
        UPDATE players

        SET

            troops =
                troops + ?,

            power =
                power + ?,

            training_end = 0,

            training_amount = 0

        WHERE id = ?
    `).run(

        amount,

        powerGain,

        player.id
    );

    const updated =
        getPlayer(player.id);

    io.emit(
        "trainingFinished",
        {

            playerId:
                player.id,

            amount:
                amount
        }
    );

    io.emit(
        "playerUpdated",
        publicPlayer(updated)
    );
}

/* =========================
   START TRAINING
========================= */

app.post(
    "/api/player/:id/train",
    (req, res) => {

        let player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
            });
        }

        /* إذا انتهى تدريب سابق */

        if (
            player.training_end > 0 &&
            player.training_end <= Date.now()
        ) {

            completeTraining(player);

            player =
                getPlayer(player.id);
        }

        /* هل يوجد تدريب جارٍ؟ */

        if (
            player.training_end >
            Date.now()
        ) {

            const remaining =
                player.training_end -
                Date.now();

            return res.status(400).json({

                error:
                    "⚔️ يوجد تدريب جارٍ بالفعل.",

                remaining,

                player:
                    publicPlayer(player)
            });
        }

        const amount =
            100;

        const foodCost =
            500;

        if (
            player.food <
            foodCost
        ) {

            return res.status(400).json({

                error:
                    "🍎 الطعام غير كافٍ.",

                player:
                    publicPlayer(player)
            });
        }

        const duration =
            getTrainingTime(amount);

        const endTime =
            Date.now() +
            duration;

        db.prepare(`
            UPDATE players

            SET

                food =
                    food - ?,

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
                "⚔️ بدأ تدريب 100 جندي! مدة التدريب 30 ثانية.",

            player:
                publicPlayer(updated)
        });
    }
);

/* =========================
   TRAINING TIMER
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

    for (const player of players) {

        completeTraining(player);
    }
}

setInterval(
    processTraining,
    1000
);

/* =========================
   WORLD
========================= */

app.get(
    "/api/world/:kingdom",
    (req, res) => {

        const kingdom =
            Number(
                req.params.kingdom
            );

        const players =
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

                WHERE kingdom = ?
            `).all(kingdom);

        const zombies =
            db.prepare(`
                SELECT *
                FROM zombies
            `).all();

        const forts =
            db.prepare(`
                SELECT *
                FROM forts
            `).all();

        const marches =
            db.prepare(`
                SELECT *
                FROM marches

                WHERE status = 'marching'
            `).all();

        res.json({

            players,

            zombies,

            forts,

            marches
        });
    }
);

/* =========================
   RANKING
========================= */

app.get(
    "/api/ranking/:kingdom",
    (req, res) => {

        const players =
            db.prepare(`
                SELECT

                    id,

                    name,

                    castle,

                    power,

                    troops

                FROM players

                WHERE kingdom = ?

                ORDER BY power DESC

                LIMIT 100
            `).all(
                req.params.kingdom
            );

        res.json(players);
    }
);

/* =========================
   MOVE PLAYER
========================= */

app.post(
    "/api/player/:id/move",
    (req, res) => {

        const player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
            });
        }

        let x =
            Number(req.body.x);

        let y =
            Number(req.body.y);

        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {

            return res.status(400).json({

                error:
                    "الموقع غير صحيح"
            });
        }

        x =
            Math.max(
                0,
                Math.min(100, x)
            );

        y =
            Math.max(
                0,
                Math.min(100, y)
            );

        db.prepare(`
            UPDATE players

            SET

                x = ?,

                y = ?

            WHERE id = ?
        `).run(

            x,

            y,

            player.id
        );

        io.emit(
            "playerMoved",
            {

                id:
                    player.id,

                x,

                y
            }
        );

        res.json({

            success: true,

            player:
                publicPlayer(
                    getPlayer(
                        player.id
                    )
                )
        });
    }
);

/* =========================
   SEND MARCH
========================= */

app.post(
    "/api/player/:id/march",
    (req, res) => {

        const player =
            getPlayer(
                req.params.id
            );

        if (!player) {

            return res.status(404).json({

                error:
                    "اللاعب غير موجود"
            });
        }

        const targetType =
            req.body.targetType;

        const targetId =
            Number(
                req.body.targetId
            );

        let target = null;

        if (
            targetType ===
            "zombie"
        ) {

            target =
                db.prepare(`
                    SELECT *
                    FROM zombies
                    WHERE id = ?
                `).get(
                    targetId
                );
        }

        if (
            targetType ===
            "fort"
        ) {

            target =
                db.prepare(`
                    SELECT *
                    FROM forts
                    WHERE id = ?
                `).get(
                    targetId
                );
        }

        if (!target) {

            return res.status(404).json({

                error:
                    "الهدف غير موجود"
            });
        }

        if (player.troops < 100) {

            return res.status(400).json({

                error:
                    "⚔️ لا يوجد عدد كافٍ من الجنود"
            });
        }

        let troops =
            Number(
                req.body.troops
            );

        if (
            !Number.isFinite(troops) ||
            troops <= 0
        ) {

            troops = 100;
        }

        troops =
            Math.floor(
                Math.min(
                    troops,
                    player.troops
                )
            );

        const now =
            Date.now();

        const distance =
            Math.sqrt(

                Math.pow(
                    target.x - player.x,
                    2
                )

                +

                Math.pow(
                    target.y - player.y,
                    2
                )
            );

        const travelTime =
            Math.max(
                3000,
                Math.floor(
                    distance * 1000
                )
            );

        const arrival =
            now + travelTime;

        db.prepare(`
            UPDATE players

            SET

                troops =
                    troops - ?

            WHERE id = ?
        `).run(

            troops,

            player.id
        );

        const result =
            db.prepare(`
                INSERT INTO marches

                (
                    player_id,

                    target_type,

                    target_id,

                    start_x,

                    start_y,

                    target_x,

                    target_y,

                    troops,

                    start_time,

                    arrival_time,

                    status
                )

                VALUES

                (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, 'marching'
                )
            `).run(

                player.id,

                targetType,

                targetId,

                player.x,

                player.y,

                target.x,

                target.y,

                troops,

                now,

                arrival
            );

        const march =
            db.prepare(`
                SELECT *
                FROM marches
                WHERE id = ?
            `).get(
                result.lastInsertRowid
            );

        io.emit(
            "marchCreated",
            march
        );

        res.json({

            success: true,

            message:
                "⚔️ المسيرة انطلقت!",

            march
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

    for (const march of marches) {

        let enemy = null;

        if (
            march.target_type ===
            "zombie"
        ) {

            enemy =
                db.prepare(`
                    SELECT *
                    FROM zombies
                    WHERE id = ?
                `).get(
                    march.target_id
                );
        }

        if (
            march.target_type ===
            "fort"
        ) {

            enemy =
                db.prepare(`
                    SELECT *
                    FROM forts
                    WHERE id = ?
                `).get(
                    march.target_id
                );
        }

        if (!enemy) {

            db.prepare(`
                UPDATE marches

                SET status = 'finished'

                WHERE id = ?
            `).run(
                march.id
            );

            continue;
        }

        const playerPower =
            march.troops * 10;

        const enemyPower =
            enemy.power;

        let result;

        let lost;

        if (
            playerPower >=
            enemyPower
        ) {

            result =
                "victory";

            lost =
                Math.max(
                    1,
                    Math.floor(
                        march.troops * 0.1
                    )
                );

        } else {

            result =
                "defeat";

            lost =
                Math.max(
                    1,
                    Math.floor(
                        march.troops * 0.5
                    )
                );
        }

        const survivors =
            Math.max(
                0,
                march.troops - lost
            );

        db.prepare(`
            UPDATE players

            SET

                troops =
                    troops + ?

            WHERE id = ?
        `).run(

            survivors,

            march.player_id
        );

        db.prepare(`
            INSERT INTO battle_reports

            (
                player_id,

                target_type,

                target_id,

                result,

                troops_sent,

                troops_lost,

                enemy_power,

                created_at
            )

            VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(

            march.player_id,

            march.target_type,

            march.target_id,

            result,

            march.troops,

            lost,

            enemyPower,

            now
        );

        db.prepare(`
            UPDATE marches

            SET status = ?

            WHERE id = ?
        `).run(

            result,

            march.id
        );

        io.emit(
            "battleFinished",
            {

                marchId:
                    march.id,

                playerId:
                    march.player_id,

                targetType:
                    march.target_type,

                targetId:
                    march.target_id,

                result,

                troopsSent:
                    march.troops,

                troopsLost:
                    lost
            }
        );

        const updatedPlayer =
            getPlayer(
                march.player_id
            );

        io.emit(
            "playerUpdated",
            publicPlayer(
                updatedPlayer
            )
        );
    }
}

setInterval(
    processMarches,
    1000
);

/* =========================
   BATTLE REPORTS
========================= */

app.get(
    "/api/reports/:playerId",
    (req, res) => {

        const reports =
            db.prepare(`
                SELECT *
                FROM battle_reports

                WHERE player_id = ?

                ORDER BY created_at DESC

                LIMIT 50
            `).all(
                req.params.playerId
            );

        res.json(reports);
    }
);

/* =========================
   SOCKET.IO
========================= */

io.on(
    "connection",
    (socket) => {

        console.log(
            "Player connected:",
            socket.id
        );

        socket.emit(
            "world",
            {

                kingdom: 1,

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

                        WHERE kingdom = 1
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

                        WHERE status =
                            'marching'
                    `).all()
            }
        );

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "Player disconnected:",
                    socket.id
                );
            }
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

            game:
                "Kardous Survival",

            status:
                "online",

            kingdom:
                1,

            multiplayer:
                true,

            world:
                true,

            zombies:
                true,

            forts:
                true,

            marches:
                true,

            battles:
                true,

            reports:
                true,

            castleUpgrade:
                true,

            training:
                true,

            castleMaxLevel:
                30,

            trainingAmount:
                100,

            trainingTime:
                30,

            version:
                "10.0"
        });
    }
);

/* =========================
   START SERVER
========================= */

server.listen(

    PORT,

    "0.0.0.0",

    () => {

        console.log(
            "================================"
        );

        console.log(
            "KARDOUS SURVIVAL"
        );

        console.log(
            "MULTIPLAYER SERVER ONLINE"
        );

        console.log(
            "KINGDOM #1"
        );

        console.log(
            "WORLD SYSTEM ONLINE"
        );

        console.log(
            "BATTLES ONLINE"
        );

        console.log(
            "LOGIN SYSTEM ONLINE"
        );

        console.log(
            "CASTLE UPGRADE SYSTEM ONLINE"
        );

        console.log(
            "CASTLE LEVELS: 1-30"
        );

        console.log(
            "TROOP TRAINING SYSTEM ONLINE"
        );

        console.log(
            "TRAINING: 100 TROOPS / 30 SECONDS"
        );

        console.log(
            "PORT:",
            PORT
        );

        console.log(
            "VERSION: 10.0"
        );

        console.log(
            "================================"
        );
    }
);
