const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { getAllTransaction, getTransaction } = require("./transaction.controller");


router.get("/my-transactions", auth, getAllTransaction);
router.get("/my-transaction/:id", auth, getTransaction);
  
module.exports = router;
