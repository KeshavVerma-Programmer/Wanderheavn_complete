require("dotenv").config();
const Admin = require("../models/admin");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Host = require("../models/host");
const Booking = require("../models/booking");
const mongoose = require("mongoose"); // For ID validation
const { cloudinary } = require("../cloudConfig");
const axios = require("axios"); 
const mapToken = process.env.MAP_TOKEN;

// const fetch = require("node-fetch");
// ==========================
// ADMIN LOGIN
// ==========================
module.exports.renderAdminLoginForm = (req, res) => {
    res.render("admin/login");
};

module.exports.adminLogin = (req, res) => {
    req.flash("success", "Welcome Admin!");
    res.redirect("/admin/dashboard");
};

// ==========================
// ADMIN LOGOUT
// ==========================
module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "Admin logged out successfully.");
        res.redirect("/admin/login");
    });
};

// ==========================
// ADMIN DASHBOARD
// ==========================
module.exports.adminDashboard = async (req, res) => {
    try {
        const [totalUsers, totalListings, totalReviews, pendingReviews, totalHosts] = await Promise.all([
            User.countDocuments({}),
            Listing.countDocuments({}),
            Review.countDocuments({}),
            Review.countDocuments({ status: "Pending" }),
            Host.countDocuments({}) // Ensure correct host count
        ]);

        res.render("admin/dashboard", { totalUsers, totalListings, totalReviews, pendingReviews, totalHosts }); 
    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash("error", "Failed to load dashboard data.");
        res.redirect("/admin/login");
    }
};

// ==========================
// MANAGE USERS
// ==========================
module.exports.manageUsers = async (req, res) => {
    const users = await User.find({});
    res.render("admin/manageUsers", { users });
};

module.exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Deleting user with ID:", id);  // Debugging line

        // Validate if ID is a proper MongoDB ObjectId
        if (!mongoose.isValidObjectId(id)) {
            req.flash("error", "Invalid User ID.");
            return res.redirect("/admin/manage-users");
        }

        // Find and delete all reviews authored by the user
        const reviews = await Review.find({ author: id });

        // Remove these reviews from their respective listings
        await Listing.updateMany(
            { reviews: { $in: reviews.map(review => review._id) } },
            { $pull: { reviews: { $in: reviews.map(review => review._id) } } }
        );

        // Delete all reviews authored by the user
        await Review.deleteMany({ author: id });

        // Finally, delete the user
        const user = await User.findByIdAndDelete(id);

        console.log("Deleted User:", user);  // Debugging line

        req.flash(user ? "success" : "error", user ? "User deleted successfully along with their reviews." : "User not found.");
        res.redirect("/admin/manage-users");

    } catch (error) {
        console.error("Error deleting user:", error);
        req.flash("error", "Failed to delete user.");
        res.redirect("/admin/manage-users");
    }
};
// ==========================
// MANAGE HOSTS
// ==========================
module.exports.manageHosts = async (req, res) => {
    const hosts = await Host.find({});
    res.render("admin/manageHosts", { hosts });
};

module.exports.deleteHosts = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Deleting host with ID:", id); // Debugging

        if (!mongoose.isValidObjectId(id)) {
            req.flash("error", "Invalid Host ID.");
            return res.redirect("/admin/manage-hosts");
        }

        // Find the host first
        const host = await Host.findById(id);
        if (!host) {
            req.flash("error", "Host not found.");
            return res.redirect("/admin/manage-hosts");
        }

        // Find all listings owned by this host
        const listings = await Listing.find({ owner: id });

        // Collect all review IDs from these listings
        const reviewIds = listings.reduce((acc, listing) => acc.concat(listing.reviews), []);

        // Delete all reviews associated with these listings
        await Review.deleteMany({ _id: { $in: reviewIds } });

        console.log(`Deleted ${reviewIds.length} reviews on listings owned by Host ID:`, id);

        // Delete all listings associated with this host
        const deletedListings = await Listing.deleteMany({ owner: id });
        console.log(`Deleted ${deletedListings.deletedCount} listings of Host ID:`, id);

        // Delete all reviews written by the host (if applicable)
        const deletedHostReviews = await Review.deleteMany({ author: id });
        console.log(`Deleted ${deletedHostReviews.deletedCount} reviews by Host ID:`, id);

        // Finally, delete the host
        await Host.findByIdAndDelete(id);
        console.log("Deleted Host:", host);

        req.flash("success", "Host and all related data deleted successfully.");
    } catch (error) {
        console.error("Error deleting host and related data:", error);
        req.flash("error", "Something went wrong while deleting the host.");
    }

    res.redirect("/admin/manage-hosts");
};

// ==========================
// MANAGE LISTINGS
// ==========================
module.exports.manageListings = async (req, res) => {
    try {
        // const listings = await Listing.find({})
        //     .populate("owner", "name") // Ensure we get only the "name" field
        //     .exec();
            const listings = await Listing.find().populate({
                path: 'owner',
                select: 'username' // Use 'username' instead of 'name' if applicable
            });
            
        console.log(listings); // Debugging: Check populated data
        res.render("admin/manageListings", { listings });
    } catch (err) {
        console.error("Error fetching listings:", err);
        res.status(500).send("Internal Server Error");
    }
};

module.exports.approveListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Invalid Listing ID.");
        return res.redirect("/admin/manage-listings");
    }

    const listing = await Listing.findByIdAndUpdate(id, { status: "Active" });
    req.flash(listing ? "success" : "error", listing ? "Listing approved successfully!" : "Listing not found.");
    res.redirect("/admin/manage-listings");
};

module.exports.rejectListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Invalid Listing ID.");
        return res.redirect("/admin/manage-listings");
    }

    const listing = await Listing.findByIdAndUpdate(id, { status: "Inactive" });
    req.flash(listing ? "success" : "error", listing ? "Listing rejected successfully!" : "Listing not found.");
    res.redirect("/admin/manage-listings");
};

module.exports.featureListing = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Invalid Listing ID.");
        return res.redirect("/admin/manage-listings");
    }

    await Listing.updateMany({}, { isFeatured: false });
    const listing = await Listing.findByIdAndUpdate(id, { isFeatured: true });

    req.flash(listing ? "success" : "error", listing ? "Listing marked as Featured!" : "Listing not found.");
    res.redirect("/admin/manage-listings");
};

// Get a specific listing for admin view
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
            return res.redirect("/admin/listings");
        }

        res.render("admin/listings/view", { listing });
    } catch (error) {
        console.error("Error fetching listing:", error);
        req.flash("error", "Something went wrong while fetching the listing.");
        res.redirect("/admin/manage-listings");
    }
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

// Render Edit Form
module.exports.renderEditForm = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/admin/listings");
        }
        res.render("admin/listings/edit", { listing });
    } catch (error) {
        console.error("❌ Error rendering edit form:", error);
        req.flash("error", "Something went wrong.");
        res.redirect("/admin/listings");
    }
};

module.exports.updateListing = async (req, res) => {
    try {
        const { id } = req.params;
        let listing = await Listing.findById(id);

        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/admin/listings");
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
        res.redirect(`/admin/listings/${listing._id}`);
    } catch (error) {
        console.error("❌ Error updating listing:", error);
        req.flash("error", "Something went wrong while updating.");
        res.redirect(`/admin/listings/${id}/edit`);
    }
};

module.exports.renderDeletePage = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/admin/manage-listings");
        }
        res.render("admin/listings/delete", { listing });
    } catch (error) {
        console.error("❌ Error rendering delete page:", error);
        req.flash("error", "Something went wrong.");
        res.redirect("/admin/manage-listings");
    }
};

// Delete Listing
module.exports.deleteListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);

        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/admin/manage-listings");
        }

        // Delete images from Cloudinary
        for (let image of listing.images) {
            await cloudinary.uploader.destroy(image.filename);
        }

        // Delete listing from the database
        await Listing.findByIdAndDelete(id);

        req.flash("success", "Listing deleted successfully!");
        res.redirect("/admin/manage-listings");
    } catch (error) {
        console.error("❌ Error deleting listing:", error);
        req.flash("error", "Something went wrong while deleting.");
        res.redirect("/admin/manage-listings");
    }
};

module.exports.destroyReview = async (req, res) => {
    try {
        let { id, reviewId } = req.params;

        // Check if the review exists
        const review = await Review.findById(reviewId);
        if (!review) {
            req.flash("error", "Review not found!");
            return res.redirect(`/admin/listings/${id}`);
        }

        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review Deleted!");
        res.redirect(`/admin/listings/${id}`); // Corrected path
    } catch (error) {
        console.error("Error deleting review:", error);
        req.flash("error", "Failed to delete review. Please try again.");
        res.redirect(`/admin/listings/${id}`); // Corrected path
    }
};
module.exports.viewAllReviews = async (req, res) => {
    try {
        const listings = await Listing.find({})
            .populate({
                path: "reviews",
                populate: { path: "author" }
            })
            .populate("owner"); // <-- Ensure 'owner' is populated

        res.render("admin/listings/manageReviews", { listings });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        req.flash("error", "Failed to load reviews.");
        res.redirect("/admin/dashboard");
    }
};

// ✅ Controller to delete a review
module.exports.deleteReview = async (req, res) => {
    try {
        const { id, reviewId } = req.params;

        // Remove review reference from the listing
        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });

        // Delete review from database
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review deleted successfully.");
        res.redirect("/admin/listings/manage-reviews");
    } catch (error) {
        console.error("Error deleting review:", error);
        req.flash("error", "Failed to delete review.");
        res.redirect("/admin/listings/manage-reviews");
    }
};

module.exports.renderAdminAnalytics = async (req, res) => {
    try {
        const totalHosts = await Host.countDocuments();
        const totalListings = await Listing.countDocuments();
        const totalBookings = await Booking.countDocuments({ status: "Paid" });

        // Calculate total revenue from successful bookings
        const paidBookings = await Booking.find({ status: "Paid" });
        const totalRevenue = paidBookings.reduce((sum, booking) => sum + booking.amountPaid, 0);

        // Find the most booked listing
        const listingCounts = await Booking.aggregate([
            { $match: { status: "Paid" } },
            { $group: { _id: "$property", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 1 }
        ]);

        let mostBookedListing = "No Bookings Yet";
        if (listingCounts.length > 0) {
            const listing = await Listing.findById(listingCounts[0]._id);
            mostBookedListing = listing ? listing.title : "Unknown Listing";
        }

        // Monthly Revenue Chart Data
        const monthlyRevenue = await Booking.aggregate([
            { $match: { status: "Paid" } },
            { $group: { _id: { $month: "$createdAt" }, total: { $sum: "$amountPaid" } } },
            { $sort: { _id: 1 } }
        ]);

        res.render("admin/analytics", { 
            totalHosts, 
            totalListings, 
            totalBookings, 
            totalRevenue, 
            mostBookedListing, 
            monthlyRevenue 
        });
    } catch (error) {
        console.error("Admin Analytics Error:", error);
        req.flash("error", "Failed to load analytics.");
        res.redirect("/admin/dashboard");
    }
};