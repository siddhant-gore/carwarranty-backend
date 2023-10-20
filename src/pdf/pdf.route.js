const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");

const { getReceipt } = require("./pdf.controller");

router.get("/receipt/:id", auth, getReceipt);

module.exports = router;
