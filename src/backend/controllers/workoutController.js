const db = require("../config/db");
const {
  ValidationError,
  optionalDateOnly,
  optionalPositiveInteger,
  optionalString,
  parseRequestUserId,
  requirePositiveInteger,
  requireString,
  todayDateOnly,
  validationMessage,
} = require("../utils/validation");

const workoutSelect = `
  SELECT
    wt.template_id,
    wt.user_id,
    wt.title,
    wt.notes,
    wt.created_at,
    COALESCE(
            json_agg(
            json_build_object(
                'template_exercise_id', te.template_exercise_id,
                'source_exercise_id', te.source_exercise_id,
                'exercise_name', te.exercise_name,
                'sets', te.sets,
                'reps', te.reps,
                'notes', te.notes,
                'weight_lbs', te.weight_lbs,
                'sort_order', te.sort_order
            )
            ORDER BY te.sort_order, te.template_exercise_id
                    ) FILTER (WHERE te.template_exercise_id IS NOT NULL),
            '[]'::json
    ) AS exercises
  FROM WorkoutTemplates wt
         LEFT JOIN TemplateExercises te ON te.template_id = wt.template_id
`;

function normalizeExerciseIds(value) {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError("exercise_ids must be an array.");
  }

  return value.map((id, index) =>
      requirePositiveInteger(id, `exercise_ids[${index}]`)
  );
}

function normalizeSingleExercise(body) {
  return {
    exercise_name: requireString(
        body.exercise_name ?? body.name ?? body.title,
        "exercise_name",
        { maxLength: 100 }
    ),
    sets: optionalPositiveInteger(body.sets, "sets") ?? 3,
    reps: optionalPositiveInteger(body.reps, "reps") ?? 10,
    weight_lbs: optionalPositiveInteger(body.weight_lbs ?? body.weight, "weight_lbs"),
    notes: optionalString(body.notes, "notes", { maxLength: 1000 }),
  };
}

function parseWorkoutInput(body, { allowUndefined = false } = {}) {
  const hasTitleField =
      Object.prototype.hasOwnProperty.call(body, "title") ||
      Object.prototype.hasOwnProperty.call(body, "description");

  if (!allowUndefined && !hasTitleField) {
    throw new ValidationError("title is required.");
  }

  if (
      allowUndefined &&
      !hasTitleField &&
      !Object.prototype.hasOwnProperty.call(body, "exercise_ids") &&
      !Object.prototype.hasOwnProperty.call(body, "exerciseIds")
  ) {
    return { title: undefined, notes: undefined, exercise_ids: undefined };
  }

  return {
    title: hasTitleField
        ? requireString(body.title ?? body.description, "title", { maxLength: 100 })
        : undefined,
    notes: Object.prototype.hasOwnProperty.call(body, "notes")
        ? optionalString(body.notes, "notes", { maxLength: 2000 })
        : allowUndefined
            ? undefined
            : null,
    exercise_ids:
        Object.prototype.hasOwnProperty.call(body, "exercise_ids") ||
        Object.prototype.hasOwnProperty.call(body, "exerciseIds")
            ? normalizeExerciseIds(body.exercise_ids ?? body.exerciseIds)
            : allowUndefined
                ? undefined
                : [],
  };
}

async function ensureUserExists(client, userId) {
  const result = await client.query("SELECT user_id FROM Users WHERE user_id = $1", [userId]);
  if (result.rowCount === 0) {
    throw new ValidationError("user_id does not exist.");
  }
}

async function getWorkoutById(client, templateId) {
  const result = await client.query(
      `
        ${workoutSelect}
        WHERE wt.template_id = $1
        GROUP BY wt.template_id
        `,
      [templateId]
  );

  return result.rows[0] ?? null;
}

async function ensureWorkoutOwnership(client, templateId, userId) {
  const workout = await getWorkoutById(client, templateId);

  if (!workout) {
    throw new ValidationError("workoutId does not exist.");
  }

  if (workout.user_id !== userId) {
    throw new ValidationError("workoutId does not belong to the provided user_id.");
  }

  return workout;
}

async function getExerciseById(client, exerciseId) {
  const result = await client.query(
      `
        SELECT
            exercise_id,
            user_id,
            exercise_name,
            notes,
            sets,
            reps,
            weight_lbs,
            created_at
        FROM Exercises
        WHERE exercise_id = $1
        `,
      [exerciseId]
  );

  return result.rows[0] ?? null;
}

async function ensureExerciseOwnership(client, exerciseId, userId) {
  const exercise = await getExerciseById(client, exerciseId);

  if (!exercise) {
    throw new ValidationError("exerciseId does not exist.");
  }

  if (exercise.user_id !== userId) {
    throw new ValidationError("exerciseId does not belong to the provided user_id.");
  }

  return exercise;
}

async function copyExercisesToTemplate(client, templateId, userId, exerciseIds) {
  for (let index = 0; index < exerciseIds.length; index += 1) {
    const exerciseId = exerciseIds[index];
    const exercise = await ensureExerciseOwnership(client, exerciseId, userId);

    await client.query(
        `
            INSERT INTO TemplateExercises (
                template_id,
                source_exercise_id,
                exercise_name,
                notes,
                sets,
                reps,
                weight_lbs,
                sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
        [
          templateId,
          exercise.exercise_id,
          exercise.exercise_name,
          exercise.notes,
          exercise.sets,
          exercise.reps,
          exercise.weight_lbs,
          index,
        ]
    );
  }
}

/* ----------------------------
   Exercise library endpoints
-----------------------------*/

exports.listExercises = async (req, res) => {
  try {
    const userId = parseRequestUserId(req);

    const result = await db.query(
        `
            SELECT
                exercise_id,
                user_id,
                exercise_name,
                notes,
                sets,
                reps,
                weight_lbs,
                created_at
            FROM Exercises
            WHERE user_id = $1
            ORDER BY created_at DESC, exercise_id DESC
            `,
        [userId]
    );

    res.json({ exercises: result.rows });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while listing exercises."),
    });
  }
};

exports.createExercise = async (req, res) => {
  const client = await db.connect();

  try {
    const userId = parseRequestUserId(req);
    const exercise = normalizeSingleExercise(req.body);

    await client.query("BEGIN");
    await ensureUserExists(client, userId);

    const result = await client.query(
        `
            INSERT INTO Exercises (user_id, exercise_name, notes, sets, reps, weight_lbs)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                exercise_id,
                user_id,
                exercise_name,
                notes,
                sets,
                reps,
                weight_lbs,
                created_at
            `,
        [
          userId,
          exercise.exercise_name,
          exercise.notes,
          exercise.sets,
          exercise.reps,
          exercise.weight_lbs,
        ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      message: "Exercise created successfully.",
      exercise: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while creating the exercise."),
    });
  } finally {
    client.release();
  }
};

exports.updateExercise = async (req, res) => {
  const client = await db.connect();

  try {
    const exerciseId = requirePositiveInteger(req.params.exerciseId, "exerciseId");
    const userId = parseRequestUserId(req);
    await ensureExerciseOwnership(client, exerciseId, userId);

    const exercise = normalizeSingleExercise(req.body);

    await client.query("BEGIN");

    const result = await client.query(
        `
            UPDATE Exercises
            SET exercise_name = $1,
                notes = $2,
                sets = $3,
                reps = $4,
                weight_lbs = $5
            WHERE exercise_id = $6
            RETURNING
                exercise_id,
                user_id,
                exercise_name,
                notes,
                sets,
                reps,
                weight_lbs,
                created_at
            `,
        [
          exercise.exercise_name,
          exercise.notes,
          exercise.sets,
          exercise.reps,
          exercise.weight_lbs,
          exerciseId,
        ]
    );

    await client.query("COMMIT");

    res.json({
      message: "Exercise updated successfully.",
      exercise: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while updating the exercise."),
    });
  } finally {
    client.release();
  }
};

exports.deleteExercise = async (req, res) => {
  try {
    const exerciseId = requirePositiveInteger(req.params.exerciseId, "exerciseId");
    const userId = parseRequestUserId(req);
    const exercise = await getExerciseById(db, exerciseId);

    if (!exercise) {
      throw new ValidationError("exerciseId does not exist.");
    }

    if (exercise.user_id !== userId) {
      throw new ValidationError("exerciseId does not belong to the provided user_id.");
    }

    await db.query("DELETE FROM Exercises WHERE exercise_id = $1", [exerciseId]);

    res.json({
      message: "Exercise deleted successfully.",
      exercise_id: exerciseId,
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while deleting the exercise."),
    });
  }
};

/* ----------------------------
   Workout template endpoints
-----------------------------*/

exports.listWorkouts = async (req, res) => {
  try {
    const userId = parseRequestUserId(req);

    const result = await db.query(
        `
            ${workoutSelect}
            WHERE wt.user_id = $1
            GROUP BY wt.template_id
            ORDER BY wt.created_at DESC
            `,
        [userId]
    );

    res.json({ workouts: result.rows });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while listing workouts."),
    });
  }
};

exports.getWorkout = async (req, res) => {
  try {
    const templateId = requirePositiveInteger(req.params.workoutId, "workoutId");
    const userId = parseRequestUserId(req, { required: false });
    const workout = await getWorkoutById(db, templateId);

    if (!workout) {
      throw new ValidationError("workoutId does not exist.");
    }

    if (userId !== null && workout.user_id !== userId) {
      throw new ValidationError("workoutId does not belong to the provided user_id.");
    }

    res.json({ workout });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while loading the workout."),
    });
  }
};

exports.createWorkout = async (req, res) => {
  const client = await db.connect();

  try {
    const userId = parseRequestUserId(req);
    const { title, notes, exercise_ids } = parseWorkoutInput(req.body);

    await client.query("BEGIN");
    await ensureUserExists(client, userId);

    const workoutResult = await client.query(
        `
            INSERT INTO WorkoutTemplates (user_id, title, notes)
            VALUES ($1, $2, $3)
            RETURNING template_id
            `,
        [userId, title, notes]
    );

    const templateId = workoutResult.rows[0].template_id;

    await copyExercisesToTemplate(client, templateId, userId, exercise_ids);

    const workout = await getWorkoutById(client, templateId);
    await client.query("COMMIT");

    res.status(201).json({
      message: "Workout template created successfully.",
      workout,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while creating the workout."),
    });
  } finally {
    client.release();
  }
};

exports.updateWorkout = async (req, res) => {
  const client = await db.connect();

  try {
    const templateId = requirePositiveInteger(req.params.workoutId, "workoutId");
    const userId = parseRequestUserId(req);
    const workout = await ensureWorkoutOwnership(client, templateId, userId);
    const updates = parseWorkoutInput(req.body, { allowUndefined: true });

    await client.query("BEGIN");

    const nextTitle = updates.title ?? workout.title;
    const nextNotes = updates.notes !== undefined ? updates.notes : workout.notes;

    await client.query(
        `
            UPDATE WorkoutTemplates
            SET title = $1,
                notes = $2
            WHERE template_id = $3
            `,
        [nextTitle, nextNotes, templateId]
    );

    if (updates.exercise_ids !== undefined) {
      await client.query("DELETE FROM TemplateExercises WHERE template_id = $1", [templateId]);
      await copyExercisesToTemplate(client, templateId, userId, updates.exercise_ids);
    }

    const updatedWorkout = await getWorkoutById(client, templateId);
    await client.query("COMMIT");

    res.json({
      message: "Workout template updated successfully.",
      workout: updatedWorkout,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while updating the workout."),
    });
  } finally {
    client.release();
  }
};

exports.completeWorkout = async (req, res) => {
  try {
    const templateId = requirePositiveInteger(req.params.workoutId, "workoutId");
    const userId = parseRequestUserId(req);
    const completionDate = optionalDateOnly(req.body?.date_completed, "date_completed") ?? todayDateOnly();

    const workout = await getWorkoutById(db, templateId);
    if (!workout) {
      throw new ValidationError("workoutId does not exist.");
    }

    if (workout.user_id !== userId) {
      throw new ValidationError("workoutId does not belong to the provided user_id.");
    }

    const existingLog = await db.query(
        `
            SELECT log_id, user_id, template_id, date_completed, created_at
            FROM Logs
            WHERE user_id = $1
              AND template_id = $2
              AND date_completed = $3::date
            `,
            [userId, templateId, completionDate]
    );

    const log =
        existingLog.rowCount > 0
            ? existingLog.rows[0]
            : (
                await db.query(
                    `
                        INSERT INTO Logs (user_id, template_id, date_completed)
                        VALUES ($1, $2, $3::date)
                        RETURNING log_id, user_id, template_id, date_completed, created_at
                        `,
                    [userId, templateId, completionDate]
                )
            ).rows[0];

    res.json({
      message: "Workout marked complete.",
      log,
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while marking the workout complete."),
    });
  }
};

exports.deleteWorkout = async (req, res) => {
  try {
    const templateId = requirePositiveInteger(req.params.workoutId, "workoutId");
    const userId = parseRequestUserId(req);
    const workout = await getWorkoutById(db, templateId);

    if (!workout) {
      throw new ValidationError("workoutId does not exist.");
    }

    if (workout.user_id !== userId) {
      throw new ValidationError("workoutId does not belong to the provided user_id.");
    }

    await db.query("DELETE FROM WorkoutTemplates WHERE template_id = $1", [templateId]);

    res.json({
      message: "Workout template deleted successfully.",
      workout_id: templateId,
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while deleting the workout."),
    });
  }
};


