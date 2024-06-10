const router = require("express").Router();
const User = require("../Modals/UserModal");
const bcrypt = require("bcrypt");
const bcryptjs = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const sendMail = require("./mailer");

dotenv.config();

///////////////////////////////////////////////////////////////////////
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

///////////////////////////////////////////////////////////////////////
///////////////////////// Send the Invitaion //////////////////////////
///////////////////////////////////////////////////////////////////////

router.post("/invite", async (req, res) => {
  const newUser = new User({
    firstName: "",
    lastName: "",
    email: req.body.email,
    password: "",
    role: req.body.role,
    team: req.body.team,
    project: req.body.project,
  });
  let user = await newUser.save();

  // Send Email invitaion
  const { email, role, project, team } = req.body;
  //const invitationLink = `${process.env.CLIENT_URL}/register?role=${role}&project=${project}&team=${team}&email=${email}`;

  // Send email
  const subject = "Invitation to join our platform";
  const text = `You have been invited to join as a <b> ${role}. </b> Click the following link to register`;
  const html = `<b>You have been invited to join as a ${role}. Click the following link to register</b>`;

  await sendMail(email, subject, text, html);

  res.status(200).json({
    message: "Invition sent",
    user: {
      email: user.email,
    },
  });
});

/////////////////////////////////////////////////////////////
///////////////////////// register //////////////////////////
/////////////////////////////////////////////////////////////

router.post("/register", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json("Need An invitation to register");
    } else {
      // Hash the password
      const secPassword = await bcrypt.hash(req.body.password, saltRounds);

      // Update the user details
      user.firstName = req.body.firstName;
      user.lastName = req.body.lastName;
      user.password = secPassword;

      // Save the updated user
      await user.save();

      // Generate JWT token
      const accessToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" } // Adjust the token expiration time as needed
      );

      // Send the response
      res
        .status(200)
        .json({ message: "Registered Successfully", token: accessToken });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Server Error");
  }
});

//////////////////////////////////////////////////////////
///////////////////////// login //////////////////////////
//////////////////////////////////////////////////////////

router.post("/login", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json({ message: "Email is not registered" });
    }
    const comparePassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!comparePassword) {
      return res.status(400).json({ message: "Password is incorrect" });
    }
    const accessToken = await jwt.sign(
      {
        id: user._id,
        username: user.username,
      },
      process.env.JWT_SECRET
    );
    const { password, ...others } = user._doc;
    res.status(200).json({ others, accessToken });
  } catch (error) {
    res.status(500).json({ "Internal Error Occured ": error });
  }
});

module.exports = router;
