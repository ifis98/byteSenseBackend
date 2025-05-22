require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const user = require("./routes/user"); //new addition
const doctor = require("./routes/doctor");
const patient = require("./routes/patients");
const InitiateMongoServer = require("./config/db");
const { urlencoded } = require("body-parser");
const socket = require("socket.io");
const mongoose = require("mongoose");
const PatientData = require("./model/patientData");
const Report = require("./model/report")
const { use } = require("./routes/user");
const randomDisconnect = require("./model/randomDisconnect");
const ObjectId = require('mongodb').ObjectId;
const grindRatio = require("./model/grindRatio");
const battery = require("./model/battery");
const connection = require("./model/connection");
const disconnection = require("./model/disconnection");
const appopen = require("./model/appopen");
const appclose = require("./model/appclose");
const newGrindRatio = require("./model/newGrindRatio");
const BiometricData = require('./model/biometricData');
const { spawn } = require('child_process');
const { type } = require("os");
const utils = require('./deleteOldData');
const generateReportUtil = require('./generateReport');
const fs = require('fs');
const https = require('https');






//const cron = require('node-cron');
//const { compareSync } = require("bcryptjs");

/*
cron.schedule('5 * * * * *', () => {
console.log('running a task every minute at the 5th second');
})
*/

/* Cron job for deleting old data */
// cron.schedule('0 17 * * * *', () => {
//   utils.deleteOldData();
// });




// Initiate Mongo Server
InitiateMongoServer();
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});

// PORT
const PORT = process.env.PORT || 4000;
app.use('/preorderstripe', (req, res, next) => {
  console.log('[DEBUG] Entering /preorderstripe before bodyParser.raw');
  next();
});

app.use('/preorderstripe', bodyParser.raw({ type: 'application/json' }));

app.use('/preorderstripe', (req, res, next) => {
  console.log('[DEBUG] After bodyParser.raw: typeof body =', typeof req.body, 'isBuffer =', Buffer.isBuffer(req.body));
  next();
});
// Middleware
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: false }));

app.use(
  "/Uploads/profilePictures",
  express.static(process.cwd() + "/Uploads/profilePictures")
);

app.get("/", (req, res) => {
  res.json({ message: "API Working" });
});

/**
 * Router Middleware
 * Router - /user/*
 * Method - *
 */
app.use("/user", user);
app.use(doctor);
app.use(patient);


const sslOptions = {
  key: fs.readFileSync('/home/ec2-user/ssl/private.key'),
  cert: fs.readFileSync('/home/ec2-user/ssl/certificate.crt'),
  ca: fs.readFileSync('/home/ec2-user/ssl/ca_bundle.crt')
};

const server = https.createServer(sslOptions, app).listen(4000, () => {
  console.log('HTTPS server running at https://api.bytesense.ai');
});

var autogenerate = async () => {
  var new_date = new Date();
  var date = new Date(new_date);
  console.log("Running autogenerate"+new_date.getHours())
  if(new_date.getHours() < 23){
    date = date.setDate(date.getDate() - 1);
  }

  date = new Date(date).toLocaleDateString('en-ZA');

  await generateReportUtil.generateReport(date);
}


/* Cron job for generating report every 4 hour */

//cron.schedule('0 */4 * * *', () => {
/*
  var new_date = new Date();
  var date = new Date(new_date);
  console.log("Running autogenerate"+new_date.getHours())
  if(new_date.getHours() < 23){
    date = date.setDate(date.getDate() - 1);
  }

  date = new Date(date).toLocaleDateString('en-ZA');

  generateReportUtil.generateReport(date);

});

cron.schedule('59 22 * * *', autogenerate)
cron.schedule('0 14 * * *', autogenerate)
cron.schedule('0 18 * * *', autogenerate)
*/
//Socket setup
var io = socket(server);
//autogenerate()
mongoose.set("useFindAndModify", false);
io.on("connection", function (socket) {
  //console.log("connected successfully");
  socket.on("report", async (data) => {
    console.log(data)
    let durationListParsed = []

    for( let x = 0; x< data.episodeList.length; x++){
      durationListParsed.push({
        start: data.episodeList[x].start.toString(),
        end: data.episodeList[x].end.toString(),
      })
    }
    var syncDate = new Date(new Date(data.Date).setUTCHours(0, 0, 0, 0));
    console.log(syncDate)
    let user = await Report.exists({
      user: mongoose.Types.ObjectId(data.user),
      date: syncDate,
    });
    console.log(user)
    if (user) {
      console.log("updating existing report")
      Report.findOneAndUpdate(
        {
          user: mongoose.Types.ObjectId(data.user),
          date: syncDate,
        },
        {
          $inc: {
            "total_episodes": data.sessionEpisodes,
            "total_duration": data.sessionDuration,
            
          },
          $push: {
            "duration_list" : { $each: durationListParsed}
          }
          
        },
        { upsert: true },
        function (err) {
          if (err) {
            console.log(err);
          }
        }
      );
    } else {
      console.log("creating new report")
      /*
      Report.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          //deviceID: data.deviceID,
          $addToSet: {
              date: syncDate,
              total_episodes: data.sessionEpisodes,
              total_duration: data.sessionDuration,
              duration_list: data.episodeList
          },
        },
        {
          returnOriginal: false,
        },
        (err) => {
          if (err) {
            socket.emit(err);
            console.log(err)
          } else {
            socket.emit("data is updated");
          }
        }
      );
      */
      var newData = new Report(
        {
          user: data.user,
          date: syncDate,
          total_episodes: data.sessionEpisodes,
          total_duration: data.sessionDuration,
          duration_list: []
       }
      )

      await newData.save()

      Report.findOneAndUpdate({ "user": data.user, "date": syncDate, },
        {
          $push: {
            "duration_list" : { $each: durationListParsed}
          }
        },
        { upsert: true },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            //console.log(doc.data.hours[0].hourData)
            console.log("updated grind")
            socket.emit("data is updated");
          }
        });
    }
    //console.log("data received")
  });
  // socket.on("rawData", async (data) => {
  //   PatientData.findOneAndUpdate(
  //     { user: mongoose.Types.ObjectId(data.user) },
  //     {
  //       $addToSet: {
  //         grindRatio: {
  //           timeStamp: Date.now(),
  //           grindRatio1: data.sensor1Data,
  //           grindRatio2: data.sensor2Data,
  //           grindRatio3: data.sensor3Data,
  //           grindRatio4: data.sensor4Data,
  //         },
  //       },
  //     },
  //     {
  //       returnOriginal: false,
  //     },
  //     function (err) {
  //       if (err) {
  //         socket.emit(err);
  //       } else {
  //         socket.emit("data is updated");
  //       }
  //     }
  //   );
  // });
/***************************************************************************************/
socket.on("biometricData", async (data) => {
  if (!data.data || data.data.length === 0) return;

  const ts = new Date(data.data[0].ts);
  const gmtHour = ts.getUTCHours();

  // Day starts at 11 PM UTC
  const dayStart = new Date(ts);
  if (gmtHour < 23) {
    dayStart.setUTCDate(dayStart.getUTCDate() - 1);
  }
  dayStart.setUTCHours(23, 0, 0, 0);

  const today = new Date(dayStart); // canonical date
  const hour = new Date(data.data[0].ts).getUTCHours();

  // 1. Ensure BiometricData document exists
  let existing = await BiometricData.findOne({ user: data.user, date: today });

  if (!existing) {
    existing = new BiometricData({
      user: data.user,
      date: today,
      data: {
        hours: Array.from({ length: 24 }, (_, i) => ({ _id: i, hourData: [] }))
      }
    });
    await existing.save();

    // 1a. Push to biometricList if not already present
    await PatientData.updateOne(
      {
        user: mongoose.Types.ObjectId(data.user),
        "biometricList.Date": { $ne: today }
      },
      {
        $push: {
          biometricList: {
            Date: today,
            _id: existing._id
          }
        }
      }
    );
  }

  // 2. Append new datapoints to the correct hour
  await BiometricData.updateOne(
    { user: data.user, date: today, "data.hours._id": hour },
    {
      $push: {
        "data.hours.$.hourData": { $each: data.data }
      }
    }
  );

  // 3. Recalculate average HR and HRV for the day
  const dayBiometric = await BiometricData.findOne({ user: data.user, date: today });

  let allPoints = [];
  for (const hourEntry of dayBiometric.data.hours) {
    allPoints = allPoints.concat(hourEntry.hourData);
  }

  const validSamples = allPoints.filter(p => {
    const hr = parseFloat(p.HR);
    const hrv = parseFloat(p.HRV);
    return !isNaN(hr) && !isNaN(hrv) && hr > 0 && hrv > 0;
  });

  const validHR = validSamples.map(d => parseFloat(d.HR));
  const validHRV = validSamples.map(d => parseFloat(d.HRV));

  const avgHR = validHR.length ? (validHR.reduce((a, b) => a + b, 0) / validHR.length) : 0;
  const avgHRV = validHRV.length ? (validHRV.reduce((a, b) => a + b, 0) / validHRV.length) : 0;

  // -------------------------------------------------------
  // Sleep Activities and Score Calculations
  // -------------------------------------------------------
  const sortedAll = allPoints.slice().sort((a,b) => new Date(a.ts) - new Date(b.ts));
  const sorted = validSamples.slice().sort((a,b) => new Date(a.ts) - new Date(b.ts));
  let activities = [];
  let totalSleepSec = 0;
  let segStart = null;
  let segSleepSec = 0;
  for(let i=1;i<sortedAll.length;i++){
    const prev = sortedAll[i-1];
    const curr = sortedAll[i];
    if(segStart === null) segStart = prev;
    const gap = (new Date(curr.ts) - new Date(prev.ts))/1000;
    if(gap <= 10){
      segSleepSec += gap;
    }else{
      activities.push({ type: 'Sleep', start: new Date(segStart.ts), end: new Date(prev.ts), duration: segSleepSec/60 });
      totalSleepSec += segSleepSec;
      segStart = curr;
      segSleepSec = 0;
    }
  }
  if(sortedAll.length){
    if(segStart === null) segStart = sortedAll[0];
    activities.push({ type: 'Sleep', start: new Date(segStart.ts), end: new Date(sortedAll[sortedAll.length-1].ts), duration: segSleepSec/60 });
    totalSleepSec += segSleepSec;
  }
  const totalSleepMinutes = totalSleepSec/60;

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

  // Components
  const maxHRV = validHRV.length ? Math.max(...validHRV) : 0;
  const hrvMaxComp = clamp((maxHRV/90)*100,0,100);

  const hrSorted = validHR.slice().sort((a,b)=>b-a);
  const segCount = Math.max(1, Math.floor(hrSorted.length*0.1));
  const meanTop = hrSorted.slice(0,segCount).reduce((a,b)=>a+b,0)/segCount;
  const meanBot = hrSorted.slice(-segCount).reduce((a,b)=>a+b,0)/segCount;
  const hrDropComp = clamp(((meanTop - meanBot)/25)*100,0,100);

  // Restfulness component
  let spikes = 0;
  let window = [];
  for(const samp of sorted){
    const tsMs = new Date(samp.ts).getTime();
    while(window.length && tsMs - new Date(window[0].ts).getTime() > 120000){
      window.shift();
    }
    const winAvg = window.length ? window.reduce((a,b)=>a+parseFloat(b.HR || 0),0)/window.length : 0;
    if(window.length && parseFloat(samp.HR) >= winAvg + 10){
      spikes++;
    }
    window.push(samp);
  }
  const spikesPerHour = totalSleepMinutes ? (spikes / (totalSleepMinutes/60)) : 0;
  const restfulnessComp = clamp(100 - ((spikesPerHour*10/6)*100),0,100);

  // Stability component
  const meanHRV = avgHRV;
  const stdHRV = validHRV.length ? Math.sqrt(validHRV.reduce((s,x)=>s+Math.pow(x-meanHRV,2),0)/validHRV.length) : 0;
  const stabilityComp = meanHRV ? clamp(100 - (((stdHRV/meanHRV)/0.3)*100),0,100) : 0;

  let recoveryScore = clamp(0.35*hrvMaxComp + 0.25*hrDropComp + 0.25*restfulnessComp + 0.15*stabilityComp,0,100);

  let stressLoadScore = clamp(100 - (( (avgHR/80)*0.4 + (avgHRV? (70/avgHRV)*0.4 : 0) + (hrDropComp/100)*0.2 )*100),0,100);

  // Recovery Trend Score via linear regression
  let slope = 0;
  const trendPoints = sorted.map(p=>({x:(new Date(p.ts)-new Date(sorted[0].ts))/60000,y:parseFloat(p.HRV)})).filter(p=>!isNaN(p.y));
  if(trendPoints.length>1){
    const n = trendPoints.length;
    const sumX = trendPoints.reduce((a,b)=>a+b.x,0);
    const sumY = trendPoints.reduce((a,b)=>a+b.y,0);
    const sumXY = trendPoints.reduce((a,b)=>a+b.x*b.y,0);
    const sumXX = trendPoints.reduce((a,b)=>a+b.x*b.x,0);
    const denom = n*sumXX - sumX*sumX;
    if(denom!==0){
      slope = (n*sumXY - sumX*sumY)/denom;
    }
  }
  let recoveryTrendScore = clamp(50 + (slope*1000),0,100);

  const byteScore = (recoveryScore + stressLoadScore + recoveryTrendScore)/3;

  // -------------------------------------------------------
  // Compute previous week averages (excluding current day)
  // -------------------------------------------------------
  const patientDoc = await PatientData.findOne({ user: mongoose.Types.ObjectId(data.user) }).lean();
  let prevStart = new Date(today);
  const dow = prevStart.getUTCDay();
  prevStart.setUTCDate(prevStart.getUTCDate() - dow - 7);
  prevStart.setUTCHours(23,0,0,0);
  const prevEnd = new Date(prevStart);
  prevEnd.setUTCDate(prevEnd.getUTCDate() + 6);

  let prevWeekData = [];
  if(patientDoc && patientDoc.appData){
    prevWeekData = patientDoc.appData.filter(entry => {
      const d = new Date(entry.Date);
      return d >= prevStart && d <= prevEnd;
    });
  }

  const avgField = (arr, field) => {
    if(!arr.length) return null;
    const vals = arr.map(e => parseFloat((e[field]||0).toString?e[field].toString():e[field])).filter(v=>!isNaN(v));
    if(!vals.length) return null;
    return vals.reduce((a,b)=>a+b,0)/vals.length;
  };

  const prevWeekAvgRecoveryScore = avgField(prevWeekData,'recoveryScore');
  const prevWeekAvgStressLoadScore = avgField(prevWeekData,'stressLoadScore');
  const prevWeekAvgRecoveryTrendScore = avgField(prevWeekData,'recoveryTrendScore');
  const prevWeekAvgByteScore = avgField(prevWeekData,'byteScore');
  const prevWeekAvgHR = avgField(prevWeekData,'averageHR');
  const prevWeekAvgHRV = avgField(prevWeekData,'averageHRV');
  const prevWeekAvgTotalEpisode = avgField(prevWeekData,'totalEpisode');
  const prevWeekAvgTotalDuration = avgField(prevWeekData,'totalDuration');

  // 4. Store averages in BiometricData (for redundancy if needed)
  await BiometricData.updateOne(
    { user: data.user, date: today },
    {
      $set: {
        averageHR: avgHR,
        averageHRV: avgHRV
      }
    }
  );

  // 5. Upsert into appData
  const updated = await PatientData.findOneAndUpdate(
    { user: mongoose.Types.ObjectId(data.user), "appData.Date": today },
    {
      $set: {
        "appData.$.averageHR": avgHR,
        "appData.$.averageHRV": avgHRV,
        "appData.$.recoveryScore": recoveryScore,
        "appData.$.stressLoadScore": stressLoadScore,
        "appData.$.recoveryTrendScore": recoveryTrendScore,
        "appData.$.byteScore": byteScore,
        "appData.$.prevWeekAvgRecoveryScore": prevWeekAvgRecoveryScore,
        "appData.$.prevWeekAvgStressLoadScore": prevWeekAvgStressLoadScore,
        "appData.$.prevWeekAvgRecoveryTrendScore": prevWeekAvgRecoveryTrendScore,
        "appData.$.prevWeekAvgByteScore": prevWeekAvgByteScore,
        "appData.$.prevWeekAvgHR": prevWeekAvgHR,
        "appData.$.prevWeekAvgHRV": prevWeekAvgHRV,
        "appData.$.prevWeekAvgTotalEpisode": prevWeekAvgTotalEpisode,
        "appData.$.prevWeekAvgTotalDuration": prevWeekAvgTotalDuration,
        "appData.$.activities": activities
      }
    },
    { upsert: false, new: true }
  );

  if (!updated) {
    await PatientData.updateOne(
      { user: mongoose.Types.ObjectId(data.user) },
      {
        $push: {
          appData: {
            Date: today,
            totalEpisode: 0,
            totalDuration: 0,
            averageHR: avgHR,
            averageHRV: avgHRV,
            recoveryScore,
            stressLoadScore,
            recoveryTrendScore,
            byteScore,
            prevWeekAvgRecoveryScore,
            prevWeekAvgStressLoadScore,
            prevWeekAvgRecoveryTrendScore,
            prevWeekAvgByteScore,
            prevWeekAvgHR,
            prevWeekAvgHRV,
            prevWeekAvgTotalEpisode,
            prevWeekAvgTotalDuration,
            activities,
            substances: []
          }
        }
      }
    );
  }

  console.log(`Biometric data updated for user ${data.user} on ${today.toISOString()}`);
  socket.emit("biometric data updated");
});

socket.on("grindRatio", async (data) => {
    
    if(data.data.length == 0){
      return
    }

    console.log(data.data[0])
    var toDate = new Date(data.data[0].ts)
    var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
    toDate = new Date(data.data[0].ts)
    /*
    if(data.data.length == 0){
      return
    }
    */
    //today = today + 86400000
    //console.log(today)
    var exists = await grindRatio.exists({
      "user": data.user, "date": today
    })
    //console.log(exists)
    if (exists) {
      //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
      //if (hourExist) {
      //console.log("hour exist");
      //console.log('data hour: '+toDate.getHours())
      //console.log(toDate)
      //console.log('today '+today)
      grindRatio.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
        {
          $push: {
            "data.hours.$.hourData": { $each: data.data }
          }
        },
        { upsert: true },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            //console.log(doc.data.hours[0].hourData)
            console.log("updated grind: "+ data.data[0].ts)
            socket.emit("data is updated");
          }
        }
      )
    } else {
      var exists = await grindRatio.exists({
        "user": data.user, "date": today
      });

      var newData = new grindRatio(
        {
          user: data.user,
          date: today,
          data: {
            hours: [
              {
                _id: 0,
                hourData: []
              },
              {
                _id: 1,
                hourData: []
              },
              {
                _id: 2,
                hourData: []
              },
              {
                _id: 3,
                hourData: []
              },
              {
                _id: 4,
                hourData: []
              },
              {
                _id: 5,
                hourData: []
              },
              {
                _id: 6,
                hourData: []
              },
              {
                _id: 7,
                hourData: []
              },
              {
                _id: 8,
                hourData: []
              },
              {
                _id: 9,
                hourData: []
              },
              {
                _id: 10,
                hourData: []
              },
              {
                _id: 11,
                hourData: []
              },
              {
                _id: 12,
                hourData: []
              },
              {
                _id: 13,
                hourData: []
              },
              {
                _id: 14,
                hourData: []
              },
              {
                _id: 15,
                hourData: []
              },
              {
                _id: 16,
                hourData: []
              },
              {
                _id: 17,
                hourData: []
              },
              {
                _id: 18,
                hourData: []
              },
              {
                _id: 19,
                hourData: []
              },
              {
                _id: 20,
                hourData: []
              },
              {
                _id: 21,
                hourData: []
              },
              {
                _id: 22,
                hourData: []
              },
              {
                _id: 23,
                hourData: []
              },

            ]
          }
        }
      )
  
      await newData.save();
        
      console.log("new grind date")
      grindRatio.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
        {
          $push: {
            "data.hours.$.hourData": { $each: data.data }
          }
        },
        { upsert: true },
        function (err) {
          if (err) {
            console.log(err);
          } else {
            //console.log(doc.data.hours[0].hourData)
            console.log("updated grind")
            socket.emit("data is updated");
          }
        });
      //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
      //if (newId) {
        //console.log("Inserting in Patient Data")
        PatientData.findOneAndUpdate(
          { user: mongoose.Types.ObjectId(data.user) },
          {
            $push: {
              objList: {
                Date: today,
                _id: newData._id
              }
            }
          },
          (findErr, findRes) => {
            if (findErr) {
              console.log(findErr);
            }
          }
        );

      //}

    }
  });
/************************************************************************************/
socket.on("battery", async (data) => {
  var toDate = new Date(data.data[0].ts)
  var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
  toDate = new Date(data.data[0].ts)

  //today = today + 86400000
  //console.log(today)
  var exists = await battery.exists({
    "user": data.user, "date": today
  })
  //console.log(exists)
  if (exists) {
    //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
    //if (hourExist) {
    //console.log("hour exist");
    //console.log('data hour: '+toDate.getHours())
    //console.log(toDate)
    //console.log('today '+today)
    battery.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      }
    )
  } else {
    var newData = new battery(
      {
        user: data.user,
        date: today,
        data: {
          hours: [
            {
              _id: 0,
              hourData: []
            },
            {
              _id: 1,
              hourData: []
            },
            {
              _id: 2,
              hourData: []
            },
            {
              _id: 3,
              hourData: []
            },
            {
              _id: 4,
              hourData: []
            },
            {
              _id: 5,
              hourData: []
            },
            {
              _id: 6,
              hourData: []
            },
            {
              _id: 7,
              hourData: []
            },
            {
              _id: 8,
              hourData: []
            },
            {
              _id: 9,
              hourData: []
            },
            {
              _id: 10,
              hourData: []
            },
            {
              _id: 11,
              hourData: []
            },
            {
              _id: 12,
              hourData: []
            },
            {
              _id: 13,
              hourData: []
            },
            {
              _id: 14,
              hourData: []
            },
            {
              _id: 15,
              hourData: []
            },
            {
              _id: 16,
              hourData: []
            },
            {
              _id: 17,
              hourData: []
            },
            {
              _id: 18,
              hourData: []
            },
            {
              _id: 19,
              hourData: []
            },
            {
              _id: 20,
              hourData: []
            },
            {
              _id: 21,
              hourData: []
            },
            {
              _id: 22,
              hourData: []
            },
            {
              _id: 23,
              hourData: []
            },

          ]
        }
      }
    )
    await newData.save();
    battery.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      });
    //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
    //if (newId) {
    console.log("Battery in Patient Data")
      PatientData.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          $push: {
            batteryList: {
              Date: today,
              _id: newData._id
            }
          }
        },
        (findErr, findRes) => {
          if (findErr) {
            console.log(findErr);
          }
        }
      );

    //}

  }
});

socket.on("connection", async (data) => {
  var toDate = new Date(data.data[0].ts)
  var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
  toDate = new Date(data.data[0].ts)

  //today = today + 86400000
  //console.log(today)
  var exists = await connection.exists({
    "user": data.user, "date": today
  })
  //console.log(exists)
  if (exists) {
    //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
    //if (hourExist) {
    //console.log("hour exist");
    //console.log('data hour: '+toDate.getHours())
    //console.log(toDate)
    //console.log('today '+today)
    connection.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      }
    )
  } else {
    var newData = new connection(
      {
        user: data.user,
        date: today,
        data: {
          hours: [
            {
              _id: 0,
              hourData: []
            },
            {
              _id: 1,
              hourData: []
            },
            {
              _id: 2,
              hourData: []
            },
            {
              _id: 3,
              hourData: []
            },
            {
              _id: 4,
              hourData: []
            },
            {
              _id: 5,
              hourData: []
            },
            {
              _id: 6,
              hourData: []
            },
            {
              _id: 7,
              hourData: []
            },
            {
              _id: 8,
              hourData: []
            },
            {
              _id: 9,
              hourData: []
            },
            {
              _id: 10,
              hourData: []
            },
            {
              _id: 11,
              hourData: []
            },
            {
              _id: 12,
              hourData: []
            },
            {
              _id: 13,
              hourData: []
            },
            {
              _id: 14,
              hourData: []
            },
            {
              _id: 15,
              hourData: []
            },
            {
              _id: 16,
              hourData: []
            },
            {
              _id: 17,
              hourData: []
            },
            {
              _id: 18,
              hourData: []
            },
            {
              _id: 19,
              hourData: []
            },
            {
              _id: 20,
              hourData: []
            },
            {
              _id: 21,
              hourData: []
            },
            {
              _id: 22,
              hourData: []
            },
            {
              _id: 23,
              hourData: []
            },

          ]
        }
      }
    )
    await newData.save();
    connection.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      });
    //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
    //if (newId) {
    console.log("Connection in Patient Data")
      PatientData.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          $push: {
            connectionList: {
              Date: today,
              _id: newData._id
            }
          }
        },
        (findErr, findRes) => {
          if (findErr) {
            console.log(findErr);
          }
        }
      );

    //}

  }
});

socket.on("disconnection", async (data) => {
  var toDate = new Date(data.data[0].ts)
  var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
  toDate = new Date(data.data[0].ts)

  //today = today + 86400000
  //console.log(today)
  var exists = await disconnection.exists({
    "user": data.user, "date": today
  })
  //console.log(exists)
  if (exists) {
    //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
    //if (hourExist) {
    //console.log("hour exist");
    //console.log('data hour: '+toDate.getHours())
    //console.log(toDate)
    //console.log('today '+today)
    disconnection.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      }
    )
  } else {
    var newData = new disconnection(
      {
        user: data.user,
        date: today,
        data: {
          hours: [
            {
              _id: 0,
              hourData: []
            },
            {
              _id: 1,
              hourData: []
            },
            {
              _id: 2,
              hourData: []
            },
            {
              _id: 3,
              hourData: []
            },
            {
              _id: 4,
              hourData: []
            },
            {
              _id: 5,
              hourData: []
            },
            {
              _id: 6,
              hourData: []
            },
            {
              _id: 7,
              hourData: []
            },
            {
              _id: 8,
              hourData: []
            },
            {
              _id: 9,
              hourData: []
            },
            {
              _id: 10,
              hourData: []
            },
            {
              _id: 11,
              hourData: []
            },
            {
              _id: 12,
              hourData: []
            },
            {
              _id: 13,
              hourData: []
            },
            {
              _id: 14,
              hourData: []
            },
            {
              _id: 15,
              hourData: []
            },
            {
              _id: 16,
              hourData: []
            },
            {
              _id: 17,
              hourData: []
            },
            {
              _id: 18,
              hourData: []
            },
            {
              _id: 19,
              hourData: []
            },
            {
              _id: 20,
              hourData: []
            },
            {
              _id: 21,
              hourData: []
            },
            {
              _id: 22,
              hourData: []
            },
            {
              _id: 23,
              hourData: []
            },

          ]
        }
      }
    )
    await newData.save();
    disconnection.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      });
    //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
    //if (newId) {
    console.log("Connection in Patient Data")
      PatientData.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          $push: {
            disconnectionList: {
              Date: today,
              _id: newData._id
            }
          }
        },
        (findErr, findRes) => {
          if (findErr) {
            console.log(findErr);
          }
        }
      );

    //}

  }
});

socket.on("appopen", async (data) => {
  var toDate = new Date(data.data[0].ts)
  var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
  toDate = new Date(data.data[0].ts)

  //today = today + 86400000
  //console.log(today)
  var exists = await appopen.exists({
    "user": data.user, "date": today
  })
  //console.log(exists)
  if (exists) {
    //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
    //if (hourExist) {
    //console.log("hour exist");
    //console.log('data hour: '+toDate.getHours())
    //console.log(toDate)
    //console.log('today '+today)
    appopen.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      }
    )
  } else {
    var newData = new appopen(
      {
        user: data.user,
        date: today,
        data: {
          hours: [
            {
              _id: 0,
              hourData: []
            },
            {
              _id: 1,
              hourData: []
            },
            {
              _id: 2,
              hourData: []
            },
            {
              _id: 3,
              hourData: []
            },
            {
              _id: 4,
              hourData: []
            },
            {
              _id: 5,
              hourData: []
            },
            {
              _id: 6,
              hourData: []
            },
            {
              _id: 7,
              hourData: []
            },
            {
              _id: 8,
              hourData: []
            },
            {
              _id: 9,
              hourData: []
            },
            {
              _id: 10,
              hourData: []
            },
            {
              _id: 11,
              hourData: []
            },
            {
              _id: 12,
              hourData: []
            },
            {
              _id: 13,
              hourData: []
            },
            {
              _id: 14,
              hourData: []
            },
            {
              _id: 15,
              hourData: []
            },
            {
              _id: 16,
              hourData: []
            },
            {
              _id: 17,
              hourData: []
            },
            {
              _id: 18,
              hourData: []
            },
            {
              _id: 19,
              hourData: []
            },
            {
              _id: 20,
              hourData: []
            },
            {
              _id: 21,
              hourData: []
            },
            {
              _id: 22,
              hourData: []
            },
            {
              _id: 23,
              hourData: []
            },

          ]
        }
      }
    )
    await newData.save();
    appopen.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      });
    //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
    //if (newId) {
    console.log("Connection in Patient Data")
      PatientData.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          $push: {
            appopenList: {
              Date: today,
              _id: newData._id
            }
          }
        },
        (findErr, findRes) => {
          if (findErr) {
            console.log(findErr);
          }
        }
      );

    //}

  }
});
socket.on("appclose", async (data) => {
  var toDate = new Date(data.data[0].ts)
  var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
  toDate = new Date(data.data[0].ts)

  //today = today + 86400000
  //console.log(today)
  var exists = await appclose.exists({
    "user": data.user, "date": today
  })
  //console.log(exists)
  if (exists) {
    //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
    //if (hourExist) {
    //console.log("hour exist");
    //console.log('data hour: '+toDate.getHours())
    //console.log(toDate)
    //console.log('today '+today)
    appclose.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      }
    )
  } else {
    var newData = new appclose(
      {
        user: data.user,
        date: today,
        data: {
          hours: [
            {
              _id: 0,
              hourData: []
            },
            {
              _id: 1,
              hourData: []
            },
            {
              _id: 2,
              hourData: []
            },
            {
              _id: 3,
              hourData: []
            },
            {
              _id: 4,
              hourData: []
            },
            {
              _id: 5,
              hourData: []
            },
            {
              _id: 6,
              hourData: []
            },
            {
              _id: 7,
              hourData: []
            },
            {
              _id: 8,
              hourData: []
            },
            {
              _id: 9,
              hourData: []
            },
            {
              _id: 10,
              hourData: []
            },
            {
              _id: 11,
              hourData: []
            },
            {
              _id: 12,
              hourData: []
            },
            {
              _id: 13,
              hourData: []
            },
            {
              _id: 14,
              hourData: []
            },
            {
              _id: 15,
              hourData: []
            },
            {
              _id: 16,
              hourData: []
            },
            {
              _id: 17,
              hourData: []
            },
            {
              _id: 18,
              hourData: []
            },
            {
              _id: 19,
              hourData: []
            },
            {
              _id: 20,
              hourData: []
            },
            {
              _id: 21,
              hourData: []
            },
            {
              _id: 22,
              hourData: []
            },
            {
              _id: 23,
              hourData: []
            },

          ]
        }
      }
    )
    await newData.save();
    appclose.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      });
    //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
    //if (newId) {
    console.log("Connection in Patient Data")
      PatientData.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          $push: {
            appcloseList: {
              Date: today,
              _id: newData._id
            }
          }
        },
        (findErr, findRes) => {
          if (findErr) {
            console.log(findErr);
          }
        }
      );

    //}

  }
});

socket.on("newGrindRatio", async (data) => {
  var toDate = new Date(data.data[0].ts)
  var today = new Date(toDate.setUTCHours(0, 0, 0, 0));
  toDate = new Date(data.data[0].ts)

  //today = today + 86400000
  //console.log(today)
  var exists = await newGrindRatio.exists({
    "user": data.user, "date": today
  })
  //console.log(exists)
  if (exists) {
    //var hourExist = await grindRatio.exists({ "data.hours": { $elemMatch: { _id: toDate.getHours() } } })
    //if (hourExist) {
    //console.log("hour exist");
    //console.log('data hour: '+toDate.getHours())
    //console.log(toDate)
    //console.log('today '+today)
    newGrindRatio.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      }
    )
  } else {
    var newData = new newGrindRatio(
      {
        user: data.user,
        date: today,
        data: {
          hours: [
            {
              _id: 0,
              hourData: []
            },
            {
              _id: 1,
              hourData: []
            },
            {
              _id: 2,
              hourData: []
            },
            {
              _id: 3,
              hourData: []
            },
            {
              _id: 4,
              hourData: []
            },
            {
              _id: 5,
              hourData: []
            },
            {
              _id: 6,
              hourData: []
            },
            {
              _id: 7,
              hourData: []
            },
            {
              _id: 8,
              hourData: []
            },
            {
              _id: 9,
              hourData: []
            },
            {
              _id: 10,
              hourData: []
            },
            {
              _id: 11,
              hourData: []
            },
            {
              _id: 12,
              hourData: []
            },
            {
              _id: 13,
              hourData: []
            },
            {
              _id: 14,
              hourData: []
            },
            {
              _id: 15,
              hourData: []
            },
            {
              _id: 16,
              hourData: []
            },
            {
              _id: 17,
              hourData: []
            },
            {
              _id: 18,
              hourData: []
            },
            {
              _id: 19,
              hourData: []
            },
            {
              _id: 20,
              hourData: []
            },
            {
              _id: 21,
              hourData: []
            },
            {
              _id: 22,
              hourData: []
            },
            {
              _id: 23,
              hourData: []
            },

          ]
        }
      }
    )
    await newData.save();
    newGrindRatio.findOneAndUpdate({ "user": data.user, "date": today, "data.hours": { $elemMatch: { "_id": toDate.getHours() } } },
      {
        $push: {
          "data.hours.$.hourData": { $each: data.data }
        }
      },
      { upsert: true },
      function (err) {
        if (err) {
          console.log(err);
        } else {
          //console.log(doc.data.hours[0].hourData)
          socket.emit("data is updated");
        }
      });
    //var newId = await grindRatio.findOne({ "user": data.user, "date": today })
    //if (newId) {
      console.log("Inserting in Patient Data")
      PatientData.findOneAndUpdate(
        { user: mongoose.Types.ObjectId(data.user) },
        {
          $push: {
            objList: {
              Date: today,
              _id: newData._id,
              upgraded:true
            }
          }
        },
        (findErr, findRes) => {
          if (findErr) {
            console.log(findErr);
          }
        }
      );

    //}

  }
});

/************************************************************************************/


  socket.on("accelerometer", async (data) => {
    PatientData.findOneAndUpdate(
      { user: mongoose.Types.ObjectId(data.user) },
      {
        $push: {
          accelerometer: {
            timeStamp: Date.now(),
            x: data.x,
            y: data.y,
            z: data.z,
          },
        },
      },
      function (err) {
        if (err) {
          socket.emit(err);
        } else {
          socket.emit("data is updated");
        }
      }
    );
  });

  socket.on("energy", async (data) => {
    PatientData.findOneAndUpdate(
      { user: mongoose.Types.ObjectId(data.user) },
      {
        $push: {
          energy: {
            time: Date.now(),
            energy: data.energy,
          },
        },
      },
      function (err) {
        if (err) {
          socket.emit(err);
        } else {
          socket.emit("data is updated");
        }
      }
    );
  });

  socket.on("disconnectDevice", async (data) => {
    var jsonData = JSON.parse(data);
    let user = await randomDisconnect.exists({
      user: jsonData.user
    });
    if (user) {
      randomDisconnect.findOneAndUpdate(
        { user: jsonData.user },
        {
          $push: {
            data: {
              timeStamp: Date.now()
            }
          }
        },
        function (err) {
          if (err) {
            socket.emit(err);
          } else {
            socket.emit("data is updated");
          }
        }
      );
    } else {
      let newUser = new randomDisconnect(
        {
          user: jsonData.user,
          data: {
            timeStamp: Date.now()
          }
        }
      )
      await newUser.save();
    }
  });

});
