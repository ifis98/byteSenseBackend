const grindRatio = require('./model/grindRatio');
const patientData = require('./model/patientData');

module.exports = {

    deleteOldData: async function () {
        var date = new Date();
        console.log(date + " Cron job for deleting 30 days older data");
        var daysToDeletion = 30;
        var deletionDate = new Date(date.setDate(date.getDate() - daysToDeletion)).setUTCHours(0, 0, 0, 0);

        await grindRatio.deleteMany({date: {$lt:deletionDate}});
        //need to delete grind ratio document id from objList
        await patientData.updateMany(
            {},
            {$pull:{'objList':{Date: {$lt: deletionDate}}}},
            {$pull:{'batteryList':{Date: {$lt: deletionDate}}}}
        );

    }


};