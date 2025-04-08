const mongoose = require("mongoose");
const Listing = require("../models/listing");
const fetch = require('node-fetch'); 
const mapToken = process.env.MAP_TOKEN;
const Joi = require("joi");

const listingSchema = Joi.object({
    listing: Joi.object({
       title: Joi.string().min(5).max(100).required(),
       description: Joi.string().min(10).max(500).required(),
       location: Joi.string().required(),
       country: Joi.string().required(),
       price: Joi.number().required().min(0),
       images: Joi.array().items(
          Joi.object({
             url: Joi.string().uri().required(),
             filename: Joi.string().required()
          })
       ).min(1).required(),
       status: Joi.string().valid("Active", "Inactive", "Pending").default("Pending"),
       isFeatured: Joi.boolean().default(false),
       category: Joi.string()
          .valid("apartment", "house", "villa", "cabin", "hotel", "bungalow", "hostel", "resort", "camping","cave", "container", "chalet", "room", "treehouse", "igloo", "other")
          .insensitive()
          .required(),
       owner: Joi.string().required(), // ✅ Owner should be a string
       checkInTime: Joi.string().required(),
       checkOutTime: Joi.string().required(),
       geometry: Joi.object({
          type: Joi.string().valid("Point").required(),
          coordinates: Joi.array().items(Joi.number()).length(2).required()
       }).optional()
    }).required()
});

module.exports.index = async (req, res) => {
    const allListings = await Listing.find({}).lean();
    res.render("listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
    res.render("host/addListing.ejs");
};

const formatTime = (timeString) => {
    const [hour, minute] = timeString.split(":").map(Number);
    const period = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 || 12; 
    return `${formattedHour}:${minute.toString().padStart(2, "0")} ${period}`;
  };
  
  module.exports.showListing = async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
        req.flash("error", "Invalid listing ID.");
        return res.redirect("/listings");
    }

    const listing = await Listing.findById(id)
        .populate({
            path: "reviews",
            populate: { path: "author", select: "username" }
        })
        .populate("owner", "_id username role")  // ✅ Ensure owner is populated
        .lean();

    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }
       // ✅ Default values to prevent undefined errors
    listing.formattedCheckInTime = listing.checkInTime || "Not Provided";
    listing.formattedCheckOutTime = listing.checkOutTime || "Not Provided";
     
   
    res.render("listings/show", { listing, currUser: req.user });
};


module.exports.createListing = async (req, res, next) => {
    console.log("Inside createListing");
    console.log("Received Body:", req.body);

    try {
        if (!req.user || req.user.role !== "host") {
            req.flash("error", "Only hosts can create listings.");
            return res.redirect("/host/addListing");
        }

        console.log("Creating listing for user:", req.user);

        // ✅ Assign owner as a string
        req.body.listing.owner = req.user._id.toString(); // ✅ Store as string, not ObjectId

        // Convert category to lowercase
        if (req.body.listing.category) {
            req.body.listing.category = req.body.listing.category.toLowerCase();
        }

        const location = req.body.listing.location;
        console.log("Location provided:", location);

        if (!location) {
            req.flash("error", "Location is required.");
            return res.redirect("/host/addListing");
        }

        let coordinates = [0, 0]; // Default coordinates
        try {
            const geoResponse = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(location)}.json?key=${mapToken}`);
            const geoData = await geoResponse.json();

            console.log("🌍 GeoData Response:", JSON.stringify(geoData, null, 2));

            if (geoData.features && geoData.features.length > 0) {
                coordinates = geoData.features[0].geometry.coordinates;
            }

            if (!coordinates || coordinates.length !== 2) {
                console.error("Failed to fetch valid coordinates");
                req.flash("error", "Could not determine location coordinates. Try another location.");
                return res.redirect("/host/addListing");
            }
        } catch (geoError) {
            console.error("Error Fetching Coordinates:", geoError);
            req.flash("error", "Failed to fetch coordinates. Try again later.");
            return res.redirect("/host/addListing");
        }

        console.log("Fetched Coordinates:", coordinates);

        req.body.listing.geometry = {
            type: "Point",
            coordinates: coordinates,
        };

        console.log("Final Geometry:", req.body.listing.geometry);

        // ✅ Validate using Joi schema
        const { error } = listingSchema.validate(req.body);
        if (error) {
            console.log("Validation Error:", error.details);
            req.flash("error", error.details.map(err => err.message).join(", "));
            return res.redirect("/host/addListing");
        }

        // ✅ Create and save listing (No need to convert owner again)
        const newListing = new Listing({
            ...req.body.listing,
            images: req.files ? req.files.map(file => ({ url: file.path, filename: file.filename })) : [],
        });

        console.log("Ready to save listing:", newListing);

        await newListing.save();
        console.log("Listing Created Successfully!");

        req.flash("success", "New Listing Created!");
        res.redirect("/host/manage-listings");

    } catch (error) {
        console.error("Error creating listing:", error);
        req.flash("error", "Failed to create listing.");
        res.redirect("/host/addListing");
    }
};



