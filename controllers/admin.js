require("dotenv").config();
const Admin = require("../models/admin");
const User = require("../models/user");
const Listing = require("../models/listing");
const Review = require("../models/review");
const Host = require("../models/host");
const Booking = require("../models/booking");
const mongoose = require("mongoose");
const { cloudinary } = require("../cloudConfig");
const axios = require("axios"); 
const mapToken = process.env.MAP_TOKEN;

module.exports.renderAdminLoginForm = (req, res) => {
    res.render("admin/login");
};

module.exports.adminLogin = (req, res) => {
    req.flash("success", "Welcome Admin!");
    res.redirect("/admin/dashboard");
};

module.exports.logout = (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "Admin logged out successfully.");
        res.redirect("/admin/login");
    });
};

module.exports.adminDashboard = async (req, res) => {
    try {
        const [
            totalUsers,
            totalListings,
            totalReviews,
            pendingReviews,
            totalHosts,
            totalBookings 
        ] = await Promise.all([
            User.countDocuments({}),
            Listing.countDocuments({}),
            Review.countDocuments({}),
            Review.countDocuments({ status: "Pending" }),
            Host.countDocuments({}),
            Booking.countDocuments({}) 
        ]);

        res.render("admin/dashboard", {
            totalUsers,
            totalListings,
            totalReviews,
            pendingReviews,
            totalHosts,
            totalBookings 
        }); 
    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash("error", "Failed to load dashboard data.");
        res.redirect("/admin/login");
    }
};

module.exports.manageUsers = async (req, res) => {
    const users = await User.find({});
    res.render("admin/manageUsers", { users });
};

module.exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Deleting user with ID:", id);  

        if (!mongoose.isValidObjectId(id)) {
            req.flash("error", "Invalid User ID.");
            return res.redirect("/admin/manage-users");
        }

        const reviews = await Review.find({ author: id });

        await Listing.updateMany(
            { reviews: { $in: reviews.map(review => review._id) } },
            { $pull: { reviews: { $in: reviews.map(review => review._id) } } }
        );

        await Review.deleteMany({ author: id });

        const user = await User.findByIdAndDelete(id);

        console.log("Deleted User:", user);  

        req.flash(user ? "success" : "error", user ? "User deleted successfully along with their reviews." : "User not found.");
        res.redirect("/admin/manage-users");

    } catch (error) {
        console.error("Error deleting user:", error);
        req.flash("error", "Failed to delete user.");
        res.redirect("/admin/manage-users");
    }
};

module.exports.manageHosts = async (req, res) => {
    const hosts = await Host.find({});
    res.render("admin/manageHosts", { hosts });
};

module.exports.deleteHosts = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Deleting host with ID:", id); 

        if (!mongoose.isValidObjectId(id)) {
            req.flash("error", "Invalid Host ID.");
            return res.redirect("/admin/manage-hosts");
        }

        const host = await Host.findById(id);
        if (!host) {
            req.flash("error", "Host not found.");
            return res.redirect("/admin/manage-hosts");
        }

        const listings = await Listing.find({ owner: id });

        const reviewIds = listings.reduce((acc, listing) => acc.concat(listing.reviews), []);

        await Review.deleteMany({ _id: { $in: reviewIds } });

        console.log(`Deleted ${reviewIds.length} reviews on listings owned by Host ID:`, id);

        const deletedListings = await Listing.deleteMany({ owner: id });
        console.log(`Deleted ${deletedListings.deletedCount} listings of Host ID:`, id);

        const deletedHostReviews = await Review.deleteMany({ author: id });
        console.log(`Deleted ${deletedHostReviews.deletedCount} reviews by Host ID:`, id);

        await Host.findByIdAndDelete(id);
        console.log("Deleted Host:", host);

        req.flash("success", "Host and all related data deleted successfully.");
    } catch (error) {
        console.error("Error deleting host and related data:", error);
        req.flash("error", "Something went wrong while deleting the host.");
    }

    res.redirect("/admin/manage-hosts");
};

module.exports.manageListings = async (req, res) => {
    try {
            const listings = await Listing.find().populate({
                path: 'owner',
                select: 'username' 
            });
            
        console.log(listings); 
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

module.exports.viewListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id)
            .populate("owner")  
            .populate({
                path: "reviews",
                populate: { path: "author", select: "username" } 
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
        console.error("Geocoding Error:", error);
        return null;
    }
}

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
        console.error("Error rendering edit form:", error);
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

        listing.set(req.body.listing);

        if (req.file) {
            if (listing.images && listing.images.length > 0) {
                for (let img of listing.images) {
                    await cloudinary.uploader.destroy(img.filename);
                }
            }

            listing.images = [{ url: req.file.path, filename: req.file.filename }];
        }

        if (req.body.listing.location) {
            const geoData = await geocodeLocation(req.body.listing.location);
            if (geoData) {
                listing.geometry = geoData;
            }
        }

        await listing.save();

        req.flash("success", "Listing updated successfully!");
        res.redirect(`/admin/listings/${listing._id}`);
    } catch (error) {
        console.error("Error updating listing:", error);
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
        console.error("Error rendering delete page:", error);
        req.flash("error", "Something went wrong.");
        res.redirect("/admin/manage-listings");
    }
};

module.exports.deleteListing = async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);

        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/admin/manage-listings");
        }

        for (let image of listing.images) {
            await cloudinary.uploader.destroy(image.filename);
        }

        await Listing.findByIdAndDelete(id);

        req.flash("success", "Listing deleted successfully!");
        res.redirect("/admin/manage-listings");
    } catch (error) {
        console.error("Error deleting listing:", error);
        req.flash("error", "Something went wrong while deleting.");
        res.redirect("/admin/manage-listings");
    }
};

module.exports.destroyReview = async (req, res) => {
    try {
        let { id, reviewId } = req.params;

        const review = await Review.findById(reviewId);
        if (!review) {
            req.flash("error", "Review not found!");
            return res.redirect(`/admin/listings/${id}`);
        }

        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review Deleted!");
        res.redirect(`/admin/listings/${id}`); 
    } catch (error) {
        console.error("Error deleting review:", error);
        req.flash("error", "Failed to delete review. Please try again.");
        res.redirect(`/admin/listings/${id}`); 
    }
};

module.exports.viewAllReviews = async (req, res) => {
    try {
        const listings = await Listing.find({})
            .populate({
                path: "reviews",
                populate: { path: "author" }
            })
            .populate("owner"); 

        res.render("admin/listings/manageReviews", { listings });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        req.flash("error", "Failed to load reviews.");
        res.redirect("/admin/dashboard");
    }
};

module.exports.deleteReview = async (req, res) => {
    try {
        const { id, reviewId } = req.params;

        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });

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

        const paidBookings = await Booking.find({ status: "Paid" });

        const totalRevenue = paidBookings.reduce((sum, booking) => sum + booking.totalPrice, 0);

        const adminEarnings = paidBookings.reduce((sum, booking) => sum + booking.adminCommission, 0);

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

        const monthlyRevenue = await Booking.aggregate([
            { $match: { status: "Paid" } },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    total: { $sum: "$totalPrice" }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.render("admin/analytics", {
            totalHosts,
            totalListings,
            totalBookings,
            totalRevenue,
            adminEarnings,
            mostBookedListing,
            monthlyRevenue
        });
    } catch (error) {
        console.error("Admin Analytics Error:", error);
        req.flash("error", "Failed to load analytics.");
        res.redirect("/admin/dashboard");
    }
};
module.exports.viewBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({})
            .populate({
                path: "property",
                populate: {
                    path: "owner",
                    model: "Host" 
                }
            })
            .populate("guest");

        res.render("admin/bookings", { bookings });
    } catch (err) {
        console.error("Error fetching bookings for admin:", err);
        res.status(500).send("Error loading bookings");
    }
};