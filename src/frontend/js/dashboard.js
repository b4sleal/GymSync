const userId = Number(localStorage.getItem("gymsync_user_id"));

const streakNumberEl = document.getElementById("streak-number");
const streakSubtextEl = document.getElementById("streak-subtext");
const todayPlanListEl = document.getElementById("today-plan-list");
const recentWorkoutsListEl = document.getElementById("recent-workouts-list");

let todayPlan = [];
let expandedScheduleId = null;

function requireAuth() {
    if (!Number.isInteger(userId) || userId <= 0) {
        alert("Please log in first.");
        window.location.href = "landing.html";
        throw new Error("Missing user session");
    }
}
function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatMinutes(minutes) {
    if (!Number.isInteger(minutes)) return "No time";
    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = (hours24 % 12) || 12;
    return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function formatDateOnly(dateOnly) {
    const date = new Date(`${dateOnly}T12:00:00`);
    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

async function loadDashboard() {
    const today = formatDateLocal(new Date());

    const response = await fetch(
        `/api/schedules/dashboard/${encodeURIComponent(userId)}?date=${encodeURIComponent(today)}`
    );
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not load dashboard.");
    }

    todayPlan = Array.isArray(data.today_plan) ? data.today_plan : [];
    renderStats(data.stats || {});
    renderTodayPlan();
    renderRecentLogs(Array.isArray(data.recent_logs) ? data.recent_logs : []);
}

function renderStats(stats) {
    streakNumberEl.textContent = Number(stats.current_streak || 0);
    streakSubtextEl.textContent =
        Number(stats.current_streak || 0) > 0
            ? "Keep the fire burning! 🔥"
            : "Finish a workout today to start your streak.";
}

function renderTodayPlan() {
    if (!todayPlan.length) {
        todayPlanListEl.innerHTML = `<p>No workouts scheduled for today.</p>`;
        return;
    }

    todayPlanListEl.innerHTML = todayPlan.map((schedule) => {
        const exercises = Array.isArray(schedule.exercises) ? schedule.exercises : [];
        const isExpanded = expandedScheduleId === schedule.schedule_id;

        return `
            <div class="today-plan-item" data-schedule-id="${schedule.schedule_id}" style="margin-bottom:14px; padding:12px; border:1px solid rgba(199,168,169,0.16); border-radius:8px;">
                <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
                    <div style="flex:1; cursor:pointer;" class="today-plan-toggle" data-schedule-id="${schedule.schedule_id}">
                        <strong>${escapeHtml(schedule.title)}</strong><br>
                        <span>${formatMinutes(schedule.start_minutes)} · ${schedule.duration_minutes} min</span>
                    </div>
                    <label style="display:flex; align-items:center; gap:8px; white-space:nowrap;">
                        <input type="checkbox" class="complete-schedule-checkbox" data-schedule-id="${schedule.schedule_id}" ${schedule.completed ? "checked disabled" : ""}>
                        <span>${schedule.completed ? "Done" : "Finish"}</span>
                    </label>
                </div>

                ${
            isExpanded
                ? `
                        <div style="margin-top:12px; color:#c7a8a9; white-space:pre-wrap;">
                            ${escapeHtml(schedule.notes || "No notes.")}
                        </div>
                        <ul class="exercise-preview" style="margin-top:10px;">
                            ${exercises.map((exercise) => `
                                <li>
                                    <strong>${escapeHtml(exercise.exercise_name)}</strong>
                                    — ${exercise.sets} sets x ${exercise.reps} reps
                                    ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                                </li>
                            `).join("")}
                        </ul>
                        `
                : ""
        }
            </div>
        `;
    }).join("");
}

function renderRecentLogs(logs) {
    if (!logs.length) {
        recentWorkoutsListEl.innerHTML = `<li>No recent workouts yet.</li>`;
        return;
    }

    recentWorkoutsListEl.innerHTML = logs.map((log) => `
        <li>
            <div class="history-info">
                <strong>${escapeHtml(log.title || "Workout")}</strong>
                <span class="date">${escapeHtml(formatDateOnly(String(log.date_completed).slice(0, 10)))}</span>
            </div>
        </li>
    `).join("");
}

async function completeSchedule(scheduleId) {
    const response = await fetch(`/api/schedules/${scheduleId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not complete workout.");
    }

    return data;
}

document.addEventListener("click", async (event) => {
    const toggle = event.target.closest(".today-plan-toggle");
    if (toggle) {
        const scheduleId = Number(toggle.dataset.scheduleId);
        expandedScheduleId = expandedScheduleId === scheduleId ? null : scheduleId;
        renderTodayPlan();
        return;
    }

    const checkbox = event.target.closest(".complete-schedule-checkbox");
    if (checkbox) {
        const scheduleId = Number(checkbox.dataset.scheduleId);

        try {
            await completeSchedule(scheduleId);
            await loadDashboard();
        } catch (error) {
            alert(error.message || "Could not complete workout.");
            checkbox.checked = false;
        }
    }
});

requireAuth();
loadDashboard().catch((error) => {
    console.error(error);
});