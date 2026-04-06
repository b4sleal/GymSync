const {
    ValidationError,
    requireString,
    validationMessage,
} = require("../utils/validation");

function normalizeHistory(history) {
    if (history === undefined || history === null) {
        return [];
    }

    if (!Array.isArray(history)) {
        throw new ValidationError("history must be an array.");
    }

    return history
        .filter((message) => message && typeof message === "object" && !Array.isArray(message))
        .map((message, index) => {
            const role = message.role === "assistant" ? "assistant" : "user";
            const content = requireString(message.text ?? message.content, `history[${index}].content`, {
                maxLength: 2000,
            });

            return { role, content };
        })
        .slice(-10);
}

function buildSystemPrompt({ page, pageTip, isLoggedIn }) {
    const pageName = typeof page === "string" && page.trim() ? page.trim() : "app";
    const safePageTip =
        typeof pageTip === "string" && pageTip.trim()
            ? pageTip.trim()
            : "Help the user use GymSync clearly and briefly.";

    return [
        "You are GymSync Assistant, a short in-app helper for a student gym planning web app.",
        "Answer briefly, clearly, and practically.",
        "Focus on using the GymSync app: login, dashboard, planner, workout builder, and group chat.",
        "Do not invent features that are not obviously present.",
        "If a question is unrelated to the app, steer the answer back to GymSync.",
        `Current page: ${pageName}.`,
        `Current page context: ${safePageTip}`,
        `User logged in: ${isLoggedIn ? "yes" : "no"}.`,
    ].join(" ");
}

function buildGeminiContents(history, message) {
    const contents = history.map((entry) => ({
        role: entry.role === "assistant" ? "model" : "user",
        parts: [{ text: entry.content }],
    }));

    contents.push({
        role: "user",
        parts: [{ text: message }],
    });

    return contents;
}

function extractGeminiText(payload) {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) {
        throw new Error("Gemini response did not contain any text.");
    }

    const text = parts
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("")
        .trim();

    if (!text) {
        throw new Error("Gemini response did not contain any text.");
    }

    return text;
}

exports.respond = async (req, res) => {
    try {
        const message = requireString(req.body.message, "message", { maxLength: 2000 });
        const history = normalizeHistory(req.body.history);
        const page = typeof req.body.page === "string" ? req.body.page : "app";
        const pageTip = typeof req.body.pageTip === "string" ? req.body.pageTip : "";
        const isLoggedIn = Boolean(req.body.isLoggedIn);
        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is missing.");
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: buildSystemPrompt({ page, pageTip, isLoggedIn }) }],
                    },
                    contents: buildGeminiContents(history, message),
                }),
            }
        );

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const upstreamError =
                payload?.error?.message ||
                payload?.message ||
                `Gemini request failed with status ${response.status}.`;

            throw new Error(upstreamError);
        }

        res.json({
            reply: extractGeminiText(payload),
            model,
        });
    } catch (error) {
        const isValidationError = error instanceof ValidationError;
        const isConnectionError = !isValidationError && /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(error.message);
        const isConfigError = !isValidationError && /GEMINI_API_KEY is missing/i.test(error.message);
        const statusCode = isValidationError ? 400 : isConnectionError ? 503 : isConfigError ? 500 : 500;
        const fallbackMessage = isConfigError
            ? "GymSync Assistant is missing GEMINI_API_KEY."
            : isConnectionError
                ? "GymSync Assistant could not reach Gemini."
                : "Server error while talking to Gemini.";

        res.status(statusCode).json({
            message: validationMessage(error, fallbackMessage),
        });
    }
};
