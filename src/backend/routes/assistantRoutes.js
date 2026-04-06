const express = require("express");
const assistantController = require("../controllers/assistantController");

const router = express.Router();

router.post("/", assistantController.respond);

module.exports = router;
