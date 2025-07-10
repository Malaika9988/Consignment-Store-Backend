// backend/routes/agreementRoutes.js
const express = require('express');
const router = express.Router();
const agreementController = require('../controllers/agreementController');

// --- Agreement Routes ---

// POST /api/agreements - Add a new agreement
router.post('/', agreementController.addAgreement);

// GET /api/agreements - Get all agreements
router.get('/', agreementController.getAllAgreements);

// GET /api/agreements/:id - Get a single agreement by ID
router.get('/:id', agreementController.getAgreementById);

// PUT /api/agreements/:id - Update an agreement by ID
router.put('/:id', agreementController.updateAgreement);

// DELETE /api/agreements/:id - Delete an agreement by ID
router.delete('/:id', agreementController.deleteAgreement);

module.exports = router;