const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { updateAfterPayment } = require("./payment.controller");

router.post("/update", updateAfterPayment);

module.exports = router;
