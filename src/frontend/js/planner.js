const userId = Number(localStorage.getItem("gymsync_user_id"));

const templateSelect = document.getElementById("template-id");
const scheduleForm = document.getElementById("schedule-form");
const specificDateInput = document.getElementById("specific-date");
const startTimeInput = document.getElementById("start-time");
const durationMinutesInput = document.getElementById("duration-minutes");
const isRecurringInput = document.getElementById("isRecurring");
const clearBtn = document.getElementById("clearBtn");
const msgEl = document.getElementById("msg");

const monthTitleEl = document.getElementById("month-title");
const monthGridEl = document.getElementById("month-grid");
const calendarStatusEl = document.getElementById("calendar-status");

const selectedDaySummaryEl = document.getElementById("selected-day-summary");
const selectedWorkoutDetailEl = document.getElementById("selected-workout-detail");
const dayDetailTitleEl = document.getElementById("day-detail-title");
const dayDetailShellEl = document.getElementById("day-detail-shell");

const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const logoutLink = document.getElementById("logout-link");

let templates = [];
let schedules = [];
let currentMonth = new Date();
currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);

let selectedDate = formatDateLocal(new Date());
let selectedScheduleId = null;

const isPlannerEditorPage = Boolean(
    scheduleForm &&
    templateSelect &&
    specificDateInput &&
    startTimeInput &&
    durationMinutesInput &&
    msgEl
);

function preserveTimelineScroll() {
    const shell = dayDetailShellEl.querySelector(".timeline-shell");
    return shell ? shell.scrollTop : 0;
}

function isBeforeToday(dateOnly) {
    return dateOnly < formatDateLocal(new Date());
}

function restoreTimelineScroll(scrollTop) {
    const shell = dayDetailShellEl.querySelector(".timeline-shell");
    if (shell) {
        shell.scrollTop = scrollTop;
    }
}

function requireAuth() {
    if (!Number.isInteger(userId) || userId <= 0) {
        alert("Please log in first.");
        window.location.href = "landing.html";
        throw new Error("Missing user session");
    }
}

function setStatus(el, message, isError = false) {
    el.textContent = message;
    el.classList.toggle("error", isError);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatDateLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function normalizeDateOnly(value) {
    if (!value) return null;
    if (typeof value === "string") return value.slice(0, 10);

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatDateLocal(date);
}

const PIXELS_PER_10_MINUTES = 64;
const PIXELS_PER_MINUTE = PIXELS_PER_10_MINUTES / 10;
const COMPRESSED_GAP_HEIGHT = 34;
const LARGE_GAP_THRESHOLD_MINUTES = 120;
const MAX_EVENT_HEIGHT = PIXELS_PER_10_MINUTES * 2; // cap at 20 minutes visual height

function minutesToPixels(minutes) {
    return minutes * PIXELS_PER_MINUTE;
}

function formatGapLabel(minutes) {
    if (minutes < 60) {
        return `${minutes}m gap`;
    }

    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;

    if (remainder === 0) {
        return `${hours}h gap`;
    }

    return `${hours}h ${remainder}m gap`;
}

function buildCompressedTimelineLayout(items) {
    if (!items.length) {
        const start = 8 * 60;
        const end = 9 * 60;

        return {
            windowStart: start,
            windowEnd: end,
            totalHeight: minutesToPixels(end - start),
            segments: [
                {
                    type: "time",
                    minuteStart: start,
                    minuteEnd: end,
                    top: 0,
                    height: minutesToPixels(end - start),
                },
            ],
        };
    }

    const starts = items.map((item) => Number.isInteger(item.start_minutes) ? item.start_minutes : 0);
    const ends = items.map((item) => {
        const start = Number.isInteger(item.start_minutes) ? item.start_minutes : 0;
        const duration = Number.isInteger(item.duration_minutes) ? item.duration_minutes : 60;
        return start + duration;
    });

    let windowStart = Math.floor((Math.min(...starts) - 10) / 10) * 10;
    let windowEnd = Math.ceil((Math.max(...ends) + 10) / 10) * 10;

    windowStart = Math.max(0, windowStart);
    windowEnd = Math.min(1440, windowEnd);

    const sortedItems = [...items].sort((a, b) => {
        const aStart = Number.isInteger(a.start_minutes) ? a.start_minutes : 0;
        const bStart = Number.isInteger(b.start_minutes) ? b.start_minutes : 0;
        return aStart - bStart;
    });

    const segments = [];
    let cursor = windowStart;
    let currentTop = 0;

    for (let i = 0; i < sortedItems.length; i += 1) {
        const item = sortedItems[i];
        const itemStart = Number.isInteger(item.start_minutes) ? item.start_minutes : 0;
        const gap = itemStart - cursor;

        if (gap > 0) {
            if (gap > LARGE_GAP_THRESHOLD_MINUTES) {
                segments.push({
                    type: "gap",
                    minuteStart: cursor,
                    minuteEnd: itemStart,
                    top: currentTop + 10,
                    height: COMPRESSED_GAP_HEIGHT,
                    label: formatGapLabel(gap),
                });
                currentTop += COMPRESSED_GAP_HEIGHT + 20;
            } else {
                const gapHeight = minutesToPixels(gap);
                segments.push({
                    type: "time",
                    minuteStart: cursor,
                    minuteEnd: itemStart,
                    top: currentTop,
                    height: gapHeight,
                });
                currentTop += gapHeight;
            }
        }

        const duration = Math.max(Number.isInteger(item.duration_minutes) ? item.duration_minutes : 60, 1);
        const eventHeight = Math.min(Math.max(minutesToPixels(duration), 78), MAX_EVENT_HEIGHT);

        segments.push({
            type: "event",
            scheduleId: item.schedule_id,
            minuteStart: itemStart,
            minuteEnd: itemStart + duration,
            top: currentTop,
            height: eventHeight,
        });

        currentTop += eventHeight;
        cursor = itemStart + duration;
    }

    if (cursor < windowEnd) {
        const tailGap = windowEnd - cursor;

        if (tailGap > LARGE_GAP_THRESHOLD_MINUTES) {
            segments.push({
                type: "gap",
                minuteStart: cursor,
                minuteEnd: windowEnd,
                top: currentTop + 10,
                height: COMPRESSED_GAP_HEIGHT,
                label: formatGapLabel(tailGap),
            });
            currentTop += COMPRESSED_GAP_HEIGHT + 20;
        } else {
            const tailHeight = minutesToPixels(tailGap);
            segments.push({
                type: "time",
                minuteStart: cursor,
                minuteEnd: windowEnd,
                top: currentTop,
                height: tailHeight,
            });
            currentTop += tailHeight;
        }
    }

    return {
        windowStart,
        windowEnd,
        totalHeight: Math.max(currentTop, 160),
        segments,
    };
}

function formatDurationLabel(totalMinutes) {
    const safeMinutes = Math.max(1, Number(totalMinutes) || 1);

    if (safeMinutes < 60) {
        return `${safeMinutes} min`;
    }

    const hours = Math.floor(safeMinutes / 60);
    const minutes = safeMinutes % 60;

    if (minutes === 0) {
        return hours === 1 ? "1 hour" : `${hours} hours`;
    }

    return `${hours}h ${minutes}m`;
}

function formatTimeframe(startMinutes, durationMinutes) {
    const safeDuration = Math.max(1, Number(durationMinutes) || 1);
    return `${formatMinutes(startMinutes)} · ${formatMinutes(startMinutes + safeDuration)}`;
}

function getEventDisplayClass(height) {
    return height >= 72 ? "standard" : "pill";
}

function normalizeSchedule(schedule) {
    return {
        ...schedule,
        schedule_id: Number(schedule.schedule_id),
        user_id: Number(schedule.user_id),
        template_id: Number(schedule.template_id),
        start_minutes:
            schedule.start_minutes === null || schedule.start_minutes === undefined
                ? null
                : Number(schedule.start_minutes),
        duration_minutes:
            schedule.duration_minutes === null || schedule.duration_minutes === undefined
                ? 60
                : Number(schedule.duration_minutes),
        specific_date: normalizeDateOnly(schedule.specific_date),
        is_recurring: Boolean(schedule.is_recurring),
    };
}

function formatMinutes(minutes) {
    if (!Number.isInteger(minutes)) {
        return "No time";
    }

    const hours24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = (hours24 % 12) || 12;
    return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

function getMonthRange(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);

    return {
        startDateOnly: formatDateLocal(start),
        endDateOnly: formatDateLocal(end),
    };
}

function sameDateOnly(a, b) {
    return a === b;
}

function formatPrettyDate(dateOnly) {
    const date = new Date(`${dateOnly}T12:00:00`);

    const month = date.toLocaleString(undefined, { month: "long" });
    const day = date.getDate();
    const year = date.getFullYear();

    const suffix =
        day % 10 === 1 && day !== 11 ? "st" :
            day % 10 === 2 && day !== 12 ? "nd" :
                day % 10 === 3 && day !== 13 ? "rd" :
                    "th";

    return `${month} ${day}${suffix}, ${year}`;
}

function getSchedulesForDate(dateOnly) {
    const dateObj = new Date(`${dateOnly}T12:00:00`);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dateObj.getDay()];

    return schedules
        .filter((schedule) => {
            if (schedule.specific_date) {
                return schedule.specific_date === dateOnly;
            }

            return schedule.is_recurring && schedule.day_of_week === weekday;
        })
        .sort((a, b) => {
            const aStart = Number.isInteger(a.start_minutes) ? a.start_minutes : 0;
            const bStart = Number.isInteger(b.start_minutes) ? b.start_minutes : 0;
            return aStart - bStart;
        });
}

function getSelectedSchedule() {
    const items = getSchedulesForDate(selectedDate);
    return items.find((item) => item.schedule_id === selectedScheduleId) ?? null;
}

async function loadTemplates() {
    const response = await fetch(`/api/workouts?user_id=${encodeURIComponent(userId)}`);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not load workout templates.");
    }

    templates = Array.isArray(data.workouts) ? data.workouts : [];
    renderTemplateOptions();
}

function renderTemplateOptions() {
    if (templates.length === 0) {
        templateSelect.innerHTML = `<option value="">No workout templates yet</option>`;
        return;
    }

    templateSelect.innerHTML = templates.map((template) => `
        <option value="${template.template_id}">
            ${escapeHtml(template.title)}
        </option>
    `).join("");
}

async function loadSchedulesForMonth() {
    try {
        setStatus(calendarStatusEl, "Loading calendar...");

        const { startDateOnly, endDateOnly } = getMonthRange(currentMonth);
        const response = await fetch(`/api/schedules?user_id=${encodeURIComponent(userId)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Could not load planned workouts.");
        }

        const allSchedules = Array.isArray(data.schedules) ? data.schedules.map(normalizeSchedule) : [];

        schedules = allSchedules.filter((schedule) => {
            if (schedule.specific_date) {
                return schedule.specific_date >= startDateOnly && schedule.specific_date <= endDateOnly;
            }

            return schedule.is_recurring === true;
        });

        const dayItems = getSchedulesForDate(selectedDate);
        if (!dayItems.some((item) => item.schedule_id === selectedScheduleId)) {
            selectedScheduleId = dayItems[0]?.schedule_id ?? null;
        }

        renderMonth();
        renderSelectedDay();
        setStatus(calendarStatusEl, "");
    } catch (error) {
        setStatus(calendarStatusEl, error.message || "Could not load calendar.", true);
    }
}

function renderMonth() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const gridStart = new Date(year, month, 1 - startWeekday);

    monthTitleEl.textContent = currentMonth.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
    });

    const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map((day) => `<div class="weekday-header">${day}</div>`)
        .join("");

    const cells = [];

    for (let i = 0; i < 42; i += 1) {
        const date = new Date(gridStart);
        date.setDate(gridStart.getDate() + i);

        const dateOnly = formatDateLocal(date);
        const isCurrentMonth = date.getMonth() === month;
        const isActive = sameDateOnly(dateOnly, selectedDate);
        const isToday = sameDateOnly(dateOnly, formatDateLocal(new Date()));
        const items = getSchedulesForDate(dateOnly);

        cells.push(`
            <button
                type="button"
                class="day-cell ${isCurrentMonth ? "" : "other-month"} ${isActive ? "active" : ""} ${isToday ? "today" : ""}"                data-date="${dateOnly}"
            >
                <div class="day-cell-number">${date.getDate()}</div>
                <div class="day-pill-list">
                    ${items.slice(0, 3).map((item) => `
                        <div class="day-pill">${escapeHtml(item.title)}</div>
                    `).join("")}
                    ${items.length > 3 ? `<div class="day-pill">+${items.length - 3} more</div>` : ""}
                </div>
            </button>
        `);
    }

    monthGridEl.innerHTML = weekdayHeaders + cells.join("");
}

function renderSelectedWorkoutDetail() {
    const schedule = getSelectedSchedule();

    if (!schedule) {
        selectedWorkoutDetailEl.innerHTML = `<div class="empty-state">Click a workout in the day summary or timeline.</div>`;
        return;
    }

    const template = templates.find((item) => Number(item.template_id) === Number(schedule.template_id));
    const exercises = Array.isArray(template?.exercises) ? template.exercises : [];

    selectedWorkoutDetailEl.innerHTML = `
        <div>
            <strong>${escapeHtml(schedule.title)}</strong><br>
            <span>${formatMinutes(schedule.start_minutes)} · ${schedule.duration_minutes} min</span>
        </div>

        <div style="margin-top:10px; color:#c7a8a9; white-space:pre-wrap;">
            ${escapeHtml(schedule.notes || "No notes.")}
        </div>

        <div style="margin-top:14px;">
            <strong>Exercises</strong>
            ${
        exercises.length === 0
            ? `<div class="empty-state">No exercises in this workout template.</div>`
            : `
                        <ul class="exercise-preview" style="margin-top:10px;">
                            ${exercises.map((exercise) => `
                                <li>
                                    <strong>${escapeHtml(exercise.exercise_name)}</strong>
                                    — ${exercise.sets} sets x ${exercise.reps} reps
                                    ${exercise.weight_lbs ? ` @ ${exercise.weight_lbs} lbs` : ""}
                                    ${exercise.notes ? `<br><span style="color:#c7a8a9;">${escapeHtml(exercise.notes)}</span>` : ""}
                                </li>
                            `).join("")}
                        </ul>
                    `
    }
        </div>

        <div class="selected-workout-actions">
            <button type="button" class="btn-danger" id="delete-selected-schedule-btn">
                Delete Planned Workout
            </button>
        </div>
    `;
}

function buildTimelineColumns(items) {
    const columns = [];

    return items.map((item) => {
        const start = Number.isInteger(item.start_minutes) ? item.start_minutes : 0;
        const end = start + (item.duration_minutes || 60);

        let colIndex = 0;
        while (true) {
            if (!columns[colIndex] || columns[colIndex] <= start) {
                columns[colIndex] = end;
                return { ...item, _colIndex: colIndex, _colCount: 1 };
            }
            colIndex += 1;
        }
    }).map((item, _, arr) => {
        const overlapping = arr.filter((other) => {
            const aStart = Number.isInteger(item.start_minutes) ? item.start_minutes : 0;
            const aEnd = aStart + (item.duration_minutes || 60);
            const bStart = Number.isInteger(other.start_minutes) ? other.start_minutes : 0;
            const bEnd = bStart + (other.duration_minutes || 60);
            return aStart < bEnd && bStart < aEnd;
        });

        const colCount = Math.max(...overlapping.map((x) => x._colIndex)) + 1;
        return { ...item, _colCount: colCount };
    });
}

function renderSelectedDay() {
    const items = getSchedulesForDate(selectedDate);
    dayDetailTitleEl.textContent = `Day Detail — ${formatPrettyDate(selectedDate)}`;

    if (items.length === 0) {
        selectedDaySummaryEl.innerHTML = `<div class="empty-state">No planned workouts for this day.</div>`;
        dayDetailShellEl.innerHTML = `<div class="empty-state">No planned workouts for this day.</div>`;
        selectedWorkoutDetailEl.innerHTML = `<div class="empty-state">Click a workout in the day summary or timeline.</div>`;
        return;
    }

    if (!items.some((item) => item.schedule_id === selectedScheduleId)) {
        selectedScheduleId = items[0].schedule_id;
    }

    selectedDaySummaryEl.innerHTML = items.map((item) => `
        <div class="summary-item ${item.schedule_id === selectedScheduleId ? "active" : ""}" data-schedule-id="${item.schedule_id}">
            <strong>${escapeHtml(item.title)}</strong><br>
            <span>${formatMinutes(item.start_minutes)} · ${item.duration_minutes} min</span>
        </div>
    `).join("");

    const previousScrollTop = preserveTimelineScroll();

    const layout = buildCompressedTimelineLayout(items);
    const timelineHeight = layout.totalHeight;

    const timeLabels = [];
    const gridLines = [];
    const gapMarkers = [];

    for (const segment of layout.segments) {
        if (segment.type === "time") {
            for (let minute = segment.minuteStart; minute <= segment.minuteEnd; minute += 10) {
                const offset = segment.top + minutesToPixels(minute - segment.minuteStart);

                timeLabels.push(`
                    <div class="time-label" style="top:${offset}px;">
                        ${formatMinutes(minute)}
                    </div>
                `);

                gridLines.push(`
                    <div class="hour-line" style="top:${offset}px;"></div>
                `);
            }
        }

        if (segment.type === "gap") {
            gapMarkers.push(`
                <div class="gap-marker" style="top:${segment.top}px;">
                    ...
                </div>
            `);

            timeLabels.push(`
                <div class="time-label gap-time-label" style="top:${segment.top + (segment.height / 2)}px;">
                    ...
                </div>
            `);

            timeLabels.push(`
                <div class="time-label" style="top:${segment.top}px;">
                    ${formatMinutes(segment.minuteStart)}
                </div>
            `);

            timeLabels.push(`
                <div class="time-label" style="top:${segment.top + segment.height}px;">
                    ${formatMinutes(segment.minuteEnd)}
                </div>
            `);
        }
    }

    const positioned = buildTimelineColumns(items);

    const blocks = positioned.map((item) => {
        const segment = layout.segments.find(
            (part) => part.type === "event" && part.scheduleId === item.schedule_id
        );

        if (!segment) {
            return "";
        }

        const height = segment.height;
        const displayClass = getEventDisplayClass(height);

        const widthPct = 100 / item._colCount;
        const leftCalc = `calc(${item._colIndex * widthPct}% + 8px)`;
        const rightCalc = `calc(${(item._colCount - item._colIndex - 1) * widthPct}% + 8px)`;

        return `
            <div
                class="event-block ${displayClass} ${item.schedule_id === selectedScheduleId ? "active" : ""}"
                data-schedule-id="${item.schedule_id}"
                style="top:${segment.top}px; height:${height}px; left:${leftCalc}; right:${rightCalc};"
                title="${escapeHtml(item.title)} — ${formatDurationLabel(item.duration_minutes)} — ${formatTimeframe(item.start_minutes, item.duration_minutes)}"
            >
                <div class="timeline-event-content">
                    <div class="event-title">${escapeHtml(item.title)}</div>
                    <div class="timeline-event-duration">${escapeHtml(formatDurationLabel(item.duration_minutes))}</div>
                    <div class="timeline-event-timeframe">${escapeHtml(formatTimeframe(item.start_minutes, item.duration_minutes))}</div>
                </div>
            </div>
        `;
    }).join("");

    dayDetailShellEl.innerHTML = `
        <div class="timeline-shell">
            <div class="time-labels" style="height:${timelineHeight}px;">
                ${timeLabels.join("")}
            </div>
            <div class="time-lane" style="height:${timelineHeight}px;">
                ${gridLines.join("")}
                ${gapMarkers.join("")}
                ${blocks}
            </div>
        </div>
        <div class="timeline-note">
            Timeline uses 10-minute scale. Gaps longer than 2 hours are compressed.
        </div>
    `;

    restoreTimelineScroll(previousScrollTop);

    renderSelectedWorkoutDetail();
}

async function saveSchedule(payload) {
    const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_id: userId,
            ...payload,
        }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not save planned workout.");
    }

    return data.schedules;
}

async function deleteSchedule(scheduleId) {
    const response = await fetch(`/api/schedules/${scheduleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Could not delete planned workout.");
    }

    return data;
}

function resetForm() {
    specificDateInput.value = selectedDate;
    specificDateInput.min = formatDateLocal(new Date());
    startTimeInput.value = "17:00";
    durationMinutesInput.value = "60";
    isRecurringInput.checked = false;
    setStatus(msgEl, "");
}
if (!window.__GYMSYNC_READONLY_PROFILE__) {
    scheduleForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const template_id = Number(templateSelect.value);
        const specific_date = specificDateInput.value;
        const start_time = startTimeInput.value;
        const duration_minutes = Number(durationMinutesInput.value);
        const is_recurring = Boolean(isRecurringInput.checked);

        if (!template_id) {
            setStatus(msgEl, "Select a workout template.", true);
            return;
        }

        if (!specific_date) {
            setStatus(msgEl, "Select a specific date.", true);
            return;
        }

        if (isBeforeToday(specific_date)) {
            setStatus(msgEl, "You cannot plan workouts before today.", true);
            return;
        }

        try {
            setStatus(msgEl, "Saving planned workout...");

            const saved = await saveSchedule({
                template_id,
                specific_date,
                start_time,
                duration_minutes,
                is_recurring,
            });

            selectedDate = specific_date;
            selectedScheduleId = saved?.[0]?.schedule_id ?? null;

            const selectedDateObj = new Date(`${specific_date}T12:00:00`);
            currentMonth = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);

            await loadSchedulesForMonth();
            setStatus(msgEl, "Planned workout saved.");
        } catch (error) {
            setStatus(msgEl, error.message || "Could not save planned workout.", true);
        }
    });

    monthGridEl.addEventListener("click", (event) => {
        const button = event.target.closest(".day-cell");
        if (!button) return;

        selectedDate = button.dataset.date;
        specificDateInput.value = selectedDate;
        specificDateInput.min = formatDateLocal(new Date());

        const items = getSchedulesForDate(selectedDate);
        selectedScheduleId = items[0]?.schedule_id ?? null;

        renderMonth();
        renderSelectedDay();
    });

    selectedDaySummaryEl.addEventListener("click", (event) => {
        const item = event.target.closest("[data-schedule-id]");
        if (!item) return;

        selectedScheduleId = Number(item.dataset.scheduleId);
        renderSelectedDay();
    });

    dayDetailShellEl.addEventListener("click", (event) => {
        const item = event.target.closest("[data-schedule-id]");
        if (!item) return;

        selectedScheduleId = Number(item.dataset.scheduleId);
        renderSelectedDay();
    });

    selectedWorkoutDetailEl.addEventListener("click", async (event) => {
        if (event.target.id !== "delete-selected-schedule-btn") return;
        if (!selectedScheduleId) return;

        const schedule = getSelectedSchedule();
        const ok = confirm(`Delete "${schedule?.title || "this planned workout"}"?`);
        if (!ok) return;

        try {
            setStatus(msgEl, "Deleting planned workout...");
            await deleteSchedule(selectedScheduleId);

            selectedScheduleId = null;
            await loadSchedulesForMonth();
            setStatus(msgEl, "Planned workout deleted.");
        } catch (error) {
            setStatus(msgEl, error.message || "Could not delete planned workout.", true);
        }
    });

    prevMonthBtn.addEventListener("click", async () => {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
        await loadSchedulesForMonth();
    });

    nextMonthBtn.addEventListener("click", async () => {
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
        await loadSchedulesForMonth();
    });

    clearBtn?.addEventListener("click", resetForm);

    logoutLink?.addEventListener("click", () => {
        localStorage.removeItem("gymsync_user_id");
        localStorage.removeItem("gymsync_username");
    });

    requireAuth();
    if (specificDateInput) specificDateInput.value = selectedDate;

    Promise.all([loadTemplates(), loadSchedulesForMonth()])
        .then(() => {
            resetForm();
        })
        .catch((error) => {
            setStatus(calendarStatusEl, error.message || "Could not initialize planner.", true);
        });
}