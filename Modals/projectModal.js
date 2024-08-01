const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  projectName: {
    type: String,
    required: true,
    min: 1,
    max: 255,
  },
  projectManager: {
    type: [String],
    required: true,
  },
  projectMembers: {
    type: [String],
  },
  projectTeams: {
    type: [String],
  },
  projectStatus: {
    type: String,
  },
  projectStartDate: {
    type: String,
  },
  projectEndDate: {
    type: String,
  },
});

module.exports = mongoose.model("Project", projectSchema);
