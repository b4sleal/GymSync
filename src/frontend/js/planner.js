const STORAGE_KEY = "gymsync_workouts";

const form = document.getElementById("workoutForm");
const msg = document.getElementById("msg");
const list = document.getElementById("workoutList");
const filterDay = document.getElementById("filterDay");

const clearBtn = document.getElementById("clearBtn");
const wipeBtn = document.getElementById("wipeBtn");

function loadWorkouts() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function saveWorkouts(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function setMessage(text) {
    msg.textContent = text;
    if (text) setTimeout(() => (msg.textContent = ""), 2500);
}

function getSelectedDays() {
    return [...document.querySelectorAll('input[name="days"]:checked')].map(cb => cb.value);
}

function render() {
    const day = filterDay.value;
    const workouts = loadWorkouts().sort((a, b) => a.created_at.localeCompare(b.created_at));

    const filtered = day === "All" ? workouts : workouts.filter(w => w.day_of_week === day);

    if (filtered.length === 0) {
        list.innerHTML = `<div class="small">No workouts planned yet.</div>`;
        return;
    }

    list.innerHTML = filtered.map(w => {
        const recur = w.is_recurring ? "Recurring" : "One-time";
        return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div><strong>${escapeHtml(w.description)}</strong></div>
            <div class="small">${w.duration} min • ${recur}</div>
          </div>
          <div class="badge">${w.day_of_week}</div>
        </div>

        <div class="itemActions">
          <button type="button" class="secondary" data-action="toggle" data-id="${w.id}">
            ${w.completed ? "Undo Complete" : "Mark Complete"}
          </button>
          <button type="button" class="danger" data-action="delete" data-id="${w.id}">
            Delete
          </button>
        </div>
      </div>
    `;
    }).join("");
}

function escapeHtml(s) {
    return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const description = document.getElementById("description").value.trim();
    const duration = Number(document.getElementById("duration").value);
    const isRecurring = document.getElementById("isRecurring").checked;
    const days = getSelectedDays();

    if (!description) return setMessage("Please enter a workout description.");
    if (!Number.isFinite(duration) || duration <= 0) return setMessage("Please enter a valid duration.");
    if (days.length === 0) return setMessage("Select at least one day of the week.");

    const workouts = loadWorkouts();

    // IMPORTANT: One row per selected day (matches your Workouts schema)
    for (const day of days) {
        workouts.push({
            id: uid(),
            // user_id would be filled by backend later; for demo we omit it
            description,
            day_of_week: day,
            is_recurring: isRecurring,
            duration,
            created_at: new Date().toISOString(),
            completed: false
        });
    }

    saveWorkouts(workouts);
    form.reset();
    document.getElementById("isRecurring").checked = true;

    setMessage(`Added ${days.length} workout${days.length > 1 ? "s" : ""}.`);
    render();
});

clearBtn.addEventListener("click", () => {
    form.reset();
    document.getElementById("isRecurring").checked = true;
    setMessage("Form cleared.");
});

wipeBtn.addEventListener("click", () => {
    const ok = confirm("Delete ALL planned workouts?");
    if (!ok) return;

    saveWorkouts([]);
    setMessage("All workouts deleted.");
    render();
});

filterDay.addEventListener("change", render);

list.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    const workouts = loadWorkouts();
    const idx = workouts.findIndex(w => w.id === id);
    if (idx === -1) return;

    if (action === "delete") {
        workouts.splice(idx, 1);
        saveWorkouts(workouts);
        setMessage("Workout deleted.");
        render();
        return;
    }

    if (action === "toggle") {
        workouts[idx].completed = !workouts[idx].completed;
        saveWorkouts(workouts);
        render();
        return;
    }
});

render();

<!-- {
    "description": "Leg Day",
    "days": ["Mon","Tue"],
    "is_recurring": true,
    "duration": 60
} -->