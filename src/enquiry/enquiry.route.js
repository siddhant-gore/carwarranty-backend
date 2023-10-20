const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { createEnquiry } = require("./enquiry.controller");

router.post("/", createEnquiry);

module.exports = router;
