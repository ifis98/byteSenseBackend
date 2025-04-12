const mongoose = require("mongoose");

const disconnection = mongoose.Schema({
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

module.exports = mongoose.model("disconnection", disconnection); 