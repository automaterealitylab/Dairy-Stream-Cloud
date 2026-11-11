-- ====================================================================
-- Production Hardening Migration: Atomic Customer Wallet Settlement RPC
-- ====================================================================

-- Function: public.execute_customer_wallet_payment
-- Purpose: Atomically debits customer wallet, inserts [MONTHLY_BILL] payment settlement,
--          and logs [WALLET_DEBIT_CUSTOMER] ledger entry in a single PostgreSQL transaction.
-- Security: SECURITY DEFINER with fixed search_path, restricted to service_role.

CREATE OR REPLACE FUNCTION public.execute_customer_wallet_payment(
    p_customer_id BIGINT,
    p_dairy_id BIGINT,
    p_amount NUMERIC(10, 2),
    p_month_key VARCHAR(50),
    p_idempotency_key VARCHAR(160),
    p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_customer_dairy_id BIGINT;
    v_current_wallet NUMERIC(12, 2);
    v_next_wallet NUMERIC(12, 2);
    v_existing_payment RECORD;
    v_payment_id BIGINT;
    v_effective_dairy_id BIGINT;
    v_today_iso DATE := CURRENT_DATE;
    v_paid_at_iso TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Acquire exclusive Row-Level Lock on Customer row (Serializes concurrent wallet attempts)
    SELECT dairy_id, COALESCE(wallet_balance, 0)
    INTO v_customer_dairy_id, v_current_wallet
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found (ID: %)', p_customer_id;
    END IF;

    v_effective_dairy_id := COALESCE(p_dairy_id, v_customer_dairy_id);

    -- 2. Validate customer/dairy association
    IF p_dairy_id IS NOT NULL AND v_customer_dairy_id IS NOT NULL AND v_customer_dairy_id <> p_dairy_id THEN
        RAISE EXCEPTION 'Customer % does not belong to dairy %', p_customer_id, p_dairy_id;
    END IF;

    -- 3. Idempotency Check & Context Verification under Row Lock
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, customer_id, dairy_id, amount, status, method, billing_month
        INTO v_existing_payment
        FROM public.payments
        WHERE idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            -- Context validation against reuse attacks / accidental collisions
            IF v_existing_payment.customer_id <> p_customer_id OR
               (v_existing_payment.dairy_id IS NOT NULL AND v_existing_payment.dairy_id <> v_effective_dairy_id) OR
               v_existing_payment.method <> 'WALLET' OR
               v_existing_payment.status <> 'PAID' OR
               (v_existing_payment.billing_month IS NOT NULL AND v_existing_payment.billing_month <> p_month_key) OR
               ABS(v_existing_payment.amount - p_amount) >= 0.01 THEN
                RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT: Key % already used with conflicting payment parameters', p_idempotency_key;
            END IF;

            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'payment_id', v_existing_payment.id,
                'amount', v_existing_payment.amount,
                'wallet_balance', v_current_wallet
            );
        END IF;
    END IF;

    -- 4. Validate Amount
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than zero';
    END IF;

    -- 5. Validate Wallet Balance
    IF v_current_wallet < p_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance (Current: %, Required: %)', v_current_wallet, p_amount;
    END IF;

    v_next_wallet := ROUND((v_current_wallet - p_amount)::numeric, 2);

    -- 6. Atomic Wallet Debit
    UPDATE public.customers
    SET wallet_balance = v_next_wallet,
        updated_at = v_paid_at_iso
    WHERE id = p_customer_id;

    -- 7. Insert [MONTHLY_BILL] PAID Settlement
    INSERT INTO public.payments (
        customer_id,
        dairy_id,
        amount,
        status,
        method,
        description,
        billing_month,
        due_date,
        paid_at,
        idempotency_key,
        created_at,
        updated_at
    ) VALUES (
        p_customer_id,
        v_effective_dairy_id,
        p_amount,
        'PAID',
        'WALLET',
        p_description,
        p_month_key,
        v_today_iso,
        v_paid_at_iso,
        p_idempotency_key,
        v_paid_at_iso,
        v_paid_at_iso
    )
    RETURNING id INTO v_payment_id;

    -- 8. Insert [WALLET_DEBIT_CUSTOMER] Ledger Row
    INSERT INTO public.payments (
        customer_id,
        dairy_id,
        amount,
        status,
        method,
        description,
        billing_month,
        due_date,
        paid_at,
        created_at,
        updated_at
    ) VALUES (
        p_customer_id,
        v_effective_dairy_id,
        p_amount,
        'PAID',
        'WALLET',
        format('[WALLET_DEBIT_CUSTOMER] paid bills with wallet; amount=%s', p_amount),
        p_month_key,
        v_today_iso,
        v_paid_at_iso,
        v_paid_at_iso,
        v_paid_at_iso
    );

    -- 9. Return Atomic Success Payload
    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'payment_id', v_payment_id,
        'amount', p_amount,
        'previous_wallet_balance', v_current_wallet,
        'wallet_balance', v_next_wallet
    );
END;
$$;

-- Secure Permissions: Backend service_role only
REVOKE ALL ON FUNCTION public.execute_customer_wallet_payment(BIGINT, BIGINT, NUMERIC, VARCHAR, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_customer_wallet_payment(BIGINT, BIGINT, NUMERIC, VARCHAR, VARCHAR, TEXT) TO service_role;
