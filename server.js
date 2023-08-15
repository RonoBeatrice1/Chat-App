const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const bodyParser = require("body-parser");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// MySQL setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "Chat-room",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("Connected to MySQL database");
  }
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  done(null, user.username);
});

passport.deserializeUser((username, done) => {
  const query = "SELECT * FROM users WHERE username = ?";
  db.query(query, [username], (err, rows) => {
    done(err, rows[0]);
  });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/avatars"); // Save avatars in the 'uploads/avatars' folder
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.set("view engine", "ejs");

// Redirect root URL to the register page
app.get("/", (req, res) => {
  res.redirect("/register");
});

app.get("/login", (req, res) => {
  res.render("login"); // Render the login form
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/chat",
    failureRedirect: "/login",
  })
);

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/login");
});

app.get("/register", (req, res) => {
  res.render("register"); // Render the registration form
});

app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const query = "INSERT INTO users (username, password) VALUES (?, ?)";
  db.query(query, [username, password], (err, result) => {
    if (err) {
      console.error("Error registering user:", err);
      res.redirect("/register");
    } else {
      // Redirect to the login page after successful registration
      res.redirect("/login");
    }
  });
});

app.post("/upload-avatar", upload.single("avatar"), (req, res) => {
  const avatarUrl = `/uploads/avatars/${req.file.filename}`;
  // Update the user's avatar URL in the database
  // ... Perform database update here
  res.json({ avatarUrl });
});

// Serve static files
app.use(express.static(__dirname + "/public"));

// Route to render the chat page
app.get("/chat", (req, res) => {
  if (!req.isAuthenticated()) {
    res.redirect("/login");
  } else {
    // Retrieve user data from the session
    const user = req.user;
    res.render("chat", { user });
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("message", (data) => {
    const { username, message } = data;

    // Save the message to the database
    const insertQuery =
      "INSERT INTO messages (username, message) VALUES (?, ?)";
    db.query(insertQuery, [username, message], (err, result) => {
      if (err) {
        console.error("Error saving message:", err);
      } else {
        io.emit("message", data); // Broadcast the message to all clients
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 4005;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
