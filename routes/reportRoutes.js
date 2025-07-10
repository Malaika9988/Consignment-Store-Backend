// backend/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController'); // Import the controller

// Define the GET route for consignor commissions
// This will be accessible at /api/reports/consignor-commissions
router.get('/consignor-commissions', reportController.getConsignorCommissions);

module.exports = router;