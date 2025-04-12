const mongoose = require("mongoose");

const PatientRequestList = mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

module.exports = mongoose.model("PatientRequestList", PatientRequestList);
