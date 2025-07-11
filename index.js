require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // Required for Socket.io
const { Server } = require('socket.io'); // Import Socket.io
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const reportRoutes = require('./routes/reportRoutes');
const agreementRoutes = require('./routes/agreementRoutes');
const commissionRoutes = require('./routes/commissionRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 8000;

// --- Create HTTP server for Socket.io ---
const server = http.createServer(app);

// --- Socket.io Setup ---
const io = new Server(server, {
  cors: {
    origin: "http://localhost:8080", // Allow frontend (Vite/React) to connect
    methods: ["GET", "POST", "DELETE", "PUT"],
  },
});

// Track connected clients (optional)
let clients = [];

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  clients.push(socket);

  // Notify all clients when a product is updated/deleted
  socket.on('product_updated', (data) => {
    io.emit('refresh_products', data); // Broadcast to all clients
  });

  socket.on('disconnect', () => {
    clients = clients.filter(client => client.id !== socket.id);
    console.log('❌ Client disconnected:', socket.id);
  });
});

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.get('/', (req, res) => {
  res.send(`Welcome to the API! Server running on port ${PORT}. Use /api/products, /api/sales, etc.`);
});

app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/agreements', agreementRoutes);
app.use('/api/commissions', commissionRoutes);

// --- Modify Product Routes to Emit Events ---
// Example: In your productRoutes.js (or controller), add Socket.io emits:
/*
  const deleteProduct = async (req, res) => {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    
    // Notify all clients
    req.app.get('io').emit('refresh_products', { action: 'delete', id });
    
    res.status(204).send();
  };
*/

// Global error handler
app.use(errorHandler);

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`🚀 Backend running: http://localhost:${PORT}`);
  console.log(`🛰️ Socket.io ready for real-time updates`);
});