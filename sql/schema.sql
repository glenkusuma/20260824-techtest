DROP TABLE IF EXISTS employees;
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  join_date TEXT NOT NULL,
  release_date TEXT NULL,
  years_experience REAL NOT NULL,
  salary REAL NOT NULL
);
