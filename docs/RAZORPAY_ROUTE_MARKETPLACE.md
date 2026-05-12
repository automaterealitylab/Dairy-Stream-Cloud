# Razorpay Route Marketplace Implementation

This module implements a multi-vendor dairy marketplace:

Customer -> Razorpay Checkout -> Razorpay Route transfer -> Dairy linked account settlement.

The platform does not create RazorpayX payouts and does not take commission. Each marketplace order creates one Route transfer for 100% of the order amount to the dairy linked account.

## Folder Structure

Backend:

- `Backend/sql/SUPABASE_MIGRATIONS.sql`
- `Backend/services/marketplace/razorpayRoute.service.js`
- `Backend/services/marketplace/marketplace.service.js`
- `Backend/controllers/marketplace.controller.js`
- `Backend/routes/marketplace.routes.js`

Frontend:

- `Frontend/src/api/marketplace.api.js`
- `Frontend/src/utils/loadRazorpay.js`
- `Frontend/src/pages/marketplace/MarketplaceDairyRegistration.jsx`
- `Frontend/src/pages/marketplace/MarketplaceCheckout.jsx`
- `Frontend/src/pages/marketplace/MarketplaceSuccess.jsx`
- `Frontend/src/pages/marketplace/MarketplaceAdminDashboard.jsx`
- `Frontend/src/pages/marketplace/MarketplaceDairyDashboard.jsx`

## API Routes

- `POST /api/marketplace/dairies`
  Creates a dairy record, creates a Razorpay Route linked account, creates a stakeholder, requests Route product configuration, and updates settlement bank details.

- `GET /api/marketplace/dairies`
  Lists marketplace dairies for checkout.

- `POST /api/marketplace/orders`
  Creates a Supabase customer if needed, validates the dairy Route account, calculates the payable amount from backend product prices, creates a Razorpay order with `transfers[0].account` set to the dairy linked account, and stores order/payment rows.

- `POST /api/marketplace/payments/verify`
  Verifies Razorpay Checkout signature and marks order/payment as paid.

- `POST /api/marketplace/webhooks/razorpay`
  Verifies `x-razorpay-signature`, logs events idempotently, queues failed processing, and handles `payment.captured`, `payment.failed`, `order.paid`, `transfer.processed`, `transfer.failed`, and `settlement.processed`.

- `GET /api/marketplace/admin/dashboard`
  Admin view for dairies, orders, payments, and webhook logs.

- `GET /api/marketplace/admin/settlement-health`
  Admin settlement health summary for pending settlements, failed settlements, dead-letter webhooks, and recent reconciliation runs.

- `POST /api/marketplace/admin/reconcile`
  Runs reconciliation immediately. Compares local records with Razorpay payment and transfer state, repairs drift, and retries queued webhook events.

- `GET /api/marketplace/admin/orders/:razorpayOrderId/settlement`
  Verifies one order's transfer and settlement state against Razorpay and repairs the local payment record if needed.

- `GET /api/marketplace/dairies/:dairyId/dashboard`
  Dairy-specific payment dashboard.

## Frontend Pages

- `/marketplace/dairy/register`
- `/marketplace/checkout`
- `/marketplace/success`
- `/marketplace/admin`
- `/marketplace/dairy/:dairyId`

## Setup

1. Run the SQL in `Backend/sql/SUPABASE_MIGRATIONS.sql` in Supabase.
2. Copy `Backend/.env.example` to `Backend/.env` and fill values.
3. Copy `Frontend/.env.example` to `Frontend/.env` and set backend URL.
4. Enable Razorpay Route for the parent merchant account.
5. In Razorpay Dashboard, add a webhook URL:

   `https://your-backend-domain.com/api/marketplace/webhooks/razorpay`

6. Subscribe to:

   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `transfer.processed`
   - `transfer.failed`
   - `settlement.processed`

7. Save the Razorpay webhook secret in `RAZORPAY_WEBHOOK_SECRET`.

## Razorpay Route Notes

The implementation follows Razorpay Route linked account flow:

1. Create linked account using `POST /v2/accounts`.
2. Create the owner stakeholder using `POST /v2/accounts/:account_id/stakeholders`.
3. Request Route product configuration using `POST /v2/accounts/:account_id/products`.
4. Update settlement bank configuration using `PATCH /v2/accounts/:account_id/products/:product_id`.
5. Create orders with Route transfers using `POST /v1/orders` and a `transfers` array.

The order transfer uses:

```json
{
  "account": "acc_xxxxx",
  "amount": 10000,
  "currency": "INR",
  "on_hold": false
}
```

That means the full payment amount is transferred to the dairy linked account for settlement by Razorpay. No platform commission split is applied.

## Security

- Razorpay key secret and webhook secret are backend-only.
- Checkout signature is verified before payment verification.
- Frontend amount is not trusted. Checkout sends product/quantity only; the backend reads active dairy products, validates ownership and stock, applies configured tax/delivery fee, and creates the Razorpay order from the backend-calculated amount.
- Before checkout, the backend fetches the linked account and Route product from Razorpay and blocks checkout when the Route product is not active.
- The backend fetches the Razorpay payment before marking payment paid, and confirms order ID, amount, currency, and captured status.
- Webhook signature is verified using the raw request body.
- Webhook processing stores Razorpay event IDs, treats duplicate events idempotently, tracks retry attempts, and dead-letters events after repeated failures.
- Bank account, IFSC, PAN, phone, and amount inputs are validated on the backend.
- Marketplace APIs are protected with CORS allow-listing, security headers, and route-specific rate limits.

## Reconciliation

The backend schedules marketplace reconciliation with `MARKETPLACE_RECONCILIATION_CRON`.

Reconciliation:

- fetches unsettled local payment records,
- verifies Razorpay payment status,
- fetches Route transfers for each Razorpay order,
- syncs transfer status, transfer ID, settlement ID, and settlement status,
- writes repair activity to `payment_audit_logs`,
- records each run in `reconciliation_logs`,
- retries failed webhook log rows and dead-letters permanently failing events.

Useful scripts:

```bash
npm run reconcile:marketplace
npm run verify:marketplace-order -- order_xxxxx
```

## Important

Razorpay Route must be enabled for your Razorpay parent merchant account. Linked account and product configuration APIs will fail if the feature is not enabled for the account.
