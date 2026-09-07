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
`);

const countPlayers = db.prepare(
    "SELECT COUNT(*) AS count FROM players"
).get().count;

if (countPlayers === 0) {
    db.prepare(`
        INSERT INTO players
        (name, kingdom, x, y)
        VALUES (?, ?, ?, ?)
    `).run("Kardous", 1, 50, 50);
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
    res.sendFile(path.join(__dirname, "index.html"));
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

    res.json(publicPlayer(player));
});

/* =========================
   WORLD PLAYERS
========================= */

app.get("/api/world/:kingdom", (req, res) => {

    const players = db.prepare(`
        SELECT id, name, kingdom, x, y, castle, power
        FROM players
        WHERE kingdom = ?
    `).all(req.params.kingdom);

    res.json(players);
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
   COLLECT RESOURCES
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

    const updated = getPlayer(player.id);

    io.emit("playerUpdated", publicPlayer(updated));

    res.json({
        success: true,
        message: "تم جمع الموارد!",
        player: publicPlayer(updated)
    });
});

/* =========================
   TRAIN TROOPS
========================= */

app.post("/api/player/:id/train", (req, res) => {

    const player = getPlayer(req.params.id);

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

    const updated = getPlayer(player.id);

    io.emit("playerUpdated", publicPlayer(updated));

    res.json({
        success: true,
        message: "تم تدريب 100 جندي!",
        player: publicPlayer(updated)
    });
});

/* =========================
   CASTLE UPGRADE
========================= */

app.post("/api/player/:id/upgrade-castle", (req, res) => {

    const player = getPlayer(req.params.id);

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

    const level = player.castle;

    const wood = level * 1000;
    const iron = level * 600;
    const gold = level * 250;
    const food = level * 500;

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

    const updated = getPlayer(player.id);

    io.emit("playerUpdated", publicPlayer(updated));

    res.json({
        success: true,
        message: "تم تطوير القلعة!",
        player: publicPlayer(updated)
    });
});

/* =========================
   MOVE PLAYER
========================= */

app.post("/api/player/:id/move", (req, res) => {

    const player = getPlayer(req.params.id);

    if (!player) {
        return res.status(404).json({
            error: "اللاعب غير موجود"
        });
    }

    let x = Number(req.body.x);
    let y = Number(req.body.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return res.status(400).json({
            error: "الموقع غير صحيح"
        });
    }

    x = Math.max(0, Math.min(100, x));
    y = Math.max(0, Math.min(100, y));

    db.prepare(`
        UPDATE players
        SET x = ?, y = ?
        WHERE id = ?
    `).run(x, y, player.id);

    const updated = getPlayer(player.id);

    io.emit("playerMoved", {
        id: updated.id,
        x: updated.x,
        y: updated.y
    });

    res.json({
        success: true,
        player: publicPlayer(updated)
    });
});

/* =========================
   SOCKET.IO
========================= */

io.on("connection", (socket) => {

    console.log("Player connected:", socket.id);

    socket.emit("world", {
        kingdom: 1,
        players: db.prepare(`
            SELECT id, name, x, y, castle, power
            FROM players
            WHERE kingdom = 1
        `).all()
    });

    socket.on("disconnect", () => {
        console.log("Player disconnected:", socket.id);
    });
});

/* =========================
   STATUS
========================= */

app.get("/api/status", (req, res) => {

    res.json({
        game: "Kardous Survival",
        status: "online",
        kingdom: 1,
        multiplayer: true,
        version: "7.0"
    });
});

/* =========================
   START SERVER
========================= */

server.listen(PORT, "0.0.0.0", () => {

    console.log("================================");
    console.log("KARDOUS SURVIVAL");
    console.log("MULTIPLAYER SERVER ONLINE");
    console.log("KINGDOM #1");
    console.log("PORT:", PORT);
    console.log("================================");

});
