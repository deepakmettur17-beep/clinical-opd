const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const patientRoutes = require("./routes/patientRoutes");
const visitRoutes = require("./routes/visitRoutes");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

app.use("/patients", patientRoutes);
app.use("/visits", visitRoutes);

app.listen(4000, () => {
  console.log("Backend running on port 4000");
});



