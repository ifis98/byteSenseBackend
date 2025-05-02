const mongoose = require("mongoose");

const biometricDataSchema = new mongoose.Schema({
  user: mongoose.Types.ObjectId,
  date: Date,
  data: {
    hours: [{
      _id: Number, // Represents the hour (0–23)
      hourData: [{
        HR: Number,       // Heart Rate
        HRV: Number,      // Heart Rate Variability
        ts: Date          // Timestamp
      }]
    }]
  }
});

module.exports = mongoose.model("BiometricData", biometricDataSchema);
