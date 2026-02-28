const express = require("express");
const socialController = require("../controllers/socialController");

const router = express.Router();

router.get("/feed/:userId", socialController.getFeed);
router.post("/follow", socialController.followUser);
router.delete("/follow", socialController.unfollowUser);

module.exports = router;
