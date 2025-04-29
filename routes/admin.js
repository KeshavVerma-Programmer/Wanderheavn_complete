const express = require("express");
const router = express.Router();
const passport = require("passport");
const { isAdmin, isAdminLoggedIn,isLoggedIn, checkDeletePermission } = require("../middleware");
const multer = require("multer");
const { storage } = require("../cloudConfig");
const upload = multer({ storage });
const Review=require("../models/review");

const {
    renderAdminLoginForm,
    adminLogin,
    logout,
    adminDashboard,
    manageUsers,
    deleteUser,
    manageListings,
    approveListing,
    rejectListing,
    featureListing
 ,manageHosts,deleteHosts,viewListing,renderEditForm,updateListing,renderDeletePage,deleteListing,destroyReview,viewAllReviews,deleteReview,renderAdminAnalytics,viewBookings
} = require("../controllers/admin");

const ADMIN_SECRET_KEY = "SECRET123";
const checkSecretKey = (req, res, next) => {
    const providedKey = req.query.key;

    if (providedKey === ADMIN_SECRET_KEY) {
        return next(); 
    }

    req.flash("error", "Unauthorized Access!");
    return res.redirect("/listings");
};

router.get("/login", checkSecretKey,renderAdminLoginForm);
router.post("/login", passport.authenticate("admin-local", {
    failureRedirect: "/admin/login",
    failureFlash: true
}), adminLogin);

router.post("/logout", logout);

router.get("/dashboard", isAdminLoggedIn, adminDashboard);

router.get("/manage-users", isAdmin, manageUsers);
router.delete("/manage-users/:id/delete", isAdmin, deleteUser);

router.get("/manage-hosts", isAdmin, manageHosts);
router.delete("/manage-hosts/:id/delete", isAdmin, deleteHosts);

router.get("/listings/manage-reviews", isAdmin, viewAllReviews);
router.delete("/listings/:id/reviews/:reviewId", isLoggedIn, checkDeletePermission,deleteReview);


router.get("/manage-listings", isAdmin, manageListings);
router.post("/manage-listings/:id/approve", isAdmin, approveListing);
router.post("/manage-listings/:id/reject", isAdmin, rejectListing);
router.post("/manage-listings/:id/feature", isAdmin, featureListing);


router.get("/listings/:id", isAdmin, viewListing);

router.get("/listings/:id/edit", isAdmin,renderEditForm);

router.put("/listings/:id", isAdmin, upload.single("listing[images]"), updateListing);

router.get("/listings/:id/delete", isAdmin, renderDeletePage);

router.delete("/listings/:id", isAdmin, deleteListing);

router.delete('/listings/:id/reviews/:reviewId', isLoggedIn, checkDeletePermission, destroyReview);


router.get("/profile", isAdminLoggedIn, (req, res) => {
    res.render("admin/profile", { admin: req.user });
});

router.get("/analytics", isAdmin, renderAdminAnalytics);
router.get('/bookings', isAdminLoggedIn, viewBookings);

module.exports = router;
