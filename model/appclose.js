const mongoose = require("mongoose");

const appclose = mongoose.Schema({
    user: mongoose.Types.ObjectId,
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

module.exports = mongoose.model("appclose", appclose);