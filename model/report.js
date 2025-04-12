const mongoose = require("mongoose");

const report = mongoose.Schema({
  user: mongoose.Schema.Types.ObjectId,
  date: Date,
  total_episodes: Number,
  total_duration: Number,
  duration_list: [{
    start: String,
    end: String
  }],
  total_sleep_time: Number,
  Qs: Number,
  Wk: Number,

});

module.exports = mongoose.model("report", report); 
