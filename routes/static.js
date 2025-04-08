const express = require('express');
const router = express.Router({ mergeParams: true });
router.get('/privacy', (req, res) => {
    res.render('privacy');
});

router.get('/terms', (req, res) => {
    res.render('terms');
});

router.get('/company', (req, res) => {
    res.render('company');
});

module.exports = router;