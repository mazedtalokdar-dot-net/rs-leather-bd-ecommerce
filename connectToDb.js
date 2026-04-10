const mongoose = require("mongoose");
const connectToDB = async () => {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/");
    console.log("Data Connected to MongoDB");
  } catch (error) {
    console.error(error);
  }
};
module.exports = connectToDB;
