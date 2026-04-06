class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
        this.statusCode = 400;
    }
}

const DAY_MAP = {
    mon: "Mon",
    monday: "Mon",
    tue: "Tue",
    tues: "Tue",
    tuesday: "Tue",
    wed: "Wed",
    wednesday: "Wed",
    thu: "Thu",
    thur: "Thu",
    thurs: "Thu",
    thursday: "Thu",
    fri: "Fri",
    friday: "Fri",
    sat: "Sat",
    saturday: "Sat",
    sun: "Sun",
    sunday: "Sun",
};

function requireString(value, fieldName, { maxLength = 255 } = {}) {
    if (typeof value !== "string") {
        throw new ValidationError(`${fieldName} is required.`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
        throw new ValidationError(`${fieldName} is required.`);
    }

    if (trimmed.length > maxLength) {
        throw new ValidationError(`${fieldName} must be ${maxLength} characters or fewer.`);
    }

    return trimmed;
}

function optionalString(value, fieldName, { maxLength = 2000 } = {}) {
    if (value === undefined || value === null) {
        return null;
    }

    if (typeof value !== "string") {
        throw new ValidationError(`${fieldName} must be a string.`);
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    if (trimmed.length > maxLength) {
        throw new ValidationError(`${fieldName} must be ${maxLength} characters or fewer.`);
    }

    return trimmed;
}

function requirePositiveInteger(value, fieldName) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ValidationError(`${fieldName} must be a positive integer.`);
    }

    return parsed;
}

function optionalPositiveInteger(value, fieldName) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return requirePositiveInteger(value, fieldName);
}

function requireEmail(value, fieldName = "email") {
    const email = requireString(value, fieldName, { maxLength: 255 }).toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email)) {
        throw new ValidationError(`${fieldName} must be a valid email address.`);
    }

    return email;
}

function parseRequestUserId(req, { required = true } = {}) {
    const rawValue =
        req.body?.user_id ??
        req.body?.userId ??
        req.query?.user_id ??
        req.query?.userId ??
        req.params?.userId;

    if (!required && (rawValue === undefined || rawValue === null || rawValue === "")) {
        return null;
    }

    return requirePositiveInteger(rawValue, "user_id");
}

function normalizeDayOfWeek(value, fieldName = "day_of_week") {
    const day = requireString(value, fieldName, { maxLength: 15 }).toLowerCase();
    const normalized = DAY_MAP[day];

    if (!normalized) {
        throw new ValidationError(`${fieldName} must be a valid day of the week.`);
    }

    return normalized;
}

function optionalDateOnly(value, fieldName = "specific_date") {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        throw new ValidationError(`${fieldName} must use YYYY-MM-DD format.`);
    }

    return value.trim();
}

function todayDateOnly() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function dayOfWeekForDate(dateOnly) {
    const [year, month, day] = dateOnly.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function normalizeExercises(exercises) {
    if (exercises === undefined || exercises === null) {
        return [];
    }

    if (!Array.isArray(exercises)) {
        throw new ValidationError("exercises must be an array.");
    }

    return exercises.map((exercise, index) => {
        if (!exercise || typeof exercise !== "object" || Array.isArray(exercise)) {
            throw new ValidationError(`exercises[${index}] must be an object.`);
        }

        return {
            exercise_name: requireString(
                exercise.exercise_name ?? exercise.name ?? exercise.title,
                `exercises[${index}].exercise_name`,
                { maxLength: 100 }
            ),
            sets: optionalPositiveInteger(exercise.sets, `exercises[${index}].sets`) ?? 3,
            reps: optionalPositiveInteger(exercise.reps, `exercises[${index}].reps`) ?? 10,
            weight_lbs: optionalPositiveInteger(
                exercise.weight_lbs ?? exercise.weight,
                `exercises[${index}].weight_lbs`
            ),
            notes: optionalString(exercise.notes, `exercises[${index}].notes`, { maxLength: 1000 }),
        };
    });
}

function validationMessage(error, fallbackMessage) {
    if (error instanceof ValidationError) {
        return error.message;
    }

    return fallbackMessage;
}

module.exports = {
    ValidationError,
    dayOfWeekForDate,
    normalizeDayOfWeek,
    normalizeExercises,
    optionalDateOnly,
    optionalPositiveInteger,
    optionalString,
    parseRequestUserId,
    requireEmail,
    requirePositiveInteger,
    requireString,
    todayDateOnly,
    validationMessage,
};
