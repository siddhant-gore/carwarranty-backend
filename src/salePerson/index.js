const express = require("express");
const router = express.Router();
const { auth, authRole } = require("../../middlewares/auth");

const { postSingleImage } = require("../admin/adminController");
const { upload } = require("../../utils/s3");

const { getAllWarranty, getWarranty, updateWarranty } = require("../warranty");
const { getStatistics } = require("./saleController");

router.get("/warranty", auth, authRole('sale-person'), getAllWarranty);
router.route("/warranty/:id")
  .get(auth, authRole("sale-person"), getWarranty)
  .put(auth, authRole('sale-person'), updateWarranty);

router.get('/statistics', auth, authRole('sale-person'), getStatistics);
router.post("/upload-doc", auth, authRole('sale-person'), upload.single('doc'), postSingleImage);

module.exports = router;
