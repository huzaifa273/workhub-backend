const mongoose = require("mongoose");
const router = require("express").Router();
const teamModal = require("../Modals/teamModal");
const userModel = require("../Modals/UserModal");
const projectModal = require("../Modals/projectModal");
const dotenv = require("dotenv");
const { verifyToken } = require("./verifyToken");
dotenv.config();

router.post("/create", verifyToken, async (req, res) => {
  try {
    const { teamName, teamUsers, teamProjects, teamStatus, teamStartDate } =
      req.body;

    const newTeam = new teamModal({
      teamName,
      teamUsers,
      teamProjects,
      teamStatus,
      teamStartDate,
    });

    const data = await newTeam.save();

    // Update each user with the new team ID and role
    for (const user of teamUsers) {
      await userModel.findByIdAndUpdate(user.userId, {
        $push: {
          teams: {
            teamId: data._id,
            teamRole: user.teamRole,
            isTeamLead: user.isTeamLead,
          },
        },
      });
    }

    res.status(200).json({
      message: "Team Created Successfully",
      data, // Optional: Return the saved team data
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

////////////////////////// Get all teams //////////////////////////
///////////////////////////////////////////////////////////////////
router.get("/get-all", async (req, res) => {
  try {
    const data = await teamModal.find();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      message: err,
    });
  }
});

/////////////////////// Delete team by ID ////////////////////////
//////////////////////////////////////////////////////////////////
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Find the team by ID
    const team = await teamModal.findById(id);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Remove team ID from users' teams array
    await userModel.updateMany(
      { "teams.teamId": id },
      { $pull: { teams: { teamId: id } } }
    );

    // Delete the team
    await teamModal.findByIdAndDelete(id);

    res.status(200).json({
      message: "Team Deleted Successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/////////////////////// Get team details by ID ////////////////////////
///////////////////////////////////////////////////////////////////////
router.get("/team-id/:id", async (req, res) => {
  try {
    // Fetch the team by ID
    const team = await teamModal.findById(req.params.id);

    // If the team is not found, return an error
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Fetch user data for each user in the team
    const teamData = await Promise.all(
      team.teamUsers.map(async (user) => {
        const userData = await userModel.findById(user.userId);

        // If the user is not found, return an error
        if (!userData) {
          throw new Error(`User with ID ${user.userId} not found`);
        }

        // Combine the user data with the relevant team data
        return {
          _id: userData._id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          teamRole: user.teamRole,
          isTeamLead: user.isTeamLead,
        };
      })
    );

    const teamProjects = await Promise.all(
      team.teamProjects.map(async (projectId) => {
        const projectData = await projectModal.findById(projectId);
        if (!projectData) {
          throw new Error(`Project with ID ${projectId} not found`);
        }
        return {
          _id: projectData._id,
          projectName: projectData.projectName,
          projectManager: projectData.projectManager,
          projectMembers: projectData.projectMembers,
          projectTeams: projectData.projectTeams,
          projectStatus: projectData.projectStatus,
          projectStartDate: projectData.projectStartDate,
          projectEndDate: projectData.projectEndDate,
        };
      })
    );

    // Return the combined data as the response
    res.status(200).json({
      teamName: team.teamName,
      teamId: team._id,
      teamData: teamData,
      teamProjects: teamProjects,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: err.message,
    });
  }
});

/////////////////////// Delete Member by ID //////////////////////
//////////////////////////////////////////////////////////////////
router.delete("/delete-member/:teamId/:userId", async (req, res) => {
  const { teamId, userId } = req.params;

  try {
    // Find the team by ID
    const team = await teamModal.findById(teamId);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Find the index of the user in the team's teamUsers array
    const userIndex = team.teamUsers.findIndex(
      (user) => user.userId === userId
    );

    // If the user is not found, return an error
    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found in team" });
    }

    // Remove the user from the teamUsers array
    team.teamUsers.splice(userIndex, 1);
    await team.save();

    // Remove the team ID from the user's teams array
    await userModel.findByIdAndUpdate(userId, {
      $pull: { teams: { teamId } },
    });

    res.status(200).json({
      message: "User removed from team successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

/////////////////////////// Update team Data ///////////////////////
////////////////////////////////////////////////////////////////////
router.put("/update-members/:teamId", async (req, res) => {
  try {
    const { teamUsers } = req.body;
    const teamId = req.params.teamId;

    const team = await teamModal.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Update each user's team information in the user model
    for (const user of teamUsers) {
      await userModel.updateOne(
        { _id: user.userId, "teams.teamId": teamId },
        {
          $set: {
            "teams.$.teamRole": user.teamRole,
            "teams.$.isTeamLead": user.isTeamLead,
          },
        },
        { upsert: true }
      );
    }

    // Ensure that users not in the updated list are removed from the team
    const updatedUserIds = teamUsers.map((user) => user.userId);
    await userModel.updateMany(
      { _id: { $nin: updatedUserIds }, "teams.teamId": teamId },
      { $pull: { teams: { teamId: teamId } } }
    );

    // Update the team document
    team.teamUsers = teamUsers;
    await team.save();

    res.status(200).json({ message: "Team members updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/////////////////////////// Add Team Members ///////////////////////
////////////////////////////////////////////////////////////////////
router.put("/add-members/:teamId", async (req, res) => {
  try {
    const { teamUsers } = req.body;
    const { teamId } = req.params;

    if (!Array.isArray(teamUsers)) {
      return res.status(400).json({ message: "teamUsers must be an array" });
    }

    const team = await teamModal.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    // Convert userIds to ObjectId
    const formattedTeamUsers = teamUsers.map((user) => ({
      userId: new mongoose.Types.ObjectId(user.userId),
      isTeamLead: user.isTeamLead,
      teamRole: user.teamRole,
    }));

    // Add team users to the team
    team.teamUsers = team.teamUsers.concat(formattedTeamUsers);
    await team.save();

    // Add team ID and role to users' documents
    for (const user of teamUsers) {
      await userModel.findByIdAndUpdate(user.userId, {
        $push: {
          teams: {
            teamId: team._id,
            teamRole: user.teamRole,
            isTeamLead: user.isTeamLead,
          },
        },
      });
    }

    res.status(200).json({ message: "Team members added successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/////////////////////////// Add Project to the team ///////////////////
///////////////////////////////////////////////////////////////////////
router.put("/add-project/:teamId", verifyToken, async (req, res) => {
  try {
    const { projects } = req.body;

    if (!Array.isArray(projects)) {
      return res.status(400).json({ message: "projects must be an array" });
    }

    const team = await teamModal.findById(req.params.teamId);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    team.teamProjects = team.teamProjects.concat(projects);
    await team.save();

    res.status(200).json({ message: "Projects added to team successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/////////////////////////// Fetch invites from team ///////////////////
///////////////////////////////////////////////////////////////////////
router.get("/invites/:teamId", verifyToken, async (req, res) => {
  try {
    const team = await teamModal.findById(req.params.teamId);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const pendingInvites = await userModel.find({
      "teams.teamId": req.params.teamId,
      invitationStatus: "pending",
    });

    const invitesWithStatus = pendingInvites.map((invite) => {
      if (invite.registrationTokenExpiry <= Date.now()) {
        return {
          ...invite.toObject(),
          invitationStatus: "expired",
        };
      }
      return invite;
    });

    res.status(200).json(invitesWithStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/////////////////////////// Get Onboarding for Team ///////////////////
///////////////////////////////////////////////////////////////////////
router.get("/onboarding/:teamId", verifyToken, async (req, res) => {
  try {
    const team = await teamModal.findById(req.params.teamId);

    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }

    const teamUsers = await userModel.find({
      "teams.teamId": req.params.teamId,
    });

    res.status(200).json(teamUsers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
