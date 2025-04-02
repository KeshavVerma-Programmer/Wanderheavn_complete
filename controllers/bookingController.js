require('dotenv').config(); // Make sure this line is at the top
const Listing = require("../models/listing");
const Booking = require("../models/booking");
const Razorpay = require("razorpay");  // Import Razorpay
const crypto = require("crypto");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
module.exports.getBookingPage = async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found!");
        return res.redirect("/listings");
    }

    res.render("bookings/book", { listing, currUser: req.user });
};

// Create Booking (Temporary Data)
module.exports.createBooking = async (req, res) => {
    const { id } = req.params;
    const { bookingDates } = req.body;

    if (!bookingDates || bookingDates.length === 0) {
        req.flash("error", "Please select at least two consecutive dates for booking.");
        return res.redirect(`/listings/${id}/book`);
    }

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    // Convert selected dates to YYYY-MM-DD format
    const selectedDates = bookingDates.split(",").map(date => new Date(date).toISOString().split("T")[0]);

    // Ensure at least 2 dates are selected
    if (selectedDates.length < 2) {
        req.flash("error", "Please select at least two consecutive dates for booking.");
        return res.redirect(`/listings/${id}/book`);
    }

    // Ensure bookedDates are also in YYYY-MM-DD format before checking
    const bookedDates = listing.bookedDates.map(date => new Date(date).toISOString().split("T")[0]);

    // Check if any selected date is already in the bookedDates array
    const alreadyBooked = selectedDates.some(date => bookedDates.includes(date));

    if (alreadyBooked) {
        req.flash("error", "One or more selected dates are already booked.");
        return res.redirect(`/listings/${id}/book`);
    }

    // Pass temporary booking data via query parameters
    res.redirect(`/listings/${id}/payment?dates=${selectedDates.join(",")}&listingId=${listing._id}`);
};
// Get Payment Page (No data saved in DB yet)Invalid payment request.
module.exports.getPaymentPage = async (req, res) => {
    const { id } = req.params;
    const { dates, listingId } = req.query;

    if (!dates || !listingId) {
        req.flash("error", "Invalid booking request.");
        return res.redirect(`/listings/${id}/book`);
    }

    try {
        const listing = await Listing.findById(listingId);

        if (!listing) {
            req.flash("error", "Listing not found.");
            return res.redirect(`/listings/${id}/book`);
        }

        const selectedDates = dates.split(",");
        const totalNights = selectedDates.length - 1; // Corrected price calculation
        const totalPrice = totalNights * listing.price; // Multiply by listing price

        res.render("bookings/payment", { selectedDates, booking: { property: listing, bookedDates: selectedDates, totalPrice } });
    } catch (err) {
        req.flash("error", "Something went wrong.");
        return res.redirect(`/listings/${id}/book`);
    }
};

module.exports.processPayment = async (req, res) => {
    try {
        console.log("📢 Full Received Request Body:", req.body);

        const listingId = req.params.id;
        const bookingDates = req.body.bookingDates;

        console.log("📢 Received bookingDates:", bookingDates, "Listing ID:", listingId);

        if (!bookingDates || !listingId || typeof bookingDates !== "string") {
            console.log("❌ Error: Missing bookingDates or listingId");
            return res.status(400).json({ success: false, message: "Invalid payment request." });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            console.log(`❌ Error: Listing not found for ID: ${listingId}`);
            return res.status(404).json({ success: false, message: "Listing not found." });
        }

        if (!listing.price) {
            console.log("❌ Error: Listing price is missing.");
            return res.status(400).json({ success: false, message: "Invalid listing price." });
        }

        const selectedDates = bookingDates.split(",").map(date => date.trim());
        const totalNights = selectedDates.length - 1; // Corrected price calculation
        const totalPrice = totalNights * listing.price;

        console.log("🔎 Razorpay Key ID:", process.env.RAZORPAY_KEY_ID);
        console.log("🔎 Razorpay Key Secret:", process.env.RAZORPAY_KEY_SECRET);

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            console.log("❌ Error: Razorpay API keys missing.");
            return res.status(500).json({ success: false, message: "Payment service unavailable." });
        }

        const orderOptions = {
            amount: totalPrice * 100, // Convert to paise
            currency: "INR",
            receipt: `order_${new Date().getTime()}`,
            payment_capture: 1,
        };

        console.log("🛒 Creating Razorpay Order with options:", orderOptions);

        try {
            const razorpayOrder = await razorpay.orders.create(orderOptions);
            console.log("✅ Razorpay Order Created:", razorpayOrder);
            const listing = await Listing.findById(listingId).populate({ path: "owner", model: "Host" });

            console.log("🔎 Listing Owner ID:", listing.owner);

            const newBooking = new Booking({
                property: listingId,
                guest: req.user._id,
                host: listing.owner._id,  
                bookedDates: selectedDates,
                totalPrice,
                status: "Pending",
                orderId: razorpayOrder.id,
            });

            await newBooking.save();

            return res.json({
                success: true,
                message: "Razorpay order created successfully",
                orderId: razorpayOrder.id,
                amount: totalPrice * 100,
                currency: "INR",
                key: process.env.RAZORPAY_KEY_ID,
                bookingId: newBooking._id,
            });

        } catch (razorpayError) {
            console.error("❌ Razorpay Error:", razorpayError);
            return res.status(500).json({ success: false, message: "Payment processing failed." });
        }

    } catch (err) {
        console.error("❌ Error processing payment:", err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
};

module.exports.verifyPayment = async (req, res) => {
    try {
        const { paymentId, orderId, signature } = req.body;

        // ✅ Find existing booking associated with orderId
        let booking = await Booking.findOne({ orderId });

        if (!booking) {
            console.error("❌ No booking found for orderId:", orderId);
            return res.status(400).json({ success: false, message: "Invalid booking." });
        }

        // ✅ Find the associated listing
        const listing = await Listing.findById(booking.property);
        if (!listing) {
            console.error("❌ Listing not found for booked property.");
            return res.status(400).json({ success: false, message: "Listing not found." });
        }

        // ✅ Check if any selected dates are already booked (edge case)
        const alreadyBooked = booking.bookedDates.some(date => listing.bookedDates.includes(date));
        if (alreadyBooked) {
            console.error("❌ Error: One or more selected dates are already booked.");
            return res.status(400).json({ success: false, message: "Some dates are already booked." });
        }

        // ✅ Append new booked dates to listing
        listing.bookedDates.push(...booking.bookedDates);
        await listing.save();

        // ✅ Update booking status & store payment ID
        booking.razorpayPaymentId = paymentId;
        booking.status = "Confirmed";
        await booking.save();

        console.log("✅ Payment Verified & Booking Confirmed:", booking._id);

        res.json({ success: true, bookingId: booking._id });

    } catch (error) {
        console.error("❌ Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Payment verification failed." });
    }
};

module.exports.getConfirmationPage = async (req, res) => {
    const { bookingId } = req.query;

    if (!bookingId) {
        req.flash("error", "Invalid booking.");
        return res.redirect("/listings");
    }

    const booking = await Booking.findById(bookingId)
        .populate({ path: "host", select: "username email" }) 
        .populate({ path: "guest", select: "username email" })
        .populate("property");

    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/listings");
    }

    // ✅ Update the payment status to "Paid" once the user reaches this page
    if (booking.status !== "Paid") {
        booking.status = "Paid";
        await booking.save();
        console.log(`✅ Booking ${bookingId} status updated to Paid.`);
    }

    res.render("bookings/confirmation", { booking, currUser: req.user });
};
