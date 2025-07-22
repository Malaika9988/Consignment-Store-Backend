// Updated addAgreement function
exports.addAgreement = async (req, res) => {
    console.log('[%s] POST /api/agreements/add-agreement called. Body: %j', new Date().toISOString(), req.body);

    try {
        const {
            productId,
            consignorId,
            commissionRate,
            unsoldItemPolicy,
            returnFallbackDays,
            progressiveDiscounts = [], // Changed from discountSchedule
            charityChoice,
            agreementAcknowledged,
            acknowledgmentDate,
            storePurchaseOption = false,
            storePurchasePercentage = 0,
        } = req.body;

        // Basic validation
        if (!productId || !consignorId || commissionRate === undefined || commissionRate === null) {
            return res.status(400).json({
                message: 'Missing required fields: productId, consignorId, commissionRate'
            });
        }

        // Process acknowledgmentDate
        let processedAcknowledgmentDate = null;
        if (acknowledgmentDate) {
            try {
                processedAcknowledgmentDate = new Date(acknowledgmentDate).toISOString();
            } catch (e) {
                console.warn(`Invalid acknowledgmentDate format: "${acknowledgmentDate}". Setting to null.`);
                processedAcknowledgmentDate = null;
            }
        }

        // Process progressiveDiscounts
        const determinedDiscountScheduleEnabled = progressiveDiscounts && progressiveDiscounts.length > 0;
        const processedDiscountSchedule = determinedDiscountScheduleEnabled
            ? JSON.stringify(progressiveDiscounts.map(d => ({
                days_after_listing: d.daysAfterSale,
                discount_percent: d.discountPercentage
            })))
            : '[]';

        // Process returnFallbackDays
        const processedReturnFallbackDays = unsoldItemPolicy === 'return'
            ? returnFallbackDays
            : null;

        // Prepare RPC payload
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
            p_store_purchase_option: storePurchaseOption,
            p_store_purchase_percentage: storePurchasePercentage,
        };

        console.log('RPC Payload:', JSON.stringify(rpcPayload, null, 2));

        // Create agreement
        const { data: agreement, error: agreementError } = await supabase
            .rpc('create_agreement_with_details', rpcPayload);

        if (agreementError) {
            console.error('Supabase RPC Error:', agreementError);
            return res.status(500).json({
                message: 'Internal server error during agreement creation',
                error: agreementError.message
            });
        }

        const newAgreementId = agreement?.[0]?.id;
        if (!newAgreementId) {
            throw new Error('Failed to retrieve agreement ID after creation');
        }

        // Insert progressive discounts if they exist
        if (determinedDiscountScheduleEnabled) {
            const { error: discountError } = await supabase
                .from('progressive_discounts')
                .insert(progressiveDiscounts.map(d => ({
                    agreement_id: newAgreementId,
                    days_after_listing: d.daysAfterSale,
                    discount_percent: d.discountPercentage
                })));

            if (discountError) {
                console.error('Error inserting progressive discounts:', discountError);
                throw discountError;
            }
        }

        // Fetch full agreement with relations
        const { data: fullAgreement, error: fetchError } = await supabase
            .from('agreements')
            .select(`
                *,
                progressive_discounts:progressive_discounts(id, days_after_listing, discount_percent),
                charity_donations:charity_donations(id, charity_choice)
            `)
            .eq('id', newAgreementId)
            .single();

        if (fetchError) throw fetchError;

        const response = {
            ...toCamelCase(fullAgreement),
            discountPolicy: fullAgreement.progressive_discounts?.length > 0 ? 'discount' : 'none',
            progressiveDiscounts: fullAgreement.progressive_discounts?.map(d => ({
                daysAfterSale: d.days_after_listing,
                discountPercentage: d.discount_percent
            })) || [],
            charityChoice: fullAgreement.charity_donations?.[0]?.charity_choice || null,
            discountScheduleEnabled: fullAgreement.progressive_discounts?.length > 0
        };

        res.status(201).json(response);
    } catch (error) {
        console.error('Error in addAgreement:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
};