const express = require("express");
const workoutController = require("../controllers/workoutController");

const router = express.Router();

/* Exercise library */
router.get("/exercises", workoutController.listExercises);
router.post("/exercises", workoutController.createExercise);
router.put("/exercises/:exerciseId", workoutController.updateExercise);
router.delete("/exercises/:exerciseId", workoutController.deleteExercise);

/* Workout templates */
router.get("/", workoutController.listWorkouts);
router.get("/:workoutId", workoutController.getWorkout);
router.post("/", workoutController.createWorkout);
router.put("/:workoutId", workoutController.updateWorkout);
router.patch("/:workoutId/complete", workoutController.completeWorkout);
router.delete("/:workoutId", workoutController.deleteWorkout);

module.exports = router;