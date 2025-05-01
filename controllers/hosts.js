const Host = require("../models/host");
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const mongoose = require("mongoose");
const { cloudinary } = require("../cloudConfig");
const axios = require("axios"); 
const mapToken = process.env.MAP_TOKEN;
const Review=require("../models/review");

module.exports.renderHostSignupForm = (req, res) => {
    res.render("hosts/signup", { username: "", email: "", phone: "" });
};

module.exports.hostSignup = async (req, res, next) => {
    console.log("Received Data:", req.body); 

    const { username, email, phone, password } = req.body;

    try {
        if (username.length < 5) {
            req.flash("error", "Username must be at least 5 characters long.");
            return res.redirect("/host/signup");
        }

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
            role: "host",  
        });

        const registeredHost = await Host.register(newHost, password);

        req.login(registeredHost, (err) => {
            if (err) return next(err);
            console.log("Logged in user:", req.user); 
            req.flash("success", "Welcome to WanderHeavn as a Host!");
            return res.redirect("/host/dashboard");
        });

    } catch (error) {
        console.error("Signup Error:", error);

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
        else if (error.name === "UserExistsError") {
            req.flash("error", "This username is already taken. Try another.");
        } 
        else if (error.errors?.email?.message) {
            req.flash("error", "Invalid email format. Please enter a valid email.");
        }
        else {
            req.flash("error", "Something went wrong. Please check your details and try again.");
        }

        return res.redirect("/host/signup");
    }
};

module.exports.renderHostLoginForm = (req, res) => {
    res.render("hosts/login");
};

module.exports.hostLogin = (req, res) => {
    console.log("Authenticated User in Login:", req.user); 

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

module.exports.renderDashboard = async (req, res) => {
    try {
        const totalListings = await Listing.countDocuments({ owner: req.user._id });

        const activeBookings = await Booking.countDocuments({ host: req.user._id, status: "Paid" });

        const bookings = await Booking.find({ host: req.user._id, status: "Paid" });
        const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.amountPaid || 0), 0);

        res.render("host/dashboard", { totalListings, activeBookings, totalEarnings });
    } catch (error) {
        console.error("Dashboard Error:", error);
        req.flash("error", "Failed to load dashboard data.");
        res.redirect("/listings");
    }
};

module.exports.manageListings = async (req, res) => {
    const listings = await Listing.find({ owner: req.user._id });
    res.render("host/manageListings", { listings });
};

module.exports.addListing = async (req, res) => {
    console.log("Request Body:", req.body); 

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

module.exports.manageBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ host: req.user._id })
            .populate("property") 
            .populate("guest");  
        res.render("host/manageBookings", { bookings });
    } catch (err) {
        console.error("Error fetching bookings:", err);
        req.flash("error", "Something went wrong while fetching bookings.");
        res.redirect("/host/dashboard");
    }
};

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
        console.error(" Geocoding Error:", error);
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
        console.error(" Error rendering edit form:", error);
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
        res.redirect("/listings");
    } catch (error) {
        console.error(" Error updating listing:", error);
        req.flash("error", "Something went wrong while updating.");
        res.redirect(`/host/listings/${id}/edit`);
    }
};

module.exports.deleteReviewAsHost = async (req, res) => {
    try {
        const { listingId, reviewId } = req.params;

        const listing = await Listing.findById(listingId);
        const review = await Review.findById(reviewId);

        if (!listing || !review) {
            req.flash("error", "Listing or Review not found.");
            return res.redirect(`/listings/${listingId}`);
        }

        if (req.user.role !== "admin" && (!listing.owner.equals(req.user._id))) {
            req.flash("error", "You are not authorized to delete this review.");
            return res.redirect(`/listings/${listingId}`);
        }

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
            .populate("owner")  
            .populate({
                path: "reviews",
                populate: { path: "author", select: "username" } 
            });

        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/host/listings");
        }
    listing.formattedCheckInTime = listing.checkInTime || "Not Provided";
    listing.formattedCheckOutTime = listing.checkOutTime || "Not Provided";

        res.render("host/listings/view", { listing });
    } catch (error) {
        console.error("Error fetching listing:", error);
        req.flash("error", "Something went wrong while fetching the listing.");
        res.redirect("/host/manage-listings");
    }
};

const SibApiV3Sdk = require('sib-api-v3-sdk'); 
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.SIB_API_KEY; 
const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

module.exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const host = await Host.findOne({ email });

    if (!host) {
        req.flash('error', 'No host account found with that email.');
        return res.redirect('/host/login');
    }

    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; 

    host.otp = otp;
    host.otpExpires = otpExpires;
    await host.save();

    const sendSmtpEmail = {
        sender: { name: 'WanderHeavn Support', email: 'wanderheavn2025@gmail.com' },
        to: [{ email: host.email }],
        subject: 'Password Reset OTP',
        htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 10px;">
          <div style="background-color: #ff4d4d; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h2>WanderHeavn</h2>
          </div>
          <div style="padding: 20px; color: #333;">
            <h2 style="color: #ff4d4d;">Forgot your password?</h2>
            <p>Use the following OTP to reset your password:</p>
            <h3 style="color: green;">${otp}</h3>
            <p style="color: purple;">This OTP will expire in 10 minutes.</p>
          </div>
          <div style="text-align: center; font-size: 12px; color: gray; padding: 10px 0;">
            © 2025 <span style="color: #ff4d4d;">WanderHeavn</span>. All rights reserved.
          </div>
        </div>
      `,
    };

    await tranEmailApi.sendTransacEmail(sendSmtpEmail);

    req.flash('success', 'OTP sent to your email.');
    res.redirect('/host/verify-otp');
};

module.exports.showVerifyOtpForm = (req, res) => {
    res.render('hosts/verify-otp'); 
};

module.exports.verifyOtp = async (req, res) => {
    const { otp } = req.body;
    const host = await Host.findOne({
        otp,
        otpExpires: { $gt: Date.now() }
    });

    if (!host) {
        req.flash('error', 'Invalid or expired OTP.');
        return res.redirect('/host/verify-otp');
    }

    res.render('hosts/reset-password', { userId: host._id }); 
};

module.exports.resetPassword = async (req, res) => {
    const { userId, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match.');
        return res.redirect('back');
    }

    try {
        const host = await Host.findById(userId);
        if (!host) {
            req.flash('error', 'Host not found.');
            return res.redirect('/host/login');
        }

        const { error } = await Host.authenticate()(host.username, password);
        if (!error) {
            req.flash('error', 'Use a different password than your current one.');
            return res.redirect('back');
        }

        await new Promise((resolve, reject) => {
            host.setPassword(password, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        host.otp = undefined;
        host.otpExpires = undefined;
        await host.save();

        req.flash('success', 'Password successfully updated. Please log in.');
        res.redirect('/host/login');
    } catch (err) {
        console.error("Reset Error:", err);
        req.flash('error', err?.message || 'Password must be at least 6 characters and include a special character.');
        res.redirect('back');
    }
};