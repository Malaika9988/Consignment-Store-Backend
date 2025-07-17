const supabase = require('../config/supabaseClient');

// Helper function to transform database snake_case to frontend camelCase
const toCamelCase = (data) => {
    if (!data) return data;

    if (Array.isArray(data)) {
        return data.map(item => toCamelCase(item));
    }

    if (typeof data === 'object' && data !== null) {
        return Object.keys(data).reduce((acc, key) => {
            const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
            acc[camelKey] = toCamelCase(data[key]);
            return acc;
        }, {});
    }

    return data;
};

// Helper function to transform frontend camelCase to database snake_case
const toSnakeCase = (data) => {
    if (!data) return data;

    if (Array.isArray(data)) {
        return data.map(item => toSnakeCase(item));
    }

    if (typeof data === 'object' && data !== null) {
        return Object.keys(data).reduce((acc, key) => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            acc[snakeKey] = toSnakeCase(data[key]);
            return acc;
        }, {});
    }

    return data;
};

// Add a new agreement
exports.addAgreement = async (req, res) => {
    console.log('[%s] POST /api/agreements/add-agreement called. Body: %j', new Date().toISOString(), req.body);

    try {
        const {
            productId,
            consignorId,
            commissionRate,
            unsoldItemPolicy,
            returnFallbackDays,
            discountSchedule = [], // This is the JS array from the client
            charityChoice,
            agreementAcknowledged,
            acknowledgmentDate, // This is the raw input from the client
            storePurchaseOption = false, // Added: default to false if not provided
            storePurchasePercentage = 0, // Added: default to 0 if not provided
        } = req.body;

        // Basic validation for required fields
        if (!productId || !consignorId || commissionRate === undefined || commissionRate === null) {
            return res.status(400).json({
                message: 'Missing required fields: productId, consignorId, commissionRate'
            });
        }

        // --- Data Pre-processing for PostgreSQL RPC ---

        // 1. Process acknowledgmentDate: Ensure it's a valid ISO string or null for TIMESTAMPTZ
        let processedAcknowledgmentDate = null;
        if (acknowledgmentDate) {
            try {
                processedAcknowledgmentDate = new Date(acknowledgmentDate).toISOString();
            } catch (e) {
                console.warn(`[addAgreement] Invalid acknowledgmentDate format received: "${acknowledgmentDate}". Setting to null.`);
                processedAcknowledgmentDate = null;
            }
        }

        // 2. Process discountSchedule and determine discountScheduleEnabled for JSONB
        const determinedDiscountScheduleEnabled = discountSchedule && discountSchedule.length > 0;
        const processedDiscountSchedule = determinedDiscountScheduleEnabled
            ? JSON.stringify(discountSchedule)
            : '[]'; // Crucial: Send "[]" for empty JSONB, not null

        // 3. Process returnFallbackDays: Ensure it's null if unsoldItemPolicy is not 'return' for INT
        const processedReturnFallbackDays = unsoldItemPolicy === 'return'
            ? returnFallbackDays
            : null;

        // Prepare parameters for the PostgreSQL function
        const rpcPayload = {
            p_acknowledgment_date: processedAcknowledgmentDate,
            p_agreement_acknowledged: agreementAcknowledged,
            p_charity_choice: unsoldItemPolicy === 'donate' ? charityChoice : null,
            p_commission_rate: commissionRate,
            p_consignor_id: consignorId,
            p_discount_schedule: processedDiscountSchedule,
            p_discount_schedule_enabled: determinedDiscountScheduleEnabled,
            p_product_id: productId,
            p_return_fallback_days: processedReturnFallbackDays,
            p_unsold_item_policy: unsoldItemPolicy,
            p_store_purchase_option: storePurchaseOption,      // Added
            p_store_purchase_percentage: storePurchasePercentage, // Added
        };

        console.log('--- RPC Payload for create_agreement_with_details:', JSON.stringify(rpcPayload, null, 2));

        const { data: agreement, error: agreementError } = await supabase
            .rpc('create_agreement_with_details', rpcPayload);

        if (agreementError) {
            console.error('Supabase RPC Error (create_agreement_with_details):', agreementError);
            if (agreementError.code === 'PGRST203') {
                return res.status(400).json({
                    message: 'Database function `create_agreement_with_details` not found or parameter types mismatch. Ensure your database functions are correctly deployed and match the payload types.',
                    error: agreementError.message,
                    details: agreementError.details
                });
            }
            return res.status(500).json({
                message: 'Internal server error during agreement creation.',
                error: agreementError.message,
                details: agreementError.details || 'No additional details provided from database.'
            });
        }

        const newAgreementId = agreement?.[0]?.id;
        if (!newAgreementId) {
            throw new Error('Failed to retrieve agreement ID after creation via RPC');
        }

        // Fetch the full agreement details with related data for the response
        const { data: fullAgreement, error: fetchError } = await supabase
            .from('agreements')
            .select(`
                *,
                progressive_discounts:progressive_discounts(id, days_after_listing, discount_percent),
                charity_donations:charity_donations(id, charity_choice)
            `)
            .eq('id', newAgreementId)
            .single();

        if (fetchError) {
            console.error('Supabase Fetch Error (after create):', fetchError);
            throw fetchError;
        }
        if (!fullAgreement) {
            throw new Error('Agreement not found after successful creation and fetch');
        }

        const response = {
            ...toCamelCase(fullAgreement),
            discountPolicy: fullAgreement.progressive_discounts?.length > 0 ? 'discount' : 'none',
            discountSchedule: fullAgreement.progressive_discounts?.map(d => ({
                days: d.days_after_listing,
                percent: d.discount_percent
            })) || [],
            charityChoice: fullAgreement.charity_donations?.[0]?.charity_choice || null,
            discountScheduleEnabled: fullAgreement.progressive_discounts?.length > 0
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error in addAgreement:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message,
            details: error.details || 'No additional details provided from database.'
        });
    }
};

// Get all agreements (no changes needed)
exports.getAllAgreements = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('agreements')
            .select(`
                *,
                progressive_discounts:progressive_discounts(id, days_after_listing, discount_percent),
                charity_donations:charity_donations(id, charity_choice)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const response = data.map(agreement => ({
            ...toCamelCase(agreement),
            discountPolicy: agreement.progressive_discounts?.length > 0 ? 'discount' : 'none',
            discountSchedule: agreement.progressive_discounts?.map(d => ({
                days: d.days_after_listing,
                percent: d.discount_percent
            })) || [],
            charityChoice: agreement.charity_donations?.[0]?.charity_choice || null,
            discountScheduleEnabled: agreement.progressive_discounts?.length > 0
        }));

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in getAllAgreements:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get agreement by ID (no changes needed)
exports.getAgreementById = async (req, res) => {
    try {
        const agreementId = parseInt(req.params.id);
        if (isNaN(agreementId)) {
            return res.status(400).json({ message: 'Invalid agreement ID' });
        }

        const { data, error } = await supabase
            .from('agreements')
            .select(`
                *,
                progressive_discounts:progressive_discounts(id, days_after_listing, discount_percent),
                charity_donations:charity_donations(id, charity_choice)
            `)
            .eq('id', agreementId)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ message: 'Agreement not found' });

        const response = {
            ...toCamelCase(data),
            discountPolicy: data.progressive_discounts?.length > 0 ? 'discount' : 'none',
            discountSchedule: data.progressive_discounts?.map(d => ({
                days: d.days_after_listing,
                percent: d.discount_percent
            })) || [],
            charityChoice: data.charity_donations?.[0]?.charity_choice || null,
            discountScheduleEnabled: data.progressive_discounts?.length > 0
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in getAgreementById:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update agreement
exports.updateAgreement = async (req, res) => {
    console.log('[%s] PUT /api/agreements/:id called. Body: %j', new Date().toISOString(), req.body);

    try {
        const agreementId = parseInt(req.params.id);
        if (isNaN(agreementId)) {
            return res.status(400).json({ message: 'Invalid agreement ID' });
        }

        const {
            productId,
            consignorId,
            commissionRate,
            unsoldItemPolicy,
            returnFallbackDays,
            discountSchedule = [],
            charityChoice,
            agreementAcknowledged,
            acknowledgmentDate,
            storePurchaseOption = false,    // Added
            storePurchasePercentage = 0,    // Added
        } = req.body;

        // --- Data Pre-processing for PostgreSQL RPC ---
        let processedAcknowledgmentDate = null;
        if (acknowledgmentDate) {
            try {
                processedAcknowledgmentDate = new Date(acknowledgmentDate).toISOString();
            } catch (e) {
                console.warn(`[updateAgreement] Invalid acknowledgmentDate format received: "${acknowledgmentDate}". Setting to null.`);
                processedAcknowledgmentDate = null;
            }
        }

        const determinedDiscountScheduleEnabled = discountSchedule && discountSchedule.length > 0;
        const processedDiscountSchedule = determinedDiscountScheduleEnabled
            ? JSON.stringify(discountSchedule)
            : '[]';

        const processedReturnFallbackDays = unsoldItemPolicy === 'return'
            ? returnFallbackDays
            : null;

        // Prepare parameters for the PostgreSQL function
        const rpcPayload = {
            p_agreement_id: agreementId,
            p_acknowledgment_date: processedAcknowledgmentDate,
            p_agreement_acknowledged: agreementAcknowledged,
            p_charity_choice: unsoldItemPolicy === 'donate' ? charityChoice : null,
            p_commission_rate: commissionRate,
            p_consignor_id: consignorId,
            p_discount_schedule: processedDiscountSchedule,
            p_discount_schedule_enabled: determinedDiscountScheduleEnabled,
            p_product_id: productId,
            p_return_fallback_days: processedReturnFallbackDays,
            p_unsold_item_policy: unsoldItemPolicy,
            p_store_purchase_option: storePurchaseOption,      // Added
            p_store_purchase_percentage: storePurchasePercentage, // Added
        };

        console.log('--- RPC Payload for update_agreement_with_details:', JSON.stringify(rpcPayload, null, 2));

        const { data: agreement, error: updateError } = await supabase
            .rpc('update_agreement_with_details', rpcPayload);

        if (updateError) {
            console.error('Supabase RPC Error (update_agreement_with_details):', updateError);
            if (updateError.code === 'PGRST203') {
                return res.status(400).json({
                    message: 'Database function `update_agreement_with_details` not found or parameter types mismatch. Ensure your database functions are correctly deployed and match the payload types.',
                    error: updateError.message,
                    details: updateError.details
                });
            }
            return res.status(500).json({
                message: 'Internal server error during agreement update.',
                error: updateError.message,
                details: updateError.details || 'No additional details provided from database.'
            });
        }

        const { data: updatedAgreement, error: fetchError } = await supabase
            .from('agreements')
            .select(`
                *,
                progressive_discounts:progressive_discounts(id, days_after_listing, discount_percent),
                charity_donations:charity_donations(id, charity_choice)
            `)
            .eq('id', agreementId)
            .single();

        if (fetchError) {
            console.error('Supabase Fetch Error (after update):', fetchError);
            throw fetchError;
        }
        if (!updatedAgreement) {
            throw new Error('Agreement not found after successful update and fetch');
        }

        const response = {
            ...toCamelCase(updatedAgreement),
            discountPolicy: updatedAgreement.progressive_discounts?.length > 0 ? 'discount' : 'none',
            discountSchedule: updatedAgreement.progressive_discounts?.map(d => ({
                days: d.days_after_listing,
                percent: d.discount_percent
            })) || [],
            charityChoice: updatedAgreement.charity_donations?.[0]?.charity_choice || null,
            discountScheduleEnabled: updatedAgreement.progressive_discounts?.length > 0
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error in updateAgreement:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message,
            details: error.details || 'No additional details provided from database.'
        });
    }
};

// Delete agreement (no changes needed)
exports.deleteAgreement = async (req, res) => {
    console.log('[%s] DELETE /api/agreements/:id called. ID: %s', new Date().toISOString(), req.params.id);

    try {
        const agreementId = parseInt(req.params.id);
        if (isNaN(agreementId)) {
            return res.status(400).json({ message: 'Invalid agreement ID' });
        }

        const { error } = await supabase
            .from('agreements')
            .delete()
            .eq('id', agreementId);

        if (error) throw error;

        res.status(204).end();
    } catch (error) {
        console.error('Error in deleteAgreement:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
};