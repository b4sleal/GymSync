const express = require("express");
const scheduleController = require("../controllers/scheduleController");

const router = express.Router();

router.get("/", scheduleController.listSchedules);
router.get("/today/:userId", scheduleController.getTodaySchedule);
router.get("/logs/:userId", scheduleController.listRecentLogs);
router.post("/", scheduleController.createSchedule);
router.put("/:scheduleId", scheduleController.updateSchedule);
router.patch("/:scheduleId/complete", scheduleController.completeSchedule);
router.delete("/:scheduleId", scheduleController.deleteSchedule);
router.get("/dashboard/:userId", scheduleController.getDashboardData);
module.exports = router;
