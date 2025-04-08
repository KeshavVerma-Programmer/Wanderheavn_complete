const express = require("express");
const router = express.Router();
const Booking = require("../models/booking");

router.post('/cleanup', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Missing orderId" });
    }

    const booking = await Booking.findOne({ orderId, status: "Pending" });

    if (!booking) {
      console.log("ℹ️ No pending booking found for cleanup.");
      return res.json({ success: true, message: "Nothing to delete" });
    }

    await Booking.deleteOne({ _id: booking._id });
    console.log(`❌ Pending booking deleted: ${booking._id}`);

    return res.json({ success: true, message: "Pending booking deleted." });
  } catch (err) {
    console.error("❌ Cleanup error:", err);
    return res.status(500).json({ success: false, message: "Server error during cleanup." });
  }
});

module.exports = router;
