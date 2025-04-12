const mongoose = require("mongoose");

const Patient = mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
  },
});

module.exports = mongoose.model("PersonalPatientList", Patient);
