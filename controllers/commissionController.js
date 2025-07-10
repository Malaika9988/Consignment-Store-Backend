// backend/controllers/commissionController.js
const supabase = require('../config/supabaseClient');

// --- COMMISSION API CONTROLLERS ---

/**
 * Generates or fetches a commission tracking record for a given consignor and date range.
 */
exports.getOrCreateCommissionReport = async (req, res) => {
    console.log(`[${new Date().toISOString()}] GET/POST /api/commissions/report called. Query:`, req.query);
    const { consignor_id, period_start, period_end } = req.query;

    if (!consignor_id || !period_start || !period_end) {
        return res.status(400).json({ message: 'Consignor ID, period start, and period end are required.' });
    }

    const parsedConsignorId = parseInt(consignor_id);
    if (isNaN(parsedConsignorId)) {
        return res.status(400).json({ message: 'Invalid Consignor ID.' });
    }

    try {
        let { data: existingTracking, error: fetchError } = await supabase
            .from('commission_tracking')
            .select('*')
            .eq('consignor_id', parsedConsignorId)
            .eq('period_start', period_start)
            .eq('period_end', period_end)
            .maybeSingle();

        if (fetchError) throw fetchError;

        let commissionTrackingId;
        let totalCommission = 0;
        let totalSales = 0;
        let commissionItemsData = [];

        if (!existingTracking) {
            const { data: saleItems, error: saleItemsError } = await supabase
                .from('sale_items')
                .select(`
                    id, product_id, quantity, unit_price, commission, line_total, sale_id,
                    agreement_id, products(name), sale_header(sale_date), agreements(commission_rate)
                `)
                .eq('consignor_id', parsedConsignorId)
                .gte('sale_header.sale_date', period_start)
                .lte('sale_header.sale_date', period_end);

            if (saleItemsError) throw saleItemsError;

            if (!saleItems.length) {
                return res.status(200).json({ message: 'No sales found for this period.', report: null });
            }

            commissionItemsData = saleItems.map(item => {
                totalCommission += item.commission || 0;
                totalSales += item.line_total || 0;

                return {
                    commission_tracking_id: null,
                    sale_item_id: item.id,
                    product_id: item.product_id,
                    sale_amount: item.line_total,
                    commission_rate: item.agreements?.commission_rate || 0,
                    commission_amount: item.commission,
                };
            });

            const { data: newTracking, error: insertError } = await supabase
                .from('commission_tracking')
                .insert([{
                    consignor_id: parsedConsignorId,
                    period_start,
                    period_end,
                    total_commission: totalCommission,
                    total_sales: totalSales,
                    status: 'pending',
                    generated_at: new Date().toISOString(),
                    paid_amount: 0
                }])
                .select('*')
                .single();

            if (insertError) throw insertError;

            commissionTrackingId = newTracking.id;
            existingTracking = newTracking;

            const itemsToInsert = commissionItemsData.map(item => ({
                ...item,
                commission_tracking_id: commissionTrackingId
            }));

            const { error: itemsError } = await supabase
                .from('commission_items')
                .insert(itemsToInsert);

            if (itemsError) {
                await supabase.from('commission_tracking').delete().eq('id', commissionTrackingId);
                throw itemsError;
            }
        } else {
            commissionTrackingId = existingTracking.id;
            const { data: existingItems, error: itemsError } = await supabase
                .from('commission_items')
                .select(`*, sale_items(sale_id, product_id, quantity, unit_price, products(name), sale_header(invoice_number, sale_date))`)
                .eq('commission_tracking_id', commissionTrackingId);

            if (itemsError) throw itemsError;

            commissionItemsData = existingItems;
            totalCommission = existingTracking.total_commission;
            totalSales = existingTracking.total_sales;
        }

        const { data: payments, error: paymentsError } = await supabase
            .from('commission_payments')
            .select('*')
            .eq('commission_tracking_id', commissionTrackingId);

        if (paymentsError) console.warn("Payment fetch warning:", paymentsError);

        const report = {
            ...existingTracking,
            commission_items: commissionItemsData,
            payments: payments || []
        };

        res.status(200).json({ message: 'Commission report processed successfully.', report });

    } catch (err) {
        console.error("Commission Report Error:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

/**
 * Verifies a commission tracking record before marking as paid
 */
exports.verifyCommissionTracking = async (req, res) => {
    const trackingId = req.params.id;

    if (!trackingId || !/^[0-9a-fA-F\-]{36}$/.test(trackingId)) {
        return res.status(400).json({ message: 'Invalid Commission Tracking ID.' });
    }

    try {
        const { data: tracking, error } = await supabase
            .from('commission_tracking')
            .select('id, status')
            .eq('id', trackingId)
            .maybeSingle();

        if (error) throw error;
        if (!tracking) return res.status(404).json({ message: 'Commission tracking record not found.' });
        if (tracking.status === 'paid') return res.status(400).json({ message: 'Commission already paid.' });

        res.status(200).json({ valid: true });
    } catch (err) {
        console.error("Verify Error:", err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};