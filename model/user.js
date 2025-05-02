const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    uniqueCaseInsensitive: true
  },
  userName: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  isDoctor: {
    type: Boolean,
    required: true
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },
  streetAddress: {
    type: String, // Optional now
    required: false
  },
  city: {
    type: String,
    required: false
  },
  state: {
    type: String,
    required: false
  },
  zipCode: {
    type: String,
    required: false
  },
  tokens: [{
    token: {
      type: String,
      required: true
    }
  }]
});

UserSchema.plugin(uniqueValidator);

// Virtual field for patient's doctor list
UserSchema.virtual('patientList', {
  ref: 'PersonalPatientList',
  localField: '_id',
  foreignField: 'doctor'
});

// Generates JWT and saves it to tokens array
UserSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign({ _id: user._id.toString() }, 'randomstring');

  user.tokens = user.tokens || []; // initialize if undefined
  user.tokens = user.tokens.concat({ token });
  await user.save();

  return token;
};

// Static method to validate user credentials
UserSchema.statics.findByCredentials = async function (user, password) {
  return await bcrypt.compare(password, user.password);
};

// Hash password before saving
UserSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
