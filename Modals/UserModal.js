const mongoose = require("mongoose");

const UserScheme = new mongoose.Schema({
  firstName: {
    type: String,
    min: 1,
    max: 255,
  },
  lastName: {
    type: String,
    max: 255,
    min: 1,
  },
  email: {
    type: String,
    min: 3,
    max: 255,
    unique: true, // Ensure email uniqueness
  },
  password: {
    type: String,
    max: 1024,
    min: 8,
  },
  role: {
    type: String,
  },
  team: {
    type: [String],
  },
  projects: {
    type: [String],
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpires: {
    type: Date,
  },
  registrationToken: {
    type: String,
  },
  registrationTokenExpiry: {
    type: Date,
  },
});

module.exports = mongoose.model("User", UserScheme);
