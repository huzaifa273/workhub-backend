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
dotenv.config();

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

router.post("/invite", async (req, res) => {
  const newUser = new User({
    firstName: "",
    lastName: "",
    email: req.body.email,
    password: "",
    role: req.body.role,
    team: req.body.team,
    projects: req.body.projects,
  });
  let user = await newUser.save();

  const invitationLink = `http://localhost:3000/signup/`;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: "malikhuzaifaawais1@gmail.com",
      pass: process.env.PASS,
    },
  });

  // async..await is not allowed in global scope, must use a wrapper
  async function main() {
    // send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"WorkHub" <${process.env.USER}>`, // sender address
      to: req.body.email, // list of receivers
      subject: "WorkHub", // Subject line
      text: "process.env", // plain text body
      html: `<b>You are invited to join workhub as a ${req.body.role}. Here is the invitation link to join </b> ${invitationLink}`, // html body
    });

    console.log("Message sent: %s", info.messageId);
    // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
    res.status(200).json({
      message: "Email Invition Sent",
      user: {
        email: user.email,
      },
    });
  }

  main().catch(console.error);
});

///////////////// register the invited member ///////////////
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

      // Send the response
      res.status(200).json({ message: "Registered Successfully" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json("Server Error");
  }
});

///////////////////////// login //////////////////////////
//////////////////////////////////////////////////////////

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email is not registered" });
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
  // try {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  // Generate random token
  const generateToken = () => {
    return crypto.randomBytes(20).toString("hex");
  };

  // Generate reset token and expiration time
  const resetToken = generateToken();
  const resetTokenExpiry = Date.now() + 3600000 * 8; // 1 hour

  // Update user with reset token and expiry
  user.resetPasswordToken = resetToken;
  user.resetPasswordExpires = resetTokenExpiry;
  await user.save();

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: "malikhuzaifaawais1@gmail.com",
      pass: process.env.PASS,
    },
  });

  // Send email with reset link
  const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

  // async..await is not allowed in global scope, must use a wrapper
  async function main() {
    // send mail with defined transport object
    const info = await transporter.sendMail({
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

  main().catch(console.error);

  // res.status(200).json({ message: "Password reset link sent to your email" });
  // } catch (error) {
  //   res.status(500).json({ message: 'Server error', error });
  // }
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

module.exports = router;
