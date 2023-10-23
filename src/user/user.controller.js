const fs = require('fs');
const crypto = require("node:crypto");
const path = require('path');
const { default: mongoose, isValidObjectId } = require('mongoose');

const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const APIFeatures = require("../../utils/apiFeatures");
const { passwordGenerator } = require("../../utils/randGenerator");
const sendEmail = require("../../utils/sendEmail");
const userModel = require("./user.model");
const transactionModel = require("../transaction/transaction.model");
const warrantyModel = require("../warranty/warranty.model");

const userUpdate = async (id, info, res, next) => {
  console.log({ id, info });
  const user = await userModel.findByIdAndUpdate(id, info, {
    new: true,
    runValidators: true
  });

  if (!user) return next(new ErrorHandler('User not found', 404));

  res.status(200).json({ user });
}
// Create a new document
exports.createUser = catchAsyncError(async (req, res, next) => {
  const password = passwordGenerator();

  const userDetails = { ...req.body, password };
  const user = await userModel.create(userDetails);
  if (!user) {
    return next(new ErrorHandler("Something Went Wrong. Please try again.", 500));
  }

  const token = await user.getJWTToken();

  // if (req.body.googleRegistration) {
  //   return res.status(200).json({ user, token });
  // }

  
  try {
    const template = fs.readFileSync(path.join(__dirname, "userRegister.html"), "utf-8");

    // /{{(\w+)}}/g - match {{Word}} globally
    const renderedTemplate = template.replace(/{{(\w+)}}/g, (match, key) => {
      // console.log({ match, key })
      return userDetails[key] || match;
    });

    await sendEmail({
      email: user.email,
      subject: 'Successful Registration',
      message: renderedTemplate
    });

    res.status(200).json({
      user,
      token,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    await userModel.deleteOne({ _id: user._id });
    return next(new ErrorHandler(error.message, 500));
  }
});

const loginWithGoogle = async (req, res, next) => {
  const { email } = req.body;
  const user = await userModel.findOne({ email });
  if (!user) {
    return next(new ErrorHandler('User Not Found', 400));
  }

  const token = await user.getJWTToken();
  return res.status(200).json({ user, token });
};

exports.login = catchAsyncError(async (req, res, next) => {
  console.log("user login", req.body);
  const { email, password, googleLogin } = req.body;

  if (googleLogin) {
    return await loginWithGoogle(req, res, next);
  }

  if (!email || !password)
    return next(new ErrorHandler("Please enter your email and password", 400));

  const user = await userModel.findOne({ email }).select("+password");
  if (!user) {
    var message = "Email is not registered with us. Please continue as guest.";
    if (req.query.admin)
      var message = "Invalid Credentials."
    return next(new ErrorHandler(message, 401));
  }

  const isPasswordMatched = await user.comparePassword(password);
  if (!isPasswordMatched)
    return next(new ErrorHandler("Invalid password!", 401));

  const token = await user.getJWTToken();
  res.status(200).json({ user, token });
});

// Get a single document by ID
exports.getUser = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.userId;
  if (!isValidObjectId(id || userId)) {
    return next(new ErrorHandler("Invalid User ID", 400));
  }

  if (req.query.task) {
    console.log({ "jere": "Fgdfgd" })
    var [user] = await userModel.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: "warranties",
          localField: "_id",
          foreignField: "salePerson",
          pipeline: [
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
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user"
              }
            },
            { $unwind: "$user" },
            {
              $project: {
                _id: 1,
                user: 1,
                plan: "$plan.level.level",
                vehicleDetails: 1,
                status: 1,
              }
            }
          ],
          as: "warranties"
        }
      }
    ]);
  } else {
    const userDetails = await userModel.findById(id ? id : userId);
    console.log({ userDetails })
    const warranties = await warrantyModel.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userDetails._id) } },
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
      {
        $lookup: {
          from: "transactions",
          localField: "_id",
          foreignField: "warranty",
          as: "transaction"
        }
      },
      {
        $project: {
          _id: 1,
          plan: "$plan.level.level",
          amount: { $sum: "$transaction.amount" },
          vehicleDetails: 1,
          status: 1,
        }
      }
    ]);
    var user = { ...userDetails._doc, warranties };
  }

  if (!user) {
    return next(new ErrorHandler("User not found.", 404));
  }

  res.status(200).json({ user });
});

// Update a document by ID
exports.updateProfile = catchAsyncError(async (req, res, next) => {
  const userId = req.userId;
  if (!isValidObjectId(userId)) {
    return next(new ErrorHandler("Invalid User ID", 400));
  }

  delete req.body.password;

  console.log("update profile", { body: req.body })
  await userUpdate(userId, req.body, res, next);
});

exports.updatePassword = catchAsyncError(async (req, res, next) => {
  const userId = req.userId;
  if (!isValidObjectId(userId)) {
    console.log({ userId }, 2)
    return next(new ErrorHandler("Invalid User ID", 400));
  }

  const { curPassword, newPassword, confirmPassword } = req.body;
  if (!curPassword)
    return next(new ErrorHandler("Current Password is required.", 400));

  if (!newPassword || !confirmPassword)
    return next(new ErrorHandler("Password or Confirm Password is required.", 400));

  if (newPassword !== confirmPassword)
    return next(new ErrorHandler("Please confirm your password,", 400));

  const user = await userModel.findOne({ _id: userId }).select("+password");
  if (!user) return new ErrorHandler("User Not Found.", 404);

  const isPasswordMatched = await user.comparePassword(curPassword);
  if (!isPasswordMatched)
    return next(new ErrorHandler("Current Password is invalid.", 400));

  user.password = newPassword;
  await user.save();
  res.status(200).json({ message: "Password Updated Successfully." });
});

// update new document
exports.updateUser = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  await userUpdate(id, req.body, res, next)
});


// Get all documents
exports.getAllUser = catchAsyncError(async (req, res, next) => {
  console.log("get all users", req.query);
  let role = {};
  if (req.query.role) {
    role = { role: req.query.role };
  }

  const apiFeature = new APIFeatures(
    userModel.find(role).sort({ createdAt: -1 }),
    req.query
  ).search("firstname");

  let users = await apiFeature.query;
  console.log("users", users);
  let usersCount = users.length;
  if (req.query.resultPerPage && req.query.currentPage) {
    apiFeature.pagination();

    console.log("usersCount", usersCount);
    users = await apiFeature.query.clone();
  }
  console.log("users", users);
  res.status(200).json({ users, usersCount });
});

// create sale person
exports.createSalePerson = catchAsyncError(async (req, res, next) => {
  console.log("create sale person", req.body);
  const salePerson = await userModel.create({ role: "sale-person", ...req.body });
  res.status(200).json({ salePerson });
})

exports.deleteSalePerson = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  let user = await userModel.findById(id);

  if (!user)
    return next(new ErrorHandler("Sale Person not found", 404));

  await warrantyModel.updateMany({ salePerson: user._id }, { salePerson: null });
  await user.deleteOne();

  res.status(200).json({
    message: "Sale Person Deleted successfully.",
  });
});

// Delete a document by ID
exports.deleteUser = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  let user = await userModel.findById(id);

  if (!user)
    return next(new ErrorHandler("User not found", 404));

  await transactionModel.deleteMany({ user: user._id });
  await warrantyModel.deleteMany({ user: user._id });
  await user.deleteOne();

  res.status(200).json({
    message: "User Deleted successfully.",
  });
});

// forget password
exports.forgotPassword = catchAsyncError(async (req, res, next) => {
  console.log("forgot password", req.body)
  const { email } = req.body;
  if (!email) {
    return next(new ErrorHandler("Please provide the email.", 400));
  }

  const user = await userModel.findOne({ email });
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }
  // get resetPassword Token
  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });
  console.log(req);
  // const resetPasswordUrl = `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;
  console.log({ h: req.get("origin") })
  const resetPasswordUrl = `${req.get("origin")}/password/reset/${resetToken}`;
  console.log({ resetPasswordUrl })
  try {
    const template = fs.readFileSync(path.join(__dirname, "passwordReset.html"), "utf-8");

    // /{{(\w+)}}/g - match {{Word}} globally
    const renderedTemplate = template.replace(/{{(\w+)}}/g, (match, key) => {
      console.log({ match, key })
      return { resetPasswordUrl, firstname: user.firstname, lastname: user.lastname }[key] || match;
    });

    await sendEmail({
      email: user.email,
      subject: `Password Reset`,
      message: renderedTemplate
    });

    res.status(200).json({
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorHandler(error.message, 500));
  }
});

// Reset password
exports.resetPassword = catchAsyncError(async (req, res, next) => {
  console.log("reset password", req.body);
  const { password, confirmPassword } = req.body;
  if (!password || !confirmPassword) {
    return next(new ErrorHandler("Please provide password and confirm password.", 400));
  }
  // creating hash token
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  console.log({ resetPasswordToken })
  const user = await userModel.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });
  if (!user) {
    return next(new ErrorHandler("Reset password token is invalid or has been expired.", 400));
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Please confirm your password", 400));
  }
  user.password = password;
  user.resetPasswordExpire = undefined;
  user.resetPasswordToken = undefined;
  await user.save({ validateBeforeSave: false });

  const token = await user.getJWTToken();
  res.status(200).json({ user, token });
});