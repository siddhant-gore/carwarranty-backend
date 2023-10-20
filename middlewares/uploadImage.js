const ErrorHandler = require("../utils/errorHandler");
const { s3Uploadv2 } = require("../utils/s3");

exports.singleImage = async (req, res, next) => {
  const file = req.file;
  if (!file) return next(new ErrorHandler("Invalid Image", 400));

  const results = await s3Uploadv2(file);
  const location = results.Location && results.Location;
  req.body.profile_img = location;

  next();
};

