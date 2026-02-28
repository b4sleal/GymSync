const express = require("express");
const workoutController = require("../controllers/workoutController");

const router = express.Router();

router.get("/", workoutController.listWorkouts);
router.post("/", workoutController.createWorkout);
router.patch("/:workoutId/complete", workoutController.completeWorkout);
router.delete("/:workoutId", workoutController.deleteWorkout);

module.exports = router;
