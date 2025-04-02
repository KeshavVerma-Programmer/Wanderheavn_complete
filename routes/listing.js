const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isHost, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const bookingController = require("../controllers/bookingController");

const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });
const Listing = require("../models/listing.js");

// 📌 Route: Display all listings (with search & category filter)
router.route("/")
  .get(async (req, res) => {
    const { search, category } = req.query;
    let filter = {};

    if (search) {
      filter = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { location: { $regex: search, $options: "i" } },
          { price: !isNaN(search) ? parseInt(search) : undefined }
        ].filter(Boolean)
      };
    }

    if (category) {
      filter.category = category;
    }

    try {
      const allListings = await Listing.find(filter);
      res.render("listings/index", { allListings, category, search, currUser: req.user });
    } catch (err) {
      console.error(err);
      res.redirect("/listings");
    }
  })
  .post(
    isLoggedIn,
    isHost,
    upload.array("listing[images]"),
    (req, res, next) => {
      console.log("Received Body:", req.body);
      console.log("Received Files:", req.files);

      if (!req.files || req.files.length === 0) {
        req.flash("error", "No images uploaded.");
        return res.redirect("/listings/new");
      }

      req.body.listing.images = req.files.map((file) => ({
        url: file.path,
        filename: file.filename,
      }));

      // Capitalize category name
      if (req.body.listing.category) {
        req.body.listing.category =
          req.body.listing.category.charAt(0).toUpperCase() +
          req.body.listing.category.slice(1).toLowerCase();
      }

      // ✅ Store owner as a string instead of ObjectId
      req.body.listing.owner = req.user._id.toString();

      next();
    },
    validateListing,
    wrapAsync(listingController.createListing)
  );

// 📌 Route: Show a single listing
router.route("/:id")
  .get(wrapAsync(listingController.showListing));

// 📌 Route: Booking a listing
router.get("/:id/book", isLoggedIn, wrapAsync(bookingController.getBookingPage));
router.post("/:id/book", isLoggedIn, wrapAsync(bookingController.createBooking));

// 📌 Route: Payment Processing
router.get("/:id/payment", isLoggedIn, wrapAsync(bookingController.getPaymentPage));
router.post("/:id/payment", isLoggedIn, wrapAsync(bookingController.processPayment));
router.post("/:id/payment/verify", isLoggedIn, wrapAsync(bookingController.verifyPayment));

// Confirmation
router.get("/:id/confirmation", isLoggedIn, wrapAsync(bookingController.getConfirmationPage));

router.get("/category/:category", async (req, res) => {
  const { category } = req.params;
  if (!["apartment", "villa", "cabin", "bungalow", "resort", "camping"].includes(category.toLowerCase())) {
      req.flash("error", "Invalid category.");
      return res.redirect("/listings");
  }
  const listings = await Listing.find({ category: category.toLowerCase() });
  res.render("listings/index", { allListings: listings, category });
});


module.exports = router;