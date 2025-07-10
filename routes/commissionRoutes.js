const express = require('express');
const router = express.Router();
const supabase = require('../config/supabaseClient');

// =============================
// GET /api/commissions/unpaid
// =============================
router.get('/unpaid', async (req, res) => {
  const { data, error } = await supabase
    .from('commission_tracking')
    .select(`
      id,
      consignor_id,
      period_start,
      period_end,
      total_sales,
      total_commission,
      created_at,
      updated_at,
      consignors:consignor_id(full_name, email, phone_number)
    `)
    .eq('status', 'pending')
    .order('period_end', { ascending: true });

  if (error) {
    console.error('Error fetching unpaid commissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.json(data);
});

// ===========================
// GET /api/commissions/paid
// ===========================
router.get('/paid', async (req, res) => {
  // Removed comments from inside the select string
  const { data, error } = await supabase
    .from('commission_tracking')
    .select(`
      id,
      total_commission,
      period_start,
      period_end,
      consignors:consignor_id(full_name),
      status,
      updated_at
    `)
    .eq('status', 'paid')
    .order('updated_at', { ascending: false }); // Order by updated_at on the main table

  if (error) {
    console.error('Error fetching paid commissions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.json(data);
});

// ======================================================
// GET /api/commissions/:id/details - Get commission info
// ======================================================
router.get('/:id/details', async (req, res) => {
  const { id } = req.params;

  const { data: header, error: headerError } = await supabase
    .from('commission_tracking')
    .select(`*, consignors:consignor_id(full_name, email, phone_number)`)
    .eq('id', id)
    .single();

  if (headerError || !header) {
    return res.status(404).json({ error: 'Commission not found' });
  }

  const { data: items, error: itemsError } = await supabase
    .from('commission_items')
    .select(`*, sale_items:sale_item_id(sale_date, unit_price, quantity, line_total, products:product_id(name))`)
    .eq('commission_tracking_id', id);

  let payment = null;
  if (header.status === 'paid') {
    const { data: paymentData } = await supabase
      .from('commission_payments')
      .select('*')
      .eq('commission_tracking_id', id)
      .single();

    payment = paymentData;
  }

  if (itemsError) {
    return res.status(500).json({ error: 'Error fetching commission items' });
  }

  res.json({ header, items, payment });
});

// ======================================================
// GET /api/commissions/:id/verify - Verify commission status
// ======================================================
router.get('/:id/verify', async (req, res) => {
  const { id } = req.params;

  // Fetch the commission to check its status
  const { data: commission, error } = await supabase
    .from('commission_tracking')
    .select('id, status, total_commission')
    .eq('id', id)
    .single(); // Use single() as we expect one result

  if (error) {
    console.error('Error fetching commission for verification:', error);
    // If error is due to no rows found (e.g., id doesn't exist), return 404
    if (error.code === 'PGRST116') { // Supabase error code for no rows found
      return res.status(404).json({ error: 'Commission not found' });
    }
    return res.status(500).json({ error: 'Internal server error during verification' });
  }

  // If commission is not found (e.g., single() returns null if no match)
  if (!commission) {
    return res.status(404).json({ error: 'Commission not found' });
  }

  // Check if the commission is in a state that allows payment (e.g., 'pending' or 'calculated')
  if (commission.status === 'pending' || commission.status === 'calculated') {
    return res.status(200).json({
      success: true,
      message: 'Commission is valid for payment',
      commission_id: commission.id,
      total_commission: commission.total_commission
    });
  } else if (commission.status === 'paid') {
    return res.status(400).json({
      success: false,
      error: 'Commission has already been paid'
    });
  } else {
    // Handle other unexpected statuses
    return res.status(400).json({
      success: false,
      error: `Commission is in an unpayable status: ${commission.status}`
    });
  }
});


// ==============================
// POST /api/commissions/payment
// ==============================
router.post('/payment', async (req, res) => {
  const {
    commission_tracking_id,
    amount,
    payment_date,
    payment_method,
    transaction_reference,
    bank_name,
    account_last_four,
    card_last_four,
    card_type
  } = req.body;

  if (!commission_tracking_id || !amount || !payment_date || !payment_method) {
    return res.status(400).json({
      error: 'Missing required fields (commission_tracking_id, amount, payment_date, payment_method)'
    });
  }

  // ✅ FIXED: Validate status manually after fetching by ID
  const { data: commission, error: commissionError } = await supabase
    .from('commission_tracking')
    .select('*')
    .eq('id', commission_tracking_id)
    .maybeSingle(); // avoids throwing if not found

  if (commissionError) {
    console.error('Error fetching commission:', commissionError);
    return res.status(500).json({ error: 'Error fetching commission' });
  }

  if (!commission || !['pending', 'calculated'].includes(commission.status)) {
    return res.status(404).json({ error: 'Commission not found or already paid' });
  }

  if (parseFloat(amount) !== parseFloat(commission.total_commission)) {
    return res.status(400).json({
      error: `Payment amount (${amount}) must match commission amount (${commission.total_commission})`
    });
  }

  // Insert payment
  const { data: payment, error: paymentError } = await supabase
    .from('commission_payments')
    .insert([{
      commission_tracking_id,
      payment_date,
      payment_method,
      amount,
      transaction_reference,
      bank_name,
      account_last_four,
      card_last_four,
      card_type
    }])
    .select()
    .single();

  if (paymentError) {
    console.error('Error inserting payment:', paymentError);
    return res.status(500).json({ error: 'Error recording payment' });
  }

  // Update commission status
  const { error: updateError } = await supabase
    .from('commission_tracking')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', commission_tracking_id);

  if (updateError) {
    console.error('Error updating commission status:', updateError);
    return res.status(500).json({ error: 'Payment inserted but failed to update commission status' });
  }

  res.status(201).json({ success: true, payment });
});

module.exports = router;


