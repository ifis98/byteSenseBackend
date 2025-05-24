const mongoose = require('mongoose');
const uniqueValidator = require('mongoose-unique-validator');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


const UserSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
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
    required: true,
  },
  resetPasswordToken: {
    type: String
  },
  resetPasswordExpires: {
      type: Date
  },
  tokens:[{
    token: {
        type: String,
        required: true
    }
}]
});

UserSchema.plugin(uniqueValidator);
UserSchema.index({ email: 1, isDoctor: 1 }, { unique: true });

UserSchema.virtual('patientList',{
  ref: 'PersonalPatientList',
  localField: '_id',
  foreignField: 'doctor'
})

UserSchema.methods.generateAuthToken = async function (){
  const user = this
  const token = jwt.sign({_id: user._id.toString()},'randomstring')

  user.tokens = user.tokens.concat({token})
  await user.save()

  return token
}

UserSchema.methods.findByCredentials = async function (user,password){
  const isMatch = await bcrypt.compare(password,user.password)
  return isMatch
}

UserSchema.pre('save', async function(next){
  const user = this
  if (user.isModified('password')){
      const salt = await bcrypt.genSalt(10)
      user.password = await bcrypt.hash(user.password,salt)
  }
  next()
})

UserSchema.methods.checkPassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};


// export model user with UserSchema
module.exports = mongoose.model("user", UserSchema);
