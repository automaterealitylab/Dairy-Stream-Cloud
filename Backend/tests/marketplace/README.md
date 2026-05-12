# Marketplace QA Harness

Run unit and integration-safe tests:

```bash
npm run test:marketplace
```

Run health/load smoke tests against a running backend:

```bash
LOAD_TEST_BASE_URL=http://localhost:4000 npm run load:marketplace
```

Recommended staging scenarios:

- Webhook replay: send the same signed Razorpay event twice and verify the second response is duplicate/queued without a second ledger mutation.
- Duplicate event: reuse `x-razorpay-event-id` with a changed payload and confirm lineage stays tied to the first event.
- Settlement simulation: create a test order, mark payment captured, run `npm run reconcile:marketplace`, then verify transfer and settlement ledger rows.
- Concurrency: run multiple `workers:marketplace` processes against one Redis and confirm lock-protected jobs execute once.
- Chaos: temporarily block Razorpay API egress or lower `RAZORPAY_CIRCUIT_FAILURE_THRESHOLD` and verify retries, circuit opening, and reconciliation recovery.
- Mismatch: manually alter a test payment amount/status in Supabase, run reconciliation, and confirm `reconciliation_mismatches` gets an OPEN row.
