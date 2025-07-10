// backend/controllers/agreementController.js
const supabase = require('../config/supabaseClient');

// --- Agreement Controllers ---

// Add a new agreement
exports.addAgreement = async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/agreements called. Body:`, req.body);

    const {
        product_id,
        consignor_id,
        commission_rate,
        unsold_item_policy,
        // Removed discount_percentage and discount_interval_days from top-level destructuring
        // as they belong inside discount_policy JSONB.
        store_purchase_percentage,
        agreement_acknowledged,
        acknowledgment_date,
        // Also capture other fields that might be part of discount_policy from req.body
        // This assumes frontend might send them individually or as a nested object
        discount_percentage,
        discount_interval_days,
        discount_enabled, // Assuming frontend might send this, default to false if not
        discount_start_after_days, // Assuming frontend might send this, default to 30 if not
    } = req.body;

    // Basic validation for NOT NULL fields in Agreements schema
    if (commission_rate === undefined || unsold_item_policy === undefined || !product_id || !consignor_id) {
        return res.status(400).json({ message: 'Missing required agreement fields: product_id, consignor_id, commission_rate, unsold_item_policy.' });
    }

    // Construct the discount_policy JSONB object based on provided or default values
    const discountPolicy = {
        enabled: discount_enabled !== undefined ? Boolean(discount_enabled) : false,
        percentage: discount_percentage !== undefined ? parseFloat(discount_percentage) : 0,
        start_after_days: discount_start_after_days !== undefined ? parseInt(discount_start_after_days) : 30,
        interval_days: discount_interval_days !== undefined ? parseInt(discount_interval_days) : 15,
    };

    // Prepare data for insertion
    const agreementToInsert = {
        product_id: parseInt(product_id),
        consignor_id: parseInt(consignor_id),
        commission_rate: parseFloat(commission_rate),
        unsold_item_policy: unsold_item_policy,
        // Store the constructed discount_policy object as JSONB
        discount_policy: discountPolicy,
        store_purchase_percentage: store_purchase_percentage !== undefined ? parseFloat(store_purchase_percentage) : null,
        agreement_acknowledged: agreement_acknowledged !== undefined ? Boolean(agreement_acknowledged) : false, // Default to false
        acknowledgment_date: acknowledgment_date ? new Date(acknowledgment_date).toISOString() : null,
    };

    try {
        const { data, error } = await supabase
            .from('agreements')
            .insert([agreementToInsert])
            .select(`
                *,
                products (name, category),
                consignors (full_name, email)
            `);

        if (error) {
            console.error("Supabase Error - addAgreement:", error);
            if (error.code === '23503') { // Foreign key violation
                return res.status(400).json({ message: 'Invalid product_id or consignor_id.', error: error.message });
            }
            return res.status(500).json({ message: 'Error adding agreement to database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Agreement added to DB:`, data[0]);
        res.status(201).json(data[0]);
    } catch (err) {
        console.error("Server Error - addAgreement:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Get all agreements
exports.getAllAgreements = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET /api/agreements called.`);
    try {
        const { data, error } = await supabase
            .from('agreements')
            .select(`
                *,
                products (id, name, category),
                consignors (id, full_name, email)
            `);

        if (error) {
            console.error("Supabase Error - getAllAgreements:", error);
            return res.status(500).json({ message: 'Error fetching agreements from database', error: error.message });
        }

        console.log(`[${new Date().toISOString()}] Returning ${data.length} agreements from DB.`);
        res.status(200).json(data);
    } catch (err) {
        console.error("Server Error - getAllAgreements:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Get agreement by ID
exports.getAgreementById = async (req, res) => {
    const agreementId = parseInt(req.params.id);
    console.log(`[${new Date().toISOString()}] GET /api/agreements/${agreementId} called.`);

    if (isNaN(agreementId)) {
        return res.status(400).json({ message: 'Invalid agreement ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('agreements')
            .select(`
                *,
                products (id, name, category),
                consignors (id, full_name, email)
            `)
            .eq('id', agreementId)
            .single();

        if (error) {
            console.error(`Supabase Error - getAgreementById for ID ${agreementId}:`, error);
            if (error.code === 'PGRST116') {
                return res.status(404).json({ message: `Agreement with ID ${agreementId} not found.` });
            }
            return res.status(500).json({ message: 'Error fetching agreement from database', error: error.message });
        }

        if (!data) {
            return res.status(404).json({ message: `Agreement with ID ${agreementId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Returning agreement with ID ${agreementId}:`, data);
        res.status(200).json(data);
    } catch (err) {
        console.error("Server Error - getAgreementById:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Update an existing agreement by ID
exports.updateAgreement = async (req, res) => {
    const agreementId = parseInt(req.params.id);
    const updateData = req.body;
    console.log(`[${new Date().toISOString()}] PUT /api/agreements/${agreementId} called. Update data:`, updateData);

    if (isNaN(agreementId)) {
        return res.status(400).json({ message: 'Invalid agreement ID provided.' });
    }

    const fieldsToUpdate = {};
    const allowedFields = [
        'product_id', 'consignor_id', 'commission_rate', 'unsold_item_policy',
        'store_purchase_percentage', 'agreement_acknowledged', 'acknowledgment_date',
        // 'discount_policy' will be handled specially, not in this array
    ];

    let hasValidField = false;
    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            // Type conversion for numeric/boolean/date fields
            if (['product_id', 'consignor_id'].includes(field)) {
                fieldsToUpdate[field] = parseInt(updateData[field]);
            } else if (['commission_rate', 'store_purchase_percentage'].includes(field)) {
                fieldsToUpdate[field] = parseFloat(updateData[field]);
            } else if (field === 'agreement_acknowledged') {
                fieldsToUpdate[field] = Boolean(updateData[field]);
            } else if (field === 'acknowledgment_date') {
                fieldsToUpdate[field] = updateData[field] ? new Date(updateData[field]).toISOString() : null;
            } else {
                fieldsToUpdate[field] = updateData[field];
            }
            hasValidField = true;
        }
    }

    // Special handling for discount_policy JSONB
    const currentAgreementQuery = await supabase
        .from('agreements')
        .select('discount_policy')
        .eq('id', agreementId)
        .single();

    if (currentAgreementQuery.error) {
        console.error("Supabase Error - updateAgreement (fetching current discount_policy):", currentAgreementQuery.error);
        return res.status(500).json({ message: 'Error fetching current agreement data for update.', error: currentAgreementQuery.error.message });
    }

    const currentDiscountPolicy = currentAgreementQuery.data.discount_policy || {};

    let newDiscountPolicy = { ...currentDiscountPolicy }; // Start with current or empty object

    let discountPolicyUpdated = false;
    // Check for individual discount fields in updateData
    if (updateData.discount_enabled !== undefined) {
        newDiscountPolicy.enabled = Boolean(updateData.discount_enabled);
        discountPolicyUpdated = true;
    }
    if (updateData.discount_percentage !== undefined) {
        newDiscountPolicy.percentage = parseFloat(updateData.discount_percentage);
        discountPolicyUpdated = true;
    }
    if (updateData.discount_start_after_days !== undefined) {
        newDiscountPolicy.start_after_days = parseInt(updateData.discount_start_after_days);
        discountPolicyUpdated = true;
    }
    if (updateData.discount_interval_days !== undefined) {
        newDiscountPolicy.interval_days = parseInt(updateData.discount_interval_days);
        discountPolicyUpdated = true;
    }

    // If a complete discount_policy object is sent (e.g., from frontend form data)
    if (updateData.discount_policy && typeof updateData.discount_policy === 'object') {
        newDiscountPolicy = { ...newDiscountPolicy, ...updateData.discount_policy };
        discountPolicyUpdated = true;
    }

    if (discountPolicyUpdated) {
        fieldsToUpdate.discount_policy = newDiscountPolicy;
        hasValidField = true;
    }


    fieldsToUpdate.updated_at = new Date().toISOString();

    if (!hasValidField && Object.keys(fieldsToUpdate).length === 1 && fieldsToUpdate.updated_at) {
        return res.status(400).json({ message: 'No valid fields provided for agreement update.' });
    }

    try {
        const { data, error } = await supabase
            .from('agreements')
            .update(fieldsToUpdate)
            .eq('id', agreementId)
            .select(`
                *,
                products (id, name, category),
                consignors (id, full_name, email)
            `);

        if (error) {
            console.error(`Supabase Error - updateAgreement for ID ${agreementId}:`, error);
            if (error.code === '23503') { // Foreign key violation
                return res.status(400).json({ message: 'Invalid product_id or consignor_id provided for update.', error: error.message });
            }
            return res.status(500).json({ message: 'Error updating agreement in database', error: error.message });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: `Agreement with ID ${agreementId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Agreement ID ${agreementId} updated in DB:`, data[0]);
        res.status(200).json(data[0]);
    } catch (err) {
        console.error("Server Error - updateAgreement:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

// Delete an agreement by ID
exports.deleteAgreement = async (req, res) => {
    const agreementId = parseInt(req.params.id);
    console.log(`[${new Date().toISOString()}] DELETE /api/agreements/${agreementId} called.`);

    if (isNaN(agreementId)) {
        return res.status(400).json({ message: 'Invalid agreement ID provided.' });
    }

    try {
        const { data, error } = await supabase
            .from('agreements')
            .delete()
            .eq('id', agreementId)
            .select(); // Select to confirm deletion

        if (error) {
            console.error(`Supabase Error - deleteAgreement for ID ${agreementId}:`, error);
            return res.status(500).json({ message: 'Error deleting agreement from database', error: error.message });
        }

        if (data.length === 0) {
            return res.status(404).json({ message: `Agreement with ID ${agreementId} not found.` });
        }

        console.log(`[${new Date().toISOString()}] Agreement ID ${agreementId} deleted successfully.`);
        res.status(204).send(); // 204 No Content
    } catch (err) {
        console.error("Server Error - deleteAgreement:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};