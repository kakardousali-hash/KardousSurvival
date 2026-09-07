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
    commander_xp INTEGER NOT NULL DEFAULT 0
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
   DEFAULT PLAYER
========================= */

const playerCount = db.prepare(
    "SELECT COUNT(*) AS count FROM players"
).get().count;

if (playerCount === 0) {
    db.prepare(`
        INSERT INTO players
        (name, kingdom, x, y)
        VALUES (?, ?, ?, ?)
    `).run("Kardous", 1, 50, 50);
}

/* =========================
   ZOMBIES
========================= */

const zombieCount = db.prepare(
    "SELECT COUNT(*) AS count FROM zombies"
).get().count;

if (zombieCount === 0) {

    const addZombie = db.prepare(`
        INSERT INTO zombies
        (name, x, y, level, power)
        VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 20; i++) {

        const x = Math.random() * 90 + 5;
        const y = Math.random() * 90 + 5;
        const level = Math.floor(Math.random() * 10) + 1;
        const power = level * 1000;

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

const fortCount = db.prepare(
    "SELECT COUNT(*) AS count FROM forts"
).get().count;

if (fortCount === 0) {

    const addFort = db.prepare(`
        INSERT INTO forts
        (name, x, y, level, power)
        VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 1; i <= 5; i++) {

        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        const level = i;
        const power = level * 10000;

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
   HELPERS
========================= */

function getPlayer(id) {

    return db.prepare(
        "SELECT * FROM players WHERE id = ?"
    ).get(id);
}

function publicPlayer(player) {

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
            level: player.commander_level,
            experience: player.commander_xp
        }
    };
}

/* =========================
   MAIN PAGE
========================= */

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

/* =========================
   PLAYER
========================= */

app.get("/api/player/:id", (req, res) => {

    const player = getPlayer(req.params.id);

    if (!player) {

        return res.status(404).json({
            error: "اللاعب غير موجود"
        });
    }

    res.json(
        publicPlayer(player)
    );
});

/* =========================
   WORLD
========================= */

app.get("/api/world/:kingdom", (req, res) => {

    const kingdom = Number(
        req.params.kingdom
    );

    const players = db.prepare(`
        SELECT id, name, kingdom, x, y, castle, power
        FROM players
        WHERE kingdom = ?
    `).all(kingdom);

    const zombies = db.prepare(`
        SELECT *
        FROM zombies
    `).all();

    const forts = db.prepare(`
        SELECT *
        FROM forts
    `).all();

    const marches = db.prepare(`
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
});

/* =========================
   RANKING
========================= */

app.get("/api/ranking/:kingdom", (req, res) => {

    const players = db.prepare(`
        SELECT id, name, castle, power, troops
        FROM players
        WHERE kingdom = ?
        ORDER BY power DESC
        LIMIT 100
    `).all(req.params.kingdom);

    res.json(players);
});

/* =========================
   COLLECT
========================= */

app.post("/api/player/:id/collect", (req, res) => {

    const player = getPlayer(req.params.id);

    if (!player) {

        return res.status(404).json({
            error: "اللاعب غير موجود"
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
        message: "تم جمع الموارد!",
        player: publicPlayer(updated)
    });
});

/* =========================
   TRAIN
========================= */

app.post("/api/player/:id/train", (req, res) => {

    const player =
        getPlayer(req.params.id);

    if (!player) {

        return res.status(404).json({
            error: "اللاعب غير موجود"
        });
    }

    if (player.food < 500) {

        return res.status(400).json({
            error: "الطعام غير كافٍ"
        });
    }

    db.prepare(`
        UPDATE players
        SET
            food = food - 500,
            troops = troops + 100,
            power = power + 130
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
        message: "تم تدريب 100 جندي!",
        player: publicPlayer(updated)
    });
});

/* =========================
   CASTLE UPGRADE
========================= */

app.post(
    "/api/player/:id/upgrade-castle",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود"
            });
        }

        if (player.castle >= 30) {

            return res.status(400).json({
                error: "القلعة وصلت إلى المستوى 30"
            });
        }

        const level =
            player.castle;

        const wood =
            level * 1000;

        const iron =
            level * 600;

        const gold =
            level * 250;

        const food =
            level * 500;

        if (
            player.wood < wood ||
            player.iron < iron ||
            player.gold < gold ||
            player.food < food
        ) {

            return res.status(400).json({
                error: "الموارد غير كافية"
            });
        }

        db.prepare(`
            UPDATE players
            SET
                wood = wood - ?,
                iron = iron - ?,
                gold = gold - ?,
                food = food - ?,
                castle = castle + 1,
                power = power + ?,
                commander_xp = commander_xp + ?
            WHERE id = ?
        `).run(
            wood,
            iron,
            gold,
            food,
            level * 1000,
            level * 100,
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
            message: "تم تطوير القلعة!",
            player: publicPlayer(updated)
        });
    }
);

/* =========================
   MOVE
========================= */

app.post(
    "/api/player/:id/move",
    (req, res) => {

        const player =
            getPlayer(req.params.id);

        if (!player) {

            return res.status(404).json({
                error: "اللاعب غير موجود"
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
                error: "الموقع غير صحيح"
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
            SET x = ?, y = ?
            WHERE id = ?
        `).run(
            x,
            y,
            player.id
        );

        io.emit(
            "playerMoved",
            {
                id: player.id,
                x,
                y
            }
        );

        res.json({
            success: true,
            player:
                publicPlayer(
                    getPlayer(player.id)
                )
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
                error: "اللاعب غير موجود"
            });
        }

        const targetType =
            req.body.targetType;

        const targetId =
            Number(req.body.targetId);

        let target = null;

        if (targetType === "zombie") {

            target =
                db.prepare(
                    "SELECT * FROM zombies WHERE id = ?"
                ).get(targetId);
        }

        if (targetType === "fort") {

            target =
                db.prepare(
                    "SELECT * FROM forts WHERE id = ?"
                ).get(targetId);
        }

        if (!target) {

            return res.status(404).json({
                error: "الهدف غير موجود"
            });
        }

        if (player.troops < 100) {

            return res.status(400).json({
                error: "لا يوجد عدد كافٍ من الجنود"
            });
        }

        let troops =
            Number(req.body.troops);

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
                ) +
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
            SET troops = troops - ?
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
                (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'marching')
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
            db.prepare(
                "SELECT * FROM marches WHERE id = ?"
            ).get(
                result.lastInsertRowid
            );

        io.emit(
            "marchCreated",
            march
        );

        res.json({
            success: true,
            message: "⚔️ المسيرة انطلقت!",
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
            march.target_type === "zombie"
        ) {

            enemy =
                db.prepare(
                    "SELECT * FROM zombies WHERE id = ?"
                ).get(
                    march.target_id
                );
        }

        if (
            march.target_type === "fort"
        ) {

            enemy =
                db.prepare(
                    "SELECT * FROM forts WHERE id = ?"
                ).get(
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
            playerPower >= enemyPower
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
            SET troops = troops + ?
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
                marchId: march.id,
                playerId: march.player_id,
                targetType: march.target_type,
                targetId: march.target_id,
                result,
                troopsSent: march.troops,
                troopsLost: lost
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
                        WHERE status = 'marching'
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
            game: "Kardous Survival",
            status: "online",
            kingdom: 1,
            multiplayer: true,
            world: true,
            zombies: true,
            forts: true,
            marches: true,
            battles: true,
            reports: true,
            version: "8.1"
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
            "PORT:",
            PORT
        );

        console.log(
            "================================"
        );
    }
);
