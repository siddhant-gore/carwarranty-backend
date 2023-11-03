const userModel = require("../user/user.model");
const warrantyModel = require("../warranty/warranty.model");
const catchAsyncError = require("../../utils/catchAsyncError");
const ErrorHandler = require("../../utils/errorHandler");
const { s3Uploadv2, s3UploadMulti } = require("../../utils/s3");
const { transactionModel } = require("../transaction");
const { enquiryModel } = require("../enquiry");
const APIFeatures = require("../../utils/apiFeatures");

exports.postSingleImage = catchAsyncError(async (req, res, next) => {
  const file = req.file;
  if (!file) return next(new ErrorHandler("Invalid File (Image/PDF).", 401));

  const results = await s3Uploadv2(file);
  const location = results.Location && results.Location;
  return res.status(201).json({ data: { location } });
});

exports.postMultipleImages = catchAsyncError(async (req, res, next) => {
  const files = req.files;
  if (files) {
    const results = await s3UploadMulti(files);
    console.log(results);
    let location = [];
    results.filter((result) => {
      location.push(result.Location);
    });
    return res.status(201).json({ data: { location } });
  } else {
    return next(new ErrorHandler("Invalid Image", 401));
  }
});

exports.getSummary = catchAsyncError(async (req, res, next) => {
  const today = new Date();
  const thirtyDaysFromNow = new Date().setDate(today.getDate() + 30);

  const awaited = await warrantyModel.count({ "status.value": 'inspection-awaited' });
  const passed = await warrantyModel.count({ "status.value": ["inspection-passed", "order-placed", "doc-delivered"] });
  const active = await warrantyModel.count({ "status.value": 'doc-delivered' });
  const toExpired = await warrantyModel.count({
    expiry_date: {
      $gte: today,
      $lte: thirtyDaysFromNow,
    }
  });
  const rejected = await warrantyModel.count({ "status.value": 'inspection-failed' });
  const expired = await warrantyModel.count({ expiry_date: { $lte: today } });
  const enquiry = await enquiryModel.count();

  res.status(200).json({
    awaited, passed, active, toExpired, rejected, expired, enquiry
  })
});

//siddhant ka code

exports.getNewUsers = catchAsyncError(async (req, res, next) => {
  // const newUsers = await userModel.find({
  //   _id: {
  //     $nin: await warrantyModel.distinct("user")
  //   }

  // });

  const apiFeature = new APIFeatures(
    userModel.find({
      _id: {
        $nin: await warrantyModel.distinct("user")
      }
  
    }).sort({createdAt: -1}),req.query
  ).search();

 let newUsers = await apiFeature.query;
 
 let newUsersCount = newUsers.length;
  
 if (req.query.resultPerPage && req.query.currentPage) {
  apiFeature.pagination();  
  newUsers = await apiFeature.query.clone();
}
  

  res.status(200).json({ newUsers, newUsersCount });

});

// yaha tak

//ye leads may bhi edit kiya hai: 
exports.getLeads = catchAsyncError(async (req, res, next) => {

  

  
  let leads = await warrantyModel.aggregate([
    {
      $lookup: {
        localField: "_id",
        foreignField: "warranty",
        from: "transactions",
        as: "transaction"
      }
    },
    { $unwind: "$transaction" },
    {
      $lookup: {
        localField: "user",
        foreignField: "_id",
        from: "users",
        as: "user"
      }
    },
    { $unwind: "$user" },
    {
      $project: {
        user: 1,
        status: {
          $cond: {
            if: { $eq: ["$transaction.status", "fail"] },
            then: "fail",
            else: {
              $cond: {
                if: { $lte: ["$expiry_date", new Date()] },
                then: "expired",
                else: {
                  $cond: {
                    if: { $eq: ["$status.value", "refunded"] },
                    then: "refunded",
                    else: null
                  }
                }
              }
            }
          }
        },
        updatedAt: {
          $cond: {
            if: { $eq: ["$transaction.status", "fail"] },
            then: "$transaction.updatedAt",
            else: {
              $cond: {
                if: { $lte: ["$expiry_date", new Date()] },
                then: "$expiry_date",
                else: {
                  $cond: {
                    if: { $eq: ["$status.value", "refunded"] },
                    then: "$status.statusAt",
                    else: null
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      $match: {
        status: { $in: ["fail", "expired", "refunded"] }
      }
    },
    { $sort: { updatedAt: -1 } }
  ]);

  const regex = new RegExp(req.query.keyword,'i');

  leads = leads.filter(lead=>{

    const user = lead.user;

    return (
      (user.firstname?.match(regex) || '').length > 0 ||
      (user.lastname?.match(regex) || '').length > 0 ||
      (user.email?.match(regex) || '').length > 0 ||
      (user.mobile_no?.match(regex) || '').length > 0
    );
  })

  const leadsCount = leads.length;

  //   const results = await warrantyModel.aggregate(aggregatePipeline).exec();

  //   ])
  // const leads = await warrantyModel.aggregate([
  //   {
  //     $lookup: {
  //       from: "transactions",
  //       localField: "_id",
  //       foreignField: "warranty",
  //       as: "transaction"
  //     }
  //   },
  //   { $unwind: "$transaction" },
  //   {
  //     $lookup: {
  //       localField: "user",
  //       foreignField: "_id",
  //       from: "users",
  //       as: "user"
  //     }
  //   },
  //   { $unwind: "$user" },
  //   { $match: { "transaction.status": "fail" } },
  //   {
  //     $project: {
  //       user: 1,
  //       status: "fail",
  //       updatedAt: "$transaction.updatedAt"
  //     }
  //   }
  // ]);
  // const expired = await warrantyModel.find({ expiry_date: { $lte: new Date() } }).populate("user");
  // const refunded = await warrantyModel.find({ status: "refunded" }).populate("user");

  res.status(200).json({ leads , leadsCount});
  // leads: [
  //   ...failed,
  //   ...expired.map((data) => {
  //     return { user: data.user, status: "expired" }
  //   }),
  //   ...refunded.map((data) => {
  //     console.log({ data });
  //     return { user: data.user, status: data.status, updatedAt: data.updatedAt }
  //   })]
  // });
});

const getRefund = async (time) => {
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  let startDate = new Date(date.getFullYear(), 0, 1);
  var days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  var week = Math.ceil(days / 7);

  const pipeline = time === "month" ? [
    {
      $lookup: {
        from: "warranties",
        localField: "warranty",
        foreignField: "_id",
        as: "warranty"
      }
    },
    { $unwind: "$warranty" },
    { $match: { "warranty.status.value": "refunded" } },
    {
      $project: {
        year: { $year: '$warranty.status.statusAt' },
        month: { $month: '$warranty.status.statusAt' },
        day: { $dayOfMonth: '$warranty.status.statusAt' },
        amount: 1, // Replace 'amount' with your actual sales amount field
      },
    },
    { $match: { year: year, month: month } },
    {
      $group: {
        _id: {
          year: '$year',
          month: '$month',
          week: {
            $ceil: {
              $divide: ['$day', 7],
            },
          },
        },
        totalSales: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.week': 1 } },
    {
      $project: {
        _id: 0,
        // year: '$_id.year',
        // month: '$_id.month',
        week: '$_id.week',
        totalSales: 1,
      },
    }
  ] : [
    {
      $lookup: {
        from: "warranties",
        localField: "warranty",
        foreignField: "_id",
        as: "warranty"
      }
    },
    { $unwind: "$warranty" },
    { $match: { "warranty.status.value": "refunded" } },
    {
      $project: {
        year: { $year: '$warranty.status.statusAt' },
        month: { $month: '$warranty.status.statusAt' },
        amount: 1, // Replace 'amount' with your actual sales amount field
      },
    },
    { $match: { year: year } },
    {
      $group: {
        _id: {
          year: '$year',
          month: '$month',
        },
        totalSales: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        // year: '$_id.year',
        month: '$_id.month',
        // week: '$_id.week',
        totalSales: 1,
      },
    },
  ];

  return await transactionModel.aggregate(pipeline);
}
exports.getStatistics = catchAsyncError(async (req, res, next) => {
  const { time } = req.params;
  const date = new Date();
  date.setHours(24, 0, 0, 0);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  let startDate = new Date(date.getFullYear(), 0, 1);
  var days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  var week = Math.ceil(days / 7);

  console.log({ time })
  const pipeline = time === "month" ? [
    { $match: { status: "complete" } },
    {
      $project: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        day: { $dayOfMonth: '$createdAt' },
        amount: 1, // Replace 'amount' with your actual sales amount field
      },
    },
    { $match: { year: year, month: month } },
    {
      $group: {
        _id: {
          year: '$year',
          month: '$month',
          week: {
            $ceil: {
              $divide: ['$day', 7],
            },
          },
        },
        totalSales: { $sum: '$amount' },
      },
    },
    { $sort: { '_id.week': 1 } },
    {
      $project: {
        _id: 0,
        // year: '$_id.year',
        // month: '$_id.month',
        week: '$_id.week',
        totalSales: 1,
      },
    }
  ] : [
    { $match: { status: "complete" } },
    {
      $project: {
        year: { $year: '$createdAt' },
        month: { $month: '$createdAt' },
        amount: 1, // Replace 'amount' with your actual sales amount field
      },
    },
    { $match: { year: year } },
    {
      $group: {
        _id: {
          year: '$year',
          month: '$month',
        },
        totalSales: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        // year: '$_id.year',
        month: '$_id.month',
        // week: '$_id.week',
        totalSales: 1,
      },
    },
  ]
  const sales = await transactionModel.aggregate(pipeline);

  const refund = await getRefund(time);

  console.log({ sales })
  // if (time === "all") {
  // const users = await userModel.aggregate([
  //   {
  //     $group: {
  //       _id: null,
  //       total: { $sum: 1 },
  //     },
  //   },
  // ]);
  // const rejected = await warrantyModel.aggregate([
  //   {
  //     $match: { status: "inspection-failed" }
  //   },
  //   {
  //     $group: {
  //       _id: null,
  //       total: { $sum: 1 },
  //     },
  //   },
  // ]);
  // const passed = await warrantyModel.aggregate([
  //   {
  //     $match: { status: "inspection-passed" }
  //   },
  //   {
  //     $group: {
  //       _id: null,
  //       total: { $sum: 1 },
  //     },
  //   },
  // ]);

  return res.send({
    // users,
    // rejected,
    // passed,
    sales,
    refund
  });
  // }
  // if (time === "daily") {
  //   const users = await userModel.aggregate([
  //     {
  //       $match: {
  //         $expr: {
  //           $gt: [
  //             "$createdAt",
  //             { $dateSubtract: { startDate: date, unit: "day", amount: 1 } },
  //           ],
  //         },
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);
  //   const rejected = await warrantyModel.aggregate([
  //     {
  //       $match: { status: "inspection-failed" }
  //     },
  //     {
  //       $match: {
  //         $expr: {
  //           $gt: [
  //             "$createdAt",
  //             { $dateSubtract: { startDate: date, unit: "day", amount: 1 } },
  //           ],
  //         },
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);
  //   const passed = await warrantyModel.aggregate([
  //     {
  //       $match: { status: "inspection-passed" }
  //     },
  //     {
  //       $match: {
  //         $expr: {
  //           $gt: [
  //             "$createdAt",
  //             { $dateSubtract: { startDate: date, unit: "day", amount: 1 } },
  //           ],
  //         },
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);

  //   return res.send({
  //     users,
  //     rejected,
  //     passed,
  //   });
  // }
  // if (time === "weekly") {
  //   const users = await userModel.aggregate([
  //     {
  //       $project: {
  //         week: { $week: "$createdAt" },
  //         year: { $year: "$createdAt" },
  //       },
  //     },
  //     {
  //       $match: {
  //         year: year,
  //         week: week,
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);
  //   const rejected = await warrantyModel.aggregate([
  //     {
  //       $match: { status: "inspection-failed" }
  //     },
  //     {
  //       $project: {
  //         week: { $week: "$createdAt" },
  //         year: { $year: "$createdAt" },
  //       },
  //     },
  //     {
  //       $match: {
  //         year: year,
  //         week: week,
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);
  //   const passed = await warrantyModel.aggregate([
  //     {
  //       $match: { status: "inspection-passed" }
  //     },
  //     {
  //       $project: {
  //         week: { $week: "$createdAt" },
  //         year: { $year: "$createdAt" },
  //       },
  //     },
  //     {
  //       $match: {
  //         year: year,
  //         week: week,
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);

  //   return res.send({
  //     users,
  //     rejected,
  //     passed,
  //   });
  // }
  // if (time === "monthly") {
  //   const users = await userModel.aggregate([
  //     {
  //       $project: {
  //         month: { $month: "$createdAt" },
  //         year: { $year: "$createdAt" },
  //       },
  //     },
  //     {
  //       $match: {
  //         year: year,
  //         month: month,
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);
  //   const rejected = await warrantyModel.aggregate([
  //     {
  //       $match: { status: "inspection-failed" }
  //     },
  //     {
  //       $project: {
  //         month: { $month: "$createdAt" },
  //         year: { $year: "$createdAt" },
  //       },
  //     },
  //     {
  //       $match: {
  //         year: year,
  //         month: month,
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);
  //   const passed = await warrantyModel.aggregate([
  //     {
  //       $match: { status: "inspection-passed" }
  //     },
  //     {
  //       $project: {
  //         month: { $month: "$createdAt" },
  //         year: { $year: "$createdAt" },
  //       },
  //     },
  //     {
  //       $match: {
  //         year: year,
  //         month: month,
  //       },
  //     },
  //     {
  //       $group: {
  //         _id: null,
  //         total: { $sum: 1 },
  //       },
  //     },
  //   ]);

  //   return res.send({
  //     users,
  //     rejected,
  //     passed,
  //   });
  // }
});
