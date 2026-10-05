// Phase 1 Security Verification Script
import storeHandler from '/home/sitaram/Desktop/thepetalandbloom/api/settings/store';
import moderateHandler from '/home/sitaram/Desktop/thepetalandbloom/api/reviews/moderate';
import refundHandler from '/home/sitaram/Desktop/thepetalandbloom/api/payments/refund';
import cancelHandler from '/home/sitaram/Desktop/thepetalandbloom/api/orders/cancel';
import bookShipmentHandler from '/home/sitaram/Desktop/thepetalandbloom/api/shipping/book-shipment';
import linkOrdersHandler from '/home/sitaram/Desktop/thepetalandbloom/api/account/link-orders';
import auditLogHandler from '/home/sitaram/Desktop/thepetalandbloom/api/audit/log';
import signupHandler from '/home/sitaram/Desktop/thepetalandbloom/api/account/signup';

class MockResponse {
  statusCode = 200;
  headers = {};
  body = null;

  setHeader(name, value) {
    this.headers[name] = value;
    return this;
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  json(data) {
    this.body = data;
    return this;
  }
}

function createMockRequest(options = {}) {
  return {
    method: options.method || 'POST',
    headers: options.headers || {},
    body: options.body || {},
    query: options.query || {},
    socket: { remoteAddress: options.ip || '127.0.0.1' },
  };
}

async function runTests() {
  console.log('--- STARTING PHASE 1 SECURITY VERIFICATION ---\n');
  let passed = 0;
  let failed = 0;

  async function assertThrowsOr401(testName, handler, req) {
    const res = new MockResponse();
    try {
      await handler(req, res);
      if (res.statusCode === 401 || res.statusCode === 403) {
        console.log(`✅ [PASS] ${testName} -> Blocked with HTTP ${res.statusCode} (${res.body?.error || res.body?.message})`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${testName} -> Expected 401/403, but received HTTP ${res.statusCode}`);
        failed++;
      }
    } catch (e) {
      console.log(`✅ [PASS] ${testName} -> Caught exception: ${e.message}`);
      passed++;
    }
  }

  // 1. Unauthenticated store settings POST
  await assertThrowsOr401(
    '1. POST /api/settings/store without token',
    storeHandler,
    createMockRequest({ method: 'POST', body: { whatsappNumber: '+919999999999' } })
  );

  // 2. Unauthenticated review moderation
  await assertThrowsOr401(
    '2. POST /api/reviews/moderate without token',
    moderateHandler,
    createMockRequest({ method: 'POST', body: { reviewId: 'test-123', action: 'delete' } })
  );

  // 3. Unauthenticated refund attempt
  await assertThrowsOr401(
    '3. POST /api/payments/refund without token',
    refundHandler,
    createMockRequest({ method: 'POST', body: { orderId: 'ord-123', amountInRupees: 100 } })
  );

  // 4. Unauthenticated order cancel attempt
  await assertThrowsOr401(
    '4. POST /api/orders/cancel without token',
    cancelHandler,
    createMockRequest({ method: 'POST', body: { orderId: 'ord-123', reason: 'malicious cancel' } })
  );

  // 5. Unauthenticated courier booking attempt
  await assertThrowsOr401(
    '5. POST /api/shipping/book-shipment without token',
    bookShipmentHandler,
    createMockRequest({ method: 'POST', body: { orderId: 'ord-123' } })
  );

  // 6. Unauthenticated order link attempt
  await assertThrowsOr401(
    '6. POST /api/account/link-orders without token',
    linkOrdersHandler,
    createMockRequest({ method: 'POST', body: { userId: 'victim-user-id', phone: '9999999999' } })
  );

  // 7. Unauthenticated audit log injection
  await assertThrowsOr401(
    '7. POST /api/audit/log without token',
    auditLogHandler,
    createMockRequest({ method: 'POST', body: { action: 'ORDER_CANCELLED', entity: 'orders', entity_id: 'fake' } })
  );

  // 8. Public Store Settings GET must remain accessible for storefront visitors
  const publicRes = new MockResponse();
  await storeHandler(createMockRequest({ method: 'GET' }), publicRes);
  if (publicRes.statusCode === 200 && publicRes.body?.success) {
    console.log(`✅ [PASS] 8. GET /api/settings/store -> Public storefront reads succeed with HTTP 200`);
    passed++;
  } else {
    console.error(`❌ [FAIL] 8. GET /api/settings/store -> Expected 200 OK, got ${publicRes.statusCode}`);
    failed++;
  }

  // 9. IP Rate Limiting on Signup
  console.log('\nTesting IP Rate Limiter on /api/account/signup...');
  let hitLimit = false;
  for (let i = 0; i < 7; i++) {
    const signupRes = new MockResponse();
    await signupHandler(
      createMockRequest({
        method: 'POST',
        body: { email: `test${i}@example.com`, password: 'password123', fullName: 'Test', phone: '9999999999' },
        ip: '192.168.1.50',
      }),
      signupRes
    );
    if (signupRes.statusCode === 429) {
      hitLimit = true;
      console.log(`✅ [PASS] 9. Signup rate limiter triggered on request #${i + 1} with HTTP 429 (${signupRes.body?.message})`);
      passed++;
      break;
    }
  }
  if (!hitLimit) {
    console.error(`❌ [FAIL] 9. Rate limiter was not triggered after 7 rapid registration requests`);
    failed++;
  }

  console.log(`\n=========================================`);
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
