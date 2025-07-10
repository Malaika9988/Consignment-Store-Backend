// backend/controllers/productController.js
// This file handles all product-related API logic.
// It interacts with the Supabase database.

// Import the Supabase client
// Path is relative to this file: go up one directory (..) then into 'config' folder
const supabase = require('../config/supabaseClient');

// --- API Controllers ---

// Health-check controller
// Simple GET request to check if the backend is running.
exports.testConnection = (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products/test-connection called.`);
    res.status(200).send('Backend connection successful!');
};

// Add a new consignor
// Handles POST requests to create a new consignor in the 'consignors' table.
exports.addConsignor = async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/products/add-consignor called. Body:`, req.body);

    // Destructure fields exactly as they are named in your SQL 'Consignors' table
    const { full_name, email, phone_number, address, is_active } = req.body;

    // Basic validation for required fields as per your SQL schema (NOT NULL)
    if (!full_name || !email || !phone_number || !address) {
        return res.status(400).json({ message: 'Missing required consignor fields: full_name, email, phone_number, address.' });
    }

    try {
        const { data, error } = await supabase
            .from('consignors')
            .insert([{
                full_name,
                email,
                phone_number,
                address,
                is_active: is_active !== undefined ? is_active : true
            }])
            .select(); // Request the newly inserted record back

        if (error) {
            console.error("Supabase Error - addConsignor:", error);
            // Handle specific errors like duplicate email (UNIQUE constraint violation)
            if (error.code === '23505' && error.constraint === 'consignors_email_key') {
                return res.status(409).json({ message: 'A consignor with this email already exists.', error: error.message });
            }
            return res.status(500).json({ message: 'Error adding consignor to database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Consignor added to DB:`, data);
        res.status(201).json({ message: 'Consignor added successfully', data: data[0] }); // Return the first inserted record
    } catch (err) {
        console.error("Server Error - addConsignor:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Get all consignors controller function
exports.getAllConsignors = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products/consignors called.`);
    try {
        const { data, error } = await supabase
            .from('consignors')
            .select('*'); // Select all columns from the consignors table (including is_active)

        if (error) {
            console.error("Supabase Error - getAllConsignors:", error);
            return res.status(500).json({ message: 'Error fetching consignors from database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Returning ${data.length} consignors from DB.`);
        res.status(200).json(data); // Supabase returns the data directly as an array
    } catch (err) {
        console.error("Server Error - getAllConsignors:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Get a single consignor by ID
exports.getConsignorById = async (req, res) => {
    const consignorId = parseInt(req.params.id); // Get consignor ID from URL parameters
    console.log(`[${new Date().toISOString()}] GET /api/products/consignors/${consignorId} called.`);

    // Basic validation to ensure ID is a number
    if (isNaN(consignorId)) {
        return res.status(400).json({ message: 'Invalid consignor ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('consignors')
            .select('*')
            .eq('id', consignorId)
            .single(); // Expect a single record

        if (error) {
            console.error(`Supabase Error - getConsignorById for ID ${consignorId}:`, error);
            // If .single() finds no data, it returns an error with code 'PGRST116'
            if (error.code === 'PGRST116') { // No rows returned for .single()
                return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
            }
            return res.status(500).json({ message: 'Error fetching consignor from database', error: error.message });
        }

        if (!data) { // This check might be redundant with .single() error, but good for clarity
            return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Returning consignor with ID ${consignorId}:`, data);
        res.status(200).json(data);
    } catch (err) {
        console.error("Server Error - getConsignorById:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Update an existing consignor by ID
exports.updateConsignor = async (req, res) => {
    const consignorId = parseInt(req.params.id); // Get consignor ID from URL parameters
    const updateData = req.body; // Data to update
    console.log(`[${new Date().toISOString()}] PUT /api/products/consignors/${consignorId} called. Update data:`, updateData);

    if (isNaN(consignorId)) {
        return res.status(400).json({ message: 'Invalid consignor ID provided.' });
    }

    // Filter allowed update fields to prevent unexpected data being written
    const allowedFields = ['full_name', 'email', 'phone_number', 'address', 'is_active'];
    const fieldsToUpdate = {};
    let hasValidField = false;

    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            fieldsToUpdate[field] = updateData[field];
            hasValidField = true;
        }
    }

    if (!hasValidField) {
        return res.status(400).json({ message: 'No valid fields provided for consignor update. Allowed fields: full_name, email, phone_number, address, is_active.' });
    }

    // Add updated_at timestamp
    fieldsToUpdate.updated_at = new Date().toISOString();

    try {
        const { data, error } = await supabase
            .from('consignors')
            .update(fieldsToUpdate)
            .eq('id', consignorId)
            .select('*'); // Select the updated record

        if (error) {
            console.error(`Supabase Error - updateConsignor for ID ${consignorId}:`, error);
            // Handle specific errors like duplicate email (UNIQUE constraint violation)
            if (error.code === '23505' && error.constraint === 'consignors_email_key') {
                return res.status(409).json({ message: 'A consignor with this email already exists.', error: error.message });
            }
            return res.status(500).json({ message: 'Error updating consignor in database', error: error.message });
        }

        if (data.length === 0) { // If no record was updated (e.g., ID not found)
            return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Consignor ID ${consignorId} updated in DB:`, data[0]);
        res.status(200).json(data[0]); // Return the updated consignor
    } catch (err) {
        console.error("Server Error - updateConsignor:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Delete a consignor by ID
exports.deleteConsignor = async (req, res) => {
    const consignorId = parseInt(req.params.id); // Get consignor ID from URL parameters
    console.log(`[${new Date().toISOString()}] DELETE /api/products/consignors/${consignorId} called.`);

    if (isNaN(consignorId)) {
        return res.status(400).json({ message: 'Invalid consignor ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('consignors')
            .delete()
            .eq('id', consignorId)
            .select(); // Request the deleted data to confirm deletion and count

        if (error) {
            console.error(`Supabase Error - deleteConsignor for ID ${consignorId}:`, error);
            // Handle foreign key constraint error (e.g., if products are linked to this consignor)
            if (error.code === '23503' && error.constraint && error.constraint.startsWith('products_consignor_id_fkey')) {
                return res.status(409).json({ message: 'Cannot delete consignor. Products are still associated with this consignor. Please reassign or delete associated products first.', error: error.message });
            }
            return res.status(500).json({ message: 'Error deleting consignor from database', error: error.message });
        }

        if (data.length === 0) { // If `data` array is empty, no record was found/deleted
            return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Consignor ID ${consignorId} deleted successfully.`);
        res.status(204).send(); // 204 No Content is standard for successful DELETE
    } catch (err) {
        console.error("Server Error - deleteConsignor:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};


// Get all products
// Handles GET requests to fetch all products from the 'products' table.
exports.getAllProducts = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products called.`);
    try {
        const { data, error } = await supabase
            .from('products')
            // Only select fields that exist in your Products table schema
            .select(`
                id, name, category, condition, consignor_id, description,
                expected_price, minimum_price, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `);

        if (error) {
            console.error("Supabase Error - getAllProducts:", error);
            return res.status(500).json({ message: 'Error fetching products from database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Returning ${data.length} products from DB.`);
        res.status(200).json(data); // Supabase returns the data directly as an array
    } catch (err) {
        console.error("Server Error - getAllProducts:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Get a single product by barcode
exports.getProductByBarcode = async (req, res) => {
    const barcode = req.params.barcode;
    console.log(`[${new Date().toISOString()}] GET /api/products/barcode/${barcode} called.`);

    if (!barcode) {
        return res.status(400).json({ message: 'Barcode is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .select(`
                id, name, category, condition, expected_price, minimum_price,
                consignor_id, description, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `)
            .eq('barcode', barcode)
            .single(); // Expect a single record

        if (error) {
            console.error(`Supabase Error - getProductByBarcode for barcode ${barcode}:`, error);
            if (error.code === 'PGRST116') { // No rows found
                return res.status(404).json({ message: `Product with barcode ${barcode} not found.` });
            }
            return res.status(500).json({ message: 'Error fetching product by barcode from database', error: error.message });
        }

        // --- FIX APPLIED HERE: Ensure 'price' field is present ---
        const formattedProduct = data ? {
            ...data,
            price: data.expected_price // Map expected_price to 'price' for frontend consistency
        } : null;

        if (!formattedProduct) {
             return res.status(404).json({ message: `Product with barcode ${barcode} not found.` });
        }
        // --- END FIX ---

        console.log(`[${new Date().toISOString()}] Returning product with barcode ${barcode}:`, formattedProduct);
        res.status(200).json(formattedProduct); // Return the formatted product
    } catch (err) {
        console.error("Server Error - getProductByBarcode:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};


// Add a new product
// Handles POST requests to add a product to the 'products' table.
exports.addProduct = async (req, res) => {
    const productData = req.body;
    console.log(`[${new Date().toISOString()}] POST /api/products called. Received data:`, productData);

    // Basic validation for required fields as per your SQL schema (NOT NULL)
    if (!productData.name || !productData.category || !productData.condition ||
        productData.expected_price === undefined || productData.minimum_price === undefined ||
        productData.consignor_id === undefined || productData.consignor_id === null) {
        return res.status(400).json({ message: 'Missing required product fields (name, category, condition, expected_price, minimum_price, consignor_id).' });
    }

    // Prepare data for insertion, ensuring field names match your SQL 'products' table
    const productToInsert = {
        name: productData.name,
        category: productData.category,
        condition: productData.condition,
        // Ensure consignor_id is an integer (SERIAL PRIMARY KEY in Consignors table)
        consignor_id: parseInt(productData.consignor_id),
        description: productData.description || null,
        expected_price: parseFloat(productData.expected_price),
        minimum_price: parseFloat(productData.minimum_price),
        quantity: parseInt(productData.quantity) || 0, // Default to 0 as per new schema for 'receivable' status
        image_url: productData.image_url || null,
        barcode: productData.barcode || null // Include barcode here
    };

    try {
        const { data, error } = await supabase
            .from('products')
            .insert([productToInsert])
            // Select only fields from your Products table schema, and join consignors
            .select(`
                id, name, category, condition, consignor_id, description,
                expected_price, minimum_price, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `); // Request the newly inserted record back

        if (error) {
            console.error("Supabase Error - addProduct:", error);
            // Handle foreign key constraint error (e.g., consignor_id does not exist)
            if (error.code === '23503' && error.constraint === 'products_consignor_id_fkey') {
                return res.status(400).json({ message: 'Invalid Consignor ID. Consignor does not exist.', error: error.message });
            }
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Product added to DB:`, data[0]);
        res.status(201).json(data[0]); // Return the first (and only) inserted record
    } catch (err) {
        console.error("Server Error - addProduct:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Update product (this endpoint now handles general product updates based on your schema)
// The route for this would typically be PUT /api/products/:id
exports.updateProduct = async (req, res) => {
    const productId = parseInt(req.params.id); // Product ID from URL, ensure it's an integer
    const updateData = req.body;
    console.log(`[${new Date().toISOString()}] PUT /api/products/${productId} (general update) called. Update data:`, updateData);

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product ID provided.' });
    }

    const fieldsToUpdate = { updated_at: new Date().toISOString() };

    // Allowed fields for update based on your Products table schema
    const allowedFields = [
        'name', 'category', 'condition', 'description', 'expected_price',
        'minimum_price', 'quantity', 'image_url', 'consignor_id', 'status', 'barcode' // Added barcode here
    ];

    let hasValidField = false;
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            // Ensure numeric fields are parsed correctly
            if (['expected_price', 'minimum_price'].includes(field)) {
                fieldsToUpdate[field] = parseFloat(updateData[field]);
            } else if (['quantity', 'consignor_id'].includes(field)) {
                fieldsToUpdate[field] = parseInt(updateData[field]);
            } else {
                fieldsToUpdate[field] = updateData[field];
            }
            hasValidField = true;
        }
    }

    if (!hasValidField && Object.keys(fieldsToUpdate).length === 1 && fieldsToUpdate.updated_at) {
        return res.status(400).json({ message: 'No valid fields provided for update. Only "updated_at" would be changed.' });
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .update(fieldsToUpdate)
            .eq('id', productId)
            // Select only fields that exist in your Products table schema
            .select(`
                id, name, category, condition, consignor_id, description,
                expected_price, minimum_price, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `);

        if (error) {
            console.error("Supabase Error - updateProduct:", error);
            if (error.code === '23503' && error.constraint === 'products_consignor_id_fkey') {
                return res.status(400).json({ message: 'Invalid Consignor ID provided for update. Consignor does not exist.', error: error.message });
            }
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: 'Product not found for update.' });
        }

        console.log(`[${new Date().toISOString()}] Product updated in DB:`, data[0]);
        res.status(200).json(data[0]);
    } catch (err) {
        console.error("Server Error - updateProduct:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Delete a product by ID
exports.deleteProduct = async (req, res) => {
    const productId = parseInt(req.params.id); // Get product ID from URL parameters
    console.log(`[${new Date().toISOString()}] DELETE /api/products/${productId} called.`);

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .select(); // Request the deleted data to confirm deletion and count

        if (error) {
            console.error(`Supabase Error - deleteProduct for ID ${productId}:`, error);
            return res.status(500).json({ message: 'Error deleting product from database', error: error.message });
        }

        if (data.length === 0) { // If `data` array is empty, no record was found/deleted
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Product ID ${productId} deleted successfully.`);
        res.status(204).send(); // 204 No Content is standard for successful DELETE
    } catch (err) {
        console.error("Server Error - deleteProduct:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Get all products eligible for sale
exports.getAllProductsEligibleForSale = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products/eligible-for-sale called.`);
    try {
        // Based on your schema, eligibility means quantity > 0 and status is 'in_stock' or 'paid'
        const { data, error } = await supabase
            .from('products')
            // Select all fields from products, and join consignors
            .select(`
                id, name, category, condition, expected_price, minimum_price,
                consignor_id, description, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `)
            .gt('quantity', 0) // Products are eligible if quantity > 0
            .in('status', ['in_stock', 'paid']); // Filter for status to be 'in_stock' OR 'paid'

        if (error) {
            console.error("Supabase Error - getAllProductsEligibleForSale:", error);
            return res.status(500).json({ message: 'Error fetching eligible products from database', error: error.message });
        }

        // Map the Supabase data to match your frontend Product interface's expected structure
        const formattedProducts = data.map(product => ({
            ...product,
            price: product.expected_price, // Assuming 'price' in frontend maps to 'expected_price' from DB
            consignor_name: product.consignors ? product.consignors.full_name : 'N/A', // Assuming consignor data comes nested
        }));

        console.log(`[${new Date().toISOString()}] Returning ${formattedProducts.length} eligible products from DB.`);
        res.status(200).json(formattedProducts);
    } catch (err) {
        console.error("Server Error - getAllProductsEligibleForSale:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// --- NEW FUNCTION FOR ITEM LOCATOR ---
// Update product location and status (from Item Locator form)
// This function handles the PUT request from the Item Locator form.
exports.updateProductLocationAndStatus = async (req, res) => {
    console.log(`[${new Date().toISOString()}] PUT /api/products/location/:id called. Body:`, req.body);

    const productId = parseInt(req.params.id);
    const {
        floor,
        aisle,
        rack_shelf,
        bin_number,
        quantity, // This 'quantity' is for the *location*, which will also become the product's main quantity
        staff_member_id,
        notes,
        barcode // ⭐ ADDED: Destructure barcode from req.body ⭐
    } = req.body;

    // ⭐ UPDATED: Added barcode to validation ⭐
    if (isNaN(productId) || !floor || !aisle || !rack_shelf || !bin_number || quantity === undefined || !barcode) {
        return res.status(400).json({ message: 'Missing required location fields: product ID, floor, aisle, rack/shelf, bin number, quantity, barcode.' });
    }

    const locationQuantity = parseInt(quantity);
    if (isNaN(locationQuantity) || locationQuantity < 0) {
        return res.status(400).json({ message: 'Invalid quantity provided for location. Must be a non-negative number.' });
    }

    try {
        // First, check if the product exists before trying to update its location or status
        const { data: productCheck, error: checkError } = await supabase
            .from('products')
            .select('id, status, quantity')
            .eq('id', productId)
            .single();

        if (checkError || !productCheck) {
            console.error(`Supabase Error - updateProductLocationAndStatus (product existence check) for ID ${productId}:`, checkError);
            if (checkError && checkError.code === 'PGRST116') { // No rows found
                return res.status(404).json({ message: `Product with ID ${productId} not found.` });
            }
            return res.status(500).json({ message: 'Error checking product existence before update.', error: checkError?.message || 'Unknown error during product check.' });
        }

        // --- Start of critical section: Both updates must ideally succeed ---

        // 1. Upsert (Update or Insert) into product_locations table
        const { data: locationData, error: locationError } = await supabase
            .from('product_locations')
            .upsert(
                {
                    product_id: productId,
                    floor: floor,
                    aisle: aisle,
                    rack_shelf: rack_shelf,
                    bin_number: bin_number,
                    quantity: locationQuantity,
                    barcode: barcode, // ⭐ ADDED: Pass barcode to the upsert payload ⭐
                    staff_member_id: staff_member_id || null,
                    notes: notes || null,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'product_id', ignoreDuplicates: false } // 'product_id' is the unique key for upsert
            )
            .select();

        if (locationError) {
            console.error(`Supabase Error - updateProductLocationAndStatus (product_locations upsert) for ID ${productId}:`, locationError);
            // This is the first possible point of failure.
            return res.status(500).json({
                message: 'Failed to update product location. Please check details and try again.',
                error: locationError.message
            });
        }

        // 2. Update the product's status AND its total quantity in the products table
        // This is the operation that was likely failing, causing the mixed message.
        const { data: productUpdateData, error: productUpdateError } = await supabase
            .from('products')
            .update({
                status: 'in_stock', // Set status to 'in_stock' as per requirement
                quantity: locationQuantity, // Update the main product quantity with the location quantity
                updated_at: new Date().toISOString()
            })
            .eq('id', productId)
            .select(); // Select the updated product data

        if (productUpdateError) {
            console.error(`Supabase Error - updateProductLocationAndStatus (products status/quantity update) for ID ${productId}:`, productUpdateError);
            // This is the second possible point of failure.
            // If this fails, the location was updated, but the main product record was not.
            return res.status(500).json({
                message: `Failed to update product details (status/quantity). Location was updated. Error: ${productUpdateError.message}`,
                error: productUpdateError.message
            });
        }

        // --- End of critical section: Both updates succeeded ---

        // If both operations succeed, send the success response.
        console.log(`[${new Date().toISOString()}] Product ID ${productId} location and status/quantity updated successfully.`);
        res.status(200).json({
            message: 'Product location updated and status set to in_stock successfully',
            product_location: locationData[0], // Return the updated location record
            updated_product: productUpdateData[0] // Return the updated product record
        });

    } catch (err) {
        // This catches any unexpected errors not caught by Supabase `error` objects
        console.error("Server Error - updateProductLocationAndStatus:", err);
        res.status(500).json({ message: 'Internal server error occurred during product update.', error: err.message });
    }
};