// index.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors'); // Import the CORS middleware
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const reportRoutes = require('./routes/reportRoutes'); // <--- NEW: Import reportRoutes
const agreementRoutes = require('./routes/agreementRoutes'); // ✨ NEW: Import agreementRoutes ✨
const commissionRoutes = require('./routes/commissionRoutes'); // ⭐ NEW: Import commissionRoutes ⭐
const errorHandler = require('./middlewares/errorHandler');

const app = express();
// --- CRITICAL FIX 1: Use PORT from .env file (now 5000) ---
// This will now correctly use the PORT defined in your .env file
const PORT = process.env.PORT || 8000; // Fallback to 8000 if .env isn't set, but ensure your .env has PORT=8000

// --- MIDDLEWARE ---
// IMPORTANT: Make sure CORS allows your frontend's origin if they are on different domains/ports.
// Since frontend is 8080 and backend will be 8000, this setup with `cors()` is usually fine for local dev.
app.use(cors());
app.use(express.json());

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send(`Welcome to the API! Server running on port ${PORT}. Use /api/products, /api/sales, /api/reports, /api/agreements, or /api/commissions.`);
});

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes); // <--- NEW: Mount report routes under /api/reports
app.use('/api/agreements', agreementRoutes); // ✨ NEW: Mount agreement routes under /api/agreements ✨
app.use('/api/commissions', commissionRoutes); // ⭐ NEW: Mount commission routes under /api/commissions ⭐

// Global error handler middleware. This should be defined last.
app.use(errorHandler);

// --- SERVER START ---
console.log('--- Backend Server Starting NOW ---');
app.listen(PORT, () => {
    console.log(`Backend Server running: http://localhost:${PORT}`);
    console.log(`Ensure your frontend proxy (vite.config.ts or direct calls) targets http://localhost:${PORT}`);
});