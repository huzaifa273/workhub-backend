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

router.post("/invite", async (req, res) => {
  // try {
  // Generate reset token and expiration time
  const registrationToken = generateToken();
  const registrationTokenExpiry = Date.now() + 8 * 60 * 60 * 1000; // 8 hours

  // Transporter configuration
  // in .env file Replace host with "smtp.gmail.com" and user with "malikhuzaifaawais1@gmail.com" email provider and password with "hojaccphamr*****" from the google account (search for "app passwords")
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

  const invitationLink = `http://localhost:3000/signup/${registrationToken}`;

  // send mail with defined transport object
  const info = await transporter.sendMail({
    from: `"WorkHub" <${process.env.USER}>`, // sender address
    to: req.body.email, // list of receivers
    subject: "WorkHub Invitation", // Subject line
    text: `You are invited to join WorkHub as a ${req.body.role}. Here is the invitation link to join: ${invitationLink}`, // plain text body
    html: `<b>You are invited to join WorkHub as a ${req.body.role}. Here is the invitation link to join:</b> <a href="${invitationLink}">Register</a> This link will expire in 8 hours`, // html body
  });

  console.log("Message sent: %s", info.messageId);

  // Check if the user already exists
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    // Update existing user with new token and expiry
    user.registrationToken = registrationToken;
    user.registrationTokenExpiry = registrationTokenExpiry;
  } else {
    // Create new user with empty fields except email
    user = new User({
      firstName: null,
      lastName: null,
      email: req.body.email,
      password: null,
      role: req.body.role,
      team: [req.body.team], // Modify this line to make team an array with the new team
      projects: [req.body.projects],
      registrationToken,
      registrationTokenExpiry,
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
  // } catch (error) {
  //   console.error(error);
  //   res
  //     .status(500)
  //     .json({ message: "Internal Server Error", error: error.message });
  // }
});

///////////////// register the invited member ///////////////
/////////////////////////////////////////////////////////////
router.post("/register/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { email, firstName, lastName, password } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(403).json({ message: "Email is not registered" });
    }
    if (
      user.registrationToken === null ||
      user.registrationToken === undefined ||
      user.registrationToken === ""
    ) {
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
    user.registrationToken = undefined; // Clear the token
    user.registrationTokenExpiry = undefined; // Clear the token expiry
    // Save the updated user
    await user.save();
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

module.exports = router;
