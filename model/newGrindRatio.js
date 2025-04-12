const mongoose = require("mongoose");

const newGrindRatio = mongoose.Schema({
  user:mongoose.Types.ObjectId,
  date: Date,
  data: {
    hours: [{
      _id: Number,
      hourData: [{
        gr:[],
        gr1:Number,
        gr2:Number,
        ts: Date
      }]
    }],
  }

});

module.exports = mongoose.model("newGrindRatio", newGrindRatio); 