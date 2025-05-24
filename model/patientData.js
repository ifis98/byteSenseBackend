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
      averageHRV: { type: mongoose.Decimal128, default: 0 },
      recoveryScore: { type: mongoose.Decimal128, default: null },
      stressLoadScore: { type: mongoose.Decimal128, default: null },
      recoveryTrendScore: { type: mongoose.Decimal128, default: null },
      recoveryDepthScore: { type: mongoose.Decimal128, default: null },
      byteScore: { type: mongoose.Decimal128, default: null },
      prevWeekAvgRecoveryScore: { type: mongoose.Decimal128, default: null },
      prevWeekAvgStressLoadScore: { type: mongoose.Decimal128, default: null },
      prevWeekAvgRecoveryTrendScore: { type: mongoose.Decimal128, default: null },
      prevWeekAvgRecoveryDepthScore: { type: mongoose.Decimal128, default: null },
      prevWeekAvgHR: { type: mongoose.Decimal128, default: null },
      prevWeekAvgHRV: { type: mongoose.Decimal128, default: null },
      prevWeekAvgTotalEpisode: { type: mongoose.Decimal128, default: null },
      prevWeekAvgTotalDuration: { type: mongoose.Decimal128, default: null },
      activities: [{
        type: { type: String },
        start: Date,
        end: Date,
        duration: Number
      }]
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
