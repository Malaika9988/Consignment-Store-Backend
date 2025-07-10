// backend/controllers/reportController.js
const { createClient } = require('@supabase/supabase-js');

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

exports.getConsignorCommissions = async (req, res, next) => {
    const dateRange = req.query.dateRange;
    console.log(`Backend: Received request for consignor commissions for date range: ${dateRange}`);

    try {
        let startDate;
        let endDate = new Date();

        // --- Date Range Logic ---
        if (dateRange === 'this-year') {
            startDate = new Date(endDate.getFullYear(), 0, 1);
        } else if (dateRange === 'last-month') {
            startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
            endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
        } else {
            startDate = new Date(endDate.getFullYear(), 0, 1);
        }

        const isoStartDate = startDate.toISOString();
        const isoEndDate = endDate.toISOString();

        // --- SUPABASE QUERY ---
        const { data: commissionLines, error: fetchError } = await supabase
            .from('sale_items')
            .select(`
                line_total,
                commission_rate,
                products!inner (
                    consignor_id,
                    consignors!inner (
                        id,
                        full_name
                    )
                ),
                sale_header!inner (
                    sale_date
                )
            `)
            .gte('sale_header.sale_date', isoStartDate)
            .lte('sale_header.sale_date', isoEndDate);

        if (fetchError) {
            console.error("Supabase fetch error:", fetchError);
            throw new Error(`Error fetching sales data: ${fetchError.message}`);
        }

        // --- Aggregate Sales and Calculate Commissions per Consignor ---
        const consignorCommissionsMap = new Map();

        commissionLines.forEach(lineItem => {
            if (!lineItem.products || !lineItem.products.consignors) {
                console.warn("Missing joined product or consignor data for sale line:", lineItem);
                return;
            }

            const consignorId = lineItem.products.consignors.id;
            const consignorName = lineItem.products.consignors.full_name;
            const commissionRate = lineItem.commission_rate;
            const lineTotal = lineItem.line_total;

            if (!consignorId || !consignorName || commissionRate === undefined || lineTotal === undefined) {
                console.warn("Incomplete essential data for commission calculation:", lineItem);
                return;
            }

            if (!consignorCommissionsMap.has(consignorId)) {
                consignorCommissionsMap.set(consignorId, {
                    id: consignorId,
                    consignorName: consignorName,
                    totalSales: 0,
                    commissionRate: commissionRate,
                    commissionAmount: 0
                });
            }

            const consignorData = consignorCommissionsMap.get(consignorId);
            consignorData.totalSales += lineTotal;
            consignorData.commissionAmount += (lineTotal * commissionRate);
        });

        const commissionData = Array.from(consignorCommissionsMap.values());

        res.json(commissionData);

    } catch (error) {
        console.error("Error in getConsignorCommissions:", error);
        next(error);
    }
};