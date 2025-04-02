const express = require("express");
const router = express.Router();
const passport = require("passport");
const { isHost, validateListing, isLoggedIn,canCreateListing ,isAdminOrHost,isHostOrAdmin} = require("../middleware");
const wrapAsync = require("../utils/wrapAsync");
const Host =require("../models/host");
const Listing=require("../models/listing");
const {
    renderHostSignupForm,
    hostSignup,
    renderHostLoginForm,
    hostLogin,
    renderDashboard,
    manageListings,
    addListing,        
    manageBookings,
    approveBooking,
    rejectBooking,
    logout,renderEditForm,updateListing,destroyListing,deleteReviewAsHost,renderHostAnalytics,viewListing
} = require("../controllers/hosts");
const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });

const mongoose = require("mongoose"); // For ID validation

// ==========================
// HOST SIGNUP
// ==========================
router.get("/signup", renderHostSignupForm);
router.post("/signup", wrapAsync(hostSignup));

// ==========================
// HOST LOGIN
// ==========================
router.get("/login", renderHostLoginForm);

router.post("/login", passport.authenticate("host-local", {
    failureFlash: true,
    failureRedirect: "/host/login"
}), (req, res) => {
    req.flash("success", "Welcome back to WanderHeavn!");
    req.session.save(() => res.redirect("/host/dashboard")); // Ensure flash message is saved
});

// ==========================
// HOST DASHBOARD
// ==========================
router.get("/dashboard", isHost, wrapAsync(renderDashboard));

// ==========================
// MANAGE LISTINGS
// ==========================
router.get("/manage-listings", isHost, wrapAsync(manageListings));

router.get("/listings/new", isHost, (req, res) => {
    res.render("host/addListing"); // Make sure this path matches the actual location of `addListing.ejs`
});
router.post("/listings/new", isHost, validateListing, wrapAsync(addListing));

// ==========================
// MANAGE BOOKINGS
// ==========================
router.get("/manage-bookings", isHost, wrapAsync(manageBookings));

router.post("/bookings/:id/approve", isHost, wrapAsync(approveBooking));
router.post("/bookings/:id/reject", isHost, wrapAsync(rejectBooking));

// ==========================
// LOGOUT
// ==========================
router.post("/logout", logout);

// Host Profile Route
router.get("/profile", isHost, async (req, res) => {
    console.log("Current Host:", req.user); // Debugging Line

    try {
        const host = await Host.findById(req.user._id);
        if (!host) {
            req.flash("error", "Host not found!");
            return res.redirect("/host/dashboard");
        }
        res.render("host/profile", { host });
    } catch (err) {
        console.error("Error fetching host profile:", err);
        req.flash("error", "Something went wrong.");
        res.redirect("/host/dashboard");
    }
});

router.get("/listings/:id/edit",isLoggedIn,isHost, renderEditForm);

router.put("/listings/:id",
    isLoggedIn,
    isHost,
    upload.single("listing[images]"),
  updateListing
  );

router.delete("/listings/:id",isLoggedIn, isHost,wrapAsync(destroyListing));

router.delete("/listings/:listingId/reviews/:reviewId", isLoggedIn, isHostOrAdmin, wrapAsync(deleteReviewAsHost));

router.get("/analytics", isHost, wrapAsync(renderHostAnalytics));

router.get("/listings/:id", isHost, viewListing);
module.exports = router;
