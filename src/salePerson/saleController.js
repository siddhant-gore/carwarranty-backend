const userModel = require("../user/user.model");
const warrantyModel = require("../warranty/warranty.model");
const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { s3Uploadv2, s3UploadMulti } = require("../../utils/s3");
const { transactionModel } = require("../transaction");
const { default: mongoose } = require("mongoose");

exports.getStatistics = catchAsyncError(async (req, res, next) => {
  // const { time } = req.params;
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  let startDate = new Date(date.getFullYear(), 0, 1);
  var days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  var week = Math.ceil(days / 7);
console.log(req.userId);
  // if (time === "all") {
  const awaited = await warrantyModel.aggregate([
    { $match: { salePerson: new mongoose.Types.ObjectId(req.userId), status: "inspection-awaited" } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);
  const rejected = await warrantyModel.aggregate([
    {
      $match: { salePerson: new mongoose.Types.ObjectId(req.userId), status: "inspection-failed" }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);
  const passed = await warrantyModel.aggregate([
    {
      $match: { salePerson: new mongoose.Types.ObjectId(req.userId), status: "inspection-passed" }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
      },
    },
  ]);

  console.log({awaited});
  return res.send({
    awaited,
    rejected,
    passed,
  });
});
