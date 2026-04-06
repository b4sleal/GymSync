const db = require("../config/db");
const {
    ValidationError,
    dayOfWeekForDate,
    normalizeDayOfWeek,
    optionalDateOnly,
    parseRequestUserId,
    requirePositiveInteger,
    todayDateOnly,
    validationMessage,
} = require("../utils/validation");

const scheduleSelect = `
    SELECT
        s.schedule_id,
        s.user_id,
        s.template_id,
        s.day_of_week,
        s.specific_date,
        s.is_recurring,
        s.start_minutes,
        s.duration_minutes,
        s.created_at,
        wt.title,
        wt.notes
    FROM Schedules s
             JOIN WorkoutTemplates wt ON wt.template_id = s.template_id
`;

async function ensureUserExists(client, userId) {
    const result = await client.query("SELECT user_id FROM Users WHERE user_id = $1", [userId]);
    if (result.rowCount === 0) {
        throw new ValidationError("user_id does not exist.");
    }
}

async function ensureTemplateOwnership(client, templateId, userId) {
    const result = await client.query(
        `
            SELECT template_id, user_id, title
            FROM WorkoutTemplates
            WHERE template_id = $1
        `,
        [templateId]
    );

    if (result.rowCount === 0) {
        throw new ValidationError("template_id does not exist.");
    }

    if (result.rows[0].user_id !== userId) {
        throw new ValidationError("template_id does not belong to the provided user_id.");
    }

    return result.rows[0];
}

async function getScheduleById(client, scheduleId) {
    const result = await client.query(
        `
        ${scheduleSelect}
        WHERE s.schedule_id = $1
        `,
        [scheduleId]
    );

    return result.rows[0] ?? null;
}

function effectiveRange(schedule) {
    const start = Number.isInteger(schedule.start_minutes) ? schedule.start_minutes : 0;
    const duration = Number.isInteger(schedule.duration_minutes) ? schedule.duration_minutes : 60;
    return {
        start,
        end: start + duration,
    };
}

function schedulesOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
}

async function ensureNoScheduleConflict(
    client,
    {
        userId,
        scheduleIdToIgnore = null,
        dayOfWeek = null,
        specificDate = null,
        startMinutes,
        durationMinutes,
    }
) {
    if (!Number.isInteger(startMinutes)) {
        return;
    }

    const newRange = {
        start: startMinutes,
        end: startMinutes + durationMinutes,
    };

    const result = await client.query(
        `
        SELECT
            s.schedule_id,
            s.day_of_week,
            s.specific_date,
            s.is_recurring,
            s.start_minutes,
            s.duration_minutes,
            wt.title
        FROM Schedules s
        JOIN WorkoutTemplates wt ON wt.template_id = s.template_id
        WHERE s.user_id = $1
          AND ($2::int IS NULL OR s.schedule_id <> $2)
          AND (
                ($3::date IS NOT NULL AND s.specific_date = $3::date)
                OR
                ($4::text IS NOT NULL AND (
                    (s.specific_date IS NULL AND s.day_of_week = $4)
                    OR
                    (s.specific_date IS NOT NULL AND TO_CHAR(s.specific_date, 'Dy') = $4)
                ))
              )
        `,
        [userId, scheduleIdToIgnore, specificDate, dayOfWeek]
    );

    for (const row of result.rows) {
        const existingRange = effectiveRange(row);

        if (schedulesOverlap(newRange, existingRange)) {
            throw new ValidationError(
                `This workout overlaps with "${row.title}" (${formatMinutesForError(existingRange.start)} - ${formatMinutesForError(existingRange.end)}).`
            );
        }
    }
}

function formatMinutesForError(totalMinutes) {
    const safeMinutes = Math.max(0, totalMinutes);
    const hours24 = Math.floor(safeMinutes / 60) % 24;
    const minutes = safeMinutes % 60;
    const suffix = hours24 >= 12 ? "PM" : "AM";
    const hours12 = (hours24 % 12) || 12;
    return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function parseScheduleInput(body, { requireTemplateId = true, allowNoDateFields = false } = {}) {
    const templateIdValue = body.template_id ?? body.templateId;
    const days = Array.isArray(body.days) ? body.days : null;
    const dayOfWeekRaw = body.day_of_week ?? body.dayOfWeek;
    const specificDate = optionalDateOnly(body.specific_date ?? body.specificDate);

    let normalizedDays = [];
    if (days) {
        if (days.length === 0) {
            throw new ValidationError("days must contain at least one day.");
        }

        normalizedDays = [...new Set(days.map((day) => normalizeDayOfWeek(day, "days")))];
    } else if (dayOfWeekRaw !== undefined && dayOfWeekRaw !== null && dayOfWeekRaw !== "") {
        normalizedDays = [normalizeDayOfWeek(dayOfWeekRaw)];
    }

    if (!allowNoDateFields && normalizedDays.length === 0 && !specificDate) {
        throw new ValidationError("Provide day_of_week, days, or specific_date.");
    }

    const isRecurringRaw = body.is_recurring ?? body.isRecurring;
    const isRecurring =
        isRecurringRaw === undefined || isRecurringRaw === null || isRecurringRaw === ""
            ? allowNoDateFields
                ? undefined
                : specificDate
                    ? false
                    : true
            : typeof isRecurringRaw === "boolean"
                ? isRecurringRaw
                : isRecurringRaw === "true"
                    ? true
                    : isRecurringRaw === "false"
                        ? false
                        : specificDate
                            ? false
                            : true;

    const startMinutes =
        body.start_minutes !== undefined || body.startMinutes !== undefined
            ? optionalStartMinutes(body.start_minutes ?? body.startMinutes)
            : parseTimeToMinutes(body.start_time ?? body.startTime);

    const durationMinutes =
        body.duration_minutes !== undefined || body.durationMinutes !== undefined
            ? (requirePositiveInteger(body.duration_minutes ?? body.durationMinutes, "duration_minutes"))
            : body.duration !== undefined
                ? requirePositiveInteger(body.duration, "duration_minutes")
                : allowNoDateFields
                    ? undefined
                    : 60;

    return {
        templateId: requireTemplateId
            ? requirePositiveInteger(templateIdValue, "template_id")
            : templateIdValue === undefined || templateIdValue === null || templateIdValue === ""
                ? null
                : requirePositiveInteger(templateIdValue, "template_id"),
        normalizedDays,
        specificDate,
        isRecurring,
        startMinutes,
        durationMinutes,
    };
}

function optionalStartMinutes(value, fieldName = "start_minutes") {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1439) {
        throw new ValidationError(`${fieldName} must be an integer between 0 and 1439.`);
    }

    return parsed;
}

function parseTimeToMinutes(value, fieldName = "start_time") {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value.trim())) {
        throw new ValidationError(`${fieldName} must use HH:MM format.`);
    }

    const [hours, minutes] = value.trim().split(":").map(Number);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes) ||
        hours < 0 ||
        hours > 23 ||
        minutes < 0 ||
        minutes > 59
    ) {
        throw new ValidationError(`${fieldName} must use valid HH:MM 24-hour time.`);
    }

    return (hours * 60) + minutes;
}

exports.listSchedules = async (req, res) => {
    try {
        const userId = parseRequestUserId(req);
        const dayFilter = req.query.day_of_week ? normalizeDayOfWeek(req.query.day_of_week) : null;
        const dateFilter = optionalDateOnly(req.query.specific_date);

        const result = await db.query(
            `
            ${scheduleSelect}
            WHERE s.user_id = $1
              AND ($2::text IS NULL OR s.day_of_week = $2)
              AND ($3::date IS NULL OR s.specific_date = $3)
            ORDER BY COALESCE(s.specific_date, CURRENT_DATE), s.day_of_week NULLS LAST, s.created_at DESC
            `,
            [userId, dayFilter, dateFilter]
        );

        res.json({ schedules: result.rows });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while listing schedules."),
        });
    }
};

exports.getTodaySchedule = async (req, res) => {
    try {
        const userId = requirePositiveInteger(req.params.userId, "user_id");
        const date = optionalDateOnly(req.query.date, "date") ?? todayDateOnly();
        const dayOfWeek = dayOfWeekForDate(date);

        const result = await db.query(
            `
                SELECT
                    s.schedule_id,
                    s.user_id,
                    s.template_id,
                    s.day_of_week,
                    s.specific_date,
                    s.is_recurring,
                    s.created_at,
                    wt.title,
                    wt.notes,
                    EXISTS (
                        SELECT 1
                        FROM Logs l
                        WHERE l.user_id = s.user_id
                          AND l.schedule_id = s.schedule_id
                          AND l.date_completed = $2::date
                    ) AS completed
                FROM Schedules s
                         JOIN WorkoutTemplates wt ON wt.template_id = s.template_id
                WHERE s.user_id = $1
                  AND (
                    s.specific_date = $2::date
                    OR (s.specific_date IS NULL AND s.day_of_week = $3)
                    )
                ORDER BY s.created_at ASC
            `,
            [userId, date, dayOfWeek]
        );

        res.json({
            date,
            day_of_week: dayOfWeek,
            schedules: result.rows,
        });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading today's schedule."),
        });
    }
};

exports.listRecentLogs = async (req, res) => {
    try {
        const userId = requirePositiveInteger(req.params.userId, "user_id");
        const limit = Number(req.query.limit ?? 5);
        const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 20 ? limit : 5;

        const result = await db.query(
            `
                SELECT
                    l.log_id,
                    l.user_id,
                    l.template_id,
                    l.date_completed,
                    l.created_at,
                    wt.title
                FROM Logs l
                         LEFT JOIN WorkoutTemplates wt ON wt.template_id = l.template_id
                WHERE l.user_id = $1
                ORDER BY l.date_completed DESC, l.created_at DESC
                    LIMIT $2
            `,
            [userId, safeLimit]
        );

        res.json({ logs: result.rows });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading recent logs."),
        });
    }
};

exports.createSchedule = async (req, res) => {
    const client = await db.connect();

    try {
        const userId = parseRequestUserId(req);
        const {
            templateId,
            normalizedDays,
            specificDate,
            isRecurring,
            startMinutes,
            durationMinutes,
        } = parseScheduleInput(req.body);

        await client.query("BEGIN");
        await ensureUserExists(client, userId);
        await ensureTemplateOwnership(client, templateId, userId);

        const createdSchedules = [];

        if (normalizedDays.length > 0) {
            for (const day of normalizedDays) {
                await ensureNoScheduleConflict(client, {
                    userId,
                    dayOfWeek: day,
                    specificDate,
                    startMinutes,
                    durationMinutes,
                });

                const result = await client.query(
                    `
                        INSERT INTO Schedules (
                            user_id,
                            template_id,
                            day_of_week,
                            specific_date,
                            is_recurring,
                            start_minutes,
                            duration_minutes
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                            RETURNING
                            schedule_id,
                            user_id,
                            template_id,
                            day_of_week,
                            specific_date,
                            is_recurring,
                            start_minutes,
                            duration_minutes,
                            created_at
                    `,
                    [userId, templateId, day, specificDate, isRecurring, startMinutes, durationMinutes]
                );
                createdSchedules.push(result.rows[0]);
            }
        } else {
            const derivedDayOfWeek = specificDate ? dayOfWeekForDate(specificDate) : null;

            const finalDayOfWeek = isRecurring ? derivedDayOfWeek : null;
            const finalSpecificDate = isRecurring ? null : specificDate;

            await ensureNoScheduleConflict(client, {
                userId,
                dayOfWeek: finalDayOfWeek,
                specificDate: finalSpecificDate,
                startMinutes,
                durationMinutes,
            });

            const result = await client.query(
                `
                    INSERT INTO Schedules (
                        user_id,
                        template_id,
                        day_of_week,
                        specific_date,
                        is_recurring,
                        start_minutes,
                        duration_minutes
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING
                        schedule_id,
                        user_id,
                        template_id,
                        day_of_week,
                        specific_date,
                        is_recurring,
                        start_minutes,
                        duration_minutes,
                        created_at
                `,
                [
                    userId,
                    templateId,
                    finalDayOfWeek,
                    finalSpecificDate,
                    isRecurring,
                    startMinutes,
                    durationMinutes,
                ]
            );
            createdSchedules.push(result.rows[0]);
        }

        await client.query("COMMIT");
        res.status(201).json({ schedules: createdSchedules });
    } catch (error) {
        await client.query("ROLLBACK");
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while creating schedules."),
        });
    } finally {
        client.release();
    }
};

exports.updateSchedule = async (req, res) => {
    const client = await db.connect();

    try {
        const scheduleId = requirePositiveInteger(req.params.scheduleId, "scheduleId");
        const schedule = await getScheduleById(client, scheduleId);

        if (!schedule) {
            throw new ValidationError("scheduleId does not exist.");
        }

        const providedUserId = parseRequestUserId(req, { required: false });
        if (providedUserId !== null && providedUserId !== schedule.user_id) {
            throw new ValidationError("user_id does not match this schedule.");
        }

        const {
            templateId,
            normalizedDays,
            specificDate,
            isRecurring,
            startMinutes,
            durationMinutes,
        } = parseScheduleInput(req.body, {
            requireTemplateId: false,
            allowNoDateFields: true,
        });

        if (normalizedDays.length > 1) {
            throw new ValidationError("Use a single day_of_week when updating an existing schedule.");
        }

        await client.query("BEGIN");

        const nextTemplateId = templateId ?? schedule.template_id;
        await ensureTemplateOwnership(client, nextTemplateId, schedule.user_id);

        const nextIsRecurring = isRecurring !== undefined ? isRecurring : schedule.is_recurring;
        const candidateSpecificDate = specificDate ?? schedule.specific_date;
        const candidateDayOfWeek =
            normalizedDays[0] ??
            schedule.day_of_week ??
            (candidateSpecificDate ? dayOfWeekForDate(String(candidateSpecificDate).slice(0, 10)) : null);

        const nextDayOfWeek = nextIsRecurring ? candidateDayOfWeek : null;
        const nextSpecificDate = nextIsRecurring ? null : candidateSpecificDate;
        const nextStartMinutes = startMinutes !== undefined ? startMinutes : schedule.start_minutes;
        const nextDurationMinutes = durationMinutes !== undefined ? durationMinutes : schedule.duration_minutes;

        await ensureNoScheduleConflict(client, {
            userId: schedule.user_id,
            scheduleIdToIgnore: scheduleId,
            dayOfWeek: nextDayOfWeek,
            specificDate: nextSpecificDate,
            startMinutes: nextStartMinutes,
            durationMinutes: nextDurationMinutes,
        });

        const updated = await client.query(
            `
                UPDATE Schedules
                SET template_id = $1,
                    day_of_week = $2,
                    specific_date = $3,
                    is_recurring = $4,
                    start_minutes = $5,
                    duration_minutes = $6
                WHERE schedule_id = $7
                    RETURNING
                schedule_id,
                user_id,
                template_id,
                day_of_week,
                specific_date,
                is_recurring,
                start_minutes,
                duration_minutes,
                created_at
            `,
            [
                nextTemplateId,
                nextDayOfWeek,
                nextSpecificDate,
                nextIsRecurring,
                nextStartMinutes,
                nextDurationMinutes,
                scheduleId,
            ]
        );

        await client.query("COMMIT");
        res.json({ schedule: updated.rows[0] });
    } catch (error) {
        await client.query("ROLLBACK");
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while updating the schedule."),
        });
    } finally {
        client.release();
    }
};

exports.completeSchedule = async (req, res) => {
    const client = await db.connect();

    try {
        const scheduleId = requirePositiveInteger(req.params.scheduleId, "scheduleId");
        const schedule = await getScheduleById(client, scheduleId);

        if (!schedule) {
            throw new ValidationError("scheduleId does not exist.");
        }

        const explicitCompletionDate =
            optionalDateOnly(req.body?.date_completed ?? req.query?.date_completed, "date_completed");

        let scheduleSpecificDate = null;
        if (schedule.specific_date) {
            const raw = schedule.specific_date;

            if (typeof raw === "string") {
                scheduleSpecificDate = raw.slice(0, 10);
            } else if (raw instanceof Date) {
                const year = raw.getFullYear();
                const month = String(raw.getMonth() + 1).padStart(2, "0");
                const day = String(raw.getDate()).padStart(2, "0");
                scheduleSpecificDate = `${year}-${month}-${day}`;
            } else {
                scheduleSpecificDate = String(raw).slice(0, 10);
            }
        }

        const completionDate =
            explicitCompletionDate ??
            scheduleSpecificDate ??
            todayDateOnly();

        optionalDateOnly(completionDate, "date_completed");

        await client.query("BEGIN");

        const existingLog = await client.query(
            `
                SELECT log_id, user_id, schedule_id, template_id, date_completed, created_at
                FROM Logs
                WHERE user_id = $1
                  AND schedule_id = $2
                  AND date_completed = $3::date
            `,
            [schedule.user_id, schedule.schedule_id, completionDate]
        );

        let log;
        if (existingLog.rowCount > 0) {
            log = existingLog.rows[0];
        } else {
            const inserted = await client.query(
                `
                    INSERT INTO Logs (user_id, schedule_id, template_id, date_completed)
                    VALUES ($1, $2, $3, $4::date)
                        RETURNING log_id, user_id, schedule_id, template_id, date_completed, created_at
                `,
                [schedule.user_id, schedule.schedule_id, schedule.template_id, completionDate]
            );
            log = inserted.rows[0];
        }

        const statsResult = await client.query(
            `
            SELECT user_id, current_streak, longest_streak, last_completed_date
            FROM UserStats
            WHERE user_id = $1
            `,
            [schedule.user_id]
        );

        const completionDateObj = new Date(`${completionDate}T12:00:00`);
        const yesterdayObj = new Date(completionDateObj);
        yesterdayObj.setDate(yesterdayObj.getDate() - 1);
        const yesterdayDateOnly = yesterdayObj.toISOString().slice(0, 10);

        if (statsResult.rowCount === 0) {
            await client.query(
                `
                INSERT INTO UserStats (
                    user_id,
                    current_streak,
                    longest_streak,
                    last_completed_date,
                    updated_at
                )
                VALUES ($1, 1, 1, $2::date, CURRENT_TIMESTAMP)
                `,
                [schedule.user_id, completionDate]
            );
        } else {
            const stats = statsResult.rows[0];
            const lastCompleted =
                stats.last_completed_date
                    ? String(stats.last_completed_date).slice(0, 10)
                    : null;

            if (lastCompleted !== completionDate) {
                const nextStreak =
                    lastCompleted === yesterdayDateOnly
                        ? Number(stats.current_streak || 0) + 1
                        : 1;

                const nextLongest = Math.max(Number(stats.longest_streak || 0), nextStreak);

                await client.query(
                    `
                    UPDATE UserStats
                    SET current_streak = $1,
                        longest_streak = $2,
                        last_completed_date = $3::date,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = $4
                    `,
                    [nextStreak, nextLongest, completionDate, schedule.user_id]
                );
            }
        }

        await client.query("COMMIT");
        res.json({
            message: "Workout marked complete.",
            schedule_id: scheduleId,
            log,
        });
    } catch (error) {
        console.error(error)
        await client.query("ROLLBACK");
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while marking the workout complete."),
        });
    } finally {
        client.release();
    }
};

exports.deleteSchedule = async (req, res) => {
    try {
        const scheduleId = requirePositiveInteger(req.params.scheduleId, "scheduleId");
        const userId = parseRequestUserId(req);

        const existing = await getScheduleById(db, scheduleId);

        if (!existing) {
            throw new ValidationError("scheduleId does not exist.");
        }

        if (existing.user_id !== userId) {
            throw new ValidationError("scheduleId does not belong to the provided user_id.");
        }

        await db.query(
            `
            DELETE FROM Schedules
            WHERE schedule_id = $1
            `,
            [scheduleId]
        );

        res.json({
            message: "Schedule deleted successfully.",
            schedule_id: scheduleId,
        });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while deleting the schedule."),
        });
    }
};

exports.getDashboardData = async (req, res) => {
    try {
        const userId = requirePositiveInteger(req.params.userId, "user_id");
        const date = optionalDateOnly(req.query.date, "date") ?? todayDateOnly();
        const dayOfWeek = dayOfWeekForDate(date);

        const todayResult = await db.query(
            `
            SELECT
                s.schedule_id,
                s.user_id,
                s.template_id,
                s.day_of_week,
                s.specific_date,
                s.is_recurring,
                s.start_minutes,
                s.duration_minutes,
                wt.title,
                wt.notes,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'template_exercise_id', te.template_exercise_id,
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
                ) AS exercises,
                EXISTS (
                    SELECT 1
                    FROM Logs l
                    WHERE l.user_id = s.user_id
                      AND l.schedule_id = s.schedule_id
                      AND l.date_completed = $2::date
                ) AS completed
            FROM Schedules s
            JOIN WorkoutTemplates wt ON wt.template_id = s.template_id
            LEFT JOIN TemplateExercises te ON te.template_id = wt.template_id
            WHERE s.user_id = $1
              AND (
                    s.specific_date = $2::date
                    OR (s.specific_date IS NULL AND s.day_of_week = $3)
                  )
            GROUP BY
                s.schedule_id,
                s.user_id,
                s.template_id,
                s.day_of_week,
                s.specific_date,
                s.is_recurring,
                s.start_minutes,
                s.duration_minutes,
                wt.title,
                wt.notes
            ORDER BY s.start_minutes ASC NULLS LAST, s.created_at ASC
            `,
            [userId, date, dayOfWeek]
        );

        const logsResult = await db.query(
            `
            SELECT
                l.log_id,
                l.template_id,
                l.date_completed,
                l.created_at,
                wt.title
            FROM Logs l
            LEFT JOIN WorkoutTemplates wt ON wt.template_id = l.template_id
            WHERE l.user_id = $1
            ORDER BY l.date_completed DESC, l.created_at DESC
            LIMIT 10
            `,
            [userId]
        );

        const statsResult = await db.query(
            `
            SELECT current_streak, longest_streak, last_completed_date
            FROM UserStats
            WHERE user_id = $1
            `,
            [userId]
        );

        res.json({
            date,
            today_plan: todayResult.rows,
            recent_logs: logsResult.rows,
            stats: statsResult.rows[0] ?? {
                current_streak: 0,
                longest_streak: 0,
                last_completed_date: null,
            },
        });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading dashboard data."),
        });
    }
};