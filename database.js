const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db = null;

const initializeDb = async () => {
  db = await open({
    filename: 'database.db',
    driver: sqlite3.Database
  });

  await db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES posts(id),
      FOREIGN KEY(user_id) REFERENCES Users(id)
    );
  `);

  console.log("DB initialized");
  return db;
};

module.exports = { initializeDb, db };
