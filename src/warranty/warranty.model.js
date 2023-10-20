const mongoose = require('mongoose');

const validateEmail = (email) => {
	var re = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
	return re.test(email);
};

const vehicleDetailSchema = new mongoose.Schema({
	"reg_num": {
		type: String,
		required: [true, "Vehicle's registration number is required."],
		unique: true,
	},
	make: {
		type: String,
		required: [true, "Vehicle's make is required."],
	},
	fuel_type: {
		type: String,
		// enum: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'],
		required: [true, "Fuel Type is required."],
	},
	model: {
		type: String,
		required: [true, "Vehicle's model is required."],
	},
	date_first_reg: {
		type: Date,
		required: [true, "Date of first registration is required."]
	},
	size: {
		type: Number,
		required: [true, "Engine Size is required."],
	},
	mileage: {
		type: Number,
		required: [true, "Mileage is required."],
	},
	drive_type: {
		type: String,
		// enum: ['4x4', '4x2'],
		required: [true, "Drive Type is required."],
	},
	bhp: {
		type: Number,
		required: [true, "Vehicle's BHP is required."],
	},
});

const vehicleInfoSchema = new mongoose.Schema({
	purchase_date: {
		type: Date,
		required: [true, "Vehicle's purchase date is required."]
	},
	service_history: {
		type: Boolean,
		default: false,
	}
});

const warrantySchema = new mongoose.Schema({
	vehicleDetails: {
		type: vehicleDetailSchema,
		required: [true, "Vehicle detail is required."]
	},
	start_date: {
		type: Date,
		required: [true, "Plan Start Date is required."],
	},
	expiry_date: {
		type: Date,
		required: [true, "Plan Expiry Date is required."],
	},
	vehicleInfo: {
		type: vehicleInfoSchema,
		required: [true, "Vehicle information is required."]
	},
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: [true, "User ID is required"]
	},
	plan: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Plan",
		required: [true, "Please select a plan."]
	},
	status: {
		value: {
			type: String,
			enum: ["inspection-failed", "inspection-awaited", "inspection-passed", "order-placed", "doc-delivered", "refunded"],
			// "claim-requested", "claim-inspection", "claim-inspection-failed", "claim-in-progress", "claim-setteled"],
			default: "inspection-awaited"
		},
		statusAt: {
			type: Date,
			default: Date.now 
		}
	},
	// paypalID: {
	// 	type: String,
	// 	// required: [true, "Paypal orderID is required."],
	// 	select: false
	// },
	payment: {
		type: Boolean,
		default: false,
		select: false,
	},
	salePerson: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		select: false
	},
	document: {
		url: { type: String },
		desc: { type: String }
	},
	comments: [{ type: String }]
}, { timestamps: true });

warrantySchema.pre('save', function(next) {
	console.log(this.isModified('status.value'), "ismodi")
	if (this.isModified('status.value')) {
			this.status.statusAt = new Date();
	}
	next();
});

const warrantyModel = mongoose.model('Warranty', warrantySchema);
module.exports = warrantyModel;