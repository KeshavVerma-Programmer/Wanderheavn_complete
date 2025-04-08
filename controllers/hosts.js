const Host = require("../models/host");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const mongoose = require("mongoose");
const { cloudinary } = require("../cloudConfig");
const axios = require("axios"); 
const mapToken = process.env.MAP_TOKEN;
const Review=require("../models/review");

// ==========================
// HOST SIGNUP
// ==========================
module.exports.renderHostSignupForm = (req, res) => {
    res.render("hosts/signup", { username: "", email: "", phone: "" });
};

module.exports.hostSignup = async (req, res, next) => {
    console.log("Received Data:", req.body); // Debugging

    const { username, email, phone, password } = req.body;

    try {
        // ✅ Username must be at least 5 characters
        if (username.length < 5) {
            req.flash("error", "Username must be at least 5 characters long.");
            return res.redirect("/host/signup");
        }

        // ✅ Password must be at least 6 characters and contain a special character
        if (password.length < 6) {
            req.flash("error", "Password must be at least 6 characters long.");
            return res.redirect("/host/signup");
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            req.flash("error", "Password must contain at least one special character (!@#$%^&* etc).");
            return res.redirect("/host/signup");
        }

        const newHost = new Host({ 
            username, 
            email, 
            phone,
            role: "host",  // Ensure role is assigned
        });

        const registeredHost = await Host.register(newHost, password);

        req.login(registeredHost, (err) => {
            if (err) return next(err);
            console.log("Logged in user:", req.user); // Debugging
            req.flash("success", "Welcome to WanderHeavn as a Host!");
            return res.redirect("/host/dashboard");
        });

    } catch (error) {
        console.error("Signup Error:", error);

        // ✅ Handle duplicate key errors (MongoDB error code 11000)
        if (error.code === 11000 && error.keyPattern) {
            if (error.keyPattern.email) {
                req.flash("error", "This email is already registered. Try another one.");
            } else if (error.keyPattern.phone) {
                req.flash("error", "This phone number is already in use. Use a different one.");
            } else if (error.keyPattern.username) {
                req.flash("error", "This username is already taken. Try another.");
            } else {
                req.flash("error", "Duplicate value detected. Please try again.");
            }
        } 
        // ✅ Handle password-related errors from Passport
        else if (error.name === "UserExistsError") {
            req.flash("error", "This username is already taken. Try another.");
        } 
        // ✅ Handle email format errors
        else if (error.errors?.email?.message) {
            req.flash("error", "Invalid email format. Please enter a valid email.");
        }
        // ✅ General error fallback
        else {
            req.flash("error", "Something went wrong. Please check your details and try again.");
        }

        return res.redirect("/host/signup");
    }
};

// ==========================
// HOST LOGIN
// ==========================
module.exports.renderHostLoginForm = (req, res) => {
    res.render("hosts/login");
};

module.exports.hostLogin = (req, res) => {
    console.log("Authenticated User in Login:", req.user); // Debugging

    if (!req.user) {
        req.flash("error", "Invalid username/email or password. Please try again.");
        return res.redirect("/host/login");
    }

    if (req.user.role !== "host") {
        req.flash("error", "You must be a host to access this route.");
        return res.redirect("/host/login");
    }

    req.flash("success", "Welcome back to WanderHeavn!");
    res.redirect("/host/dashboard");
};

// ==========================
// DASHBOARD
// ==========================
module.exports.renderDashboard = async (req, res) => {
    try {
        const totalListings = await Listing.countDocuments({ owner: req.user._id });

        // Count only successfully paid bookings
        const activeBookings = await Booking.countDocuments({ host: req.user._id, status: "Paid" });

        // Get total earnings from paid bookings
        const bookings = await Booking.find({ host: req.user._id, status: "Paid" });
        const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.amountPaid || 0), 0);

        res.render("host/dashboard", { totalListings, activeBookings, totalEarnings });
    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash("error", "Failed to load dashboard data.");
        res.redirect("/listings");
    }
};


// ==========================
// MANAGE LISTINGS
// ==========================
module.exports.manageListings = async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id });
    res.render("host/manageListings", { listings });
};

module.exports.addListing = async (req, res) => {
    console.log("Request Body:", req.body); // Debug incoming data

    if (!req.user || req.user.role !== "host") {  
        req.flash("error", "Only hosts can create listings.");  
        return res.redirect("/host/manage-listings");  
    }

    try {
        const newListing = new Listing({ 
            ...req.body.listing, 
            owner: req.user._id
        });

        await newListing.save();
        req.flash("success", "New listing added successfully!");
        res.redirect("/host/manage-listings");
    } catch (error) {
        console.error("Error adding listing:", error);
        req.flash("error", "Failed to add listing. Please try again.");
        res.redirect("/host/manage-listings");
    }
};

// ==========================
// MANAGE BOOKINGS
// ==========================

module.exports.manageBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ host: req.user._id })
            .populate("property") // ✅ Ensure property details are included
            .populate("guest");  // ✅ Populate guest details too if needed

        res.render("host/manageBookings", { bookings });
    } catch (err) {
        console.error("Error fetching bookings:", err);
        req.flash("error", "Something went wrong while fetching bookings.");
        res.redirect("/host/dashboard");
    }
};


// ==========================
// LOGOUT
// ==========================
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) {
            console.error("Logout Error:", err);
            req.flash("error", "Failed to log out. Please try again.");
            return next(err);
        }
        req.flash("success", "You are logged out!");
        res.redirect("/listings");
    });
};
module.exports.destroyListing = async (req, res) => {
    let { id } = req.params;
    let deletedListing = await Listing.findByIdAndDelete(id);
    if (!deletedListing) {
        req.flash("error", "Listing not found or already deleted.");
        return res.redirect("/listings");
    }

    req.flash("success", "Listing Deleted!");
    res.redirect("/listings");
};
// Function to get coordinates using MapTiler
async function geocodeLocation(location) {
    try {
        const geoUrl = `https://api.maptiler.com/geocoding/${encodeURIComponent(location)}.json?key=${mapToken}`;
        const response = await axios.get(geoUrl);

        if (response.data.features && response.data.features.length > 0) {
            const [longitude, latitude] = response.data.features[0].geometry.coordinates;
            return { type: "Point", coordinates: [longitude, latitude] };
        } else {
            throw new Error("No coordinates found for the given location.");
        }
    } catch (error) {
        console.error("❌ Geocoding Error:", error);
        return null;
    }
}
module.exports.renderEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/host/listings");
        }
        res.render("host/listings/edit", { listing });
    } catch (error) {
        console.error("❌ Error rendering edit form:", error);
        req.flash("error", "Something went wrong.");
        res.redirect("/host/listings");
    }
};

module.exports.updateListing = async (req, res) => {
    try {
        const { id } = req.params;
        let listing = await Listing.findById(id);

        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/host/listings");
        }

        // Update text fields (title, description, etc.)
        listing.set(req.body.listing);

        // Handle Image Upload
        if (req.file) {
            // Delete old images from Cloudinary
            if (listing.images && listing.images.length > 0) {
                for (let img of listing.images) {
                    await cloudinary.uploader.destroy(img.filename);
                }
            }

            // Assign new image
            listing.images = [{ url: req.file.path, filename: req.file.filename }];
        }

        // Handle Geocoding with MapTiler
        if (req.body.listing.location) {
            const geoData = await geocodeLocation(req.body.listing.location);
            if (geoData) {
                listing.geometry = geoData; // Store coordinates
            }
        }

        // **Save the updated listing**
        await listing.save();

        req.flash("success", "Listing updated successfully!");
        res.redirect("/listings");
    } catch (error) {
        console.error("❌ Error updating listing:", error);
        req.flash("error", "Something went wrong while updating.");
        res.redirect(`/host/listings/${id}/edit`);
    }
};
module.exports.deleteReviewAsHost = async (req, res) => {
    try {
        const { listingId, reviewId } = req.params;

        // Find the listing and review
        const listing = await Listing.findById(listingId);
        const review = await Review.findById(reviewId);

        if (!listing || !review) {
            req.flash("error", "Listing or Review not found.");
            return res.redirect(`/listings/${listingId}`);
        }

        // Ensure host owns the listing
        if (req.user.role !== "admin" && (!listing.owner.equals(req.user._id))) {
            req.flash("error", "You are not authorized to delete this review.");
            return res.redirect(`/listings/${listingId}`);
        }

        // Delete review from listing
        await Listing.findByIdAndUpdate(listingId, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review deleted successfully!");
        res.redirect(`/listings/${listingId}`);
    } catch (error) {
        console.error("Error deleting review as host:", error);
        req.flash("error", "Failed to delete review. Try again.");
        res.redirect(`/listings/${listingId}`);
    }
};

module.exports.renderHostAnalytics = async (req, res) => {
    try {
        const hostId = req.user._id;

        const paidBookings = await Booking.find({ host: hostId, status: "Paid" });
        const totalEarnings = paidBookings.reduce((sum, booking) => sum + booking.amountPaid, 0);

        const totalBookings = paidBookings.length;

        const listingCounts = await Booking.aggregate([
            { $match: { host: hostId, status: "Paid" } },
            { $group: { _id: "$property", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);
        let mostBookedListing = "No Bookings Yet";
        if (listingCounts.length > 0) {
            const listing = await Listing.findById(listingCounts[0]._id);
            mostBookedListing = listing ? listing.title : "Unknown Listing";
        }

        const monthlyEarnings = await Booking.aggregate([
            { $match: { host: hostId, status: "Paid" } },
            { $group: { _id: { $month: "$createdAt" }, total: { $sum: "$amountPaid" } } },
            { $sort: { _id: 1 } }
        ]);

        res.render("host/analytics", { totalEarnings, totalBookings, mostBookedListing, monthlyEarnings });
    } catch (error) {
        console.error("Analytics Error:", error);
        req.flash("error", "Failed to load analytics.");
        res.redirect("/host/dashboard");
    }
};
module.exports.viewListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id)
            .populate("owner")  // Populate owner details
            .populate({
                path: "reviews",
                populate: { path: "author", select: "username" } // Ensure author details are populated
            });

        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/host/listings");
        }
        // ✅ Default values to prevent undefined errors
    listing.formattedCheckInTime = listing.checkInTime || "Not Provided";
    listing.formattedCheckOutTime = listing.checkOutTime || "Not Provided";

        res.render("host/listings/view", { listing });
    } catch (error) {
        console.error("Error fetching listing:", error);
        req.flash("error", "Something went wrong while fetching the listing.");
        res.redirect("/host/manage-listings");
    }
};