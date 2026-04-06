const express = require("express");
const socialController = require("../controllers/socialController");

const router = express.Router();

router.get("/users", socialController.searchUsers);
router.get("/followers", socialController.listFollowers);
router.post("/follow", socialController.followUser);
router.delete("/follow", socialController.unfollowUser);
router.get("/messages/:otherUserId", socialController.listConversation);
router.post("/messages", socialController.sendMessage);
router.get("/profile/:userId", socialController.getUserProfile);
router.get("/profile/:userId/schedules", socialController.getUserSchedules);
router.get("/profile/:userId/workouts", socialController.getUserWorkouts);

module.exports = router;