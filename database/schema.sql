DROP TABLE IF EXISTS Logs CASCADE;
DROP TABLE IF EXISTS Workouts CASCADE;
DROP TABLE IF EXISTS Social CASCADE;
DROP TABLE IF EXISTS Users CASCADE;
DROP TABLE IF EXISTS WorkoutTemplates CASCADE;
DROP TABLE IF EXISTS TemplateExercises CASCADE;
DROP TABLE IF EXISTS Schedules CASCADE;


CREATE TABLE Users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE WorkoutTemplates (
  template_id SERIAL PRIMARY KEY,
  user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE TemplateExercises (
   exercise_id SERIAL PRIMARY KEY,
   template_id INT REFERENCES WorkoutTemplates(template_id) ON DELETE CASCADE,
   exercise_name VARCHAR(100) NOT NULL,
   sets INT NOT NULL DEFAULT 3,
   reps INT NOT NULL DEFAULT 10,
   weight_lbs INT
);

CREATE TABLE Schedules (
    schedule_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE,
    template_id INT REFERENCES WorkoutTemplates(template_id) ON DELETE CASCADE,
    day_of_week VARCHAR(15),
    specific_date DATE,
    is_recurring BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Logs (
    log_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    template_id INT REFERENCES WorkoutTemplates(template_id) ON DELETE SET NULL,
    date_completed DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Social (
    follow_id SERIAL PRIMARY KEY,
    follower_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    following_id INT REFERENCES Users(user_id) ON DELETE CASCADE NOT NULL,
    UNIQUE(follower_id, following_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);