const router = require("express").Router();
const projectModal = require("../Modals/projectModal");
const teamModal = require("../Modals/teamModal");
const dotenv = require("dotenv");
const { verifyToken } = require("./verifyToken");
dotenv.config();

router.post("/create", verifyToken, async (req, res) => {
  console.log("Request to create a new project");
  try {
    const {
      projectName,
      projectManager,
      projectMembers,
      projectTeams,
      projectStatus,
      projectStartDate,
      projectEndDate,
    } = req.body;
    const newProject = new projectModal({
      projectName,
      projectManager,
      projectMembers,
      projectTeams,
      projectStatus,
      projectStartDate,
      projectEndDate,
    });
    data = await newProject.save();
    res.status(200).json({
      message: "Project Created Successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err,
    });
  }
});

////////////////////////// Get all projects //////////////////////////
/////////////////////////////////////////////////////////////////////

router.get("/get-all", verifyToken, async (req, res) => {
  try {
    data = await projectModal.find();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      message: err,
    });
  }
});

///////////////////// Delete project by ID from a team ////////////////////
///////////////////////////////////////////////////////////////////////////
router.delete("/delete/:teamId/:projectId", verifyToken, async (req, res) => {
  try {
    const { teamId, projectId } = req.params;
    console.log(`Team ID: ${teamId}, Project ID: ${projectId}`);

    // Check if teamId and projectId are valid ObjectId
    if (
      !teamId.match(/^[0-9a-fA-F]{24}$/) ||
      !projectId.match(/^[0-9a-fA-F]{24}$/)
    ) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    // Find the team by ID
    const team = await teamModal.findById(teamId);

    // If the team is not found, return an error
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    console.log("Found team:", team);

    // Find the index of the project in the team's teamProjects array
    const projectIndex = team.teamProjects.findIndex(
      (project) => project.toString() === projectId
    );
    console.log("Project Index:", projectIndex);

    // If the project is not found, return an error
    if (projectIndex === -1) {
      return res.status(404).json({ message: "Project not found in team" });
    }

    // Remove the project from the team's teamProjects array
    team.teamProjects.splice(projectIndex, 1);

    // Save the updated team document
    await team.save();
    console.log("Updated team saved successfully");

    res.status(200).json({
      message: "Project removed successfully",
    });
  } catch (error) {
    console.error("Error removing project:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
});

module.exports = router;
