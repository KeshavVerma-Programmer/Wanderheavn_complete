require("dotenv").config();
console.log("MAP_TOKEN:", process.env.MAP_TOKEN);
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require('./utils/ExpressError.js');
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

// Models
const User = require("./models/user.js");
const Host = require("./models/host.js");     // Added Host model
const Admin = require("./models/admin");

// Routes
const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");
const adminRoutes = require("./routes/admin");
const hostRoutes = require("./routes/host");

const MONGO_URL = "mongodb://127.0.0.1:27017/wanderheavn";

async function main() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to DB");
  } catch (err) {
    console.error("Database connection error:", err);
  }
}

main();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine('ejs', ejsMate);
app.use(express.static(path.join(__dirname, "/public")));
app.use(express.json());
  const sessionOptions = {
    secret: "mysupersecretcode",
    resave: false,
    saveUninitialized: true,
    cookie: {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  };

// Session & Flash should come before routes
app.use(session(sessionOptions));
app.use(flash());

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  "user-local",
  new LocalStrategy(
    { usernameField: "identifier", passwordField: "password" }, 
    async (identifier, password, done) => {
      try {
        // Find user by either username or email
        const user = await User.findOne({
          $or: [{ email: identifier }, { username: identifier }],
        });

        if (!user) {
          return done(null, false, { message: "Invalid username or email!" });
        }

        // Authenticate Password
        const isValid = await user.authenticate(password);
        if (!isValid.user) {
          return done(null, false, { message: "Incorrect password!" });
        }

        return done(null, user); // Successfully authenticated
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  "admin-local",
  new LocalStrategy(
    { usernameField: "identifier", passwordField: "password" },
    async (identifier, password, done) => {
      try {
        const admin = await Admin.findOne({
          $or: [{ email: identifier }, { username: identifier }],
        });

        if (!admin) {
          return done(null, false, { message: "Invalid username or email!" });
        }

        // Authenticate Password using Admin model
        const { user: authenticatedAdmin, error } = await admin.authenticate(password);
        if (error || !authenticatedAdmin) {
          return done(null, false, { message: "Incorrect password!" });
        }

        return done(null, authenticatedAdmin); // Successfully authenticated
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  "host-local",
  new LocalStrategy(
    { usernameField: "identifier", passwordField: "password" }, 
    async (identifier, password, done) => {
      try {
        // Find user by either username or email
        const host = await Host.findOne({
          $or: [{ email: identifier }, { username: identifier }],
        });

        if (!host) {
          return done(null, false, { message: "Invalid username or email!" });
        }

        // Authenticate Password
        const isValid = await host.authenticate(password);
        if (!isValid.user) {
          return done(null, false, { message: "Incorrect password!" });
        }

        return done(null, host); // Successfully authenticated
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, { id: user.id, role: user.role }));

passport.deserializeUser(async (data, done) => {
  try {
    let user = null;

    switch (data.role) {
      case "admin":
        user = await Admin.findById(data.id);
        break;
      case "host":
        user = await Host.findById(data.id);
        break;
      default:
        user = await User.findById(data.id);
        break;
    }

    if (!user) return done(null, false);

    user.role = data.role; // Reattach role
    return done(null, user);
  } catch (err) {
    return done(err);
  }
});

// Flash Messages & Current User in Views
app.use((req, res, next) => {
  // res.locals.messages = req.flash();
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Set search value before any routes
app.use((req, res, next) => {
  res.locals.search = req.query.search || '';
  next();
});

// Routes
app.use("/", userRouter);
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/admin", adminRoutes);
app.use("/host", hostRoutes);

// Error Handling
app.all('*', (req, res, next) => {
  next(new ExpressError(404, 'Page Not Found!'));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = 'Something went wrong!' } = err;
  res.status(statusCode).render('listings/error.ejs', { message });
});

// Start Server
app.listen(3030, () => {
  console.log("Server is listening on port 3030");
});

app.get("/api/map-token", (req, res) => {
  res.json({ mapToken: process.env.MAP_TOKEN });
});
