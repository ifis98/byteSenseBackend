const mongoose = require("mongoose");
var DateOnly = require('mongoose-dateonly')(mongoose);

const UserProfile = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true
  },
  fName: {
    type: String,
    required: true,
  },
  lName: {
    type: String,
    required: true,
  },
  email:{
    type: String
  },
  picture: {
    type: String,
    required: false,
  },
  bio: {
    type: String,
    required: false,
  },
  address: {
    street: {
      type: String
    },
    unitNo: {
      type: String
    },
    city: {
      type: String
    },
    state:{
      type: String
    },
    zip: {
      type: String
    },
    country: {
      type: String
    }
  },
  phone:{
    type: String
  },
  dob: {
    type: String,
    required: false,
  },
  gender: {
    type: String,
    required: false,
  },
  userCreationDate : Date
});
// export model user with UserSchema
module.exports = mongoose.model("userProfile", UserProfile);
