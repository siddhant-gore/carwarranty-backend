const ErrorHandler = require("../../utils/errorHandler")
const catchAsyncError = require("../../utils/catchAsyncError")

const fs = require("fs");
const path = require('path');
const pdf = require("pdf-creator-node");

const transactionModel = require("../transaction/transaction.model");

// Read HTML Template
const templateHtml = (templateName) => {
  const templatePath = path.join(__dirname, templateName);
  return fs.readFileSync(templatePath, 'utf-8');
}

const options = {
  format: "A3",
  orientation: "portrait",
  border: "10mm",
  footer: {
    height: "10mm",
    contents: {
      default: '<span style="color: #444; float: right; margin-top: 20px;">{{page}}</span>'
    }
  },
};

const sendReport = async (templateName, data, res) => {
  const report = await pdf.create({
    html: templateHtml(templateName),
    data,
    path: "./output.pdf",
    type: "buffer",
  }, options);

  res.setHeader('Content-Type', 'application/pdf');
  res.status(200).send(report);
};

const getOrdersJSON = async (date_type, warehouseId, startDate, endDate) => {
  const orders = await orderModel.findAll({
    where: {
      warehouseId,
      createdAt: {
        [Op.gte]: startDate,
        [Op.lt]: endDate,
      },
      [date_type]: {
        [Op.not]: null
      }
    },
    include: [{
      model: userModel,
      as: "user",
      attributes: ["id", "fullname"]
    }, {
      model: orderItemModel,
      as: "items",
      attributes: ["id", "name", "quantity"],
    }],
    attributes: {
      include: includeCountAttr
    }
  });

  // map a particular user with thier orders
  let groupedOrders = {};
  orders.forEach(order => {
    const userId = order.userId;
    if (!groupedOrders[userId]) {
      groupedOrders[userId] = [];
    }
    groupedOrders[userId].push(order.toJSON());
  });

  // now convert into list of list of orders 
  // for eg [
  //   [order1, order2],   // for user1
  //   [order1]            // for user2
  // ]
  groupedOrders = Object.entries(groupedOrders).map(([k, v]) => v);

  groupedOrders.forEach(orders => {
    let index = 1;
    orders.forEach(order => {
      order.index = index;
      order[date_type] = order[date_type].toISOString().split('T')[0]; index++;
    })
  });

  // now the above list in below format
  // for eg [
  //   {client_name: order1.user.fullname, orders: [order1, order2],           // for user1
  //   {client_name: order1.user.fullname, orders: [order1, order2, order3],   // for user1
  // ]
  groupedOrders = groupedOrders.map(orders => {
    return { client_name: orders[0].user.fullname, orders }
  })

  console.log({ groupedOrders });
  return groupedOrders;
};

const formattedDate = (date) => {
  if (!date || isNaN(date)) return;
  return date.toISOString().split('T')[0];
};

const formattedOrder = (order) => {
  console.log({ order })
  order.arrival_date = formattedDate(order.arrival_date);
  order.trans_date = formattedDate(order.trans_date);
  order.exit_date = formattedDate(order.exit_date);
  order.last_storage_date = formattedDate(order.last_storage_date);
  order.createdAt = formattedDate(order.createdAt);
  order.updatedAt = formattedDate(order.updatedAt);
  if (order.transaction)
    order.transaction.createdAt = formattedDate(order.transaction.createdAt);

  return order;
};

const formatedTransaction = (transaction) => {
  transaction.createdAt = formattedDate(transaction.createdAt);
  return transaction;
};

exports.getReceipt = catchAsyncError(async (req, res, next) => {
  const { id } = req.params;
  if (!id)
    return next(new ErrorHandler("Please provide the transaction ID", 400));

  var transaction = await transactionModel.findOne({ _id: id, user: req.userId }).populate("user");
  if (!transaction) return next(new ErrorHandler("Transaction not found.", 404));

  transaction.createdAt = formattedDate(transaction.createdAt);
  console.log({ transaction });

  await sendReport('receipt.html', { heading: 'SUPER CAR WARRANTY', ...formatedTransaction(transaction.toJSON()) }, res);
});
