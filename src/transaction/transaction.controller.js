const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const APIFeatures = require("../../utils/apiFeatures");
const transactionModel = require("./transaction.model");
const { isValidObjectId } = require("mongoose");
const { refundOrder } = require("../../utils/paypal");


// Create a new document
exports.createTransaction = catchAsyncError(async (req, res, next) => {
  const transaction = await transactionModel.create(req.body);
  res.status(201).json({ transaction });
});

// Get all documents
exports.getAllTransaction = catchAsyncError(async (req, res, next) => {
  console.log("get all transactions")
  console.log(req.query);
  if (!req.user) {
    const userId = req.userId;
    var transactions = await transactionModel.find({ user: userId }).sort({ createdAt: -1 }).select("-user");
  } else {
    const apiFeature = new APIFeatures(transactionModel.find().sort({ createdAt: -1 }).populate([
      { path: "user" },
      { path: "warranty", select: "status" }
    ]), req.query).search();
    
    var transactions = await apiFeature.query;
    var transactionsCount = transactions.length;
    if (req.query.resultPerPage && req.query.currentPage) {
      apiFeature.pagination();

      console.log("transactionsCount", transactionsCount);
    }

    transactions = await apiFeature.query.clone();
  }
  res.status(200).json({ transactions, transactionsCount });
});


// Get a single document by ID
exports.getTransaction = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return next(new ErrorHandler("Invalid Transaction ID", 400));
  }

  if (!req.user) {
    var transaction = await transactionModel.findOne({ _id: id, user: req.userId }).select("-user");
  } else {
    var transaction = await transactionModel.findById(id).populate([{ path: "user", select: "firstname lastname email mobile_no" }, { path: "warranty", select: "status" }]);
  }

  if (!transaction) {
    return next(new ErrorHandler("Transaction not found.", 404));
  }

  res.status(200).json({ transaction });
});

// Update a document by ID
exports.updateTransaction = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const transaction = await transactionModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  if (!transaction) return next(new ErrorHandler('Transaction not found', 404));

  res.status(200).json({ transaction });
});

// Delete a document by ID
exports.deleteTransaction = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  let transaction = await transactionModel.findById(id);

  if (!transaction)
    return next(new ErrorHandler("Transaction not found", 404));

  await transaction.deleteOne();

  res.status(200).json({
    message: "Transaction Deleted successfully.",
  });
});

exports.refundTransaction = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  console.log({ id });
  if (!isValidObjectId(id)) {
    return next(new ErrorHandler("Invalid Id", 400));
  }

  let transaction = await transactionModel.findById(id).populate([
    { path: "warranty", select: "status" },
    { path: "user", select: "firstname lastname email mobile_no" }
  ]).select("+paypalID.paymentID");
  if (!transaction) {
    return next(new ErrorHandler("Transaction not found", 404));
  }

  if (transaction.warranty?.status !== "inspection-failed") {
    return next(new ErrorHandler("Something went wrong", 400));
  }

  transaction.status = "pending";
  transaction = await transaction.save();
  const data = await refundOrder(transaction.paypalID.paymentID);
  console.log({ data });
  res.status(200).json({ message: "Refund Successful.", transaction });
});