const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { getLevelSuggestion, getAllLevel } = require("./level.controller");

router.get("/", auth, getAllLevel);
router.get("/plan", auth, getLevelSuggestion);

module.exports = router;
