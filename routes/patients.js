const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const User = require("../model/user");
const PatientRequestList = require("../model/patientsRequest");
const UserProfile = require("../model/userProfile");
const PatientData = require("../model/patientData");
const DoctorList = require("../model/patientList");
const Training = require("../model/training");
const Callibiration = require("../model/callibiration");
const painSurvey = require("../model/painSurvey");
const axios = require('axios');
const nodemailer = require("nodemailer");
const { resolve } = require("path");


router.get("/viewDoctor", auth, async (req, res) => {
  try {
    const doctors = await User.find({ isDoctor: true });
    //console.log(doctors)
    var userMap = [];
    for (i = 0; i < doctors.length; i++) {
      doctorProfile = await UserProfile.findOne({ user: doctors[i]._id });
      userMap.push(doctorProfile);
    }
    res.status(200).send(userMap);
  } catch (e) {
    res.status(400).send(e);
  }
});

router.get("/myDoctor", auth, async (req, res) => {
  const doctors = await DoctorList.find({ patient: req.user._id });
  if (!doctors) {
    res.status(404).send("Doctors not found!");
  }
  console.log(req.user._id)
  const doctorList = [];
  for (i = 0; i < doctors.length; i++) {
    doctorProfile = await UserProfile.findOne({ user: doctors[i].doctor });
    doctorList.push(doctorProfile);
  }
  res.status(200).send(doctorList);
});

router.post("/sendRequest", auth, async (req, res) => {
  const userID = req.body.doctor;
  const user = await User.findOne({ _id: userID });
  if (user) {
    const newRequest = new PatientRequestList({
      ...req.body,
      patient: req.user._id,
    });
    try {
      await newRequest.save();
      res.status(200).send("Request sent!");
    } catch (e) {
      res.status(400).send("Failed to sent request");
    }
  }
});

router.get("/checkRequest", auth, async (req, res) => {
  const pendingList = await PatientRequestList.find({ patient: req.user._id });
  //console.log(doctor)
  var responseList = [];
  for (i = 0; i < pendingList.length; i++) {
    const doctor = await UserProfile.findOne({ user: pendingList[i].doctor });
    const name = doctor.fName + " " + doctor.lName;
    const data = {
      name: name,
      id: doctor.user,
    };
    responseList.push(data);
  }

  res.send(responseList);
});

router.post("/withdrawRequest", auth, async (req, res) => {
  PatientRequestList.findOneAndRemove(
    { doctor: req.body.doctorID, patient: req.user._id },
    function (err) {
      if (!err) {
        res.status(200).send("Removed from personal list!");
      } else {
        res.status(400).send("Failed to remove from the request list");
      }
    }
  );
});

router.post("/removeDoctor", auth, async (req, res) => {
  DoctorList.findOneAndRemove({ patient: req.user._id }, function (err) {
    if (!err) {
      res.status(200).send("Removed from personal list!");
    } else {
      res.status(400).send("Failed to remove doctor from personal list");
    }
  });
});

router.post("/addPatientData", auth, async (req, res) => {
  PatientData.findOneAndUpdate(
    { user: req.user._id },
    {
      deviceID: req.body.deviceID,
      appData: {
        Date: req.body.Date,
        totalEpisode: req.body.totalEpisode,
        totalDuration: req.body.totalDuration,
      },
      rawData: {
        timeStamp: req.body.timeStamp,
        sensor1: req.body.sensor1,
        sensor2: req.body.sensor2,
        sensor3: req.body.sensor3,
        sensor4: req.body.sensor4,
      },
    },
    {
      returnOriginal: false,
    },
    function (err, result) {
      if (err) {
        res.status(400).send(err);
      } else {
        res.status(200).send(result);
      }
    }
  );
});

router.post("/training", auth, async (req, res) => {

  var toDate = new Date(req.body.date);
  var today = toDate.setUTCHours(0, 0, 0, 0);

  Training.findOneAndUpdate(
    { "user": req.user._id, "date": today },
    { $push: { training: { $each: req.body.training } } },
    { upsert: true },
    function (err, result) {
      if (err) {
        //console.log('error');
        res.status(400).send(err);
      } else {
        //console.log('training data inserted');
        res.status(200).send('training data saved sucessfully!');
        //console.log(doc.data.hours[0].hourData)
      }
    })

})

router.post("/callibiration", auth, async (req, res) => {

  var toDate = new Date(req.body.date);
  var today = toDate.setUTCHours(0, 0, 0, 0);

  Callibiration.findOneAndUpdate(
    { "user": req.body.userID, "date": today },
    { $push: { callibiration: { $each: req.body.callibiration } } },
    { upsert: true },
    function (err, result) {
      if (err) {
        //console.log('error');
        res.status(400).send(err);
      } else {
        //console.log('training data inserted');
        res.status(200).send('callibiration data saved sucessfully!');
        //console.log(doc.data.hours[0].hourData)
      }
    }
  )

})

router.post("/getCallibiration", async (req, res) => {
  var date = new Date(req.body.date).setUTCHours(0, 0, 0, 0);
  var userID = req.body.userID;
  try {

    const callibirationData = await Callibiration.find({ user: userID, date: date });
    res.status(200).send(callibirationData);

  } catch (e) {
    res.status(400).send(e);
  }

})

router.post("/postPainSurvey", auth, async (req, response) => {

  console.log(req)
  var userID = req.body.userID;
  var date = req.body.date;
  var answer = req.body.answer;
  const token = req.header('Authorization')
  

  if (answer === 4) {
    const URI = 'http://18.219.37.253:4000/myDoctor'
    var header = {
      headers: {
        'Authorization': token
      }
    }
    try {
      const res = await axios.get(URI, header);
      console.log(res.data)
      var emailList = []
      for (i = 0; i < res.data.length; i++) {
        emailList.push(res.data[i].email);
      }

      var transport = nodemailer.createTransport({
        service: 'gmail',
        port: 465,
        secure: true,
        auth: {
          user: 'bruxaway.noreply@gmail.com',
          pass: 'bruxAway2020'
        }
      });

      const userProfile = await UserProfile.find({ "user": userID });
      console.log(userProfile);

      for (i = 0; i < emailList.length; i++) {
        var email = emailList[i];
        var mailOptions = {
          to: email,
          from: 'passwordreset@bruxAway.com',
          subject: 'Pain Survey Result',
          text: 'Hello ' + res.data[i].fName + ' ' + res.data[i].lName + ',\n\n\n' + userProfile[0].fName + ' ' + userProfile[0].lName +
            ' has suffered unbearable pain!!\n\n'
        };

      }

      var result = await transport.sendMail(mailOptions)
      //console.log(result.accepted.length);
      if (result.accepted.length > 0) {
        response.status(200).send('email sent to dentist');
      } else {
        throw new Error('Sending email failed')
      }

    } catch (e) {
      //console.log(e)
      response.status(400).send(e)

    }
  } else {

    painSurvey.findOneAndUpdate(
      { "user": req.body.userID, "date": date },
      { "surveyAnswer": answer },
      { upsert: true },
      function (err, result) {
        if (err) {
          //console.log('error');
          response.status(400).send(err);
        } else {
          //console.log('training data inserted');
          response.status(200).send('pain survey data saved sucessfully!');
          //console.log(doc.data.hours[0].hourData)
        }
      }

    )

  }
})



module.exports = router;
