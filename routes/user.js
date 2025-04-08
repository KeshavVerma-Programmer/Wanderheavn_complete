const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const passport = require("passport");
const { saveRedirectUrl } = require('../middleware.js');
const userController = require("../controllers/users.js");
const User = require("../models/user"); // Import the Host model
const { isLoggedIn } = require("../middleware");
const Booking = require("../models/booking"); // ✅ Import Booking model


// Redirect /signup to /signup/user
router.get("/signup", (req, res) => res.redirect("/user/signup"));

// USER SIGNUP
router.route("/user/signup")
    .get(userController.renderUserSignupForm)
    .post(wrapAsync(userController.userSignup));

// LOGIN
router.route("/user/login")
    .get(userController.renderUserLoginForm)
    .post(
        saveRedirectUrl,
        passport.authenticate("user-local", {
            failureRedirect: "/user/login",
            failureFlash: "Invalid credentials. Please try again."
        }),
        userController.userLogin  // ✅ Fixed Reference Here
    );

// LOGOUT
router.get("/logout", userController.logout);
router.get("/user/profile",async (req, res) => {
    console.log("Current User:", req.user); // Debugging Line

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash("error", "User not found!");
            return res.redirect("/user/login");
        }
        res.render("users/profile", { user });
    } catch (err) {
        console.error("Error fetching host profile:", err);
        req.flash("error", "Something went wrong.");
        res.redirect("/host/dashboard");
    }
});

router.get("/user/bookings", isLoggedIn, async (req, res) => {
    try {
        console.log("Fetching bookings for user:", req.user._id);
        const bookings = await Booking.find({ guest: req.user._id }).populate("property");
        console.log("Bookings found:", bookings);
        res.render("users/bookings", { bookings, currUser: req.user });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        req.flash("error", "Could not fetch bookings.");
        res.redirect("/");
    }
});


module.exports = router;
