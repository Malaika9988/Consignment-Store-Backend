// backend/routes/saleRoutes.js
const express = require('express');
const router = express.Router();

// Import your sale controller functions
// Ensure these function names match what's exported from backend/controllers/saleController.js
const {
    createSale,         // Changed from recordSale for consistency with controller
    getAllSales,        // New: to get all sales
    getSaleById,        // New: to get a single sale by ID
    updateSaleHeader,   // New: to update a sale header
    deleteSale,         // New: to delete a sale
    generateReceiptPdf  // Existing: for PDF generation
} = require('../controllers/saleController'); // Adjust path as needed, assuming it's in backend/controllers

// --- Sale CRUD Routes ---
// Route to create a new sale (POST to /api/sales)
router.post('/', createSale);

// Route to get all sales (GET to /api/sales)
router.get('/', getAllSales);

// Route to get a single sale by ID (GET to /api/sales/:id)
router.get('/:id', getSaleById);

// Route to update a sale header by ID (PUT to /api/sales/:id)
router.put('/:id', updateSaleHeader);

// Route to delete a sale by ID (DELETE to /api/sales/:id)
router.delete('/:id', deleteSale);

// --- Other Sale-Related Routes ---
// Route to generate and download a receipt PDF for a specific sale (GET to /api/sales/:saleId/receipt)
router.get('/:saleId/receipt', generateReceiptPdf);

module.exports = router; // Export the router to be used in index.js
