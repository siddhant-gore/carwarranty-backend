const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
	fullname: {
		type: String,
		required: [true, "Fullname is required."],
	},
	email: {
		type: String,
		required: [true, "Email is required."],
	},
	message: {
		type: String,
		required: [true, "Message is required."],
	},
	// department: {
	// 	type: String,
	// 	required: [true, "Department is required."],
	// },
}, { timestamps: true });

const enquiryModel = mongoose.model('Enquiry', enquirySchema);

module.exports = enquiryModel;