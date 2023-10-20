const fs = require('fs');
const path = require('path');
const sendEmail = require("../../utils/sendEmail");
const ErrorHandler = require("../../utils/errorHandler");
const catchAsyncError = require("../../utils/catchAsyncError");
const mongoose = require("mongoose");
const warrantyModel = require("../warranty/warranty.model");
const transactionModel = require("../transaction/transaction.model");

exports.updateAfterPayment = catchAsyncError(async (req, res, next) => {
  console.log(req.body);
  const { event_type, resource } = req.body;
  console.log({ event_type, resource });

  switch (event_type) {
    case 'CHECKOUT.ORDER.APPROVED':
      console.log({ event_type });
      return res.status(200).json({ message: "Order Approval Acknowleged." });

    case 'PAYMENT.CAPTURE.COMPLETED':
      console.log({ event_type });
      var { order_id } = resource?.supplementary_data?.related_ids;
      // var warranty = await warrantyModel.findOneAndUpdate({ "paypalID.orderID": order_id }, { payment: true });
      const trans = await transactionModel.findOneAndUpdate({ "paypalID.orderID": order_id }, { status: "complete" });
      console.log({ trans });
      const warranty = await warrantyModel.findOneAndUpdate({ _id: trans.warranty }, { payment: true }).populate("user", "firstname lastname email");

      try {
        const template = fs.readFileSync(path.join(__dirname, "orderSummary.html"), "utf-8");

        // /{{(\w+)}}/g - match {{Word}} globally
        const renderedTemplate = template.replace(/{{(\w+)}}/g, (match, key) => {
          console.log({ match, key })
          return { 
            reg_num: warranty.vehicleDetails.reg_num,
            make: warranty.vehicleDetails.make,
            fuel_type: warranty.vehicleDetails.fuel_type,
            model: warranty.vehicleDetails.model,
            date_first_reg: warranty.vehicleDetails.date_first_reg.toISOString().slice(0, 10),
            size: warranty.vehicleDetails.size,
            mileage: warranty.vehicleDetails.mileage,
            drive_type: warranty.vehicleDetails.drive_type,
            bhp: warranty.vehicleDetails.bhp,
            start_date: warranty.start_date.toISOString().slice(0, 10),
            expiry_date: warranty.expiry_date.toISOString().slice(0, 10),
            service_history: warranty.service_history ? "YES" : "NO",
            method: trans.method,
            amount: trans.amount,
            transaction_id: trans._id,
            plan: trans.plan,
            status: warranty.status,
            firstname: warranty.user.firstname, 
            lastname: warranty.user.lastname }[key] || match;
        });

        await sendEmail({
          email: warranty.user.email,
          subject: `Order Summary for Your Vehicle Warranty`,
          message: renderedTemplate
        });
      } catch (error) {
        return next(new ErrorHandler(error.message, 500));
      }
      // const allTransaction = await transactionModel.find({ warranty: trans.warranty });
      // console.log({ allTransaction });
      // if (allTransaction.length === 2) {
      //   await warrantyModel.findOneAndUpdate({ _id: trans.warranty }, { status: "order-placed" })
      // }
      return res.status(200).json({ message: "Payment Capture Acknowleged." });

    case 'PAYMENT.CAPTURE.DECLINED':
      console.log({ event_type });
      var { order_id } = resource?.supplementary_data?.related_ids;
      // var warranty = await warrantyModel.findOne({ "paypalID.orderID": order_id });
      await transactionModel.findOneAndUpdate({ "paypalID.orderID": order_id }, { status: "fail" });
      return res.status(200).json({ message: "Payment Declined Acknowleged." });

    // case 'PAYMENT.CAPTURE.PENDING':
    //   return res.status(200).json({ message: "Order Approval Acknowleged." });

    case 'PAYMENT.CAPTURE.REFUNDED':
      console.log({ event_type });
      const { links } = resource;
      console.log({ resource, links });
      const linkParts = links[1].href.split("/");
      const id = linkParts[linkParts.length - 1];

      console.log({ linkParts, id });
      await transactionModel.findOneAndUpdate({ "paypalID.paymentID": id }, { status: 'refunded' });
      return res.status(200).json({ message: "Payment Refund Acknowleged." });

    default:
      return res.status(200).json({ message: "Acknowleged." });
  }
});