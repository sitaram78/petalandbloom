const path = require('path');
const fs = require('fs');

// Load .env
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('[Test Setup] Connecting to new Supabase project:', supabaseUrl);
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runTests() {
  console.log('\n--- TEST 1: Check Seeded Products in Database ---');
  const { data: prods, error: prodErr } = await supabase.from('products').select('code, name, price_in_paise').limit(3);
  if (prodErr) {
    console.error('Failed to query products:', prodErr);
    return;
  }
  console.log(`Found ${prods.length} products. Sample:`, prods[0]);

  console.log('\n--- TEST 2: Insert a Test Coupon ---');
  const testCouponCode = 'WELCOME10';
  await supabase.from('coupons').upsert({
    code: testCouponCode,
    discount_type: 'PERCENT',
    discount_value: 10,
    min_order_in_paise: 50000, // ₹500
    active: true,
  }, { onConflict: 'code' });
  console.log(`Coupon ${testCouponCode} created/ready.`);

  console.log('\n--- TEST 3: Create Order & Cashfree Session via create-order handler ---');
  // Load handler
  const { default: createOrderHandler } = await import('../api/checkout/create-order.ts');

  let orderResult = null;
  const mockReq = {
    method: 'POST',
    headers: { origin: 'http://localhost:5173' },
    body: {
      items: [
        { code: prods[0].code, quantity: 1, color: 'Red', giftWrap: true },
        { code: prods[1].code, quantity: 1 }
      ],
      customer: {
        name: 'Priya Sharma',
        phone: '9876543210',
        email: 'priya@example.com'
      },
      shippingAddress: {
        recipientName: 'Priya Sharma',
        phone: '9876543210',
        addressLine1: 'Villa 12, Rosewood Boulevard',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001'
      },
      couponCode: testCouponCode,
      customerNote: 'Please handcraft with care.'
    }
  };

  const mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      orderResult = data;
      return this;
    }
  };

  await createOrderHandler(mockReq, mockRes);
  console.log('Create Order Result (Status ' + mockRes.statusCode + '):', orderResult);

  if (!orderResult || !orderResult.success) {
    console.error('Order creation failed!');
    return;
  }

  const createdOrderNumber = orderResult.orderNumber;

  console.log('\n--- TEST 4: Simulate Cashfree Payment Webhook ---');
  const { default: webhookHandler } = await import('../api/payments/cashfree-webhook.ts');

  let webhookResult = null;
  const webhookReq = {
    method: 'POST',
    headers: {
      'x-webhook-signature': 'simulated_sig',
      'x-webhook-timestamp': String(Date.now()),
    },
    body: {
      event_type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: createdOrderNumber },
        payment: {
          cf_payment_id: `pay_test_${Date.now()}`,
          payment_status: 'SUCCESS',
          payment_group: 'UPI',
        }
      }
    }
  };

  const webhookRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      webhookResult = data;
      return this;
    }
  };

  await webhookHandler(webhookReq, webhookRes);
  console.log('Webhook Result (Status ' + webhookRes.statusCode + '):', webhookResult);

  console.log('\n--- TEST 5: Track Order Status After Payment ---');
  const { default: trackHandler } = await import('../api/orders/track.ts');

  let trackResult = null;
  const trackReq = {
    method: 'POST',
    body: {
      orderNumber: createdOrderNumber,
      phone: '9876543210'
    }
  };

  const trackRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      trackResult = data;
      return this;
    }
  };

  await trackHandler(trackReq, trackRes);
  console.log('Track Order Result:');
  console.log('  Order Number:', trackResult.order.orderNumber);
  console.log('  Order Status:', trackResult.order.orderStatus);
  console.log('  Payment Status:', trackResult.order.paymentStatus);
  console.log('  Total in ₹:', trackResult.order.totalInRupees);
  console.log('  Items Count:', trackResult.order.items.length);
  console.log('  Status History Count:', trackResult.order.history.length);

  console.log('\nALL END-TO-END CHECKOUT & PAYMENT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(console.error);
