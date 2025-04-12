const mongoose = require('mongoose')

const randomDisconnect = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
      },
    deviceID:{
        type: String,
        default: "NoDeviceIdFound"
      },
    data:[
        {
            timeStamp: {type: Date, default: Date.now()},
        }
    ]
        

});

module.exports = mongoose.model("randomDisconnect", randomDisconnect);