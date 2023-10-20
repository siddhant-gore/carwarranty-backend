const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const APIFeatures = require("../../utils/apiFeatures");
const { levelModel, planModel } = require("./level.model");
const { isValidObjectId } = require("mongoose");


// Create a new document
exports.createLevel = catchAsyncError(async (req, res, next) => {
  console.log("create level", req.body);
  const level = await levelModel.create(req.body);
  res.status(201).json({ level });
});

// Get all documents
exports.getAllLevel = catchAsyncError(async (req, res, next) => {
  console.log("Get all levels", req.query);
  const levels = await levelModel.find();
  res.status(200).json({levels});
});

// Get a single document by ID
exports.getLevel = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const level = await levelModel.findById(id);
  if (!level) {
    return next(new ErrorHandler("level not found.", 404));
  }

  res.status(200).json({ level });
});

// Update a document by ID
exports.updateLevel = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const level = await levelModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  if (!level) return next(new ErrorHandler('level not found', 404));

  res.status(200).json({ level });
});

// Delete a document by ID
exports.deleteLevel = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  let level = await levelModel.findById(id);

  if (!level)
    return next(new ErrorHandler("level not found", 404));

  await level.deleteOne();

  res.status(200).json({
    message: "level Deleted successfully.",
  });
});

exports.createPlan = catchAsyncError(async (req, res, next) => {
  if (!isValidObjectId(req.body.level)) {
    return next(new ErrorHandler("Invalid Level Id", 400));
  }

  const plan = await planModel.create(req.body);
  res.status(201).json(plan);
});

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

const getAge = (dateFirstReg) => {
  const manufacturedDate = new Date(dateFirstReg);
  const currentDate = new Date();
  return (currentDate - manufacturedDate) / (1000 * 60 * 60 * 24 * 365.25);
};

exports.getLevelSuggestion = catchAsyncError(async (req, res, next) => {
  console.log("Get all level suggestion", req.query);
  const { engineSize, bhp, mileage, driveType, dateFirstReg } = req.query;

  console.log({ engineSize, bhp, mileage, driveType, dateFirstReg })
  if (!engineSize || !bhp || !mileage || !driveType || !dateFirstReg) {
    return next(new ErrorHandler("Bad Request", 400));
  }

  const e = parseFloat(engineSize);
  const b = parseFloat(bhp);
  const a = getAge(dateFirstReg);
  const m = parseFloat(mileage);

  const load_per = evalLoad(e, b, driveType);
  console.log({ a, e, b, m, load_per });

  const levelsAndPlans = await levelModel.aggregate([
    // used to select plan type - safe, secure and supreme
    {
      $match: {
        max_age: { $gte: a },
        max_mileage: { $gte: m }
      }
    },
    {
      $lookup: {
        from: "plans", // Assuming the name of the plans collection
        localField: "_id",
        foreignField: "level",
        as: "plans"
      }
    },
    {
      $unwind: "$plans"
    },
    // {/**
    //  * {
    //     "_id": "64d4cbe0571819d2fbdcfc50",
    //     "level": "safe", ...,
    //     "plans": {
    //         "_id": "64d4d0ad3df5f8c88dbc8b12",
    //         "level": "64d4cbe0571819d2fbdcfc50",
    //         "month": 3,
    //         "claim": 500,
    //         "price": 148,
    //         "createdAt": "2023-08-08T11:23:22.956Z",
    //         "updatedAt": "2023-08-08T11:23:22.956Z",
    //         "__v": 0
    //     }
    // },
    // {
    //     "_id": "64d4cbe0571819d2fbdcfc50",
    //     "level": "safe", ...,
    //     "plans": {
    //         "_id": "64d4d0ad3df5f8c88dbc8b13",
    //         "level": "64d4cbe0571819d2fbdcfc50",
    //         "month": 3,
    //         "claim": 1000,
    //         "price": 170,
    //         "createdAt": "2023-08-08T11:23:22.956Z",
    //         "updatedAt": "2023-08-08T11:23:22.956Z",
    //         "__v": 0
    //     }
    // },
    //  */}
    {
      $group: {
        _id: {
          _id: "$_id",
          level: "$level",
          max_age: "$max_age",
          max_mileage: "$max_mileage",
          createdAt: "$createdAt",
          updatedAt: "$updatedAt",
          __v: "$__v",
          claim: "$plans.claim",
        },
        plans: {
          $push: {
            _id: "$plans._id",
            month: "$plans.month",
            price: {
              $add: [
                { $multiply: ["$plans.price", load_per * 0.01] },
                "$plans.price"
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        _id: 1,
        plans: { $sortArray: { input: "$plans", sortBy: { price: 1 } } }
      }
    },
    //   {
    //     "levelsAndPlans": [
    //         {
    //             "_id": {
    //                 "_id": "64d4cbe0571819d2fbdcfc50",
    //                 "level": "safe",
    //                 "max_age": 100,
    //                 "max_mileage": 1000000000000,
    //                 "createdAt": "2023-08-10T11:37:04.572Z",
    //                 "updatedAt": "2023-08-10T11:37:04.572Z",
    //                 "__v": 0,
    //                 "claim": 2000
    //             },
    //             "plans": [ ... ]
    //         },
    //         {
    //             "_id": {
    //                 "_id": "64d4cc12571819d2fbdcfc52",
    //                 "level": "secure",
    //                 "max_age": 15,
    //                 "max_mileage": 100000,
    //                 "createdAt": "2023-08-10T11:37:54.133Z",
    //                 "updatedAt": "2023-08-10T11:37:54.133Z",
    //                 "__v": 0,
    //                 "claim": "CMV"
    //             },
    //             "plans": [ ... ]
    //         },
    //         {
    //             "_id": {
    //                 "_id": "64d4cc12571819d2fbdcfc52",
    //                 "level": "secure",
    //                 "max_age": 15,
    //                 "max_mileage": 100000,
    //                 "createdAt": "2023-08-10T11:37:54.133Z",
    //                 "updatedAt": "2023-08-10T11:37:54.133Z",
    //                 "__v": 0,
    //                 "claim": 5000
    //             },
    //             "plans": [ ... ]
    //         },
    //         {
    //             "_id": {
    //                 "_id": "64d4cbe0571819d2fbdcfc50",
    //                 "level": "safe",
    //                 "max_age": 100,
    //                 "max_mileage": 1000000000000,
    //                 "createdAt": "2023-08-10T11:37:04.572Z",
    //                 "updatedAt": "2023-08-10T11:37:04.572Z",
    //                 "__v": 0,
    //                 "claim": 500
    //             },
    //             "plans": [ ... ]
    //         },
    //     ],
    //     "load_per": 50
    // }
    {
      $group: {
        _id: "$_id._id",
        level: { $first: "$_id.level" },
        max_age: { $first: "$_id.max_age" },
        max_mileage: { $first: "$_id.max_mileage" },
        createdAt: { $first: "$_id.createdAt" },
        updatedAt: { $first: "$_id.updatedAt" },
        __v: { $first: "$_id.__v" },
        plansByClaim: { $push: { claim: "$_id.claim", plans: "$plans" } },
      }
    },
    {
      $project: {
        _id: 1,
        level: 1,
        max_age: 1,
        max_mileage: 1,
        createdAt: 1,
        updatedAt: 1,
        __v: 1,
        plansByClaim: { $sortArray: { input: "$plansByClaim", sortBy: { claim: 1 } } }
      }
    },
    { $sort: { level: 1 } }
  ]);

  res.status(200).json({ levelsAndPlans, load_per });
});