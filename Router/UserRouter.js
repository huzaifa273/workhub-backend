const router = require("express").Router();
const User = require("../Modals/UserModal");
const bcrypt = require("bcrypt");
const bcryptjs = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const sendMail = require("./mailer");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { verifyToken } = require("./verifyToken");
const teamModal = require("../Modals/teamModal");
const projectModal = require("../Modals/projectModal");
dotenv.config();

const generateToken = () => {
  return crypto.randomBytes(20).toString("hex");
};
///////////////////////// register the owner //////////////////////////
///////////////////////////////////////////////////////////////////////

router.post("/register/owner", async (req, res) => {
  // try and catch block will be used to catch the error

  let user = await User.findOne({ role: "owner" });
  if (user) {
    return res.status(200).json("Owner has already been registered");
  }
  const secPassword = await bcrypt.hash(req.body.password, saltRounds);
  const newUser = new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: secPassword,
    role: "owner",
    team: "owner",
    project: "owner",
  });
  user = await newUser.save();
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.status(200).json({
    message: "Owner Registered Successfully",
    token: accessToken,
    user: {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
});

///////////////////////// Send the Invitaion //////////////////////////
///////////////////////////////////////////////////////////////////////
router.post("/invite", verifyToken, async (req, res) => {
  try {
    const { emails, role, projects, teams } = req.body;
    const registrationTokenExpiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

    // Store email-specific tokens and user creation/update promises
    const usersData = emails.map((email) => ({
      email,
      token: generateToken(),
    }));

    const userPromises = usersData.map(async ({ email, token }) => {
      let user = await User.findOne({ email });
      if (user) {
        // Update existing user with new token and expiry
        user.registrationToken = token;
        user.registrationTokenExpiry = registrationTokenExpiry;
      } else {
        // Create new user with empty fields except email
        user = new User({
          firstName: null,
          lastName: null,
          email,
          password: null,
          role,
          projects,
          registrationToken: token,
          registrationTokenExpiry,
          invitationStatus: "pending",
          teams,
        });
      }
      return user.save();
    });

    // Wait for all user operations to complete
    await Promise.all(userPromises);

    // Send all emails in one batch
    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    const invitationLinks = usersData.map(({ email, token }) => {
      return {
        email,
        link: `http://localhost:3000/signup/${token}`,
      };
    });

    const emailList = emails.join(",");

    await transporter.sendMail({
      from: `"WorkHub" <${process.env.USER}>`, // sender address
      to: emailList, // list of receivers
      subject: "WorkHub Invitation", // Subject line
      html: invitationLinks
        .map(({ email, link }) => {
          return `<p><b>${email}</b>: You are invited to join WorkHub as a ${role}. Here is the invitation link to join: <a href="${link}">Register</a> This link will expire in 8 hours</p>`;
        })
        .join(""), // html body
    });

    console.log("Invitations sent to: %s", emailList);

    res.status(200).json({
      message: "Invitations Sent Successfully",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

///////////////////// Send the invitation via team ////////////////////
///////////////////////////////////////////////////////////////////////
router.post("/invite-user-via-team", verifyToken, async (req, res) => {
  try {
    const { email, role, projects, teamId } = req.body; // Include teamId
    // console.log(
    // Generate reset token and expiration time
    const registrationToken = generateToken();
    const registrationTokenExpiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    const invitationLink = `http://localhost:3000/signup/${registrationToken}`;

    // send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"WorkHub" <${process.env.USER}>`, // sender address
      to: email, // list of receivers
      subject: "WorkHub Invitation", // Subject line
      text: `You are invited to join WorkHub as a ${role}. Here is the invitation link to join: ${invitationLink}`, // plain text body
      html: `<b>You are invited to join WorkHub as a ${role}. Here is the invitation link to join:</b> <a href="${invitationLink}">Register</a> This link will expire in 8 hours`, // html body
    });

    console.log("Message sent: %s", info.messageId);

    // Check if the user already exists
    let user = await User.findOne({ email });
    if (user) {
      // Update existing user with new token and expiry
      user.registrationToken = registrationToken;
      user.registrationTokenExpiry = registrationTokenExpiry;
    } else {
      // Create new user with empty fields except email
      user = new User({
        firstName: null,
        lastName: null,
        email,
        password: null,
        role,
        projects,
        registrationToken,
        registrationTokenExpiry,
        invitationStatus: "pending",
        teams: {
          teamId: teamId,
          teamRole: "user",
          isTeamLead: false,
        }, // Include teamId in the user document
      });
    }

    // Save the user
    await user.save();

    res.status(200).json({
      message: "Invitation Sent Successfully",
      user: {
        email: user.email,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

/////////////////////////// Resend the invitation /////////////////////
///////////////////////////////////////////////////////////////////////
router.post("/resend-invitation/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Find the user by ID
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (
      user.invitationStatus === "accepted" ||
      !user.registrationToken // check for falsy values directly
    ) {
      return res.status(400).json({ message: "User is already registered" });
    }

    // Generate a new registration token and expiration time
    const registrationToken = generateToken();
    const registrationTokenExpiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

    // Update user's registration token and expiry
    user.registrationToken = registrationToken;
    user.registrationTokenExpiry = registrationTokenExpiry;

    // Save the updated user
    await user.save();

    // Transporter configuration
    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    const invitationLink = `http://localhost:3000/signup/${registrationToken}`;

    // Ensure this is awaited correctly
    const info = await transporter.sendMail({
      from: `"WorkHub" <${process.env.USER}>`, // sender address
      to: user.email, // list of receivers
      subject: "WorkHub Invitation - Resend", // Subject line
      text: `You are invited to join WorkHub as a ${user.role}. Here is the invitation link to join: ${invitationLink}`, // plain text body
      html: `<b>You are invited to join WorkHub as a ${user.role}. Here is the invitation link to join:</b> <a href="${invitationLink}">Register</a> This link will expire in 8 hours`, // html body
    });

    console.log("Message sent: %s", info.messageId);

    // Send a success response
    res.status(200).json({ message: "Invitation Resent Successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

//////////////////////////// Register the user ////////////////////////
///////////////////////////////////////////////////////////////////////
router.post("/register/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { email, firstName, lastName, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(403).json({ message: "Email is not registered" });
    }
    if (!user.registrationToken || user.registrationToken === "") {
      return res.status(400).json({ message: "You are already registered" });
    }
    // Check if the token is valid
    if (
      user.registrationToken !== token ||
      user.registrationTokenExpiry <= Date.now()
    ) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    // Hash the password
    const secPassword = await bcrypt.hash(password, saltRounds);

    // Update the user details
    user.firstName = firstName;
    user.lastName = lastName;
    user.password = secPassword;
    user.employeeStatus = "active";
    user.invitationStatus = "accepted";
    user.registrationToken = undefined; // Clear the token
    user.registrationTokenExpiry = undefined; // Clear the token expiry
    user.timeTrackingStatus = true;
    user.lastTrackTime = new Date(new Date().setHours(0, 0, 0, 0));
    user.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    user.idleTimeOut = "15";
    user.keepIdleTime = "prompt";
    user.allowedApps = "all";

    // Save the updated user
    await user.save();

    // Add user to the teams if present
    if (user.teams && user.teams.length > 0) {
      for (const team of user.teams) {
        await teamModal.findByIdAndUpdate(team.teamId, {
          $push: {
            teamUsers: {
              userId: user._id,
              teamRole: "user",
              isTeamLead: false,
            },
          },
        });
      }
    }

    // Send the response
    res.status(200).json({ message: "Registered Successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

///////////////////////// login //////////////////////////
//////////////////////////////////////////////////////////
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per `window` (here, per 15 minutes)
  message: {
    message: "Too many login attempts, please try again later after sometime.",
  },
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email is not registered" });
    }
    if (
      user.password === null ||
      user.password === undefined ||
      user.password === ""
    ) {
      return res.status(400).json({
        message: "Please register first, Check your email for registration",
      });
    }
    // Compare the password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Password is incorrect" });
    }

    // Generate the JWT token
    const accessToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Token expiration time
    );

    // Exclude the password from the response
    const { password: userPassword, ...userWithoutPassword } = user._doc;

    // Send the response
    res.status(200).json({
      message: "Login successful",
      user: userWithoutPassword,
      accessToken,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
});

///////////////////////// Forgot Passwword //////////////////////////
///////////////////////////////////////////////////////////////////////
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(403).json({ message: "Email is not Registered" });
    }
    if (
      user.password === null ||
      user.password === undefined ||
      user.password === ""
    ) {
      return res.status(400).json({
        message: "Please register first, Check your email for registration",
      });
    }
    // Generate random token
    // Generate reset token and expiration time
    const resetToken = generateToken();
    const resetTokenExpiry = Date.now() + 3600000 * 8; // 1 hour

    // Update user with reset token and expiry
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;
    await user.save();
    /* 
    host: process.env.HOST,
    port: 465,
    secure: true, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: process.env.USER,
      pass: process.env.PASSWORD,
    },
  */
    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
    });

    // Send email with reset link
    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;
    // async..await is not allowed in global scope, must use a wrapper
    async function main() {
      // send mail with defined transport object
      const info = await transporter.sendMail({
        // from: `"WorkHub" <${process.env.USER}>`, // sender address
        from: `"WorkHub" <${process.env.USER}>`, // sender address
        to: req.body.email, // list of receivers
        subject: "WorkHub Password Reset Request", // Subject line
        text: `Click the link to reset your password: ${resetLink}`, // plain text body
        html: `<p>You requested a password reset. Click the link to reset your password: <a href="${resetLink}">Reset Password</a> Link will expire in 8 hour </p>`, // html body
      });

      console.log("Message sent: %s", info.messageId);
      // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
      res.status(200).json({
        message: "Check your email",
        user: {
          email: user.email,
        },
      });
    }
    main().catch((error) => {
      res.status(500).json({ message: "Email not send", error });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

////////////////////////// reset the password /////////////////////////
///////////////////////////////////////////////////////////////////////
router.post("/reset-password/:token", async (req, res) => {
  // try {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() }, // Check if token is still valid
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Update user's password and clear the reset token fields
  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.status(200).json({ message: "Password has been reset successfully" });
  // } catch (error) {
  //   res.status(500).json({ message: 'Server error', error });
  // }
});

////////////////////////// Get All Users Details ////////////////////
/////////////////////////////////////////////////////////////////////
router.get("/all", verifyToken, async (req, res) => {
  try {
    const users = await User.find({ invitationStatus: "accepted" });
    const sanitizedUsers = users.map((user) => {
      const { password, ...others } = user._doc;
      return others;
    });

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

////////////////////////// Get Invited User Details /////////////////
/////////////////////////////////////////////////////////////////////
router.get("/invites/all", verifyToken, async (req, res) => {
  try {
    const pendingInvites = await User.find({
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
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

////////////////////////// Get user onboarding status ///////////////////////
/////////////////////////////////////////////////////////////////////////////
router.get("/onboarding", verifyToken, async (req, res) => {
  try {
    const users = await User.find().sort({ _id: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/////////////////////////// get all users //////////////////////////
////////////////////////////////////////////////////////////////////
router.get("/all-users", async (req, res) => {
  try {
    const users = await User.find({ invitationStatus: "accepted" }).sort({
      firstName: 1,
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

/////////////////////////// Delete the user //////////////////////////
//////////////////////////////////////////////////////////////////////
router.delete("/delete/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Find the user by ID
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Remove the user from all teams where they are a member
    await teamModal.updateMany({}, { $pull: { teamUsers: { userId: id } } });

    // Remove the user from all projects where they are a member or manager
    await projectModal.updateMany(
      {},
      {
        $pull: {
          projectMembers: id,
          projectManager: id,
        },
      }
    );

    // Delete the user
    await User.findByIdAndDelete(id);

    res.status(200).json({ message: "Member deleted" });
  } catch (error) {
    console.error("Error deleting user and associated data:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

///////////////////// Get Single User Details By ID //////////////////
//////////////////////////////////////////////////////////////////////
router.get("/user-id/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    return res.status(200).json(user);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

////////////////////////// Update the user Info //////////////////////////
//////////////////////////////////////////////////////////////////////////
router.put("/update-user/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedMemberData = req.body;
    console.log(updatedMemberData);
    // Find the user by ID
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update user details
    user.role = updatedMemberData.role;
    user.projects = updatedMemberData.projects;
    user.allowedApps = updatedMemberData.allowedApps;
    user.idleTimeOut = updatedMemberData.idleTimeout;
    user.keepIdleTime = updatedMemberData.keepIdleTime;

    // Update the user's teams
    const userTeamIds = updatedMemberData.teams.map((team) => team.teamId);

    // Remove user from teams they are no longer part of
    await teamModal.updateMany(
      { "teamUsers.userId": id, _id: { $nin: userTeamIds } },
      { $pull: { teamUsers: { userId: id } } }
    );

    // Update or add the user in the specified teams
    for (const teamData of updatedMemberData.teams) {
      await teamModal.findByIdAndUpdate(teamData.teamId, {
        $addToSet: {
          teamUsers: {
            userId: user._id.toString(),
            teamRole: teamData.teamRole,
            isTeamLead: teamData.isTeamLead,
          },
        },
      });
    }

    // Update the user's teams in their document
    user.teams = updatedMemberData.teams;

    // Save the updated user
    await user.save();

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
