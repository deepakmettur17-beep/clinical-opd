const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!connStr) {
      throw new Error("Neither MONGODB_URI nor MONGO_URI is defined");
    }
    await mongoose.connect(connStr);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

