// backend/controllers/productController.js
const supabase = require('../config/supabaseClient');

exports.testConnection = (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products/test-connection called.`);
    res.status(200).send('Backend connection successful!');
};

exports.addConsignor = async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/products/add-consignor called. Body:`, req.body);
    const { full_name, email, phone_number, address, is_active } = req.body;

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
            .select();

        if (error) {
            console.error("Supabase Error - addConsignor:", error);
            if (error.code === '23505' && error.constraint === 'consignors_email_key') {
                return res.status(409).json({ message: 'A consignor with this email already exists.', error: error.message });
            }
            return res.status(500).json({ message: 'Error adding consignor to database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Consignor added to DB:`, data);
        res.status(201).json({ message: 'Consignor added successfully', data: data[0] });
    } catch (err) {
        console.error("Server Error - addConsignor:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.getAllConsignors = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products/consignors called.`);
    try {
        const { data, error } = await supabase
            .from('consignors')
            .select('*');

        if (error) {
            console.error("Supabase Error - getAllConsignors:", error);
            return res.status(500).json({ message: 'Error fetching consignors from database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Returning ${data.length} consignors from DB.`);
        res.status(200).json(data);
    } catch (err) {
        console.error("Server Error - getAllConsignors:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.getConsignorById = async (req, res) => {
    const consignorId = parseInt(req.params.id);
    console.log(`[${new Date().toISOString()}] GET /api/products/consignors/${consignorId} called.`);

    if (isNaN(consignorId)) {
        return res.status(400).json({ message: 'Invalid consignor ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('consignors')
            .select('*')
            .eq('id', consignorId)
            .single();

        if (error) {
            console.error(`Supabase Error - getConsignorById for ID ${consignorId}:`, error);
            if (error.code === 'PGRST116') {
                return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
            }
            return res.status(500).json({ message: 'Error fetching consignor from database', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Returning consignor with ID ${consignorId}:`, data);
        res.status(200).json(data);
    } catch (err) {
        console.error("Server Error - getConsignorById:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.updateConsignor = async (req, res) => {
    const consignorId = parseInt(req.params.id);
    const updateData = req.body;
    console.log(`[${new Date().toISOString()}] PUT /api/products/consignors/${consignorId} called. Update data:`, updateData);

    if (isNaN(consignorId)) {
        return res.status(400).json({ message: 'Invalid consignor ID provided.' });
    }

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

    fieldsToUpdate.updated_at = new Date().toISOString();

    try {
        const { data, error } = await supabase
            .from('consignors')
            .update(fieldsToUpdate)
            .eq('id', consignorId)
            .select('*');

        if (error) {
            console.error(`Supabase Error - updateConsignor for ID ${consignorId}:`, error);
            if (error.code === '23505' && error.constraint === 'consignors_email_key') {
                return res.status(409).json({ message: 'A consignor with this email already exists.', error: error.message });
            }
            return res.status(500).json({ message: 'Error updating consignor in database', error: error.message });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Consignor ID ${consignorId} updated in DB:`, data[0]);
        res.status(200).json(data[0]);
    } catch (err) {
        console.error("Server Error - updateConsignor:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.deleteConsignor = async (req, res) => {
    const consignorId = parseInt(req.params.id);
    console.log(`[${new Date().toISOString()}] DELETE /api/products/consignors/${consignorId} called.`);

    if (isNaN(consignorId)) {
        return res.status(400).json({ message: 'Invalid consignor ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('consignors')
            .delete()
            .eq('id', consignorId)
            .select();

        if (error) {
            console.error(`Supabase Error - deleteConsignor for ID ${consignorId}:`, error);
            if (error.code === '23503' && error.constraint && error.constraint.startsWith('products_consignor_id_fkey')) {
                return res.status(409).json({ message: 'Cannot delete consignor. Products are still associated with this consignor. Please reassign or delete associated products first.', error: error.message });
            }
            return res.status(500).json({ message: 'Error deleting consignor from database', error: error.message });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: `Consignor with ID ${consignorId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Consignor ID ${consignorId} deleted successfully.`);
        res.status(204).send();
    } catch (err) {
        console.error("Server Error - deleteConsignor:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.getAllProducts = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products called.`);
    try {
        const { data, error } = await supabase
            .from('products')
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
        res.status(200).json(data);
    } catch (err) {
        console.error("Server Error - getAllProducts:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

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
            .single();

        if (error) {
            console.error(`Supabase Error - getProductByBarcode for barcode ${barcode}:`, error);
            if (error.code === 'PGRST116') {
                return res.status(404).json({ message: `Product with barcode ${barcode} not found.` });
            }
            return res.status(500).json({ message: 'Error fetching product by barcode from database', error: error.message });
        }

        const formattedProduct = data ? {
            ...data,
            price: data.expected_price
        } : null;

        if (!formattedProduct) {
             return res.status(404).json({ message: `Product with barcode ${barcode} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Returning product with barcode ${barcode}:`, formattedProduct);
        res.status(200).json(formattedProduct);
    } catch (err) {
        console.error("Server Error - getProductByBarcode:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.addProduct = async (req, res) => {
    const productData = req.body;
    console.log(`[${new Date().toISOString()}] POST /api/products called. Received data:`, productData);

    if (!productData.name || !productData.category || !productData.condition ||
        productData.expected_price === undefined || productData.minimum_price === undefined ||
        productData.consignor_id === undefined || productData.consignor_id === null) {
        return res.status(400).json({ message: 'Missing required product fields (name, category, condition, expected_price, minimum_price, consignor_id).' });
    }

    const productToInsert = {
        name: productData.name,
        category: productData.category,
        condition: productData.condition,
        consignor_id: parseInt(productData.consignor_id),
        description: productData.description || null,
        expected_price: parseFloat(productData.expected_price),
        minimum_price: parseFloat(productData.minimum_price),
        quantity: parseInt(productData.quantity) || 0,
        image_url: productData.image_url || null,
        barcode: productData.barcode || null
    };

    try {
        const { data, error } = await supabase
            .from('products')
            .insert([productToInsert])
            .select(`
                id, name, category, condition, consignor_id, description,
                expected_price, minimum_price, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `);

        if (error) {
            console.error("Supabase Error - addProduct:", error);
            if (error.code === '23503' && error.constraint === 'products_consignor_id_fkey') {
                return res.status(400).json({ message: 'Invalid Consignor ID. Consignor does not exist.', error: error.message });
            }
            return res.status(500).json({ message: 'Internal server error', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Product added to DB:`, data[0]);
        res.status(201).json(data[0]);
    } catch (err) {
        console.error("Server Error - addProduct:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.updateProduct = async (req, res) => {
    const productId = parseInt(req.params.id);
    const updateData = req.body;
    console.log(`[${new Date().toISOString()}] PUT /api/products/${productId} (general update) called. Update data:`, updateData);

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product ID provided.' });
    }

    const fieldsToUpdate = { updated_at: new Date().toISOString() };

    const allowedFields = [
        'name', 'category', 'condition', 'description', 'expected_price',
        'minimum_price', 'quantity', 'image_url', 'consignor_id', 'status', 'barcode'
    ];

    let hasValidField = false;
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
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

exports.deleteProduct = async (req, res) => {
    const productId = parseInt(req.params.id);
    console.log(`[${new Date().toISOString()}] DELETE /api/products/${productId} called.`);

    if (isNaN(productId)) {
        return res.status(400).json({ message: 'Invalid product ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .delete()
            .eq('id', productId)
            .select();

        if (error) {
            console.error(`Supabase Error - deleteProduct for ID ${productId}:`, error);
            return res.status(500).json({ message: 'Error deleting product from database', error: error.message });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: `Product with ID ${productId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Product ID ${productId} deleted successfully.`);
        res.status(204).send();
    } catch (err) {
        console.error("Server Error - deleteProduct:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.getAllProductsEligibleForSale = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/products/eligible-for-sale called.`);
    try {
        const { data, error } = await supabase
            .from('products')
            .select(`
                id, name, category, condition, expected_price, minimum_price,
                consignor_id, description, quantity, image_url, status, barcode,
                created_at, updated_at,
                consignors (full_name, email)
            `)
            .gt('quantity', 0)
            .in('status', ['in_stock', 'paid']); // Reverted back to 'in_stock' as this will be valid after DB schema update

        if (error) {
            console.error("Supabase Error - getAllProductsEligibleForSale:", error);
            return res.status(500).json({ message: 'Error fetching eligible products from database', error: error.message });
        }

        const formattedProducts = data.map(product => ({
            ...product,
            price: product.expected_price,
            consignor_name: product.consignors ? product.consignors.full_name : 'N/A',
        }));

        console.log(`[${new Date().toISOString()}] Returning ${formattedProducts.length} eligible products from DB.`);
        res.status(200).json(formattedProducts);
    } catch (err) {
        console.error("Server Error - getAllProductsEligibleForSale:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.updateProductLocationAndStatus = async (req, res) => {
    console.log(`[${new Date().toISOString()}] PUT /api/products/location/:id called. Body:`, req.body);

    const productId = parseInt(req.params.id);
    const {
        floor,
        aisle,
        rack_shelf,
        bin_number,
        quantity,
        staff_member_id,
        notes,
        barcode
    } = req.body;

    if (isNaN(productId) || !floor || !aisle || !rack_shelf || !bin_number || quantity === undefined || !barcode) {
        return res.status(400).json({ message: 'Missing required location fields: product ID, floor, aisle, rack/shelf, bin number, quantity, barcode.' });
    }

    const locationQuantity = parseInt(quantity);
    if (isNaN(locationQuantity) || locationQuantity < 0) {
        return res.status(400).json({ message: 'Invalid quantity provided for location. Must be a non-negative number.' });
    }

    try {
        const { data: productCheck, error: checkError } = await supabase
            .from('products')
            .select('id, status, quantity')
            .eq('id', productId)
            .single();

        if (checkError || !productCheck) {
            console.error(`Supabase Error - updateProductLocationAndStatus (product existence check) for ID ${productId}:`, checkError);
            if (checkError && checkError.code === 'PGRST116') {
                return res.status(404).json({ message: `Product with ID ${productId} not found.` });
            }
            return res.status(500).json({ message: 'Error checking product existence before update.', error: checkError?.message || 'Unknown error during product check.' });
        }

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
                    barcode: barcode,
                    staff_member_id: staff_member_id || null,
                    notes: notes || null,
                    updated_at: new Date().toISOString()
                },
                { onConflict: 'product_id', ignoreDuplicates: false }
            )
            .select();

        if (locationError) {
            console.error(`Supabase Error - updateProductLocationAndStatus (product_locations upsert) for ID ${productId}:`, locationError);
            return res.status(500).json({
                message: 'Failed to update product location.',
                error: locationError.message
            });
        }

        const { data: productUpdateData, error: productUpdateError } = await supabase
            .from('products')
            .update({
                status: 'in_stock', // ✅ Corrected: Set to 'in_stock' now that DB allows it
                quantity: locationQuantity,
                updated_at: new Date().toISOString()
            })
            .eq('id', productId)
            .select();

        if (productUpdateError) {
            console.error(`Supabase Error - updateProductLocationAndStatus (products status/quantity update) for ID ${productId}:`, productUpdateError);
            return res.status(500).json({
                message: 'Failed to update product status/quantity. Location was updated.',
                error: productUpdateError.message
            });
        }

        console.log(`[${new Date().toISOString()}] Product ID ${productId} location updated and status set to in_stock.`); // ✅ Corrected log message
        res.status(200).json({
            message: 'Product location updated and status set to in_stock successfully', // ✅ Corrected response message
            product_location: locationData[0],
            updated_product: productUpdateData[0]
        });

    } catch (err) {
        console.error("Server Error - updateProductLocationAndStatus:", err);
        res.status(500).json({
            message: 'Internal server error during product update.',
            error: err.message
        });
    }
};