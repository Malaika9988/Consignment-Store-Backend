// backend/routes/productRoutes.js

const express = require('express');
const router = express.Router();

// Destructure functions from productController
const {
    testConnection,
    addConsignor,
    getAllConsignors,
    getConsignorById,
    updateConsignor,
    deleteConsignor,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getAllProductsEligibleForSale,
    updateProductLocationAndStatus,
    getProductByBarcode, // ✅ Added
} = require('../controllers/productController');

// --- Health Check Route ---
router.get('/test-connection', testConnection);

// --- Consignor Routes ---
router.post('/add-consignor', addConsignor);
router.get('/consignors', getAllConsignors);
router.get('/consignors/:id', getConsignorById);
router.put('/consignors/:id', updateConsignor);
router.delete('/consignors/:id', deleteConsignor);

// --- Product Routes ---

// ✅ Route to get product by barcode (Place before any "/:id" routes)
router.get('/barcode/:barcode', getProductByBarcode);

// ✅ Route to get eligible products for sale
router.get('/eligible-for-sale', getAllProductsEligibleForSale);

// Basic CRUD
router.get('/', getAllProducts);
router.post('/', addProduct);
router.put('/:id', updateProduct);
router.put('/:id/location', updateProductLocationAndStatus);
router.delete('/:id', deleteProduct);

module.exports = router;
