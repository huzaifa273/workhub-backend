const router = require("express").Router();
const UserData = require("../Modals/UserDataModal");
const User = require("../Modals/UserModal");
const dotenv = require("dotenv");
dotenv.config();

router.get("/timesheet/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(400).json("User not found");
  }
  const data = await UserData.find({ user: user.email });
  res.status(200).json(data);
});

module.exports = router;
// Compare this snippet from backend/Router/UserDataRouter.js:
