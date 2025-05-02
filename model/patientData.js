const mongoose = require("mongoose");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const patientData = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  deviceID: {
    type: String,
    default: "NoDeviceIdFound"
  },
  appData: [
    {
      Date: Date,
      totalEpisode: { type: mongoose.Decimal128, default: 0 },
      totalDuration: { type: mongoose.Decimal128, default: 0 },
      averageHR: { type: mongoose.Decimal128, default: 0 },
      averageHRV: { type: mongoose.Decimal128, default: 0 }
    }
  ],
  energy: [
    {
      time: Date,
      energy: { type: mongoose.Decimal128, default: 0 }
    }
  ],
  objList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ],
  batteryList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ],
  connectionList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ],
  disconnectionList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ],
  appopenList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ],
  appcloseList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ],
  biometricList: [
    {
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }
  ]
});

module.exports = mongoose.model("patientData", patientData);
