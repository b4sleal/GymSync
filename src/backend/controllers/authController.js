const db = require("../config/db")
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const userCheck = await db.query(
        'SELECT * FROM Users WHERE email = $1 OR username = $2',
        [email, username]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({
        message: "Username or Email already in use."
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await db.query(
        'INSERT INTO Users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
        [username, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully!",
      userId: newUser.rows[0].user_id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error during registration." });
  }
};

exports.login = async (req, res) => {
  // Use 'email' here to match what your auth.js is sending
  const { email, password } = req.body;

  try {
    // 1. Search for the user by email only
    const query = `
      SELECT user_id, username, email, password_hash 
      FROM Users 
      WHERE username = $1 OR email = $1
    `;
    const result = await db.query(query, [email]);

    if (result.rows.length > 0) {
      const user = result.rows[0];

      // 2. Use bcrypt to compare the plain text password with the stored hash
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        // Success!
        res.status(200).json({
          message: "Login successful",
          userId: user.user_id,
          username: user.username
        });
      } else {
        // Password didn't match the hash
        res.status(401).json({ message: "Invalid email or password" });
      }
    } else {
      // Email not found in database
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error during login" });
  }
};