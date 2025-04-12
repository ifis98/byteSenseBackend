var request = require('request');
const Report = require("./model/report");
const User = require("./model/user");
const axios = require('axios');

module.exports = {

    generateReport: async function (date) {

        //Get all the user from User collection
        // var new_date = new Date();
        // var date = new Date(new_date);
        // date = date.setDate(date.getDate() - 1);
        // date = new Date(date).toLocaleDateString('en-ZA');
        console.log("autogenerate "+date);
        const users = await User.find();
        //console.log(users.length);
        const URI = 'http://18.219.37.253:4000/episodes'
        //const URI = 'http://127.0.0.1:4000/episodes';
        //const URI = 'http://3.133.153.177:4000/episodes'
        console.log("number of users: "+users.length)
        for (let i = 0; i < users.length; i++) {
            //console.log('from generate report function check1')
            console.log('loop start index: '+ i)
            try {
                var user = users[i];
                var token = user.tokens[0].token;
                var header = {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                }

                await axios.post(URI, {
                    userID: user._id,
                    date: date
                }, header)

                //console.log('from generate report function check2')
            } catch (e) { }
            console.log("count: "+i);


        }
        console.log("autogenerate complete" + new Date())

    }
};

