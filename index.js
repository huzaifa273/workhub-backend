const express = require("express");
const app = express();
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const userRoute = require("./Router/UserRouter");
const userDataRoute = require("./Router/UserDataRouter");
const activityRoute = require("./Router/ActivityRouter");
// const postRoute = require("./Router/post");
const cors = require("cors");
dotenv.config();
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Database connected");
  })
  .catch(() => {
    console.log("Connection to Database Failed");
  });

app.use(cors());
app.use(express.json());
app.use("/api/user", userRoute);
app.use("/api/put", userDataRoute);
app.use("/api/put", activityRoute);
// app.use("/api/post", postRoute);

app.listen(5000, () => {
  console.log("Server is running on http://localhost:" + 5000);
});
