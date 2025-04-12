const mongoose = require("mongoose");

const callibiration = mongoose.Schema({
  user:mongoose.Types.ObjectId,
  date: Date,
  callibiration: {
    data: [{
        gr:[],
        ts: Date
    }],
  }

});

module.exports = mongoose.model("callibiration", callibiration); 