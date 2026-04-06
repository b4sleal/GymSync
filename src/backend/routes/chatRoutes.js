const express = require("express");
const chatController = require("../controllers/chatController");

const router = express.Router();

router.get("/", chatController.listMessages);
router.post("/", chatController.createMessage);

module.exports = router;
