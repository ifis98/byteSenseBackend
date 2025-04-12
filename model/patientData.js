const mongoose = require("mongoose");
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const patientData = mongoose.Schema({
user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
deviceID:{
    type: String,
    default: "NoDeviceIdFound"
  },
appData:[
      {
        Date: Date,
        totalEpisode: {type: mongoose.Decimal128, default:0},
        totalDuration: {type: mongoose.Decimal128, default:0}
      }
    ],
energy:[
      {
        time: Date,
        energy: {type: mongoose.Decimal128, default:0}
      }
    ],
  objList: [{
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }],
  batteryList: [{
      Date: Date,
      _id: mongoose.Types.ObjectId,
    }],
  connectionList:[{
    Date: Date,
      _id: mongoose.Types.ObjectId,
  }],
  disconnectionList:[{
    Date: Date,
      _id: mongoose.Types.ObjectId,
  }],
  appopenList: [{
    Date: Date,
      _id: mongoose.Types.ObjectId,
  }],
  appcloseList: [{
    Date: Date,
      _id: mongoose.Types.ObjectId,
  }],
//grindRatio:
// [
//     {
//         timeStamp: {type: Date, default: Date.now()},
//         grindRatio1: mongoose.Decimal128,
//         grindRatio2: mongoose.Decimal128,
//         grindRatio3: mongoose.Decimal128,
//         grindRatio4: mongoose.Decimal128
//         }
//       ],

//  threshold: {
//         sensor1:{type: mongoose.Decimal128, default:100.2},
//         sensor2:{type: mongoose.Decimal128, default:99.5},
//         sensor3:{type: mongoose.Decimal128, default:110.5},
//         sensor4:{type: mongoose.Decimal128, default:1106.7}
//       },

// accelerometer: 
// [
//   {
//     timeStamp: {type: Date, default: Date.now()},
//     x: mongoose.Decimal128,
//     y: mongoose.Decimal128,
//     z: mongoose.Decimal128
//   }
// ]

});
module.exports = mongoose.model("patientData", patientData);
