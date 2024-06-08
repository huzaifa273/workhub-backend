const router = require("express").Router();
const User = require("../Modals/UserModal");
const bcrypt = require("bcrypt");
const bcryptjs = require("bcryptjs");
const saltRounds = 10;
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

//
///////////////////////// register the owner //////////////////////////
//

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

//
///////////////////////// register //////////////////////////
//

router.post("/register", async (req, res) => {
  // try {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const secPassword = await bcrypt.hash(req.body.password, saltRounds);
    const newUser = new User({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: secPassword,
    });
  }

  user = await newUser.save();
  const accessToken = jwt.sign(
    {
      id: user._id,
      email: user.email,
    },
    JWT_SECRET
  );
  res.status(200).json("Registered Successfully");
});

//
///////////////////////// login //////////////////////////
//

router.post("/login", async (req, res) => {
  try {
    let user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(400).json("User not found");
    }
    const comparePassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!comparePassword) {
      return res.status(400).json("Password is incorrect");
    }
    const accessToken = await jwt.sign(
      {
        id: user._id,
        username: user.username,
      },
      JWT_SECRET
    );
    const { password, ...others } = user._doc;
    res.status(200).json({ others, accessToken });
  } catch (error) {
    res.status(500).json({ "Internal Error Occured ": error });
  }
});

module.exports = router;
