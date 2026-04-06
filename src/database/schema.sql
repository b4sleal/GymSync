CREATE TABLE IF NOT EXISTS Users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS WorkoutTemplates (
    template_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Exercises (
    exercise_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    exercise_name VARCHAR(100) NOT NULL,
    notes TEXT,
    sets INT NOT NULL DEFAULT 3,
    reps INT NOT NULL DEFAULT 10,
    weight_lbs INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS TemplateExercises (
    template_exercise_id SERIAL PRIMARY KEY,
    template_id INT REFERENCES WorkoutTemplates(template_id) ON DELETE CASCADE,
    source_exercise_id INT REFERENCES Exercises(exercise_id) ON DELETE SET NULL,
    exercise_name VARCHAR(100) NOT NULL,
    notes TEXT,
    sets INT NOT NULL DEFAULT 3,
    reps INT NOT NULL DEFAULT 10,
    weight_lbs INT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Schedules (
    schedule_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    template_id INT REFERENCES WorkoutTemplates(template_id) ON DELETE CASCADE,
    day_of_week VARCHAR(15),
    start_minutes INT,
    duration_minutes INT NOT NULL DEFAULT 60,
    specific_date DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Logs (
    log_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    schedule_id INT REFERENCES Schedules(schedule_id) ON DELETE SET NULL,
    template_id INT REFERENCES WorkoutTemplates(template_id) ON DELETE SET NULL,
    date_completed DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS logs_user_schedule_date_idx
    ON Logs (user_id, schedule_id, date_completed);

CREATE TABLE IF NOT EXISTS DirectMessages (
    dm_id SERIAL PRIMARY KEY,
    sender_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    recipient_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    message_text VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS direct_messages_pair_idx
    ON DirectMessages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC,
    dm_id DESC
);

CREATE TABLE IF NOT EXISTS Social (
    follow_id SERIAL PRIMARY KEY,
    follower_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    following_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    UNIQUE(follower_id, following_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS social_following_idx
    ON Social (follower_id, following_id);

CREATE INDEX IF NOT EXISTS social_followers_idx
    ON Social (following_id, follower_id);

CREATE TABLE IF NOT EXISTS UserStats (
    user_id INT PRIMARY KEY REFERENCES Users(user_id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_completed_date DATE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
