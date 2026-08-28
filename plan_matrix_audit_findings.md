# Phase 1: Plan Matrix Evidence Audit - FINDINGS

## Canonical Plan Matrix from Repository Evidence

Based on the repository artifacts, there are **THREE conflicting plan matrices**:

---

### 1. DATABASE MIGRATION (Backend/scripts/migrate-super-admin.js) - 3 PLANS
| Plan Key | Name | Monthly | Yearly | Features |
|----------|------|---------|--------|----------|
| **FREE** | Free Starter Plan | 0 | 0 | dashboard, customers, deliveries, products, payments, profile, agents, notifications, monitoring, health, buildings, farm-plan, bank |
| **GROWTH** | Growth Premium Plan | 999 | 9990 | FREE + performance |
| **PRIME** | Prime Platform Plan | 2499 | 24990 | GROWTH + procurement, suppliers |

---

### 2. SCRATCH SEED SCRIPT (Backend/scratch/seed_super_admin.js) - 3 PLANS (DIFFERENT!)
| Plan Key | Name | Monthly | Yearly | Features |
|----------|------|---------|--------|----------|
| **STARTER** | Starter Plan | 499 | 4990 | base features (13) |
| **GROWTH** | Growth Premium Plan | 999 | 9990 | STARTER + performance |
| **ENTERPRISE** | Enterprise Platform Plan | 2499 | 24990 | GROWTH + procurement, suppliers |

---

### 3. FRONTEND NORMALIZATION (Frontend/src/utils/adminPlanAccess.js) - 3 TIERS
| DB Plan | Normalized Tier | PLAN_RANK |
|---------|-----------------|-----------|
| FREE, STARTER | **Free** | 0 |
| GROWTH | **Growth** | 1 |
| PRIME, ENTERPRISE | **Prime** | 2 |

---

### 4. FRONTEND PLANSTEP UI (Frontend/src/components/steps/PlanStep.jsx) - 3 PLANS
| Plan Key | Name | Monthly | Yearly |
|----------|------|---------|--------|
| **STARTER** | Starter | 499 | 4990 |
| **GROWTH** | Growth | 999 | 9990 |
| **ENTERPRISE** | Enterprise | 2499 | 24990 |

---

### 5. BACKEND CONSTANTS (Backend/constants/plans.js) - 3 PLANS
| Plan Key | Monthly | Yearly |
|----------|---------|--------|
| **Free** | 499 | 4990 |
| **Growth** | 999 | 9990 |
| **Prime** | 2499 | 24990 |

---

### 6. BACKEND MIDDLEWARE (Backend/middleware/adminPlan.middleware.js) - QUERIES DB
- Reads `plan_key` and `features` from `platform_plans` table
- Caches by `planKey`
- Checks `features.includes(requiredFeature)`

---

### 7. SUPER ADMIN COUPONS CONTROLLER - 5 PLAN KEYS
```javascript
FREE: { monthly: 499, yearly: 4990 },
STARTER: { monthly: 499, yearly: 4990 },
GROWTH: { monthly: 999, yearly: 9990 },
PRIME: { monthly: 2499, yearly: 24990 },
ENTERPRISE: { monthly: 2499, yearly: 24990 },
// "PRIME ENTERPRISE" normalized to "ENTERPRISE"
```

---

## CRITICAL DISCREPANCIES

| Issue | Impact |
|-------|--------|
| **FREE vs STARTER** | DB migration has FREE (₹0), seed script has STARTER (₹499), constants have Free (₹499), UI shows STARTER (₹499) |
| **PRIME vs ENTERPRISE** | DB migration has PRIME, seed script has ENTERPRISE, constants have Prime |
| **Pricing mismatch** | FREE is ₹0 in migration but ₹499 everywhere else |
| **Plan keys in DB** | Migration seeds FREE/GROWTH/PRIME but seed script seeds STARTER/GROWTH/ENTERPRISE |
| **Frontend normalization** | Maps both FREE+STARTER→Free, PRIME+ENTERPRISE→Prime, but DB has only one of each pair |
| **Middleware cache** | Keyed by DB `plan_key` (FREE/STARTER/PRIME/ENTERPRISE), but frontend uses normalized tiers |

---

## VERDICT: INSUFFICIENT PROJECT EVIDENCE

The repository contains **conflicting canonical sources**:
- Database migration (migrate-super-admin.js) → FREE, GROWTH, PRIME
- Seed script (seed_super_admin.js) → STARTER, GROWTH, ENTERPRISE  
- Frontend constants → Free, Growth, Prime (with ₹499/₹999/₹2499 pricing)
- UI (PlanStep) → STARTER, GROWTH, ENTERPRISE

**NO single authoritative source** defines the intended plan matrix.

**REQUIRES BUSINESS DECISION** before proceeding to PHASE 2.
