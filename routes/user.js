const express = require("express");
//const moment = require("Moment");
const { check, validationResult } = require("express-validator/check");
const router = express.Router();
const validator = require("../express-validations/signupValidator");
const auth = require("../middleware/auth");
const async = require('async');
const crypto = require('crypto');
var fs = require("fs");
const nodemailer = require("nodemailer")
const User = require("../model/user");
const UserProfile = require("../model/userProfile");
const PatientData = require("../model/patientData");
const UploadImage = require("../middleware/uploadImage");
const GrindRatio = require("../model/grindRatio");
const { use } = require("./doctor");
const PatientRequestList = require("../model/patientsRequest");

/**
 * @method - POST
 * @param - /signup
 * @description - User SignUp
 */

router.post("/signup", validator.validateMeChecks, async (req, res) => {
  var date = new Date().setUTCHours(0, 0, 0, 0)
  //date.setHours(0,0,0,0)
  const errors = validationResult(req).formatWith(validator.errorFormatter);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array(),
    });
  }
  try {
    let userEmail = req.body.email.toLowerCase();
    //console.log(userEmail);
    // let user = await User.findOne({ email: userEmail });
    // if (user) {
    //   return res.status(400).json({
    //     msg: "User Already Exists",
    //   });
    // }

    user = new User({
      email: userEmail,
      password: req.body.password,
      userName: req.body.userName,
      isDoctor: req.body.isDoctor,
    });
    await user.save();

    var hasPicture = null;
    if(req.body.picture){
      const path = './Uploads/profilePictures/' + "picture" + "_" + Date.now() + '.png'
      const base64Image = req.body.picture;
      const base64Data = base64Image.replace(/^data:([A-Za-z-+/]+);base64,/, '')
      fs.writeFileSync(path, base64Data, { encoding: 'base64' });
      hasPicture = path.substring(26);
    }   
    profile = new UserProfile({
      user: user._id,
      fName: req.body.fName,
      lName: req.body.lName,
      email: userEmail,
      phone: null,
      picture: hasPicture,
      bio: null,
      address: {
        street: null,
        unitNo: null,
        city: null,
        state: null,
        zip: null,
        country: "US",
      },
      dob: null,
      gender: null,
      userCreationDate: Date.now()
    });
    await profile.save();

    if (!user.isDoctor) {
      patientdata = new PatientData({
        user: user._id,
        deviceID: null
      })
      await patientdata.save();
      const adminID = "638d6bbedd7971432937fbb9"

      const admin = await User.findOne({ _id: adminID });
      if (admin) {
        console.log(admin)
        const newRequest = new PatientRequestList({
          patient: user._id,
          doctor: admin,
        });
        await newRequest.save();
      }
    }

    const token = await user.generateAuthToken();
    res.status(200).send({ user, token });
  } catch (err) {
    console.log(err.message);
    res.status(500).send(err);
  }
});

// router.post("/login", async (req, res) => {
//   const { userName, password } = req.body;
//   try {
//     let user = await User.findOne({ userName });
//     if (!user) return res.status(400).json({ message: "Invalid credentials" });

//     const isMatch = await user.findByCredentials(user, password);
//     if (!isMatch) {
//       return res.status(400).json({ message: "Invalid credentials" });
//     }
//     const token = await user.generateAuthToken();
//     res.status(200).send({ token });

//   } catch (e) {
//     res.status(500).json({
//       message: "Server Error",
//     });
//   }
// });
router.post("/loginWeb", async (req, res) => {
  const { userName, password } = req.body;
  try {
    let user = await User.findOne({ userName });
    if (user.isDoctor) {
      if (!user) return res.status(400).json({ message: "Invalid credentials" });

      const isMatch = await user.findByCredentials(user, password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
      const token = await user.generateAuthToken();
      res.status(200).send({ token });
    }
    else {
      return res.status(405).json({ message: "Please use the Mobile application to login" });
    }
  } catch (e) {
    res.status(500).json({
      message: "Server Error",
    });
  }
});
router.post("/loginMobile", async (req, res) => {
  const { userName, password } = req.body;
  try {
    let user = await User.findOne({ userName });
    if (!user.isDoctor) {
      if (!user) return res.status(400).json({ message: "Invalid credentials" });

      const isMatch = await user.findByCredentials(user, password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }
      const token = await user.generateAuthToken();
      res.status(200).send({ token });
    }
    else {
      return res.status(405).json({ message: "Please use the Web aplication to login" });
    }
  } catch (e) {
    console.log(e)
    res.status(500).json({
      message: "Server Error",
    });
  }
});

router.post("/logout", auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter((token) => {
      return token.token !== req.token;
    });
    await req.user.save();
    res.status(200).send("Logged out successfully");
  } catch (e) {
    res.status(500).send("Failed to log out");
  }
});

router.get("/profile", auth, async (req, res) => {
  try {
    profile = await UserProfile.findOne({ user: req.user._id });
    res.status(200).send({ profile });
  } catch (e) {
    res.status(500).send("Profile not found!");
  }
});

router.put("/updateProfile", auth, async (req, res) => {
  UserProfile.findOneAndUpdate(
    { user: req.user._id },
    {
      fName: req.body.fName,
      lName: req.body.lName,
      bio: req.body.bio,
      address:

      {
        street: req.body.address.street,
        unitNo: req.body.address.unitNo,
        city: req.body.address.city,
        state: req.body.address.state,
        zip: req.body.address.zip
      },
      dob: req.body.dob,
      gender: req.body.gender,
    },
    {
      returnOriginal: false
    },
    function (err, result) {
      if (err) {
        res.status(500).send(err);
      } else {
        res.status(200).send("Profie updated");
      }
    }
  );
});

router.put("/uploadImage", auth, UploadImage, async (req, res) => {
  if (req.file) {
    UserProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        picture: req.file.filename
      },
      {
        returnOriginal: false
      },
      function (err, result) {
        if (err) {
          res.status(500).send(err);
        } else {
          res.status(200).send("Image uploaded successfully");
        }
      }
    )
  } else {
    res.status(500).json({
      message: "Please select a file to upload",
    });
  }
});

router.post("/uploadImageMobile", auth, async (req, res) => {
  const path = './Uploads/profilePictures/' + "picture" + "_" + Date.now() + '.png'
  const base64Image = req.body.picture;
  const base64Data = base64Image.replace(/^data:([A-Za-z-+/]+);base64,/, '')
  fs.writeFileSync(path, base64Data, { encoding: 'base64' });
  var picturePath = path.substring(26);
  UserProfile.findOneAndUpdate(
    { user: req.user._id },
    {
      picture: picturePath
    },
    {
      returnOriginal: false
    },
    function (err, result) {
      if (err) {
        res.send(err);
      } else {
        res.status(200).send("Image Uploaded");
      }
    });
}
);

router.post('/forgotpassword', function (req, res, next) {
  async.waterfall([
    function (done) {
      crypto.randomBytes(20, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({ email: req.body.email }, function (err, user) {
        if (!user) {
          return res.status(400).json({ message: "Invalid email" });
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 1800000;//Email vaid for half an hour

        user.save(function (err) {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
       var transport = nodemailer.createTransport({
      //   host: 'smtp.mailtrap.io',
      //   port: 2525,
      //   auth: {
      //     user: 'b313c5a451f408',
      //     pass: '2a5501a82abb70'
      //   }
      // }
      service: 'gmail',
      port: 465,
      secure: true,
      auth: {
        user: 'bytesense.noreply@gmail.com',
        pass: 'ebnybuudugoardih'
      }  
    });
      var mailOptions = {
        to: user.email,
        from: 'bytesense.noreply@gmail.com',
        subject: 'Password Reset',
        text: 'Hi, username: '+user.userName+'! You are receiving this because you have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + "app.bytesense.us" + '/reset/' + token +'\n\n' + 'This link is valid for half an hour' + '\n\n'
      };
      transport.sendMail(mailOptions, function (err) {
        res.json({ message: "Reset link sent successfully"});
        done(err, 'done');
      });
    }
  ], function (err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

router.put('/reset/:token', function (req, res) {
  async.waterfall([
    function (done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
          return res.status(400).json({ message: "Invalid Token" });
          //return res.redirect('back');
        }

        user.password = req.body.password;
        user.resetPasswordToken = null,
        user.resetPasswordExpires = null;

        user.save(function (err) {
          done(err, user);
        });
      });
    },
    function (user, done) {
      var transport = nodemailer.createTransport({
        // host: 'smtp.mailtrap.io',
        // port: 2525,
        // auth: {
        //   user: 'b313c5a451f408',
        //   pass: '2a5501a82abb70'
        // }
        service: 'gmail',
        port: 465,
        secure: true,
        auth: {
          user: 'bytesense.noreply@gmail.com',
          pass: 'ebnybuudugoardih'
        } 
      });
      var mailOptions = {
        to: user.email,
        from: 'bytesense.noreply@gmail.com',
        subject: 'Password Reset Successful',
        text: 'Hello,\n\n\n' + user.userName +
          ' your password has been changed successfully\n\n'
      };
      transport.sendMail(mailOptions, function (err) {
        return res.status(200).send('Password Reset Successfully');;
        done(err);
      });
    }
  ], function (err) {
    res.redirect('/');
  });
});
router.post('/deleteProfile', auth, function (req, res) {
  async.waterfall([
    function (callback) {
      PatientData.deleteOne(
        { user: req.user._id },
        function (err, patientData) {
          if (err) callback(err);
          callback(null);
        });
    },

    function (callback) {
      UserProfile.deleteOne({ user: req.user._id },
        function (err, res) {
          if (err) callback(err);
          callback(null);
        });
    },
    function (callback) {
      User.deleteOne({ _id: req.user._id },
        function (err, res) {
          if (err) callback(err);
          callback(null);
        });
    },

  ], function (err, result) {
    if (err) throw err;
    res.json({ message: "Deleted successfully" });
  });
});
module.exports = router;
