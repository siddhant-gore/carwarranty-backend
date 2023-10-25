const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const APIFeatures = require("../../utils/apiFeatures");
const warrantyModel = require("./warranty.model");
const { isValidObjectId, default: mongoose } = require("mongoose");
const axios = require("axios");
const { createOrder, capturePayment } = require("../../utils/paypal");
const transactionModel = require("../transaction/transaction.model");
const { planModel } = require("../levels/level.model");

const calcExpiryDate = async ({ plan: planID, start_date }) => {
  const plan = await planModel.findById(planID).populate("level");
  const d1 = new Date(start_date);
  const d2 = new Date(start_date).setMonth(d1.getMonth() + plan.month);
  return { expiry_date: d2, level: plan.level.level };
};

const evalLoad = (s, b, type) => {
  let base_laod = 0;
  if (b <= 300) base_laod = 50;
  else if (b <= 400) base_laod = 150;
  else base_laod = 350;

  if (s <= 2500 && type !== '4x4') {
    base_laod -= 50;
  } else if (s > 2500 && type === '4x4') {
    base_laod += 50;
  }

  return base_laod;
}

const calcTotal = (s, b, type, price) => {
  console.log({ size: s, bhp: b, drive_type: type, planPrice: price });
  const loadPercent = evalLoad(s, b, type) * 0.01;
  return price + price * loadPercent;
}

function maskString(inputString) {
  if (typeof inputString !== 'string' || inputString.length < 4) {
    // Input is not a valid string or too short to mask
    return inputString;
  }

  // Extract the first two characters and the last two characters
  const prefix = inputString.slice(0, 2);
  const suffix = inputString.slice(-2);

  // Calculate the number of asterisks needed
  const numAsterisks = inputString.length - 4;
  const maskedChars = '*'.repeat(numAsterisks);

  // Combine the prefix, masked characters, and suffix
  const maskedString = prefix + maskedChars + suffix;

  return maskedString;
}
// Create a new document
// exports.create = catchAsyncError(async (req, res, next) => {
//   console.log("warranty create", req.body);
//   const expiry_date = await calcExpiryDate(req.body);
//   console.log({expiry_date})
//   const warranty = await warrantyModel.create({ ...req.body, expiry_date, user: req.userId });
//   res.status(201).json({ warranty });
// });

exports.create2PaypalOrder = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!id || !isValidObjectId(id))
    return next(new ErrorHandler("Please provide the warranty id.", 400));

  const warranty = await warrantyModel.findById(id).populate("plan");
  if (!warranty)
    return next(new ErrorHandler("Warranty not found.", 404));

  const ttl = calcTotal(
    warranty.vehicleDetails.size,
    warranty.vehicleDetails.bhp,
    warranty.vehicleDetails.drive_type,
    warranty.plan.price
  );
  const data = await createOrder(ttl);

  if (data.status !== 'CREATED')
    return next(new ErrorHandler('Something went wrong', 500));

  res.status(200).json({ data, orderID: data.id });
});

exports.create2Warranty = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  if (!id || !isValidObjectId(id))
    return next(new ErrorHandler("Please provide the warranty id.", 400));

  console.log("create2Warranty as onApprove", req.body)
  const { order } = req.body;

  if (!order) {
    return next(new ErrorHandler("Bad Request", 400));
  }

  const warranty = await warrantyModel.findById(id).populate({
    path: "plan",
    populate: { path: "level" }
  });
  if (!warranty)
    return next(new ErrorHandler("Warranty not found.", 404));

  // capture payment
  const captureData = await capturePayment(order.orderID);
  const { payment_source } = captureData;

  if (payment_source.paypal) {
    var method = "paypal"
    var source_id = payment_source.paypal.account_id;
  } else if (payment_source.card) {
    var method = "card"
    var source_id = payment_source.card.last_digits;
  }
  // after that 2nd half transaction will be create
  await transactionModel.create({
    method, source_id,
    paypalID: {
      orderID: order.orderID,
      paymentID: captureData.purchase_units[0].payments.captures[0].id
    },
    plan: warranty.plan.level.level,
    amount: parseInt(captureData.purchase_units[0].payments.captures[0].amount.value),
    warranty: warranty._id,
    user: req.userId
  });
  warranty.payment = true;
  await warranty.save();

  console.log({ captureData });

  // TODO: store payment information such as the transaction ID
  res.status(200).json({ captureData });
});

exports.createPaypalOrder = catchAsyncError(async (req, res, next) => {
  console.log("Create Paypal Order", req.body);

  const { eng_size, bhp, drive_type, planID } = req.body;
  if (!eng_size || bhp <= 0 || !bhp || !drive_type || !planID) {
    return next(new ErrorHandler("Bad Request", 400));
  }

  const plan = await planModel.findById(planID);
  if (!plan) {
    return next(new ErrorHandler("Plan not found.", 400))
  }

  const ttl = calcTotal(eng_size, bhp, drive_type, plan.price);
  console.log({ plan, ttl });

  const data = await createOrder(ttl);

  if (data.status !== 'CREATED')
    return next(new ErrorHandler('Something went wrong', 500));

  res.status(200).json({ data, orderID: data.id });
});

exports.createWarranty = catchAsyncError(async (req, res, next) => {
  console.log("createWarranty as onApprove", req.body)
  const { order, warrantyData } = req.body;

  if (!order || !warrantyData) {
    return next(new ErrorHandler("Bad Request", 400));
  }
  // capture payment
  const captureData = await capturePayment(order.orderID);
  const { payment_source } = captureData;

  if (payment_source.paypal) {
    var method = "paypal"
    var source_id = payment_source.paypal.account_id;
  } else if (payment_source.card) {
    var method = "card"
    var source_id = payment_source.card.last_digits;
  }
  // after that warranty and transaction will be created
  const { expiry_date, level } = await calcExpiryDate(warrantyData);
  console.log({ expiry_date, level })
  const warranty = await warrantyModel.create({ ...warrantyData, expiry_date, user: req.userId });
  const transaction = await transactionModel.create({
    method, source_id,
    paypalID: {
      orderID: order.orderID,
      paymentID: captureData.purchase_units[0].payments.captures[0].id
    },
    plan: level,
    amount: parseInt(captureData.purchase_units[0].payments.captures[0].amount.value),
    warranty: warranty._id,
    user: req.userId
  });
  console.log({ captureData });

  // TODO: store payment information such as the transaction ID
  res.status(200).json({ captureData });
});

const populatePlanLevel = [
  {
    $lookup: {
      from: "plans",
      localField: "plan",
      foreignField: "_id",
      as: "plan"
    }
  },
  { $unwind: "$plan" },
  {
    $lookup: {
      from: "levels",
      localField: "plan.level",
      foreignField: "_id",
      as: "plan.level"
    }
  },
  { $unwind: "$plan.level" },
];

const myWarranties = async (userId, query) => {
  const result = await warrantyModel.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    ...populatePlanLevel,
    ...query
  ]);

  return result;
};

exports.getMyWarranties = catchAsyncError(async (req, res, next) => {
  console.log("User's all warranty")

  if (req.query.active) {
    const today = new Date();

    // const warranties = await warrantyModel.find({ user: req.userId, "status.value": ["inspection-failed", "inspection-awaited", "inspection-passed"], payment: false }).select("_id status vehicleDetails");
    const warranties = await warrantyModel.find({ user: req.userId, "status.value": ["inspection-failed", "inspection-awaited", "inspection-passed"] }).select("_id status vehicleDetails");

    var [activeWarranty] = await myWarranties(req.userId, [
      {
        $project: {
          _id: 1,
          start_date: 1,
          expiry_date: 1,
          plan: "$plan.level.level",
          status: 1,
          vehicleDetails: 1,
          remaining_days: {
            $dateDiff: {
              startDate: today,
              endDate: "$expiry_date",
              unit: "day"
            }
          },
          createdAt: 1,
          updatedAt: 1,
        }
      },
      {
        $group: {
          _id: null,
          warranties: { $push: "$$ROOT" },
          active: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lte: ['$start_date', today] },
                    { $gte: ['$expiry_date', today] },
                    { $eq: ['$status.value', "doc-delivered"] }
                  ]
                },
                1,
                0
              ]
            }
          },
          expired: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ['$expiry_date', today] },
                    { $eq: ['$status.value', "doc-delivered"] }
                  ]
                },
                1,
                0
              ]
            }
          },
          upcoming: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $gt: ['$start_date', today] },
                    { $eq: ['$status.value', "inspection-awaited"] },
                    { $eq: ['$status.value', "inspection-passed"] },
                    { $eq: ['$status.value', "order-placed"] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          warranties: {
            $filter: {
              input: "$warranties",
              as: "warranty",
              cond: {
                $and: [
                  { $lte: ['$$warranty.start_date', today] },
                  { $gte: ['$$warranty.expiry_date', today] },
                  { $eq: ['$$warranty.status.value', "doc-delivered"] }
                ]
              }
            }
          },
          active: 1,
          expired: 1,
          upcoming: 1
        }
      },
    ]);

    if (!activeWarranty) {
      return res.status(200).json({ active: 0, upcoming: 0, expired: 0, activeWarranty: [], warranties })
    }

    var result = { warranties, activeWarranty }
    // var [result] = await myWarranties(req.userId, [
    //   {
    //     $project: {
    //       _id: 1,
    //       start_date: 1,
    //       expiry_date: 1,
    //       plan: "$plan.level.level",
    //       "status.value": 1,
    //       remaining_days: {
    //         $dateDiff: {
    //           startDate: today,
    //           endDate: "$expiry_date",
    //           unit: "day"
    //         }
    //       },
    //       createdAt: 1,
    //       updatedAt: 1,
    //     }
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       warranties: { $push: "$$ROOT" },
    //       active: {
    //         $sum: {
    //           $cond: [
    //             {
    //               $and: [
    //                 { $lte: ['$start_date', today] },
    //                 { $gte: ['$expiry_date', today] },
    //                 { $eq: ['$status', "doc-delivered"] }
    //               ]
    //             },
    //             1,
    //             0
    //           ]
    //         }
    //       },
    //       expired: {
    //         $sum: {
    //           $cond: [
    //             {
    //               $and: [
    //                 { $lt: ['$expiry_date', today] },
    //                 { $eq: ['$status', "doc-delivered"] }
    //               ]
    //             },
    //             1,
    //             0
    //           ]
    //         }
    //       },
    //       upcoming: {
    //         $sum: {
    //           $cond: [
    //             {
    //               $or: [
    //                 { $gt: ['$start_date', today] },
    //                 { $eq: ['$status', "inspection-awaited"] },
    //                 { $eq: ['$status', "inspection-passed"] },
    //                 { $eq: ['$status', "order-placed"] }
    //               ]
    //             },
    //             1,
    //             0
    //           ]
    //         }
    //       }
    //     }
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       warranties: {
    //         $filter: {
    //           input: "$warranties",
    //           as: "warranty",
    //           cond: {
    //             $and: [
    //               { $lte: ['$$warranty.start_date', today] },
    //               { $gte: ['$$warranty.expiry_date', today] },
    //               { $eq: ['$$warranty.status', "doc-delivered"] }
    //             ]
    //           }
    //         }
    //       },
    //       active: 1,
    //       expired: 1,
    //       upcoming: 1
    //     }
    //   },
    // ]);

    // if (!result) {
    //   return res.status(200).json({ active: 0, upcoming: 0, expired: 0, warranties: [] })
    // }
  } else {
    var result = {
      warranties: await myWarranties(req.userId, [
        {
          $lookup: {
            from: "transactions",
            localField: "_id",
            foreignField: "warranty",
            as: "transaction"
          }
        },
        { $unwind: "$transaction" },
        {
          $project: {
            _id: 1,
            start_date: 1,
            expiry_date: 1,
            plan: "$plan.level.level",
            // amount: { $sum: "$transaction.amount" },
            amount: "$transaction.amount",
            document: 1,
            vehicleDetails: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
          }
        }
      ])
    }

    if (!result) {
      return res.status(200).json({ warranties: [] });
    }
  }
  console.log(result);
  res.status(200).json(result)
});

// Get all documents
// Get all documents
exports.getAllWarranty = catchAsyncError(async (req, res, next) => {
  const { role, userId } = req.user;
  const { status, keyword, currentPage, resultPerPage } = req.query;
  const today = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(today.getDate() + 30);

  let pipeline = []
   pipeline = [
    ...populatePlanLevel,
  ];

  // let query = warrantyModel.aggregate([...populatePlanLevel]);
  // const apiFeatures = new APIFeatures(query, req.query);
 console.log("keyword: ",keyword)

 const isPlanName = keyword === "safe" || keyword === "secure" || keyword === "supreme";
 let match = {};

 if(keyword){
  if (isPlanName) {
    console.log("In plan");
    pipeline.push({ $match: { "plan.level.level": keyword } });
  } 
}

  if (status) {
    
    switch (status) {
      case 'AWAITED':
        match = { "status.value": 'inspection-awaited' };
        break;
      case 'PASSED':
        match = { "status.value": { $in: ["inspection-passed", "order-placed", "doc-delivered"] }};
        break;
      case 'ACTIVE':
        match = {
          "status.value": 'doc-delivered',
          start_date: { $lte: today },
          expiry_date: { $gt: today },
        };
        break;
      case 'REJECTED':
        match = { "status.value": 'inspection-failed' };
        break;
      case 'TO-BE-EXPIRED':
        match = {
          expiry_date: { $gte: today, $lte: thirtyDaysFromNow },
        };
        break;
      case 'EXPIRED':
        match = { expiry_date: { $lte: today } };
        break;
    }
    pipeline.push({ $match: match });
  }

  if (currentPage && resultPerPage) {
    const r = parseInt(resultPerPage);
    const c = parseInt(currentPage);
    const skip = r * (c - 1);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: r });
  }

  if (role === 'admin') {
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      }
    });
    pipeline.push({ $unwind: "$user" });
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "salePerson",
        foreignField: "_id",
        as: "salePerson",
      }
    });
    pipeline.push({ $unwind: { path: "$salePerson", preserveNullAndEmptyArrays: true } });
  } else if (role === 'sale-person') {
    pipeline.push({ $match: { salePerson: new mongoose.Types.ObjectId(userId) }});
    pipeline.push({
      $lookup: {
        from: "users",
        localField: "user",
        foreignField: "_id",
        as: "user",
      }
    });
    pipeline.push({ $unwind: "$user" });
  } else {
    return next(new ErrorHandler("Bad Request", 400));
  }

  pipeline.push({ $sort: { createdAt: -1 } });

 
  let warranties = await warrantyModel.aggregate(pipeline);

  if (keyword) {
  if (!isPlanName) {
    const regex = new RegExp(keyword, 'i');

    warranties = warranties.filter(warranty => {
      const user = warranty.user; 
      const vehicleDetails = warranty.vehicleDetails;  
     
      
      return (
        (user.firstname?.match(regex) || '').length > 0 ||
        (user.lastname?.match(regex) || '').length > 0 ||
        (user.email?.match(regex) || '').length > 0 ||
        (vehicleDetails.reg_num?.match(regex) || '').length > 0 ||
        (user.mobile_no?.match(regex) || '').length > 0
      );
    });
  }
}
  const warrantyCount = warranties.length;

  res.status(200).json({ warranties, warrantyCount });
});



// Get a single document by ID
exports.getWarranty = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return next(new ErrorHandler("Invalid Warranty ID.", 400));
  }

  if (!req.user) {
    var warranty = await warrantyModel.findOne({ _id: id, user: req.userId }).populate([
      { path: "user", select: "firstname lastname email mobile_no" },
      { path: "plan", select: "level", populate: { path: "level", select: "level" } }
    ]);
  } else {
    var warranty = await warrantyModel.findById(id).populate([{ path: "plan", populate: { path: "level" } }, { path: "user" }]);
  }

  if (!warranty) {
    return next(new ErrorHandler("Warranty not found.", 404));
  }

  res.status(200).json({ warranty });
});

// Update a document by ID
exports.updateWarranty = catchAsyncError(async (req, res, next) => {
  const option = {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  };

  console.log("update warranty", req.body)
  const { id } = req.params;
  if (req.body.status) {
    req.body.status = { value: req.body.status, statusAt: new Date() }
  }
  // const { document } = req.body;
  if (req.user.role === 'sale-person') {
    // if (document) {
    //   var warranty = await warrantyModel.findByIdAndUpdate({ _id: id, salePerson: req.user._id }, { $push: { documents: document } }, option);
    // } else {
    var warranty = await warrantyModel.findOneAndUpdate({ _id: id, salePerson: req.user._id }, req.body, option);
    // }
  } else {
    var warranty = await warrantyModel.findByIdAndUpdate(id, req.body, option);
  }
  if (!warranty) return next(new ErrorHandler('Warranty not found', 404));

  res.status(200).json({ warranty });
});

// Delete a document by ID
exports.deleteWarranty = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  let warranty = await warrantyModel.findById(id);

  if (!warranty)
    return next(new ErrorHandler("Warranty not found", 404));

  await warranty.deleteOne();

  res.status(200).json({
    message: "Warranty Deleted successfully.",
  });
});

exports.checkWarranty = catchAsyncError(async (req, res, next) => {
  console.log("Checking warranty", req.body)
  const { reg_num } = req.body;
  if (!reg_num) {
    return next(new ErrorHandler("Please provide the vehicle's registration number.", 400));
  }

  const today = new Date();
  const renewal_lim = parseInt(process.env.RENEWAL_LIMIT);
  console.log({ renewal_lim })
  const warranty = await warrantyModel.aggregate([
    {
      $match: { "vehicleDetails.reg_num": { $regex: `^${reg_num}$`, $options: "i" } }
    },
    {
      $project: {
        _id: 1,
        remaining_days: {
          $dateDiff: {
            startDate: today,
            endDate: "$expiry_date",
            unit: "day"
          }
        }
      }
    },
    {
      $match: { remaining_days: { $gt: renewal_lim } }
    }
  ]);

  console.log({ warranty });
  if (warranty.length > 0) {
    return next(new ErrorHandler("You already have an active request for this vehicle number. Please try later", 400));
  }

  res.status(200).json({ message: "You are eligible for the renewal/purchase" });
});