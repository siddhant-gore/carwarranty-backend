const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { createWarranty, createPaypalOrder, getMyWarranties, getWarranty, create2PaypalOrder, create2Warranty, checkWarranty } = require("./warranty.controller");

router.post("/create-paypal-order", auth, createPaypalOrder);
router.post("/capture-paypal-payment", auth, createWarranty);
// router.post("/create-paypal-order/:id", auth, create2PaypalOrder);
// router.post("/capture-paypal-payment/:id", auth, create2Warranty);
router.get("/my-warranties", auth, getMyWarranties);
router.get("/my-warranty/:id", auth, getWarranty);

router.post("/check", checkWarranty);

module.exports = router;
