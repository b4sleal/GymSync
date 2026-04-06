const db = require("../config/db");
const {
    ValidationError,
    parseRequestUserId,
    requirePositiveInteger,
    requireString,
    validationMessage,
} = require("../utils/validation");

function avatarForUsername(username) {
  const first = String(username ?? "").trim().charAt(0).toUpperCase();
  return first || "?";
}

exports.searchUsers = async (req, res) => {
  try {
    const userId = parseRequestUserId(req);
    const query = String(req.query.q ?? "").trim();

    const result = await db.query(
        `
            SELECT
                u.user_id,
                u.username,
                EXISTS (
                    SELECT 1
                    FROM Social s
                    WHERE s.follower_id = $1
                      AND s.following_id = u.user_id
                ) AS is_following
            FROM Users u
            WHERE u.user_id <> $1
              AND ($2 = '' OR LOWER(u.username) LIKE LOWER($2))
            ORDER BY u.username ASC
            LIMIT 25
            `,
        [userId, `%${query}%`]
    );

    res.json({
      users: result.rows.map((row) => ({
        ...row,
        avatar: avatarForUsername(row.username),
      })),
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while searching users."),
    });
  }
};

exports.listFollowers = async (req, res) => {
  try {
    const userId = parseRequestUserId(req);

    const result = await db.query(
        `
            SELECT
                u.user_id,
                u.username
            FROM Social s
            JOIN Users u ON u.user_id = s.following_id
            WHERE s.follower_id = $1
            ORDER BY u.username ASC
            `,
        [userId]
    );

    res.json({
      followers: result.rows.map((row) => ({
        ...row,
        avatar: avatarForUsername(row.username),
      })),
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while loading followed users."),
    });
  }
};

exports.followUser = async (req, res) => {
  try {
    const followerId = parseRequestUserId(req);
    const followingId = requirePositiveInteger(
        req.body.following_id ?? req.body.followingId,
        "following_id"
    );

    if (followerId === followingId) {
      throw new ValidationError("You cannot follow yourself.");
    }

    await db.query(
        `
            INSERT INTO Social (follower_id, following_id)
            VALUES ($1, $2)
            ON CONFLICT (follower_id, following_id) DO NOTHING
            `,
        [followerId, followingId]
    );

    res.status(201).json({
      message: "User followed successfully.",
      follower_id: followerId,
      following_id: followingId,
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while following the user."),
    });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const followerId = parseRequestUserId(req);
      const followingId = requirePositiveInteger(
          req.body?.following_id ?? req.body?.followingId ?? req.query.following_id,
          "following_id"
      );

    await db.query(
        `
            DELETE FROM Social
            WHERE follower_id = $1
              AND following_id = $2
            `,
        [followerId, followingId]
    );

    res.json({
      message: "User unfollowed successfully.",
      follower_id: followerId,
      following_id: followingId,
    });
  } catch (error) {
      console.error(error);
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while unfollowing the user."),
    });
  }
};

exports.listConversation = async (req, res) => {
  try {
    const userId = parseRequestUserId(req);
    const otherUserId = requirePositiveInteger(req.params.otherUserId, "otherUserId");

    const userResult = await db.query(
        `
            SELECT user_id, username
            FROM Users
            WHERE user_id = $1
            `,
        [otherUserId]
    );
  const followResult = await db.query(
      `
        SELECT 1
        FROM Social
        WHERE follower_id = $1
          AND following_id = $2
        `,
      [userId, otherUserId]
  );

      if (followResult.rowCount === 0) {
          throw new ValidationError("You can only view chats for users you currently follow.");
      }
    if (userResult.rowCount === 0) {
      throw new ValidationError("otherUserId does not exist.");
    }

    const messagesResult = await db.query(
        `
            SELECT
                dm_id,
                sender_id,
                recipient_id,
                message_text,
                created_at
            FROM DirectMessages
            WHERE
                (sender_id = $1 AND recipient_id = $2)
                OR
                (sender_id = $2 AND recipient_id = $1)
            ORDER BY created_at ASC, dm_id ASC
            `,
        [userId, otherUserId]
    );

    res.json({
      other_user: {
        user_id: userResult.rows[0].user_id,
        username: userResult.rows[0].username,
        avatar: avatarForUsername(userResult.rows[0].username),
      },
      messages: messagesResult.rows,
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while loading conversation."),
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = parseRequestUserId(req);
    const recipientId = requirePositiveInteger(
        req.body.recipient_id ?? req.body.recipientId,
        "recipient_id"
    );
    const messageText = requireString(
        req.body.message ?? req.body.message_text ?? req.body.text,
        "message",
        { maxLength: 1000 }
    );

      if (senderId === recipientId) {
          throw new ValidationError("You cannot message yourself.");
      }

      const followResult = await db.query(
          `
              SELECT 1
              FROM Social
              WHERE follower_id = $1
                AND following_id = $2
          `,
          [senderId, recipientId]
      );

      if (followResult.rowCount === 0) {
          throw new ValidationError("You can only message users you currently follow.");
      }

      const result = await db.query(
          `
            INSERT INTO DirectMessages (sender_id, recipient_id, message_text)
            VALUES ($1, $2, $3)
            RETURNING dm_id, sender_id, recipient_id, message_text, created_at
            `,
          [senderId, recipientId, messageText]
      );

    res.status(201).json({
      message: "Message sent.",
      direct_message: result.rows[0],
    });
  } catch (error) {
    res.status(error instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(error, "Server error while sending the message."),
    });
  }
};

exports.getUserProfile = async (req, res) => {
    try {
        const viewerId = parseRequestUserId(req);
        const profileUserId = requirePositiveInteger(req.params.userId, "userId");

        const userResult = await db.query(
            `
      SELECT user_id, username
      FROM Users
      WHERE user_id = $1
      `,
            [profileUserId]
        );

        if (userResult.rowCount === 0) {
            throw new ValidationError("userId does not exist.");
        }

        if (viewerId !== profileUserId) {
            const followResult = await db.query(
                `
        SELECT 1
        FROM Social
        WHERE follower_id = $1
          AND following_id = $2
        `,
                [viewerId, profileUserId]
            );

            if (followResult.rowCount === 0) {
                throw new ValidationError("You can only view profiles for users you currently follow.");
            }
        }

        const row = userResult.rows[0];

        res.json({
            user: {
                user_id: row.user_id,
                username: row.username,
                avatar: avatarForUsername(row.username),
            },
        });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading the profile."),
        });
    }
};

exports.getUserSchedules = async (req, res) => {
    try {
        const viewerId = parseRequestUserId(req);
        const profileUserId = requirePositiveInteger(req.params.userId, "userId");

        if (viewerId !== profileUserId) {
            const followResult = await db.query(
                `
        SELECT 1
        FROM Social
        WHERE follower_id = $1
          AND following_id = $2
        `,
                [viewerId, profileUserId]
            );

            if (followResult.rowCount === 0) {
                throw new ValidationError("You can only view schedules for users you currently follow.");
            }
        }

        const result = await db.query(
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
          s.created_at,
          wt.title,
          wt.notes
      FROM Schedules s
      JOIN WorkoutTemplates wt ON wt.template_id = s.template_id
      WHERE s.user_id = $1
      ORDER BY COALESCE(s.specific_date, CURRENT_DATE), s.day_of_week NULLS LAST, s.created_at DESC
      `,
            [profileUserId]
        );

        res.json({ schedules: result.rows });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading the user's schedules."),
        });
    }
};

exports.getUserWorkouts = async (req, res) => {
    try {
        const viewerId = parseRequestUserId(req);
        const profileUserId = requirePositiveInteger(req.params.userId, "userId");

        if (viewerId !== profileUserId) {
            const followResult = await db.query(
                `
        SELECT 1
        FROM Social
        WHERE follower_id = $1
          AND following_id = $2
        `,
                [viewerId, profileUserId]
            );

            if (followResult.rowCount === 0) {
                throw new ValidationError("You can only view workout templates for users you currently follow.");
            }
        }

        const result = await db.query(
            `
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
      WHERE wt.user_id = $1
      GROUP BY wt.template_id
      ORDER BY wt.created_at DESC
      `,
            [profileUserId]
        );

        res.json({ workouts: result.rows });
    } catch (error) {
        res.status(error instanceof ValidationError ? 400 : 500).json({
            message: validationMessage(error, "Server error while loading the user's workout templates."),
        });
    }
};