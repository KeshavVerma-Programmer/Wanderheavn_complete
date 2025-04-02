const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./review.js");
const User = require("./user.js"); // Import User model to check roles
const Host = require("./host.js"); // Import Host model

const listingSchema = new Schema(
  {
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: {
      type: String,
      required: true,
      minlength: [10, "Description must be at least 10 characters long."]
    },
    category: { 
      type: String, 
      required: true,
      enum: ["apartment", "villa", "cabin", "bungalow", "resort", "camping"],
      lowercase: true // Ensure valid categories
    },
    images: [
      {
        url: { type: String, required: true },
        filename: { type: String, required: true },
      }
    ],
    price: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    location: { 
      type: String, 
      required: true 
    },
    country: { 
      type: String, 
      required: true 
    },
    status: { 
      type: String, 
      enum: ["Active", "Pending","Already Booked"], 
      default: "Pending",
      required: true
    },
    isFeatured: { 
      type: Boolean, 
      default: false 
    },
    reviews: [
      { 
        type: Schema.Types.ObjectId, 
        ref: "Review" 
      }
    ],
    owner: { 
      type: Schema.Types.ObjectId,  
      ref: "Host", 
      required: true,
    },
    geometry: {
      type: { 
        type: String, 
        enum: ["Point"], 
        required: true 
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (val) {
            return val.length === 2;
          },
          message: "Coordinates must contain exactly [longitude, latitude]."
        }
      }
    },
    checkInTime: { 
      type: String, 
      required: true 
    },
    checkOutTime: { 
      type: String, 
      required: true 
    },
    // Store booked dates
    bookedDates: [{ type: Date }]
  },
  { timestamps: true }
);

// Cascade delete associated reviews when listing is deleted
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing && listing.reviews && listing.reviews.length) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
