const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

const players = {
  1: {
    id: 1,
    name: "Kardous",
    castle: 1,
    stars: 0,

    power: 5000,

    food: 15000,
    wood: 12000,
    iron: 8000,
    gold: 3000,

    troops: 1000,

    commander: {
      name: "Kardous",
      level: 1,
      experience: 0,
      talentPoints: 0
    },

    heroes: [
      {
        id: 1,
        name: "Kardous Guard",
        level: 1,
        power: 500
      }
    ]
  }
};

function getPlayer(id) {
  return players[id];
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// معلومات اللاعب
app.get("/api/player/:id", (req, res) => {
  const player = getPlayer(req.params.id);

  if (!player) {
    return res.status(404).json({
      error: "اللاعب غير موجود"
    });
  }

  res.json(player);
});

// جميع اللاعبين
app.get("/api/players", (req, res) => {
  const list = Object.values(players)
    .sort((a, b) => b.power - a.power)
    .slice(0, 50)
    .map(player => ({
      id: player.id,
      name: player.name,
      castle: player.castle,
      stars: player.stars,
      power: player.power
    }));

  res.json(list);
});

// ترقية القلعة
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

  const woodCost = level * 1000;
  const ironCost = level * 600;
  const goldCost = level * 250;
  const foodCost = level * 500;

  if (
    player.wood < woodCost ||
    player.iron < ironCost ||
    player.gold < goldCost ||
    player.food < foodCost
  ) {
    return res.status(400).json({
      error: "الموارد غير كافية",
      required: {
        wood: woodCost,
        iron: ironCost,
        gold: goldCost,
        food: foodCost
      }
    });
  }

  player.wood -= woodCost;
  player.iron -= ironCost;
  player.gold -= goldCost;
  player.food -= foodCost;

  player.castle += 1;
  player.power += level * 1000;

  player.commander.experience += level * 100;

  if (player.commander.experience >= 1000) {
    player.commander.level += 1;
    player.commander.experience -= 1000;
    player.commander.talentPoints += 1;
  }

  res.json({
    success: true,
    message: "تم تطوير القلعة!",
    player
  });
});

// تدريب الجنود
app.post("/api/player/:id/train", (req, res) => {
  const player = getPlayer(req.params.id);

  if (!player) {
    return res.status(404).json({
      error: "اللاعب غير موجود"
    });
  }

  const amount = 100;
  const foodCost = 500;

  if (player.food < foodCost) {
    return res.status(400).json({
      error: "الطعام غير كافٍ"
    });
  }

  player.food -= foodCost;
  player.troops += amount;
  player.power += 130;

  res.json({
    success: true,
    message: "تم تدريب 100 جندي!",
    player
  });
});

// جمع الموارد
app.post("/api/player/:id/collect", (req, res) => {
  const player = getPlayer(req.params.id);

  if (!player) {
    return res.status(404).json({
      error: "اللاعب غير موجود"
    });
  }

  player.food += 1000;
  player.wood += 1000;
  player.iron += 500;
  player.gold += 200;

  res.json({
    success: true,
    message: "تم جمع الموارد!",
    player
  });
});

// إضافة بطل
app.post("/api/player/:id/hero", (req, res) => {
  const player = getPlayer(req.params.id);

  if (!player) {
    return res.status(404).json({
      error: "اللاعب غير موجود"
    });
  }

  const heroNumber = player.heroes.length + 1;

  player.heroes.push({
    id: heroNumber,
    name: "Hero " + heroNumber,
    level: 1,
    power: 1000
  });

  player.power += 1000;

  res.json({
    success: true,
    message: "تم الحصول على بطل جديد!",
    player
  });
});

// حالة الخادم
app.get("/api/status", (req, res) => {
  res.json({
    game: "Kardous Survival",
    status: "online",
    version: "6.0"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("================================");
  console.log("KARDOUS SURVIVAL");
  console.log("Server is ONLINE");
  console.log("Port: " + PORT);
  console.log("================================");
});
