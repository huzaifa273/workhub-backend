const mongoose = require("mongoose");

const UserDataScheme = new mongoose.Schema(
  {
    user: {
      type: String,
    },
    screenshot: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("UserData", UserDataScheme);
