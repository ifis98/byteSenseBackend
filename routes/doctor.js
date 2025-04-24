const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

const User = require("../model/user");
const PersonalPatientList = require("../model/patientList");
const PatientRequestList = require("../model/patientsRequest");
const UserProfile = require("../model/userProfile");
const PatientData = require("../model/patientData");
const GrindRatio = require("../model/grindRatio");
const newGrindRatio = require("../model/newGrindRatio");
const Report = require("../model/report");
const connection = require("../model/connection");
const disconnection = require("../model/disconnection");
const appopen = require("../model/appopen");
const appclose = require("../model/appclose");
const battery = require("../model/battery");
const { response } = require("express");
const mongoose = require("mongoose");
const moment = require('moment-timezone');
const { spawn } = require('child_process');
const path = require('path')
const { performance } = require('perf_hooks');
const { type } = require("os");
const { findOne } = require("../model/user");
//const { type } = require("os");
const _ = require('lodash');
const os = require("os");


//const fastcsv = require("fast-csv");
const fs = require("fs").promises;
const fss = require("fs");
const FormData = require('form-data');
const { concatLimit } = require("async");
const report = require("../model/report");
const axios = require('axios');
//const ws = fs.createWriteStream("DownloadData.csv");

const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY); // set this in .env

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.post("/createCheckoutSession", upload.fields([
  { name: 'upperScan', maxCount: 1 },
  { name: 'lowerScan', maxCount: 1 },
]), async (req, res) => {
  try {
    const {
      caseName,
      arch,
      type,
      maxUndercut,
      passiveSpacer,
      instructions,
      clientName // <-- sent from frontend
    } = req.body;

    const upperScanFile = req.files?.upperScan?.[0];
    const lowerScanFile = req.files?.lowerScan?.[0];

    if (!upperScanFile || !lowerScanFile) {
      return res.status(400).json({ error: "Both STL files are required." });
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 29900,
          product_data: {
            name: `Nightguard - ${caseName || "Custom Order"}`,
            description: `Arch: ${arch}, Type: ${type}`,
          },
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${req.headers.origin}/order-success`,
      cancel_url: `${req.headers.origin}/order`,
    });

    // Simulate order number
    const orderNumber = session.id.slice(-6).toUpperCase();

    // Create ClickUp task
    const taskPayload = {
      name: `Nightguard Order - ${caseName || "Untitled"}`,
      description: "Order submitted through the web form",
      custom_fields: [
        { id: '40dfb534-4b64-41fa-afc9-43722b3a0fbe', value: caseName }, // Case Name
        { id: '27ccf01f-e3b4-4cf5-a286-87e328135884', value: clientName }, // Client
        { id: 'a94b1a8c-efd2-42b0-a74b-90527e46d516', value: orderNumber }, // Order Number
        { id: 'b21b9a81-4a00-4044-96fb-74688c72c125', value: arch },
        { id: 'a43353d8-c4dd-428f-9938-f79f113aad40', value: type },
        { id: '5ce707a1-5770-4bab-9d30-62b9c5f6f985', value: maxUndercut },
        { id: '6dd7ca3f-1725-4335-985e-055c042d3ada', value: passiveSpacer },
        { id: '8a8fc580-187f-4932-8a8d-f861a302ae38', value: instructions },
      ],
    };

    const taskRes = await axios.post(
      'https://api.clickup.com/api/v2/list/901110333024/task',
      taskPayload,
      {
        headers: {
          Authorization: process.env.CLICKUP_TOKEN,
        },
      }
    );

    const taskId = taskRes.data.id;

    // Attach renamed STL files
    const uploadAttachment = async (file, label) => {
      const renamedFilename = `${label}_${orderNumber}.stl`;

      const form = new FormData();
      form.append('attachment', fss.createReadStream(file.path), renamedFilename);

      await axios.post(
        `https://api.clickup.com/api/v2/task/${taskId}/attachment`,
        form,
        {
          headers: {
            Authorization: process.env.CLICKUP_TOKEN,
            ...form.getHeaders(),
          },
        }
      );
    };

    await uploadAttachment(upperScanFile, 'upper');
    await uploadAttachment(lowerScanFile, 'lower');

    return res.status(200).json({ sessionId: session.id });
  } catch (err) {
    console.error("Checkout or ClickUp error:", err.message);
    return res.status(500).json({ error: "Server error. Try again later." });
  }
});


router.get("/patientRequest", auth, async (req, res) => {
  const requests = await PatientRequestList.find({ doctor: req.user._id });
  if (!requests) {
    res.status(404).send("User doen't exist");
  }
  const requestList = [];
  for (i = 0; i < requests.length; i++) {
    patientProfile = await UserProfile.findOne({ user: requests[i].patient });
    requestList.push(patientProfile);
  }
  res.status(200).send(requestList);
});

router.post("/addPatient", auth, async (req, res) => {
  const userID = req.body.patient;
  const user = await User.findOne({ _id: userID });
  if (user) {
    const newPatient = new PersonalPatientList({
      ...req.body,
      doctor: req.user._id,
    });

    try {
      await newPatient.save();
      PatientRequestList.findOneAndRemove({ patient: userID }, function (err) {
        if (!err) {
          console.log("Removed from patient request list!");
        } else {
          console.log("Failed to remove from request list!");
        }
      });
      res.status(200).send("Patient has been addeed to the list!");
    } catch (e) {
      res.status(400).send(e);
    }
  }
});

router.post("/declineRequest", auth, async (req, res) => {
  PatientRequestList.findOneAndRemove(
    { patient: req.body.patient },
    function (err) {
      if (!err) {
        res.status(200).send("Removed from personal list!");
      } else {
        res.status(400).send("Failed to remove from the request list");
      }
    }
  );
});

router.post("/removePatient", auth, async (req, res) => {
  PersonalPatientList.findOneAndRemove(
    { patient: req.body.patient },
    function (err) {
      if (!err) {
        res.status(200).send("Removed from personal list!");
      } else {
        res.status(400).send("Failed to remove from personal list");
      }
    }
  );
});

router.get("/patientList", auth, async (req, res) => {
  try {
    const doc = await PersonalPatientList.find({
      doctor: req.user._id,
    }).populate("patientList");
    const patientList = [];
    for (i = 0; i < doc.length; i++) {
      var patient = await UserProfile.findOne({ user: doc[i].patient });
      //Hard code Data for Last Visited, Next Appointment, Bruxism Level,
      var obj1 = {
        LastVisited: "12/09/2020",
        NextAppointment: "12/09/2020",
        BruxismLevel: "High",
      };
      var new_patient = { ...patient, ...obj1 };

      patientList.push({ new_patient });
    }
    res.status(200).send({ patientList });
  } catch (e) {
    res.status(400).send("No patient in the list");
  }
});

/**********************************************************/

router.post("/grindRatio",async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  console.log(req.query)
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
 // console.log(new Date(reqDate))
 // console.log(new Date(nextDate))
 // console.log(_user)

  const user = await GrindRatio.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });

  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].objList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate);
      });
      console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var grindRatio;
      console.log(resultData.length)
      if (resultData.length >= 2) {
        console.log("two documents")
        for (i = 0; i < resultData.length; i++) {
          //console.log(reqDate+" "+nextDate)
          //console.log(resultData[i].Date.getTime() == reqDate)
          var startIdx;
          var endIdx;
          if (resultData[i].Date.getTime() == reqDate) {
            startIdx = 23;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 22;
          }
          console.log(resultData[i].Date + " "+resultData[i]._id)
          grindRatio = await GrindRatio.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          fetchList.push(grindRatio[0]);
          //console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        console.log("only one document to look for")
        grindRatio = await GrindRatio.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(grindRatio[0]);
      } else {
        //data for request day but not next day
        grindRatio = await GrindRatio.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [0, 23]
            }
          }
        )
        fetchList.push(grindRatio[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              if (hour_data[k].gr.length != 0) {
                const allowed = ['ts', 'gr'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
                //responseData.push(hour_data[k]);
              } else {
                //console.log(hour_data[k]);
                const allowed = ['ts', 'gr1', 'gr2'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
              }


            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log("no data")
        console.log(resultData)
        res.status(404).send("No data for this date in objList");
      }




    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    //console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

/**********************************************************/

router.post("/newGrindRatio", auth, async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
  console.log(_user)
  //console.log(reqDate)
  //console.log(_user)
  const user = await newGrindRatio.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });
  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].objList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate && (a.upgraded == true));
      });
      //console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var grindRatio;

      if (resultData.length == 2) {
        for (i = 0; i < 2; i++) {
          var startIdx;
          var endIdx;
          if (i == 0) {
            startIdx = 22;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 23;
          }
          grindRatio = await newGrindRatio.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          fetchList.push(grindRatio[0]);
          //console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        //console.log("only one document to look for")
        grindRatio = await newGrindRatio.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [22, 23]
            }
          }
        )
        fetchList.push(grindRatio[0]);
      } else {
        //data for request day but not next day
        grindRatio = await newGrindRatio.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [0, 23]
            }
          }
        )
        fetchList.push(grindRatio[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          //console.log(hour_data);
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              responseData.push(hour_data[k]);

            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log(resultData)
        console.log("no data")
        res.status(404).send("No data for this date in objList");
      }

    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

/**********************************************************/

router.post("/patientData", auth, async (req, res) => {
  try {
    _user = req.body.userID;
    const patientData = await PatientData.findOne({ user: _user });
    const patient = await UserProfile.findOne({ user: _user });
    const name = patient.fName + " " + patient.lName;
    const picture = "./Uploads/profilePictures/" + patient.picture;
    //Hard code compliance, pressure level, tonic, brux night, avg freq, summary

    // var obj1 = {
    //   compliance: "22/31",
    //   pressure: "High",
    //   type: "tonic",
    //   brux_Night: "3.5/weeks",
    //   avg_Freq: "4.6/hr",
    // };
    result = {};
    var obj = patientData.appData;
    var numerator = patientData.objList.length;
    var startDate = patient.userCreationDate;
    var endDate = new Date();
    var timeDiff = endDate.getTime() - startDate.getTime();
    var denom = timeDiff / (1000 * 3600 * 24);
    for (i = 0; i < obj.length; i++) {
      var key = obj[i].Date;
      var myDate = new Date(key);
      var key = myDate.toISOString().substr(0, 10);
      result[key] = {
        totalEpisode: obj[i].totalEpisode,
        totalDuration: obj[i].totalDuration,
      };
    }
    if(parseInt(denom) === 0){
      denom = 1;
    }
    //var response = {...result, ...obj1}
    var finalresponse = {};
    finalresponse = {
      name: name,
      data: result,
      compliance: {
        CompDays: numerator,
        totalDays: parseInt(denom),
      },
      picture: picture,
    };
    res.status(200).send(finalresponse);
  } catch (e) {
    //console.log(e)
    res.status(404).send(e);
  }
});

router.post("/episodes", auth, async (req, res) => {
  //var start = performance.now()
  const filePath = path.join(__dirname, "../test.py")
  var userID = req.body.userID
  console.log('report for: '+userID)
  // if(userID ==="5ff6bbc7f579a6233f6fb1d7")
  // {
  //   console.log("generating report for 5ff6bbc7f579a6233f6fb1d7");
  // }
  var date = req.body.date
  //token is exposed 
  var token = req.headers.authorization
  parsed_token = token.split(' ')[1]
  //console.log(userID, date, parsed_token);
  //const childpython = spawn('python', [filePath, '6022ec9ece14754214936685'], { shell: true });
  var childpython = spawn('python3', [filePath, userID, date, parsed_token], { shell: true });

  childpython.stdout.on('data', async (data) => {
    //console.log(`stdout: ${data}`);
    var result = JSON.parse(data)
    var reqDate = new Date(date).setUTCHours(0, 0, 0, 0);
    var report = await Report.find({ user: userID, date: reqDate }).lean();
    //console.log(result);
    durationList = []
    for (i = 0; i < result.duration_list.length; i++) {
      let tempDuration = {
        start: '',
        end: ''
      }
      start = result.duration_list[i][0]
      end = result.duration_list[i][1]
      tempDuration.start = start
      tempDuration.end = end
      durationList.push(tempDuration)
    }
    // weekly comparison
    //console.log("Report : " + report);
    var average = await lastWeekAverage(date, userID);
    var wk = null;
    if (average != 0) {
      var current_duration = result.total_duration;
      wk = ((current_duration - average) / average) * 100
      wk = wk.toFixed(2)

    }

    if (report.length != 0) {
      //console.log(report);
      //console.log(result.quality_sleep)
      console.log('report find and update started')
      await Report.findByIdAndUpdate(
        { _id: report[0]._id },
        {
          total_episodes: result.total_episodes,
          duration_list: durationList,
          total_sleep_time: result.total_sleep,
          total_duration: result.total_duration,
          Qs: result.quality_sleep,
          Wk: wk,
        },
        { upsert: true },
        function (err, data) {
          if (err) {
            console.log("Updating report failed!");
            console.log(err);
          } else {
            console.log("Successfully updated report!");
          }
        }
      )
      console.log('report find and update passed')
    } else {
      console.log('new report started')
      const new_report = new Report({
        user: userID,
        date: reqDate,
        total_episodes: result.total_episodes,
        duration_list: durationList,
        total_sleep_time: result.total_sleep,
        total_duration: result.total_duration,
        Qs:result.quality_sleep,
        Wk: wk
      })
      await new_report.save();
      console.log('new report created')
    }

    //var end = performance.now();
    //console.log((end - start) / 1000);
    //res.end(result);
    return res.status(200).send(`stdout: ${data}`);
  });
  
 childpython.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
    return res.status(400).send(`stderr: ${data}`);
  });

 childpython.on('exit', (code) => {
    console.log(`child process exited with code ${code}`);
  })
});

async function lastWeekAverage(date, userID) {

  //from currentDate find last Sunday
  date = new Date(date).setUTCHours(0,0,0,0);
  date = new Date(date);
  var currentDate = new Date(date).setUTCHours(0,0,0,0);
  currentDate = new Date(currentDate);
  console.log(currentDate);
  var DayofWeek = currentDate.getDay() + 1; //offset by 1 day
  if (DayofWeek === 7) {
    DayofWeek = 0;
  }
  //console.log(DayofWeek);
  
  //based on DayofWeek find last Sunday date

  var lastSunday, Sunday;
  if (DayofWeek === 0) {
    lastSunday = currentDate.setDate(currentDate.getDate() - 7);
    Sunday = date.setDate(date.getDate() - 7);
  } else {
    lastSunday = currentDate.setDate(currentDate.getDate() - DayofWeek);
    Sunday = date.setDate(date.getDate() - DayofWeek);
  }

  Sunday = new Date(Sunday);
  //console.log(Sunday)
  lastSunday = new Date(lastSunday)
  //console.log(lastSunday);
  var lastSaturday = lastSunday.setDate(lastSunday.getDate() + 6)
  lastSaturday = new Date(lastSaturday);
  //console.log(lastSaturday);
  //console.log(lastSunday);

  //get all durtaion from lastSunday to lastSaturday
  var data = await Report.find({ user: userID, "date": { "$gte": Sunday, "$lte": lastSaturday, } });
  if (data.length == 0) {
    return 0;
  }
  var durationList = []
  for (i = 0; i < data.length; i++) {
    durationList.push(data[i].total_duration)
  }
  //console.log(durationList);
  var total = 0
  for (i = 0; i < durationList.length; i++) {
    total += durationList[i];
  }

  var average = total / durationList.length;


  // get duration average from Sunday to Saturday and return
  return average;

}

router.post("/report", async (req, res) => {
  var userID = req.body.userID;
  var date = req.body.date;

  const report = await Report.find({ user: userID, date: date });

  if (report) {
    res.status(200).send(report);
  } else {
    res.status(400).send("Cannot find report.");
  }

});

router.get("/downloadData", async (req, res) => {

  var startDate = new Date(req.body.startDate).setUTCHours(0, 0, 0, 0);
  var endDate = new Date(req.body.endDate).setUTCHours(0, 0, 0, 0);
  //console.log(startDate, endDate);
  //get all the patient
  var patient = await PatientData.find({}, { appData: 0, objList: 0 });
  var patientList = []
  for (i = 0; i < patient.length; i++) {
    patientList.push(patient[i].user)
  }

  //get grindRatio document id from objList in PatientData for each patient
  for (l = 0; l < patientList.length; l++) {

    var doc = await PatientData.find({ user: patientList[l] }, { appData: 0 }).limit(1).lean();
    var userInfo = await UserProfile.find({ user: patientList[l] });
    console.log(userInfo)
    await fs.appendFile('filename.txt', "Patient: " + userInfo[0].fName + ' ' + userInfo[0].lName + os.EOL);

    var objList, resultData;
    try {
      objList = doc[0].objList;
      //console.log(objList);

      resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= endDate && date >= startDate);
      });

      //console.log(resultData, patientList[j]);
    } catch (e) {

    }

    var fetchList = [];
    try {

      for (i = 0; i < resultData.length; i++) {

        var grindRatioData = await GrindRatio.find(
          {
            _id: resultData[i]._id
          },
          {
            "data.hours": {
              "$slice": [0, 23]
            }
          }
        )

        fetchList.push(grindRatioData[0]);
      }

    } catch (e) {

    }


    var responseData = []
    try {
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          //console.log(hour_data);
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              responseData.push(hour_data[k]);
              var JSONresult = JSON.stringify(hour_data[k]);
              await fs.appendFile('filename.txt', JSONresult + os.EOL);
            }
          }

        }

      }


    } catch (e) { }


    await fs.appendFile('filename.txt', "************************************************************************************" + os.EOL);

  }

  res.status(200).send("Sucessfully downloaded");


})

router.post("/connection", auth, async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
  console.log(new Date(reqDate))
  console.log(new Date(nextDate))
  //console.log(_user)

  const user = await connection.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });

  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].objList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate);
      });
      //console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var conn;
      console.log(resultData.length)
      if (resultData.length == 2) {
        console.log("two documents")
        for (i = 0; i < 2; i++) {
          var startIdx;
          var endIdx;
          if (i == 0) {
            startIdx = 22;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 23;
          }
          conn = await connection.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          fetchList.push(conn[0]);
          //console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        console.log("only one document to look for")
        conn = await connection.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(conn[0]);
      } else {
        //data for request day but not next day
        conn = await connection.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(conn[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              if (hour_data[k].gr.length != 0) {
                const allowed = ['ts', 'gr'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
                //responseData.push(hour_data[k]);
              } else {
                //console.log(hour_data[k]);
                const allowed = ['ts', 'gr1', 'gr2'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
              }


            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log("no data")
        res.status(404).send("No data for this date in objList");
      }




    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    //console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

router.post("/disconnection", auth, async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
  console.log(new Date(reqDate))
  console.log(new Date(nextDate))
  //console.log(_user)

  const user = await disconnection.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });

  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].objList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate);
      });
      //console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var disconn;
      console.log(resultData.length)
      if (resultData.length == 2) {
        console.log("two documents")
        for (i = 0; i < 2; i++) {
          var startIdx;
          var endIdx;
          if (i == 0) {
            startIdx = 22;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 23;
          }
          disconn = await disconnection.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          fetchList.push(disconn[0]);
          //console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        console.log("only one document to look for")
        disconn = await disconnection.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(disconn[0]);
      } else {
        //data for request day but not next day
        disconn = await disconnection.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(disconn[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              if (hour_data[k].gr.length != 0) {
                const allowed = ['ts', 'gr'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
                //responseData.push(hour_data[k]);
              } else {
                //console.log(hour_data[k]);
                const allowed = ['ts', 'gr1', 'gr2'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
              }


            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log("no data")
        res.status(404).send("No data for this date in objList");
      }




    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    //console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

router.post("/appopen", auth, async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
  console.log(new Date(reqDate))
  console.log(new Date(nextDate))
  //console.log(_user)

  const user = await appopen.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });

  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].objList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate);
      });
      //console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var appOpen;
      console.log(resultData.length)
      if (resultData.length == 2) {
        console.log("two documents")
        for (i = 0; i < 2; i++) {
          var startIdx;
          var endIdx;
          if (i == 0) {
            startIdx = 22;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 23;
          }
          appOpen = await appopen.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          fetchList.push(appOpen[0]);
          //console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        console.log("only one document to look for")
        appOpen = await appopen.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(appOpen[0]);
      } else {
        //data for request day but not next day
        appOpen = await appopen.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(appOpen[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              if (hour_data[k].gr.length != 0) {
                const allowed = ['ts', 'gr'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
                //responseData.push(hour_data[k]);
              } else {
                //console.log(hour_data[k]);
                const allowed = ['ts', 'gr1', 'gr2'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
              }


            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log("no data")
        res.status(404).send("No data for this date in objList");
      }




    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    //console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

router.post("/appclose", auth, async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
  console.log(new Date(reqDate))
  console.log(new Date(nextDate))
  //console.log(_user)

  const user = await appclose.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });

  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].objList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate);
      });
      //console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var appClose;
      console.log(resultData.length)
      if (resultData.length == 2) {
        console.log("two documents")
        for (i = 0; i < 2; i++) {
          var startIdx;
          var endIdx;
          if (i == 0) {
            startIdx = 22;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 23;
          }
          appClose = await appclose.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          fetchList.push(appClose[0]);
          //console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        console.log("only one document to look for")
        appClose = await appclose.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(appClose[0]);
      } else {
        //data for request day but not next day
        appClose = await appclose.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(appClose[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              if (hour_data[k].gr.length != 0) {
                const allowed = ['ts', 'gr'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
                //responseData.push(hour_data[k]);
              } else {
                //console.log(hour_data[k]);
                const allowed = ['ts', 'gr1', 'gr2'];
                const filteredObj = _.pick(hour_data[k], allowed);
                responseData.push(filteredObj);
              }


            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log("no data")
        res.status(404).send("No data for this date in objList");
      }




    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    //console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

router.post("/battery", async (req, res) => {
  //if no data on next date just get data for current date.
  // time needs to be 1pm to 1pm
  var start = performance.now()
  var reqDate = new Date(req.query.date).setUTCHours(0, 0, 0, 0);
  var nextDate = reqDate + 86400000
  var _user = req.query.userID
  console.log(new Date(reqDate))
  console.log(new Date(nextDate))
  //console.log(_user)

  const user = await battery.exists({
    $or: [
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: reqDate }] },
      { $and: [{ user: mongoose.Types.ObjectId(_user) }, { date: nextDate }] }
    ]
  });

  //console.log(user)

  if (user) {
    try {
      //var startPD = performance.now();
      var doc = await PatientData.find({ user: _user }, { appData: 0 }).limit(1).lean();
      //var endPD = performance.now();
      //console.log('fetch time for patient data: ' + (endPD - startPD) / 1000);
      //console.log(doc);
      //console.log('**********')
      var objList = doc[0].batteryList;
      //console.log(objList)
      var resultData = objList.filter(a => {
        var date = new Date(a.Date);
        return (date <= nextDate && date >= reqDate);
      });
      //console.log(resultData)
      var parseDate = resultData[0].Date;
      var checkDay = parseDate.getDate() + 1;
      var currentDay = parseDate.getDate();
      var str = req.query.date.split("/");
      var reqDay = Number(str[1]);
      //console.log(checkDay, reqDay);
      //var startFindDoc = performance.now();
      var fetchList = [];
      var Battery;
      console.log(resultData)
      if (resultData.length == 2) {
        console.log("two documents")
        for (i = 0; i < 2; i++) {
          var startIdx;
          var endIdx;
          if (i == 0) {
            startIdx = 23;
            endIdx = 23;
          } else {
            startIdx = 0;
            endIdx = 22;
          }
          console.log(resultData[i]._id)
          Battery = await battery.find(
            {
              _id: resultData[i]._id
            },
            {
              "data.hours": {
                "$slice": [startIdx, endIdx]
              }
            }
          )
          console.log(Battery)
          fetchList.push(Battery[0]);
          console.log(fetchList);
        }


      } else if (currentDay === reqDay) {
        console.log("only one document to look for")
        Battery = await battery.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [23, 23]
            }
          }
        )
        fetchList.push(Battery[0]);
      } else {
        //data for request day but not next day
        Battery = await battery.find(
          {
            _id: resultData[0]._id
          },
          {
            "data.hours": {
              "$slice": [0, 22]
            }
          }
        )
        fetchList.push(Battery[0]);

      }

      //console.log(fetchList);

      //var endFindDoc = performance.now();
      //console.log('find grindratio time: ' + (endFindDoc - startFindDoc) / 1000);
      var responseData = []
      for (i = 0; i < fetchList.length; i++) {
        var hours = fetchList[i].data.hours;
        //console.log(hours);
        for (j = 0; j < hours.length; j++) {
          var hour_data = hours[j].hourData;
          if (hour_data.length != 0) {
            for (k = 0; k < hour_data.length; k++) {
              responseData.push(hour_data[k])
            }
          }

        }

      }
      if (responseData.length != 0) {

        res.status(200).send(responseData);

      } else {
        console.log("no data")
        res.status(404).send("No data for this date in objList");
      }




    } catch (e) {
      console.log(e)
      res.status(400).send(e)
    }
  } else {
    //console.log("User doesnt exist")
    res.status(400).send("User doesn't exist")
  }


});

module.exports = router;


