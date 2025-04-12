const mongoose = require("mongoose");

const connection = mongoose.Schema({
  user:mongoose.Types.ObjectId,
  date: Date,
  data: {
    hours: [{
      _id: Number,
      hourData: [{
        ts: Date
      }]
    }],
  } 
});

module.exports = mongoose.model("connection", connection); 