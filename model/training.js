const mongoose = require("mongoose");

const training = mongoose.Schema({
    user: mongoose.Types.ObjectId,
    date: Date,
    training: {
        data: [{
            start_date: Date,
            end_date: Date
        }],
    }

});

module.exports = mongoose.model("training", training);