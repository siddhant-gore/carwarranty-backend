const express = require("express");
const router = express.Router();
const { auth } = require("../../middlewares/auth");
const { singleImage } = require("../../middlewares/uploadImage");
const { createUser, getUser, login, updateProfile, updatePassword, forgotPassword, resetPassword } = require("./user.controller");
const { upload } = require("../../utils/s3");

router.post("/register", createUser);
router.post("/login", login);
router.get("/profile", auth, getUser);
router.put("/update-profile/image", auth, upload.single("profile_img"), singleImage, updateProfile);
router.put("/update-profile", auth, updateProfile);
router.put("/update-password", auth, updatePassword);
router.post("/password/forgot", forgotPassword);
router.put("/password/reset/:token", resetPassword);

module.exports = router;
