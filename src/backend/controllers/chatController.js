const db = require("../config/db");
const {
    ValidationError,
    parseRequestUserId,
    requireString,
    validationMessage,
} = require("../utils/validation");

exports.listMessages = async (req, res) => {
    try {
        const limit = Number(req.query.limit ?? 50);
        const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 50;

        const result = await db.query(
            `
            SELECT
                m.message_id,
                m.user_id,
                u.username,
                m.message_text,
                m.created_at
            FROM Messages m
            JOIN Users u ON u.user_id = m.user_id
            ORDER BY m.created_at DESC, m.message_id DESC
            LIMIT $1
            `,
            [safeLimit]
        );

        res.json({ messages: result.rows.reverse() });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading chat messages."),
        });
    }
};

exports.createMessage = async (req, res) => {
    try {
        const userId = parseRequestUserId(req);
        const messageText = requireString(
            req.body.message ?? req.body.message_text ?? req.body.text,
            "message",
            { maxLength: 500 }
        );

        const result = await db.query(
            `
            WITH inserted AS (
                INSERT INTO Messages (user_id, message_text)
                SELECT user_id, $2
                FROM Users
                WHERE user_id = $1
                RETURNING message_id, user_id, message_text, created_at
            )
            SELECT
                i.message_id,
                i.user_id,
                u.username,
                i.message_text,
                i.created_at
            FROM inserted i
            JOIN Users u ON u.user_id = i.user_id
            `,
            [userId, messageText]
        );

        if (result.rowCount === 0) {
            throw new ValidationError("user_id does not exist.");
        }

        res.status(201).json({
            message: "Message sent.",
            chatMessage: result.rows[0],
        });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while sending the message."),
        });
    }
};
