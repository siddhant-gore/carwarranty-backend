const enquiryModel = require("./enquiry.model");
const { createEnquiry, getAllEnquiry, getEnquiry, updateEnquiry, deleteEnquiry } = require("./enquiry.controller");
const enquiryRoute = require("./enquiry.route");

module.exports = { enquiryModel, createEnquiry, getAllEnquiry, getEnquiry, updateEnquiry, deleteEnquiry, enquiryRoute };
