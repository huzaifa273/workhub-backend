const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  teamName: {
    type: String,
    required: true,
    min: 1,
    max: 255,
  },
  teamUsers: [
    {
      userId: String,
      isTeamLead: Boolean,
      teamRole: String, // Add other role-related information if needed
    },
  ],
  teamProjects: {
    type: [String],
  },
  teamStatus: {
    type: String,
  },
  teamStartDate: {
    type: String,
  },
});

module.exports = mongoose.model("Team", teamSchema);
