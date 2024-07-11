const router = require("express").Router();
const UserData = require("../Modals/UserDataModal");
const User = require("../Modals/UserModal");
const dotenv = require("dotenv");
const TimerLog = require("../Modals/userTimerLogModal");
dotenv.config();

router.post("/updateLastLog", async (req, res) => {
  console.log("Request to update last log entry");
  try {
    console.log("Request to update last log entry");
    const { user, endTime, endDate } = req.body;

    // Find the last log entry for the user without a stopTime
    const logEntry = await TimerLog.findOne({
      user,
      "logs.stopTime": { $exists: false },
    }).sort({ "logs.startTime": -1 });

    if (!logEntry) {
      return res.status(404).json({ message: "No active log entry found" });
    }

    // Update the log entry with the stop time and date
    logEntry.logs.forEach((log) => {
      if (!log.stopTime) {
        log.stopTime = endTime;
      }
    });

    await logEntry.save();

    res
      .status(200)
      .json({ message: "Log entry updated successfully", logEntry });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
// Compare this snippet from backend/Router/UserDataRouter.js:
