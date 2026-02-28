exports.listWorkouts = (req, res) => {
  res.json({
    message: "List workouts endpoint stub",
    workouts: [
      { workout_id: 1, title: "Push Day", day_of_week: "Monday", planned_duration_minutes: 60, is_finished: false },
      { workout_id: 2, title: "Cardio", day_of_week: "Wednesday", planned_duration_minutes: 30, is_finished: true }
    ]
  });
};

exports.createWorkout = (req, res) => {
  const { title, day_of_week, planned_duration_minutes } = req.body;

  res.status(201).json({
    message: "Create workout endpoint stub",
    workout: {
      workout_id: 3,
      title: title || "New Workout",
      day_of_week: day_of_week || "Friday",
      planned_duration_minutes: planned_duration_minutes || 45,
      is_finished: false
    }
  });
};

exports.completeWorkout = (req, res) => {
  const { workoutId } = req.params;

  res.json({
    message: "Complete workout endpoint stub",
    workout_id: Number(workoutId),
    is_finished: true,
    date_completed: new Date().toISOString().slice(0, 10)
  });
};

exports.deleteWorkout = (req, res) => {
  const { workoutId } = req.params;

  res.json({
    message: "Delete workout endpoint stub",
    deleted_workout_id: Number(workoutId)
  });
};
