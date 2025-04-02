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

    // Convert selected dates to YYYY-MM-DD format & sort
    let selectedDates = bookingDates.split(",").map(date => new Date(date).toISOString().split("T")[0]);
    selectedDates.sort(); // Ensure dates are in order

    // Find the longest continuous sequence
    let checkOutDate = selectedDates[0]; // Default to first date
    for (let i = 1; i < selectedDates.length; i++) {
        let prevDate = new Date(selectedDates[i - 1]);
        let currDate = new Date(selectedDates[i]);

        // Check if current date is exactly one day after the previous date
        if ((currDate - prevDate) / (1000 * 60 * 60 * 24) === 1) {
            checkOutDate = selectedDates[i]; // Extend the checkout date
        } else {
            break; // Stop at the first gap
        }
    }

    // Ensure bookedDates are in YYYY-MM-DD format before checking
    const bookedDates = listing.bookedDates.map(date => new Date(date).toISOString().split("T")[0]);

    // Check if any selected date is already booked
    const alreadyBooked = selectedDates.some(date => bookedDates.includes(date));

    if (alreadyBooked) {
        req.flash("error", "One or more selected dates are already booked.");
        return res.redirect(`/listings/${id}/book`);
    }

    console.log("Selected Dates:", selectedDates);
    console.log("Determined Check-Out Date:", checkOutDate);

    // Pass temporary booking data via query parameters
    res.redirect(`/listings/${id}/payment?dates=${selectedDates.join(",")}&checkout=${checkOutDate}&listingId=${listing._id}`);
};
// Get Payment Page (No data saved in DB yet)Invalid payment request.
module.exports.getPaymentPage = async (req, res) => {
    const { id } = req.params;
    const { dates, listingId, checkout } = req.query; // Get checkout date

    if (!dates || !listingId || !checkout) {
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
        const checkInDate = selectedDates[0]; // First date is check-in
        const checkOutDate = checkout; // Retrieved from query

        // Calculate total nights (Check-out date is NOT included in the stay)
        const totalNights = (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24);

        const totalPrice = totalNights * listing.price; // Multiply by listing price

        res.render("bookings/payment", { 
            checkInDate, 
            checkOutDate, 
            totalNights, 
            booking: { property: listing, bookedDates: selectedDates, totalPrice } 
        });

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

        const listing = await Listing.findById(listingId).populate({ path: "owner", model: "Host" });
        if (!listing) {
            console.log(`❌ Error: Listing not found for ID: ${listingId}`);
            return res.status(404).json({ success: false, message: "Listing not found." });
        }

        if (!listing.price) {
            console.log("❌ Error: Listing price is missing.");
            return res.status(400).json({ success: false, message: "Invalid listing price." });
        }

        const selectedDates = bookingDates.split(",").map(date => date.trim());
        const checkInDate = selectedDates[0]; // First date is check-in
        const checkOutDate = selectedDates[selectedDates.length - 1]; // Last date is check-out

        // Calculate total nights correctly (checkout date is not part of stay)
        const totalNights = (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24);
        if (totalNights < 1) {
            console.log("❌ Error: Invalid booking duration.");
            return res.status(400).json({ success: false, message: "Invalid booking duration." });
        }

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

        // ✅ Exclude the last selected date (checkout date)
        const checkInDate = booking.bookedDates[0];
        const checkOutDate = booking.bookedDates[booking.bookedDates.length - 1];
        const confirmedBookedDates = booking.bookedDates.slice(0, -1); // Exclude checkout date

        // ✅ Check if any of the selected dates are already booked (edge case)
        const alreadyBooked = confirmedBookedDates.some(date => listing.bookedDates.includes(date));
        if (alreadyBooked) {
            console.error("❌ Error: One or more selected dates are already booked.");
            return res.status(400).json({ success: false, message: "Some dates are already booked." });
        }

        // ✅ Ensure no duplicate dates are pushed
        listing.bookedDates = Array.from(new Set([...listing.bookedDates, ...confirmedBookedDates]));
        await listing.save();

        // ✅ Update booking status & store payment ID
        booking.razorpayPaymentId = paymentId;
        booking.status = "Paid"; // Update status immediately after verification
        await booking.save();

        console.log(`✅ Payment Verified & Booking Confirmed: ${booking._id} (Paid)`);

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

    console.log(`📢 Booking ${bookingId} details loaded.`);

    res.render("bookings/confirmation", { booking, currUser: req.user });
};

