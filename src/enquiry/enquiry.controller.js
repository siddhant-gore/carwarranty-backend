const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const APIFeatures = require("../../utils/apiFeatures");
const enquiryModel = require("./enquiry.model");


// Create a new document
exports.createEnquiry = catchAsyncError(async (req, res, next) => {
  const enquiry = await enquiryModel.create(req.body);
  res.status(201).json({ enquiry });
});

// Get all documents
exports.getAllEnquiry = catchAsyncError(async (req, res, next) => {
  console.log("all enquiry", req.query);

  const apiFeature = new APIFeatures(
    enquiryModel.find().sort({ createdAt: -1 }),
    req.query
  ).search("email");

  let enquiries = await apiFeature.query;
  console.log("enquiries", enquiries);
  let enquiryCount = enquiries.length;
  if (req.query.resultPerPage && req.query.currentPage) {
    apiFeature.pagination();

    console.log("enquiryCount", enquiryCount);
    enquiries = await apiFeature.query.clone();
  }
  console.log("enquiries", enquiries);
  res.status(200).json({ enquiries, enquiryCount });
});

// Get a single document by ID
exports.getEnquiry = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;

  const enquiry = await enquiryModel.findById(id);
  if (!enquiry) {
    return next(new ErrorHandler("Enquiry not found.", 404));
  }

  res.status(200).json({ enquiry });
});

// Update a document by ID
exports.updateEnquiry = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const enquiry = await enquiryModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
    useFindAndModify: false,
  });

  if (!enquiry) return next(new ErrorHandler('Enquiry not found', 404));

  res.status(200).json({ enquiry });
});

// Delete a document by ID
exports.deleteEnquiry = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  let enquiry = await enquiryModel.findById(id);

  if (!enquiry)
    return next(new ErrorHandler("Enquiry not found", 404));

  await enquiry.deleteOne();

  res.status(200).json({
    message: "Enquiry Deleted successfully.",
  });
});
