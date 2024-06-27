const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { initializeDb } = require('./database');

const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(cors());

let db = null;

// Initialize DB and Server
const initializeDbAndServer = async () => {
  try {
    db = await initializeDb();

    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

// Middleware for authorization
const authorizationToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401).send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401).send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Register API
app.post('/register/', async (request, response) => {
  const { username, password } = request.body;
  if (!username || !password) {
    return response.status(400).send("Missing data").end();
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM Users WHERE username = ?`;
  const userDataResponse = await db.get(selectUserQuery, [username]);

  if (userDataResponse === undefined) {
    if (password.length > 6) {
      const insertUserQuery = `
        INSERT INTO Users (username, password_hash)
        VALUES (?, ?);
      `;
      await db.run(insertUserQuery, [username, hashedPassword]);
      response.status(200).send({ "message": "User registered successfully." });
    } else {
      response.status(400).send({ "Error": "The password must be more than six characters long." });
    }
  } else {
    response.status(409).send({ "Error": "Username already exists." });
  }
});

// Login API
app.post('/login/', async (request, response) => {
  const { username, password } = request.body;
  if (!username || !password) {
    return response.status(400).send('Missing Data').end();
  }

  const selectUserQuery = `SELECT * FROM Users WHERE username = ?`;
  const user = await db.get(selectUserQuery, [username]);
  if (user === undefined) {
    response.status(400).send("Invalid user");
  } else {
    const isMatched = await bcrypt.compare(password, user.password_hash);
    if (isMatched) {
      const payLoad = { username: username };
      const jwtToken = await jwt.sign(payLoad, "SECRET_KEY");
      response.status(200).send({ jwtToken });
    } else {
      response.status(400).send("Invalid password");
    }
  }
});

app.post('/posts', authorizationToken, async (req, res) => {
    const { title, content } = req.body;
    const { username } = req;
    const selectUserQuery = `SELECT id FROM Users WHERE username = ?`;
    const user = await db.get(selectUserQuery, [username]);
    
    if (user === undefined) {
        return res.status(400).send("Invalid user");
    }

    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }
  
    const createdAt = new Date().toISOString();
    const sql = `INSERT INTO posts (title, content, created_at) VALUES (?, ?, ?)`;
    try {
      await db.run(sql, [title, content, createdAt]);
      return res.status(201).json(`Post Successfully Added.`);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

// Route to post a comment to a specific post
app.post('/posts/:postId/comments', authorizationToken, async (req, res) => {
  const { postId } = req.params;
  const { comment } = req.body;
  const { username } = req;
  const selectUserQuery = `SELECT id FROM Users WHERE username = ?`;
  const user = await db.get(selectUserQuery, [username]);

  if (!comment) {
    return res.status(400).json({ error: "Comment is required" });
  }

  const sql = `INSERT INTO comments (post_id, user_id, comment, created_at) VALUES (?, ?, ?, ?)`;
  const createdAt = new Date().toISOString();
  await db.run(sql, [postId, user.id, comment, createdAt], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json(`Comment successfully added to postId ${postId}`);
  });
});

// Route to get all comments for a specific post
app.get('/posts/:postId/comments', authorizationToken, async (req, res) => {
  const { postId } = req.params;
  const sql = `SELECT * FROM comments WHERE post_id = ?`;
  db.all(sql, [postId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ comments: rows });
  });
});
