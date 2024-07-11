const router = require("express").Router();
const Activity = require("../Modals/activityTrackerModal");
const TimerLog = require("../Modals/userTimerLogModal");
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

// POST /api/put/timer-log
router.post("/timer-log", async (req, res) => {
  const { user, logData } = req.body;

  try {
    for (const logEntry of logData) {
      const { date, logs } = logEntry;

      // Find the existing log for the user and date
      let timerLog = await TimerLog.findOne({ user, date });

      if (!timerLog) {
        // If no log exists for this date, create a new one
        timerLog = new TimerLog({ user, date, logs });
      } else {
        // If a log exists, append the new logs
        timerLog.logs.push(...logs);
      }

      await timerLog.save();
    }

    res.status(200).json({ message: "Timer log data saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

module.exports = router;
// Compare this snippet from backend/Router/UserDataRouter.js:
