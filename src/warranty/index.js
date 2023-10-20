const warrantyModel = require("./warranty.model");
const { createWarranty, getAllWarranty, getWarranty, updateWarranty, deleteWarranty } = require("./warranty.controller");
const warrantyRoute = require("./warranty.route");

module.exports = { warrantyModel, createWarranty, getAllWarranty, getWarranty, updateWarranty, deleteWarranty, warrantyRoute };
