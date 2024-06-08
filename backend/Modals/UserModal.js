const mongoose = require("mongoose");

const UserScheme = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    min: 1,
    max: 255,
  },
  lastName: {
    type: String,
    required: true,
    max: 255,
    min: 1,
  },
  email: {
    type: String,
    required: true,
    min: 3,
    max: 255,
  },
  password: {
    type: String,
    required: true,
    max: 1024,
    min: 8,
  },
  // profilePicture: {
  //   type: String,
  // },

  // Other related fields set by the invitation link
  role: {
    type: String,
    required: true,
  },
  team: {
    type: String,
    required: true,
  },
  project: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("User", UserScheme);
