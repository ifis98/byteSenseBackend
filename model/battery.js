const mongoose = require("mongoose");

//var grindRatio = mongoose.model("grindRatio",)

const battery = mongoose.Schema({
  user:mongoose.Types.ObjectId,
  date: Date,
  data: {
    hours: [{
      _id: Number,
      hourData: [{
        b:Number,
        ts: Date
      }]
    }],
  }

});

module.exports = mongoose.model("battery", battery); 