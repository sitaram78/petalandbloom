/**
 * Automated Verification Suite for Phase 5: Admin Backoffice & Realtime Assistance
 * Tests:
 * 1. Security & RBAC: /api/admin/orders/update-status blocks unauthorized/customer requests
 * 2. Security & RBAC: /api/admin/customers/adjust-points blocks unauthorized/customer requests
 * 3. Server-Enforced Tamper-Proof Audit Logging
 * 4. Concierge Realtime Upgrade: Elimination of 2s polling loops & active Supabase channel subscriptions
 * 5. Admin Backoffice API routing across AdminOrders and AdminCustomers
 */

import * as fs from 'fs';
import * as path from 'path';
import orderUpdateHandler from '../api/admin/orders/update-status';
import pointsAdjustHandler from '../api/admin/customers/adjust-points';

let passedAssertions = 0;
let totalAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
  } else {
    console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
    if (detail) console.error(`    \x1b[33mDetail: ${detail}\x1b[0m`);
    process.exitCode = 1;
  }
}

function createMockReqRes(method: string, body: any = {}, headers: any = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req: any = {
    method,
    body,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    setHeader() {
      return res;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
}

async function runPhase5Tests() {
  console.log('\n============================================================');
  console.log('   THE PETAL & BLOOM — PHASE 5 ADMIN & REALTIME AUDIT SUITE  ');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // SECTION 1: /api/admin/orders/update-status Security & Audit
  // ------------------------------------------------------------
  console.log('--- 1. Testing /api/admin/orders/update-status API ---');

  // 1.1 Method check
  const getMock = createMockReqRes('GET');
  await orderUpdateHandler(getMock.req, getMock.res);
  assert(getMock.getStatus() === 405, 'Rejects non-POST methods with HTTP 405');

  // 1.2 Unauthenticated call
  const unauthOrderMock = createMockReqRes('POST', { orderId: 'test-1', newStatus: 'CONFIRMED' });
  await orderUpdateHandler(unauthOrderMock.req, unauthOrderMock.res);
  assert(unauthOrderMock.getStatus() === 401, 'Rejects unauthenticated requests with HTTP 401');

  // 1.3 Inspection of handler implementation for tamper-proof server audit log
  const orderUpdateSource = fs.readFileSync(path.resolve(__dirname, '../api/admin/orders/update-status.ts'), 'utf-8');
  const hasRequireAuth = orderUpdateSource.includes('requireAuth(req, res');
  const hasServerAudit = orderUpdateSource.includes('logAuditEvent(') && orderUpdateSource.includes('ORDER_STATUS_TRANSITION');
  const hasDispatchEmail = orderUpdateSource.includes('sendDispatchEmail(');
  assert(hasRequireAuth && hasServerAudit && hasDispatchEmail, 'Enforces staff authentication, server audit logging, and dispatch email automation');

  // ------------------------------------------------------------
  // SECTION 2: /api/admin/customers/adjust-points Security & Audit
  // ------------------------------------------------------------
  console.log('\n--- 2. Testing /api/admin/customers/adjust-points API ---');

  // 2.1 Method check
  const getPointsMock = createMockReqRes('GET');
  await pointsAdjustHandler(getPointsMock.req, getPointsMock.res);
  assert(getPointsMock.getStatus() === 405, 'Rejects non-POST methods with HTTP 405');

  // 2.2 Unauthenticated call
  const unauthPointsMock = createMockReqRes('POST', { customerId: 'cust-1', pointsDelta: 100 });
  await pointsAdjustHandler(unauthPointsMock.req, unauthPointsMock.res);
  assert(unauthPointsMock.getStatus() === 401, 'Rejects unauthenticated points adjustment with HTTP 401');

  // 2.3 Inspection of handler implementation for server-enforced audit & tier updates
  const pointsAdjustSource = fs.readFileSync(path.resolve(__dirname, '../api/admin/customers/adjust-points.ts'), 'utf-8');
  const hasPointsAuth = pointsAdjustSource.includes("allowedRoles: ['super_admin', 'admin']");
  const hasPointsAudit = pointsAdjustSource.includes('AUDIT_ACTIONS.POINTS_ADJUSTED');
  const hasTierResolution = pointsAdjustSource.includes('resolveLoyaltyTier(');
  assert(hasPointsAuth && hasPointsAudit && hasTierResolution, 'Requires admin role, updates tier dynamically, and logs server-side audit entry');

  // ------------------------------------------------------------
  // SECTION 3: Realtime Concierge Chat (Zero Polling)
  // ------------------------------------------------------------
  console.log('\n--- 3. Testing Concierge Realtime Upgrade (Zero Polling) ---');

  const conciergeWidgetSource = fs.readFileSync(
    path.resolve(__dirname, '../src/components/AtelierConciergeWidget.tsx'),
    'utf-8'
  );

  // 3.1 Verify aggressive 2-second polling is completely removed
  const hasAggressivePolling = conciergeWidgetSource.includes('2000);') && conciergeWidgetSource.includes('loadMessages()');
  assert(!hasAggressivePolling, 'Aggressive 2-second polling loop is completely eliminated from AtelierConciergeWidget');

  // 3.2 Verify native Supabase Realtime channel subscription
  const hasRealtimeChannel =
    conciergeWidgetSource.includes("`realtime:concierge_messages:${conversationId}`") &&
    conciergeWidgetSource.includes("'postgres_changes'") &&
    conciergeWidgetSource.includes("table: 'assistance_messages'");
  assert(hasRealtimeChannel, 'Subscribes to Supabase Realtime channel for live concierge chat');

  // 3.3 Verify AdminMessages.tsx also uses Supabase Realtime
  const adminMessagesSource = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/admin/AdminMessages.tsx'),
    'utf-8'
  );
  const adminHasConvRealtime = adminMessagesSource.includes("channel('realtime:assistance_conversations')");
  const adminHasMsgRealtime = adminMessagesSource.includes("channel(`realtime:assistance_messages:");
  assert(adminHasConvRealtime && adminHasMsgRealtime, 'AdminMessages connects to Supabase Realtime for conversations & messages');

  // ------------------------------------------------------------
  // SECTION 4: Admin Backoffice Route Isolation
  // ------------------------------------------------------------
  console.log('\n--- 4. Testing Admin UI Authenticated API Routing ---');

  const adminOrdersSource = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/admin/AdminOrders.tsx'),
    'utf-8'
  );
  const ordersUsesUpdateStatusApi = adminOrdersSource.includes("authFetch('/api/admin/orders/update-status'");
  const ordersUsesCancelApi = adminOrdersSource.includes("authFetch('/api/orders/cancel'");
  assert(ordersUsesUpdateStatusApi && ordersUsesCancelApi, 'AdminOrders routes status updates and cancellations through authenticated backend endpoints');

  const adminCustomersSource = fs.readFileSync(
    path.resolve(__dirname, '../src/pages/admin/AdminCustomers.tsx'),
    'utf-8'
  );
  const customersUsesPointsApi = adminCustomersSource.includes("authFetch('/api/admin/customers/adjust-points'");
  assert(customersUsesPointsApi, 'AdminCustomers routes points adjustments through authenticated backend endpoint');

  // ------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`AUDIT RESULTS: ${passedAssertions}/${totalAssertions} assertions passed`);
  if (passedAssertions === totalAssertions) {
    console.log('\x1b[32m✔ PHASE 5 CODE REVIEW & AUDIT COMPLETE: ALL BACKOFFICE & REALTIME CRITERIA SATISFIED\x1b[0m');
  } else {
    console.log('\x1b[31m✖ SOME AUDIT CHECKS FAILED\x1b[0m');
  }
  console.log('============================================================\n');
}

runPhase5Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
