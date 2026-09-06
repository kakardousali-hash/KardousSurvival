const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Kardous Survival is online! 🎮");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Kardous Survival running on port ${PORT}`);
});
