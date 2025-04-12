const mongoose = require("mongoose");

//var grindRatio = mongoose.model("grindRatio",)

const grindRatio = mongoose.Schema({
  user:mongoose.Types.ObjectId,
  date: Date,
  data: {
    hours: [{
      _id: Number,
      hourData: [{
        gr:[],
        gr1: Number,
        gr2: Number,
        ts: Date
      }]
    }],
  }

});

module.exports = mongoose.model("grindRatio", grindRatio); 