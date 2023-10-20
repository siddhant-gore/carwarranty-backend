const userModel = require("./user.model");
const { createUser, getAllUser, getUser, updateUser, deleteUser, createSalePerson, deleteSalePerson } = require("./user.controller");
const userRoute = require("./user.route");

module.exports = { userModel, createUser, getAllUser, getUser, updateUser, deleteUser, createSalePerson, deleteSalePerson, userRoute };
