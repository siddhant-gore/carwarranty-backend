const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  level: {
    type: String,
    required: [true, "Please specify the warranty level."],
    enum: ["safe", "secure", "supreme"]
  },
  max_age: {
    type: Number,
    required: [true, "Please specify the max age limit for the vehicle."]
  },
  max_mileage: {
    type: Number,
    required: [true, "Please specify the max mileage limit for the vehicle."]
  },
}, { timestamps: true });

const planSchema = new mongoose.Schema({
  claim: {
    type: Number,
    required: [true, "Please specify the claim value."]
  },
  price: {
    type: Number,
    required: [true, "Please specify the base price."]
  },
  month: {
    type: Number,
    required: [true, "Please specify the plan tenure."]
  },
  level: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Level",
    required: [true, "Please specify the warranty level."]
  }
}, { timestamps: true });

const planModel = mongoose.model("Plan", planSchema);
const levelModel = mongoose.model("Level", levelSchema);

module.exports = { planModel, levelModel };

