const mongoose = require("mongoose");

const appopen = mongoose.Schema({
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

module.exports = mongoose.model("appopen", appopen); 