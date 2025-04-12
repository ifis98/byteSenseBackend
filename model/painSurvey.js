const mongoose = require("mongoose");

const painSurvey = mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  date: Date,
  surveyAnswer: Number

});

module.exports = mongoose.model("painSurvey", painSurvey); 
