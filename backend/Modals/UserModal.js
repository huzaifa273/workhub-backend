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
  },
  password: {
    type: String,
    max: 1024,
    min: 8,
  },
  // profilePicture: {
  //   type: String,
  // },

  // Other related fields set by the invitation link
  role: {
    type: String,
  },
  team: {
    type: String,
  },
  project: {
    type: String,
  },
});

module.exports = mongoose.model("User", UserScheme);
