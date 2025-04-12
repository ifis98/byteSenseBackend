const mongoose = require("mongoose");

const MONGOURI = "mongodb+srv://admin:i8TVtL8UFVeFMup9@cluster0.6p39y.mongodb.net/bruxCorpDB?retryWrites=true&w=majority";

const InitiateMongoServer = async () => {
  try {
    await mongoose.connect(MONGOURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("Connected to DB");
  } catch (e) {
    console.error("DB Connection Error:", e);
    throw e;
  }
};

module.exports = InitiateMongoServer;
