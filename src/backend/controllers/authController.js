const db = require("../config/db");
const bcrypt = require("bcrypt");
const {
  ValidationError,
  requireEmail,
  requireString,
  validationMessage,
} = require("../utils/validation");

exports.register = async (req, res) => {
  try {
    const username = requireString(req.body.username, "username");
    const email = requireEmail(req.body.email);
    const password = requireString(req.body.password, "password", { maxLength: 255 });

    if (password.length < 6) {
      throw new ValidationError("password must be at least 6 characters long.");
    }

    const userCheck = await db.query(
        "SELECT user_id FROM Users WHERE email = $1 OR username = $2",
        [email, username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        message: "Username or email already in use.",
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await db.query(
        "INSERT INTO Users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, username, email",
        [username, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully!",
      userId: newUser.rows[0].user_id
    });

  } catch (err) {
    console.error(err);
    res.status(err instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(err, "Server error during registration."),
    });
  }
};

exports.login = async (req, res) => {
  try {
    const identifier = requireString(
        req.body.identifier ?? req.body.email ?? req.body.username,
        "identifier"
    ).trim();
    const password = requireString(req.body.password, "password", { maxLength: 255 });

    const query = `
      SELECT user_id, username, email, password_hash 
      FROM Users 
      WHERE username = $1 OR LOWER(email) = LOWER($1)
    `;
    const result = await db.query(query, [identifier]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        res.status(200).json({
          message: "Login successful",
          userId: user.user_id,
          username: user.username
        });
      } else {
        res.status(401).json({ message: "Invalid email or password" });
      }
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (err) {
    console.error(err);
    res.status(err instanceof ValidationError ? 400 : 500).json({
      message: validationMessage(err, "Server error during login"),
    });
  }
};
