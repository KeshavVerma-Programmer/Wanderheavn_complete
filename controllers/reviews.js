const Listing = require("../models/listing");
const Review = require("../models/review");

module.exports.createReview = async (req, res) => {
    try {
        console.log("Received Review Data:", req.body.review); // Debugging

        if (!req.body.review || !req.body.review.rating) {
            req.flash("error", "Rating is required!");
            return res.redirect(`/listings/${req.params.id}`);
        }

        let listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash("error", "Listing not found!");
            return res.redirect("/listings");
        }

        let newReview = new Review({
            rating: parseInt(req.body.review.rating), // Convert rating to number
            comment: req.body.review.comment,
            author: req.user._id
        });

        listing.reviews.push(newReview);

        await newReview.save();
        await listing.save();

        req.flash("success", "New Review Created!");
        res.redirect(`/listings/${listing._id}`);
    } catch (error) {
        console.error("Error creating review:", error);
        req.flash("error", "Comment should be at least 5 characters long.");
        res.redirect(`/listings/${req.params.id}`);
    }
};

module.exports.destroyReview = async (req, res) => {
    try {
        let { id, reviewId } = req.params;

        // Check if the review exists
        const review = await Review.findById(reviewId);
        if (!review) {
            req.flash("error", "Review not found!");
            return res.redirect(`/listings/${id}`);
        }

        await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
        await Review.findByIdAndDelete(reviewId);

        req.flash("success", "Review Deleted!");
        res.redirect(`/listings/${id}`);
    } catch (error) {
        console.error("Error deleting review:", error);
        req.flash("error", "Failed to delete review. Please try again.");
        res.redirect(`/listings/${id}`);
    }
};
