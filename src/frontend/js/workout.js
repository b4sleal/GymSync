const userId = Number(localStorage.getItem("gymsync_user_id"));

const templateListEl = document.getElementById("template-list");
const listStatusEl = document.getElementById("list-status");

const workoutFormEl = document.getElementById("workout-form");
const editorTitleEl = document.getElementById("editor-title");
const workoutTitleInput = document.getElementById("workout-title");
const workoutNotesInput = document.getElementById("workout-notes");
const exercisePickerEl = document.getElementById("exercise-picker");
const selectedExerciseListEl = document.getElementById("selected-exercise-list");
const formStatusEl = document.getElementById("form-status");
const newWorkoutBtn = document.getElementById("new-workout-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const deleteCurrentBtn = document.getElementById("delete-current-btn");

const exerciseFormEl = document.getElementById("exercise-form");
const exerciseEditorTitleEl = document.getElementById("exercise-editor-title");
const exerciseNameInput = document.getElementById("exercise-name");
const exerciseSetsInput = document.getElementById("exercise-sets");
const exerciseRepsInput = document.getElementById("exercise-reps");
const exerciseWeightInput = document.getElementById("exercise-weight");
const exerciseNotesInput = document.getElementById("exercise-notes");
const exerciseFormStatusEl = document.getElementById("exercise-form-status");
const clearExerciseBtn = document.getElementById("clear-exercise-btn");
const exerciseLibraryListEl = document.getElementById("exercise-library-list");
const exerciseListStatusEl = document.getElementById("exercise-list-status");

const logoutLink = document.getElementById("logout-link");

let workouts = [];
let exercises = [];
let selectedWorkoutId = null;
let editingExerciseId = null;
let selectedExerciseIds = [];

function requireAuth() {
    if (!Number.isInteger(userId) || userId <= 0) {
        alert("Please log in first.");
        window.location.href = "landing.html";
        throw new Error("Missing user session");
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setStatus(el, message, isError = false) {
    el.textContent = message;
    el.classList.toggle("error", isError);
}

function resetExerciseEditor() {
    editingExerciseId = null;
    exerciseEditorTitleEl.textContent = "Create Exercise";
    exerciseNameInput.value = "";
    exerciseSetsInput.value = "3";
    exerciseRepsInput.value = "10";
    exerciseWeightInput.value = "";
    exerciseNotesInput.value = "";
    setStatus(exerciseFormStatusEl, "");
}

function loadExerciseIntoEditor(exercise) {
    editingExerciseId = Number(exercise.exercise_id);
    exerciseEditorTitleEl.textContent = "Edit Exercise";
    exerciseNameInput.value = exercise.exercise_name || "";
    exerciseSetsInput.value = exercise.sets ?? 3;
    exerciseRepsInput.value = exercise.reps ?? 10;
    exerciseWeightInput.value = exercise.weight_lbs ?? "";
    exerciseNotesInput.value = exercise.notes || "";
    setStatus(exerciseFormStatusEl, "");
}

function resetWorkoutEditor() {
    selectedWorkoutId = null;
    selectedExerciseIds = [];
    editorTitleEl.textContent = "Create Workout Template";
    workoutTitleInput.value = "";
    workoutNotesInput.value = "";
    deleteCurrentBtn.style.display = "none";
    setStatus(formStatusEl, "");
    renderExercisePicker();
    renderSelectedExercises();
    renderWorkoutList();
}

function loadWorkoutIntoEditor(workout) {
    selectedWorkoutId = Number(workout.template_id);
    editorTitleEl.textContent = "Edit Workout Template";
    workoutTitleInput.value = workout.title || "";
    workoutNotesInput.value = workout.notes || "";
    selectedExerciseIds = (Array.isArray(workout.exercises) ? workout.exercises : [])
        .map((exercise) => exercise.source_exercise_id)
        .filter((value) => Number.isInteger(value) || typeof value === "number");
    deleteCurrentBtn.style.display = "inline-block";
    setStatus(formStatusEl, "");
    renderExercisePicker();
    renderSelectedExercises(workout.exercises || []);
    renderWorkoutList();
}

function renderWorkoutList() {
    if (!Array.isArray(workouts) || workouts.length === 0) {
        templateListEl.innerHTML = `<div class="empty-state">No workout templates yet. Create your first one.</div>`;
        return;
    }

    templateListEl.innerHTML = workouts.map((workout) => {
        const isActive = Number(workout.template_id) === selectedWorkoutId;
        const workoutExercises = Array.isArray(workout.exercises) ? workout.exercises : [];

        return `
            <article class="template-item ${isActive ? "active" : ""}">
                <div class="template-item-header">
                    <div>
                        <h4>${escapeHtml(workout.title)}</h4>
                        <div class="small-muted">${workoutExercises.length} exercise${workoutExercises.length === 1 ? "" : "s"}</div>
                    </div>
                </div>

                <div class="template-notes">${escapeHtml(workout.notes || "No notes.")}</div>

                <ul class="exercise-preview">
                    ${workoutExercises.map((exercise) => `
                        <li>
                            <strong>${escapeHtml(exercise.exercise_name)}</strong>
                            — ${exercise.sets} sets x ${exercise.reps} reps
                            ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                        </li>
                    `).join("")}
                </ul>

                <div class="template-actions">
                    <button type="button" class="btn-secondary" data-action="edit-workout" data-id="${workout.template_id}">Edit</button>
                    <button type="button" class="btn-danger" data-action="delete-workout" data-id="${workout.template_id}">Delete</button>
                </div>
            </article>
        `;
    }).join("");
}

function renderExerciseLibrary() {
    if (!Array.isArray(exercises) || exercises.length === 0) {
        exerciseLibraryListEl.innerHTML = `<div class="empty-state">No exercises created yet.</div>`;
        return;
    }

    exerciseLibraryListEl.innerHTML = exercises.map((exercise) => `
        <article class="exercise-library-item">
            <div class="exercise-row-header">
                <div>
                    <h4>${escapeHtml(exercise.exercise_name)}</h4>
                    <div class="small-muted">
                        ${exercise.sets} sets x ${exercise.reps} reps
                        ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                    </div>
                </div>
            </div>

            <div class="exercise-library-notes">${escapeHtml(exercise.notes || "No notes.")}</div>

            <div class="exercise-actions">
                <button type="button" class="btn-secondary" data-action="use-exercise" data-id="${exercise.exercise_id}">Use In Workout</button>
                <button type="button" class="btn-secondary" data-action="edit-exercise" data-id="${exercise.exercise_id}">Edit</button>
                <button type="button" class="btn-danger" data-action="delete-exercise" data-id="${exercise.exercise_id}">Delete</button>
            </div>
        </article>
    `).join("");
}

function renderExercisePicker() {
    if (!Array.isArray(exercises) || exercises.length === 0) {
        exercisePickerEl.innerHTML = `<div class="empty-state">Create an exercise first, then add it to a workout template.</div>`;
        return;
    }

    exercisePickerEl.innerHTML = exercises.map((exercise) => {
        const alreadyAdded = selectedExerciseIds.includes(Number(exercise.exercise_id));

        return `
            <div class="picker-item">
                <div>
                    <strong>${escapeHtml(exercise.exercise_name)}</strong>
                    <div class="small-muted">
                        ${exercise.sets} sets x ${exercise.reps} reps
                        ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                    </div>
                    <div class="small-muted">${escapeHtml(exercise.notes || "")}</div>
                </div>
                <button
                    type="button"
                    class="btn-secondary"
                    data-action="${alreadyAdded ? "remove-picked-exercise" : "add-picked-exercise"}"
                    data-id="${exercise.exercise_id}"
                >
                    ${alreadyAdded ? "Remove" : "Add"}
                </button>
            </div>
        `;
    }).join("");
}

function renderSelectedExercises(explicitTemplateExercises = null) {
    if (Array.isArray(explicitTemplateExercises)) {
        if (explicitTemplateExercises.length === 0) {
            selectedExerciseListEl.innerHTML = `<div class="empty-state">No exercises selected.</div>`;
            return;
        }

        selectedExerciseListEl.innerHTML = explicitTemplateExercises.map((exercise) => `
            <article class="selected-exercise-item">
                <div class="exercise-row-header">
                    <div>
                        <h4>${escapeHtml(exercise.exercise_name)}</h4>
                        <div class="small-muted">
                            ${exercise.sets} sets x ${exercise.reps} reps
                            ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                        </div>
                    </div>
                </div>
                <div class="exercise-meta">${escapeHtml(exercise.notes || "No notes.")}</div>
            </article>
        `).join("");
        return;
    }

    if (selectedExerciseIds.length === 0) {
        selectedExerciseListEl.innerHTML = `<div class="empty-state">No exercises selected.</div>`;
        return;
    }

    const selected = selectedExerciseIds
        .map((id) => exercises.find((exercise) => Number(exercise.exercise_id) === Number(id)))
        .filter(Boolean);

    selectedExerciseListEl.innerHTML = selected.map((exercise) => `
        <article class="selected-exercise-item">
            <div class="exercise-row-header">
                <div>
                    <h4>${escapeHtml(exercise.exercise_name)}</h4>
                    <div class="small-muted">
                        ${exercise.sets} sets x ${exercise.reps} reps
                        ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                    </div>
                </div>
                <button type="button" class="btn-danger" data-action="remove-selected-exercise" data-id="${exercise.exercise_id}">Remove</button>
            </div>
            <div class="exercise-meta">${escapeHtml(exercise.notes || "No notes.")}</div>
        </article>
    `).join("");
}

async function loadExercises() {
    try {
        setStatus(exerciseListStatusEl, "Loading exercises...");

        const response = await fetch(`/api/workouts/exercises?user_id=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load exercises.");
        }

        exercises = Array.isArray(data.exercises) ? data.exercises : [];
        renderExerciseLibrary();
        renderExercisePicker();
        renderSelectedExercises();
        setStatus(exerciseListStatusEl, "");
    } catch (error) {
        setStatus(exerciseListStatusEl, error.message || "Could not load exercises.", true);
    }
}

async function loadWorkouts() {
    try {
        setStatus(listStatusEl, "Loading workouts...");

        const response = await fetch(`/api/workouts?user_id=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load workouts.");
        }

        workouts = Array.isArray(data.workouts) ? data.workouts : [];
        renderWorkoutList();
        setStatus(listStatusEl, "");
    } catch (error) {
        setStatus(listStatusEl, error.message || "Could not load workouts.", true);
    }
}

async function saveExercise(payload) {
    const isEditing = Number.isInteger(editingExerciseId) && editingExerciseId > 0;
    const url = isEditing ? `/api/workouts/exercises/${editingExerciseId}` : "/api/workouts/exercises";
    const method = isEditing ? "PUT" : "POST";

    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            ...payload,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not save exercise.");
    }

    return data.exercise;
}

async function deleteExercise(exerciseId) {
    const response = await fetch(`/api/workouts/exercises/${exerciseId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not delete exercise.");
    }

    return data;
}

async function saveWorkout(payload) {
    const isEditing = Number.isInteger(selectedWorkoutId) && selectedWorkoutId > 0;
    const url = isEditing ? `/api/workouts/${selectedWorkoutId}` : "/api/workouts";
    const method = isEditing ? "PUT" : "POST";

    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            ...payload,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not save workout.");
    }

    return data.workout;
}

async function deleteWorkout(workoutId) {
    const response = await fetch(`/api/workouts/${workoutId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not delete workout.");
    }

    return data;
}

exerciseFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const exercise_name = exerciseNameInput.value.trim();
    const sets = Number(exerciseSetsInput.value);
    const reps = Number(exerciseRepsInput.value);
    const weight_lbs = exerciseWeightInput.value.trim() === "" ? null : Number(exerciseWeightInput.value);
    const notes = exerciseNotesInput.value.trim();

    if (!exercise_name) {
        setStatus(exerciseFormStatusEl, "Exercise name is required.", true);
        return;
    }

    try {
        setStatus(exerciseFormStatusEl, "Saving exercise...");

        await saveExercise({
            exercise_name,
            sets,
            reps,
            weight_lbs,
            notes,
        });

        resetExerciseEditor();
        await loadExercises();
        setStatus(exerciseFormStatusEl, "Exercise saved.");
    } catch (error) {
        setStatus(exerciseFormStatusEl, error.message || "Could not save exercise.", true);
    }
});

workoutFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = workoutTitleInput.value.trim();
    const notes = workoutNotesInput.value.trim();

    if (!title) {
        setStatus(formStatusEl, "Workout title is required.", true);
        return;
    }

    try {
        setStatus(formStatusEl, "Saving workout...");

        const savedWorkout = await saveWorkout({
            title,
            notes,
            exercise_ids: selectedExerciseIds,
        });

        await loadWorkouts();
        loadWorkoutIntoEditor(savedWorkout);
        setStatus(formStatusEl, "Workout saved.");
    } catch (error) {
        setStatus(formStatusEl, error.message || "Could not save workout.", true);
    }
});

exerciseLibraryListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const exerciseId = Number(button.dataset.id);
    const exercise = exercises.find((item) => Number(item.exercise_id) === exerciseId);

    if (!exercise) return;

    if (action === "use-exercise") {
        if (!selectedExerciseIds.includes(exerciseId)) {
            selectedExerciseIds.push(exerciseId);
            renderExercisePicker();
            renderSelectedExercises();
        }
        return;
    }

    if (action === "edit-exercise") {
        loadExerciseIntoEditor(exercise);
        return;
    }

    if (action === "delete-exercise") {
        const ok = confirm(`Delete "${exercise.exercise_name}"?`);
        if (!ok) return;

        try {
            setStatus(exerciseListStatusEl, "Deleting exercise...");
            await deleteExercise(exerciseId);
            selectedExerciseIds = selectedExerciseIds.filter((id) => id !== exerciseId);

            if (editingExerciseId === exerciseId) {
                resetExerciseEditor();
            }

            await loadExercises();
            setStatus(exerciseListStatusEl, "Exercise deleted.");
        } catch (error) {
            setStatus(exerciseListStatusEl, error.message || "Could not delete exercise.", true);
        }
    }
});

exercisePickerEl.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const exerciseId = Number(button.dataset.id);

    if (action === "add-picked-exercise") {
        if (!selectedExerciseIds.includes(exerciseId)) {
            selectedExerciseIds.push(exerciseId);
        }
    }

    if (action === "remove-picked-exercise") {
        selectedExerciseIds = selectedExerciseIds.filter((id) => id !== exerciseId);
    }

    renderExercisePicker();
    renderSelectedExercises();
});

selectedExerciseListEl.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const exerciseId = Number(button.dataset.id);

    if (action === "remove-selected-exercise") {
        selectedExerciseIds = selectedExerciseIds.filter((id) => id !== exerciseId);
        renderExercisePicker();
        renderSelectedExercises();
    }
});

templateListEl.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    const workoutId = Number(button.dataset.id);
    const workout = workouts.find((item) => Number(item.template_id) === workoutId);

    if (!workout) return;

    if (action === "edit-workout") {
        loadWorkoutIntoEditor(workout);
        return;
    }

    if (action === "delete-workout") {
        const ok = confirm(`Delete "${workout.title}"?`);
        if (!ok) return;

        try {
            setStatus(listStatusEl, "Deleting workout...");
            await deleteWorkout(workoutId);

            if (selectedWorkoutId === workoutId) {
                resetWorkoutEditor();
            }

            await loadWorkouts();
            setStatus(listStatusEl, "Workout deleted.");
        } catch (error) {
            setStatus(listStatusEl, error.message || "Could not delete workout.", true);
        }
    }
});

newWorkoutBtn.addEventListener("click", resetWorkoutEditor);
cancelEditBtn.addEventListener("click", resetWorkoutEditor);
clearExerciseBtn.addEventListener("click", resetExerciseEditor);

deleteCurrentBtn.addEventListener("click", async () => {
    if (!selectedWorkoutId) return;

    const workout = workouts.find((item) => Number(item.template_id) === selectedWorkoutId);
    const ok = confirm(`Delete "${workout?.title || "this workout"}"?`);
    if (!ok) return;

    try {
        setStatus(formStatusEl, "Deleting workout...");
        await deleteWorkout(selectedWorkoutId);
        resetWorkoutEditor();
        await loadWorkouts();
        setStatus(formStatusEl, "Workout deleted.");
    } catch (error) {
        setStatus(formStatusEl, error.message || "Could not delete workout.", true);
    }
});

logoutLink?.addEventListener("click", () => {
    localStorage.removeItem("gymsync_user_id");
    localStorage.removeItem("gymsync_username");
});

requireAuth();
resetWorkoutEditor();
resetExerciseEditor();
loadExercises();
loadWorkouts();