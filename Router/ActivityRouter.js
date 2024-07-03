const router = require("express").Router();
const Activity = require("../Modals/activityTrackerModal");
const dotenv = require("dotenv");
dotenv.config();

router.post("/activity", async (req, res) => {
  const { user, startTime, endTime, activityRate, startDate, endDate } =
    req.body;

  try {
    const newActivity = new Activity({
      user,
      startTime,
      endTime,
      startDate,
      endDate,
      activityRate,
    });
    await newActivity.save();
    res.status(201).send(newActivity);
  } catch (error) {
    res.status(400).send(error);
  }
});

module.exports = router;
// Compare this snippet from backend/Router/UserDataRouter.js:
