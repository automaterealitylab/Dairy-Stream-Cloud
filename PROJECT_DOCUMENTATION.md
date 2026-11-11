# 🥛 Dairy Stream Cloud (DairyVision) — Complete Technical Documentation

> **Document Version:** 2.0.0  
> **Repository:** `Dairy-Stream-Cloud` (Automate Reality Labs)  
> **Target Environment:** Node.js 22 / React 19 / Express 5 / Supabase (PostgreSQL 15+) / Redis 7 / Capacitor 8  
> **Production Domain:** [https://dairyvision.automaterealitylabs.in/](https://dairyvision.automaterealitylabs.in/)  
> **Mobile App Package:** `com.dairystream.app` (Android APK v1.0.0 via Capacitor)  
> **Document Scope:** Full-System Comprehensive Architecture, Implementation, Database, APIs, UI/UX, Security, Testing & Operational Reference.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Proposed Solution](#3-proposed-solution)
4. [Project Objectives](#4-project-objectives)
5. [Scope of the Project](#5-scope-of-the-project)
6. [Technology Stack](#6-technology-stack)
7. [System Architecture](#7-system-architecture)
8. [Complete Project Structure](#8-complete-project-structure)
9. [Complete Functional Modules](#9-complete-functional-modules)
10. [User Roles and Permissions](#10-user-roles-and-permissions)
11. [Complete User Workflows](#11-complete-user-workflows)
12. [Complete Admin & Super Admin Workflows](#12-complete-admin--super-admin-workflows)
13. [Frontend Architecture & Component Documentation](#13-frontend-architecture--component-documentation)
14. [Backend Architecture & Request Lifecycle](#14-backend-architecture--request-lifecycle)
15. [Complete API Reference (172 Endpoints)](#15-complete-api-reference-172-endpoints)
16. [Database Schema & Data Models (53 Tables)](#16-database-schema--data-models-53-tables)
17. [Authentication, Authorization & Security Hardening](#17-authentication-authorization--security-hardening)
18. [Algorithms and Core Business Logic](#18-algorithms-and-core-business-logic)
19. [AI / Machine Learning & Intelligent Automation](#19-ai--machine-learning--intelligent-automation)
20. [Third-Party Services and External Integrations](#20-third-party-services-and-external-integrations)
21. [UI/UX Documentation & Layout Breakdown](#21-uiux-documentation--layout-breakdown)
22. [Installation, Environment Setup & Run Guide](#22-installation-environment-setup--run-guide)
23. [Environment Variables Specification](#23-environment-variables-specification)
24. [Testing Suite & Quality Assurance](#24-testing-suite--quality-assurance)
25. [Bugs, Historical Remediation & Production Fixes](#25-bugs-historical-remediation--production-fixes)
26. [Error Handling & Resilience Mechanisms](#26-error-handling--resilience-mechanisms)
27. [Performance Considerations & Caching Strategies](#27-performance-considerations--caching-strategies)
28. [Containerization, CI/CD & Deployment Guide](#28-containerization-cicd--deployment-guide)
29. [Consolidated Feature Matrix](#29-consolidated-feature-matrix)
30. [System Limitations](#30-system-limitations)
31. [Future Roadmap & Scope](#31-future-roadmap--scope)
32. [Technical Reference](#32-technical-reference)
33. [Glossary of Terms](#33-glossary-of-terms)
34. [Final Project Summary](#34-final-project-summary)

---

## 1. Project Overview

### 1.1 Project Name & Identity
- **Project Name:** Dairy Stream Cloud (commercially branded as **DairyVision**).
- **Package Identifier:** Monorepo comprising `Backend/` (Express API server) and `Frontend/` (Vite SPA + Capacitor Android container `com.dairystream.app`).
- **Live Production URL:** `https://dairyvision.automaterealitylabs.in/`
- **Hosted API Gateway:** `https://dairy-stream-cloud-backend.onrender.com`

### 1.2 Purpose
Dairy Stream Cloud is an enterprise multi-tenant Software-as-a-Service (SaaS) platform built specifically for the fresh milk and dairy supply chain. It unifies doorstep subscription delivery management, ad-hoc retail ordering ("Buy Once"), delivery partner route navigation, milk procurement tracking from local farmers/suppliers, automated billing with Direct UPI verification, customer wallet settlements, and platform-wide Super Admin oversight into a single distributed platform.

### 1.3 Problem Solved
Traditional dairy operations rely heavily on physical paper ledgers, fragmented WhatsApp messages, cash collection books, and unmonitored morning deliveries. Dairy Stream Cloud eliminates paper dependency, eliminates missed deliveries, eliminates disputed monthly bills, automates morning logistics, and verifies UPI bank transfers deterministically without relying exclusively on expensive payment gateway commissions.

### 1.4 Background & Motivation
In South Asian markets (particularly India), milk distribution is largely unorganized. Customers subscribe to daily morning or evening deliveries (e.g., 1.5 Liters Cow Milk daily). Dairies bill customers at the end of each calendar month. When customers travel, skip deliveries, or request extra milk, paper ledgers often lead to billing disputes. Furthermore, delivery boys (agents) navigate complex high-rise residential apartment complexes (Society $\rightarrow$ Building $\rightarrow$ Wing $\rightarrow$ Floor $\rightarrow$ Flat) without GPS visibility. Dairy Stream Cloud was built to solve these structural operational friction points through modern web, real-time geolocation, and automated transactional infrastructure.

### 1.5 Target Users
1. **End Customers / Households:** Daily consumers managing doorstep milk subscriptions, tracking morning deliveries in real-time, reviewing digital itemized bills, and paying via direct UPI QR or wallet.
2. **Delivery Agents (Staff Partners):** Field delivery workforce using the Capacitor Android mobile app to view floor-wise task lists, scan QR codes, collect proof-of-delivery photos, record failed reasons, and stream live GPS coordinates.
3. **Dairy Administrators (Business Owners):** Local farm owners and dairy managers overseeing customer subscriptions, agent assignments, morning shift dispatch, milk procurement from farmers, pricing, and accounting reconciliation.
4. **Milk Suppliers / Dairy Farmers:** Rural suppliers delivering bulk raw milk to dairies, with FAT/SNF percentage logs and verified bank accounts.
5. **Platform Super Admins (SaaS Owners):** System administrators managing multi-dairy tenants, SaaS tier subscription plans (`STARTER`, `GROWTH`, `ENTERPRISE`), promotional coupon codes, support tickets, system health, and cross-dairy geographical analytics.

### 1.6 Current Project Status
- **Backend API:** Production Grade (Express 5 ESM, running on Node.js 22 with clustering/containerization support, 172 endpoints).
- **Database:** Fully Hardened Supabase (PostgreSQL 15+) schema with Row Level Security, 53 relational tables, automated cron procedures, and atomic RPC transaction functions.
- **Frontend SPA:** Production Grade (React 19, Vite 7, Tailwind CSS, Lucide icons, Recharts, Leaflet, Framer Motion).
- **Mobile Agent App:** Production Ready (Capacitor 8 Android wrapper with background geolocation, network status listeners, and IndexedDB/LocalStorage offline sync queue).
- **Test Suite Status:** 33/33 Backend tests passing (100% pass rate); 25/25 Frontend Vitest tests passing (100% pass rate).

---

## 2. Problem Statement

### 2.1 The Traditional Dairy Operation Model
Before Dairy Stream Cloud, dairy logistics operated through manual, error-prone workflows:
1. **Unstructured Customer Registration:** Customer address details were noted on paper without a structured residential hierarchy (e.g., "Flat 304, Tower B" instead of validated Property $\rightarrow$ Building $\rightarrow$ Wing $\rightarrow$ Floor $\rightarrow$ Flat coordinates).
2. **Untracked Delivery Fulfillment:** Dairy owners handed hand-written address slips to delivery boys at 4:30 AM. Owners had zero real-time visibility into whether an agent delivered the packet, skipped the house, or arrived late.
3. **Billing Reconciliation Conflicts:** At the end of the month, dairies calculated total milk deliveries by hand. When customers claimed they paused their milk for five days during vacation, dairies lacked verifiable timestamps, resulting in payment deductions, disputed invoices, and lost revenue.
4. **High Payment Gateway Costs:** Payment gateways charge 2% to 3% plus GST on every transaction. For thin-margin fresh dairy items, paying 2.36% on a ₹3,000 monthly bill erodes substantial operating profit.
5. **Fraudulent Payment Claims:** When dairies switched to UPI QR codes, customers sent fake or reused UPI payment screenshots. Dairies had no automated mechanism to verify Unique Transaction Reference (UTR) numbers or detect duplicate screenshot submissions.
6. **Agent Turnover and Route Confusion:** New delivery agents frequently got lost in complex residential societies, climbing unnecessary stairs and missing early morning delivery deadlines (usually 7:00 AM).

---

## 3. Proposed Solution

Dairy Stream Cloud introduces a multi-tier, event-driven, cloud-native architecture that systematically resolves each operational failure point:

```
+-----------------------------------------------------------------------------------+
|                            DAIRY STREAM CLOUD ECOSYSTEM                           |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  [ End Customers ]          [ Delivery Agents ]           [ Dairy Admin ]         |
|  - Subscriptions            - Mobile Task Queue           - Morning Dispatch      |
|  - Live Map ETA Tracking    - Building Floor Grouping     - Customer Ledger       |
|  - Direct UPI + Wallet      - Offline Proof Sync          - Procurement & FAT/SNF |
|         |                           |                            |                |
|         +---------------------------+----------------------------+                |
|                                     |                                             |
|                                     v                                             |
|                    +--------------------------------+                             |
|                    |   React 19 / Vite 7 Frontend   |                             |
|                    |   (Web + Capacitor Android)    |                             |
|                    +--------------------------------+                             |
|                                     |                                             |
|                               (HTTPS / WSS)                                       |
|                                     v                                             |
|                    +--------------------------------+                             |
|                    |     Express 5 Backend Hub      |                             |
|                    |   - Security / Encryption      |                             |
|                    |   - Socket.IO Realtime Room    |                             |
|                    |   - BullMQ Queue & Cron Tasks  |                             |
|                    +--------------------------------+                             |
|                       /           |           \                                   |
|                      /            |            \                                  |
|                     v             v             v                                 |
|            +-------------+  +------------+  +--------------------------------+    |
|            |  PostgreSQL |  |  Redis 7   |  | Third-Party Services           |    |
|            |  (Supabase) |  |  (BullMQ)  |  | - Cashfree (Bank Verify)       |    |
|            |  53 Tables  |  |  Locks &   |  | - Google Vision (OCR)          |    |
|            |  Atomic RPC |  |  Queues    |  | - WhatsApp Cloud / Twilio      |    |
|            +-------------+  +------------+  | - OSRM Routing / Razorpay      |    |
|                                             +--------------------------------+    |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

### 3.1 Key Architectural Solutions
1. **5-Level Property Hierarchy:** Customers are registered against a strict spatial graph (`properties` $\rightarrow$ `buildings` $\rightarrow$ `wings` $\rightarrow$ `floors` $\rightarrow$ `units`). This allows automated grouping of deliveries by building and ascending/descending floor sequences.
2. **Automated Daily Fulfillment Pipeline:** A Redis-locked scheduled job runs daily at 00:00 IST to generate today's delivery rows from active approved subscriptions. An automated midnight auto-fail worker marks unfulfilled yesterday deliveries as `FAILED` with non-billing audit markers.
3. **Direct UPI Verification with OCR & Fraud Heuristics:** Customers upload their UPI transfer screenshot and enter their UTR. The backend passes the image to Google Cloud Vision OCR, extracts amount and UTR, calculates SHA-256 screenshot hashes to block duplicates, checks database collision across dairy tenants, and assigns a deterministic confidence score (0-100).
4. **Atomic In-Database Customer Wallet RPC:** To prevent race conditions during billing settlement, a PostgreSQL function `execute_customer_wallet_payment` locks the customer row with `FOR UPDATE`, checks balance, logs debit entries, and records payment status in a single ACID transaction.
5. **Real-Time Geolocation Tracking & Smart ETA:** Agents emit coordinates over WebSockets (`Socket.IO`). The backend calculates distance using the Haversine formula, evaluates historical delivery analytics grouped by time-of-day and day-of-week with exponential weighting, and feeds live ETA to the customer's Leaflet map. Turn-by-turn road geometries are computed via the Open Source Routing Machine (OSRM).
6. **Agent Mobile App with Offline Synchronization:** The Capacitor Android application caches the delivery roster into LocalStorage and IndexedDB. In network-dead elevator shafts or basements, agents can mark deliveries as `DELIVERED`, attach photos, and queue updates. As soon as the device reconnects, the synchronization manager flushes the queue sequentially.

---

## 4. Project Objectives

### 4.1 Primary Objectives
- **Zero-Friction Doorstep Delivery:** Ensure milk arrives at households by 7:00 AM daily with verified digital audit logs.
- **Accurate Consolidated Billing:** Eliminate customer disputes by auto-generating month-end invoices that account for every delivered bottle, skipped day, and one-off purchase.
- **Zero Payment Gateway Leakage:** Enable dairies to receive 100% of milk revenue directly into their bank accounts via UPI without paying gateway fees.

### 4.2 Secondary Objectives
- **High-Density Apartment Optimization:** Group delivery tasks by building and floor so agents finish deliveries 30-40% faster.
- **Supply Chain Traceability:** Record bulk raw milk intake from farmers with volume, FAT percentage, SNF percentage, and cost per liter.
- **Multi-Tenant SaaS Scaling:** Empower a single platform super-admin to onboard hundreds of independent dairy brands across different cities.

### 4.3 Technical Objectives
- **Sub-100ms API Latency:** Ensure high-throughput endpoints (dashboard, delivery feeds, detect user) execute within 100ms.
- **ACID Financial Integrity:** Ensure customer wallet balances and offline cash collections never drift due to concurrent requests.
- **Resilient Background Execution:** Ensure daily cron jobs run exactly once across multi-container backend clusters using Redis distributed locks (`acquireRedisLock`).

---

## 5. Scope of the Project

### 5.1 Fully Implemented Functionality
- **Multi-Role Authentication & Smart Detection:** Gateway `/api/auth/detect` identifies user role (`ADMIN`, `AGENT`, `CUSTOMER`, `SUPER_ADMIN`) from mobile number, email, or staff ID (`STF...`).
- **Customer Portal:** Profile management, subscription creation/pause/resume/cancel, daily calendar delivery tracker, live agent map tracking, invoice PDF download, WhatsApp bill sharing, wallet top-up, and direct UPI screenshot upload.
- **Delivery Agent Mobile Suite:** Android Capacitor integration, building-level task lists, room-by-room status toggling, proof photo capture, failed reason recording, offline action queue, and continuous GPS streaming over Socket.IO.
- **Dairy Admin ERP:** Live dashboard (milk required vs. procured), customer subscription approvals, agent onboarding with auto-generated Staff IDs, delivery bulk scheduling and shift approvals, procurement logs with FAT/SNF, bank account verification via Cashfree, product catalog pricing, and agent performance metrics.
- **Platform Super Admin Suite:** Multi-dairy tenant overview, SaaS plan matrix management (`STARTER`, `GROWTH`, `ENTERPRISE`), promotional coupon codes, support desk ticketing, operational logging, and global platform configuration.
- **Enterprise Security Hardening:** Field-level deterministic AES-256-GCM encryption, global response decryption middleware, rate limiting with IP and identity buckets, CSRF cookie/header tokens, HMAC API request signing, SSRF payload guards, and bot protection.

### 5.2 Partially Implemented / Fallback-Configured Functionality
- **Marketplace Multi-Vendor Orders:** The legacy marketplace module (`Backend/services/marketplace/`) with Razorpay Route split payments, BullMQ background queues, and automated reconciliation is fully coded, but is configured as inactive (`REDIS_ENABLED=false`) in standard standalone setups that use the direct UPI model.
- **Automated Bank Penny-Drop:** Cashfree bank verification (`bankVerification.service.js`) is fully written with fallback to Razorpay IFSC format validation if Cashfree credentials are not supplied.
- **Google Vision OCR:** If `GOOGLE_VISION_API_KEY` is not set in `.env`, the system smoothly falls back to a heuristic regex parser without crashing verification workflows.

### 5.3 Out of Scope / Planned Future Modules
- **Automated IoT Milk Vending Integration:** Direct hardware communication with automated milk dispensing machines.
- **Native iOS Compilation:** The Capacitor mobile app is configured and tested for Android (`com.dairystream.app`); iOS Xcode project files are not yet included.

---

## 6. Technology Stack

### 6.1 Complete Technology Matrix

| Layer | Technology | Version | Purpose & Usage in Codebase |
|---|---|---|---|
| **Frontend Runtime** | React | `^19.1.1` | Core UI library for reactive, component-driven user interfaces |
| **Frontend Build Tool** | Vite | `^7.3.3` | High-speed ESM bundler, dev server, and production asset builder |
| **CSS Framework** | Tailwind CSS | `^3.4.19` | Utility-first styling with custom themes in `adminTheme.js` & `index.css` |
| **Routing** | React Router DOM | `^6.30.4` | Declarative client-side routing, protected routes, and role guards |
| **Mobile Container** | Capacitor | `^8.4.2` | Packages Vite web build into native Android APK (`com.dairystream.app`) |
| **Mobile Plugins** | Capacitor Geolocation | `^8.2.0` | Native hardware GPS acquisition for delivery agents |
| **Mobile Plugins** | Capacitor App / Dialog | `^8.1.1` | Native Android hardware back-button interceptor and system alerts |
| **Icons** | Lucide React | `^0.562.0` | Modern, consistent iconography across all dashboards and modal windows |
| **Motion & Transitions** | Framer Motion | `^12.35.2` | Fluid route transitions, modal appearances, and drawer animations |
| **Charts & Analytics** | Recharts | `^3.8.0` | Business intelligence charts (Procurement vs Demand, Monthly Trends) |
| **Mapping & Geospatial** | Leaflet / React Leaflet | `^1.9.4` / `^5.0.0` | Interactive map rendering for live agent tracking and customer clusters |
| **Client PDF Generation** | jsPDF / Autotable | `^4.2.0` / `^5.0.7` | In-browser client-side invoice and statement PDF compilation |
| **Client Schema Validator** | Zod | `^4.3.6` | Form schema validation for dairy onboarding and subscription setups |
| **Backend Runtime** | Node.js | `22.x LTS` | Server-side JavaScript runtime with native ESM module support |
| **Backend Framework** | Express | `^5.2.1` | High-performance HTTP server handling 172 API endpoints |
| **Database** | PostgreSQL (Supabase) | `15+` | Relational data store, Row-Level Security, RPC functions, and migrations |
| **Database Clients** | `@supabase/supabase-js`, `pg` | `^2.97.0`, `^8.18.0` | Direct Supabase REST/PostgREST client and raw connection pooling |
| **Realtime WebSockets** | Socket.IO / Client | `^4.8.3` | Bidirectional real-time agent location streaming and order tracking |
| **In-Memory Cache / Lock** | Redis (via `ioredis`) | `^5.8.2` | Distributed cron locks, token bucket rate limiters, and lookup caching |
| **Job Queue** | BullMQ | `^5.65.0` | Background job processing for marketplace orders and retries |
| **Scheduled Tasks** | Node-Cron | `^4.2.1` | Cron scheduler for midnight auto-fail and monthly billing runs |
| **Server PDF Generation** | PDFKit | `^0.20.1` | Server-side vector PDF generation for official branded dairy bills |
| **Authentication** | JWT (`jsonwebtoken`), bcryptjs | `^9.0.3`, `^3.0.3` | Dual-token authentication (Access + Refresh) and password hashing |
| **File Uploads** | Multer, Cloudinary | `^1.4.5`, `^2.9.0` | Multipart form-data handling and cloud media hosting for receipts/logos |
| **Transactional Email** | Nodemailer, Brevo API | `^9.0.1` | Dual-provider SMTP/HTTP email dispatch for 6-digit OTP verification |
| **WhatsApp / SMS** | WhatsApp Cloud API, Twilio | Graph v20.0, `^5.13.1` | Automated customer notifications for monthly bills and delivery updates |
| **Bank Verification** | Cashfree Verification API | v2024 | Penny-drop bank account validation for dairy owners and suppliers |
| **Routing Engine** | OSRM (Open Source Routing) | v1 Public API | Driving road network geometries and voice turn-by-turn maneuvers |
| **OCR Processing** | Google Cloud Vision API | REST v1 | Machine learning text detection on UPI payment screenshots |
| **Testing** | Node Test Runner, Vitest | Built-in, `^3.1.0` | Node native test runner (Backend) and Vitest + JSDOM (Frontend) |
| **Containerization** | Docker, Docker Compose | Alpine 3.20 | Containerized deployment of frontend, backend, worker, and Redis |

---

## 7. System Architecture

### 7.1 Multi-Tier Distributed Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                      CLIENT APPLICATION TIER                                        |
+----------------------------------------------------------------------------------------------------+
|  [ Customer Web / PWA ]        [ Agent Android App (Capacitor) ]        [ Dairy Admin / Super Admin ]|
|  - DairyCustomerDashboard      - AgentBuildingTasksPage (Floor Group)   - AdminDashboard / SuperAdmin|
|  - CustomerPayments (UPI/OCR)  - Offline Action Queue (LocalStorage)    - Procurement & Verification |
|  - TrackAgent (Live Leaflet)   - GPS Background Tracking Watcher        - Operational Monitoring     |
+----------------------------------------------------------------------------------------------------+
                                                 |
                                     (HTTPS REST & WSS WebSockets)
                                                 v
+----------------------------------------------------------------------------------------------------+
|                                    SECURITY & GATEWAY LAYER                                        |
+----------------------------------------------------------------------------------------------------+
|  1. secureHeaders (CSP, HSTS, X-Frame-Options, NoSniff, Referrer-Policy)                           |
|  2. correlationMiddleware (Generates unique X-Correlation-ID for distributed tracing)               |
|  3. Global Response Decryption (Auto-converts ENC_DET: fields to plain text for authorized clients) |
|  4. Dynamic CORS Resolver (White-lists custom domains, Capacitor origins, and localhost)           |
|  5. 10MB Payload Limiter & Entity Parse Guard                                                      |
|  6. requestFingerprinting (IP + User-Agent + Accept-Language SHA-256 hash)                         |
|  7. botProtection (Redis/Memory rate limiting: 600 req/min per IP-fingerprint)                     |
|  8. ssrfGuard (Blocks 169.254.169.254, metadata.google.internal, and loopback targets)            |
|  9. validateApiSignature & csrfProtection (HMAC-SHA256 request signing and CSRF tokens)           |
|  10. apiRateLimit (General API window: 120 req/min per IP)                                         |
+----------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+----------------------------------------------------------------------------------------------------+
|                                 APPLICATION CONTROLLER & ROUTE HUB                                 |
+----------------------------------------------------------------------------------------------------+
|  /api/public      | Public Dairy Listing, Location Search, City Aggregates, Suggestions             |
|  /api/auth        | Smart Identity Detection (/detect), OTP Dispatch/Verify, Refresh, Logout       |
|  /api/customer    | Subscriptions, Daily Deliveries, Payments, Wallet, Invoices, ETA, Profile      |
|  /api/admin       | Customers, Dispatch, Deliveries, Products, Payments, Bank Verify, Performance  |
|  /api/agent       | Assigned Deliveries, Building Tasks, Delivery Proof, Location Broadcast        |
|  /api/super-admin | Dairy Tenants, Subscription Plans, Coupons, Health Monitor, Support Tickets    |
|  /api/property-*  | 5-Level Residential Hierarchy (Property -> Building -> Wing -> Floor -> Unit)  |
+----------------------------------------------------------------------------------------------------+
        |                              |                              |                       |
        v                              v                              v                       v
+----------------+            +-----------------+           +--------------------+  +----------------+
| SERVICE LOGIC  |            | REALTIME ENGINE |           | BACKGROUND WORKERS |  | DATA LAYER     |
+----------------+            +-----------------+           +--------------------+  +----------------+
| - subscription |            | Socket.IO       |           | - Node-Cron Daily  |  | Supabase       |
|   automation   |            | - Rooms:        |           |   Automation       |  | PostgreSQL     |
| - monthly      |            |   order:<id>    |           | - Midnight Auto-   |  | 53 Relational  |
|   billing      |            |   agent:<id>    |           |   Fail Worker      |  | Tables         |
| - smart OCR    |            | - Events:       |           | - WhatsApp Retry   |  | Row Level      |
|   verification |            |   agent:location|           |   Queue Worker     |  | Security       |
| - ETA & OSRM   |            |   agent:offline |           | - BullMQ (Redis)   |  | Atomic RPC     |
| - Cashfree bank|            |   customer:track|           |   Marketplace Jobs |  | Functions      |
+----------------+            +-----------------+           +--------------------+  +----------------+
```

### 7.2 Request/Response Lifecycle Walkthrough
1. **Inbound HTTP Request:** The client dispatches an HTTP request with `credentials: true`.
2. **Security Pipeline:** The request hits `secureHeaders`, `correlationMiddleware` (assigns `req.correlationId`), `sanitizeErrorResponses`, and `cors` origin validation.
3. **Bot & SSRF Validation:** `requestFingerprinting` computes a client hash. `botProtection` verifies rate thresholds in Redis. `ssrfGuard` inspects JSON payload contents for forbidden cloud metadata URLs.
4. **Rate Limiting:** Route-specific limiters (`loginRateLimit`, `otpRateLimit`, `publicSearchRateLimit`) enforce strict limits.
5. **Route Dispatch:** Express router dispatches the request to the matching controller module.
6. **Authentication & RBAC:** Middleware (`verifyAdmin`, `authenticate`, `verifyAgent`, `verifySuperAdmin`) extracts the Bearer JWT, validates signature against `JWT_SECRET`, checks token revocation in `auth_token_revocations`, and populates `req.user`, `req.admin`, or `req.agent`.
7. **Plan Authorization:** For admin routes with premium features (Procurement, Performance, Suppliers), `verifyAdminPlan` verifies that the dairy's active plan contains the required capability.
8. **Service Layer Execution:** The controller delegates to a dedicated service function (e.g., `execute_customer_wallet_payment` or `calculateSmartETA`).
9. **Database Operation:** Queries execute against Supabase PostgreSQL via the service role key or PostgREST client.
10. **Global Response Decryption:** Express intercepts `res.json` and recursively decrypts any deterministic ciphertexts (`ENC_DET:aes-256-gcm:...`) into clean plain text before output.

---

## 8. Complete Project Structure

```text
d:\DiaryVision\Dairy-Stream-Cloud-1\
├── .github/
│   └── workflows/
│       ├── ci.yml                     # 3 Parallel CI Jobs: Backend Lint/Test, Frontend Build, Android Gradle
│       └── keep-alive.yml             # Periodic health ping preventing free-tier container cold starts
├── Backend/
│   ├── config/
│   │   ├── cloudinary.js              # Cloudinary media SDK configuration
│   │   ├── envValidation.js           # Runtime environment variable assertion on startup
│   │   ├── loadEnv.js                 # Centralized dotenv environment loader
│   │   ├── razorpay.js                # Razorpay client instance with test/prod keys
│   │   ├── redis.js                   # ioredis connection pool & acquireRedisLock implementation
│   │   └── supabase.js                # Supabase client initialized with SERVICE_ROLE_KEY
│   ├── constants/
│   │   └── deliverySlots.js           # Standard delivery slot definitions (MORNING, EVENING)
│   ├── controllers/
│   │   ├── admin/                     # 15 Dairy Admin controllers (Customers, Deliveries, Payments, etc.)
│   │   ├── agent/                     # 2 Delivery Agent controllers (Deliveries, Live Location)
│   │   ├── authentication/            # Multi-role Auth (Admin, Agent, Customer, Detect, Refresh, Logout)
│   │   ├── customer/                  # 8 Customer controllers (Dashboard, Profile, Invoices, Payments, etc.)
│   │   ├── propertyHierarchy/         # 1 Controller for Property, Building, Wing, Floor, Unit resolution
│   │   ├── public/                    # 1 Public controller for dairy discovery, search, suggestions
│   │   ├── shared/                    # Shared building controllers
│   │   ├── superAdmin/                # 9 Super Admin controllers (Dairies, Plans, Coupons, Health, Tickets)
│   │   └── suppliers/                 # 1 Supplier controller for milk vendors
│   ├── middleware/
│   │   ├── admin.middleware.js        # Validates ADMIN role and attaches dairyId
│   │   ├── adminPlan.middleware.js    # Enforces SaaS feature gating based on platform_plans
│   │   ├── agent.middleware.js        # Validates AGENT/STAFF role
│   │   ├── auth.middleware.js         # Standard Bearer JWT verification
│   │   ├── cutomerAuthChecker.middleware.js # Validates CUSTOMER role and attaches customer ID
│   │   ├── observability.middleware.js # Correlation IDs, structured logging, error sanitization
│   │   ├── security.middleware.js     # Rate limiting, CSRF, Bot protection, SSRF, HMAC signatures
│   │   ├── superAdmin.middleware.js   # Enforces SUPER_ADMIN / OWNER / COMPANY_STAFF permissions
│   │   └── upload.middleware.js       # Multer single memory storage file parser
│   ├── models/
│   │   └── customer.db.js             # Customer database abstraction layer
│   ├── routes/
│   │   ├── admin.routes.js            # Base: /api/admin
│   │   ├── agent.routes.js            # Base: /api/agent
│   │   ├── auth.routes.js             # Base: /api/auth
│   │   ├── customer.routes.js         # Base: /api/customer
│   │   ├── index.route.js             # Central Route Hub mounting all route modules
│   │   ├── location.js                # Base: /api/location (Live order location access guard)
│   │   ├── propertyHierarchy.routes.js# Base: /api/property-hierarchy
│   │   ├── public.routes.js           # Base: /api/public
│   │   └── superAdmin.routes.js       # Base: /api/super-admin
│   ├── services/
│   │   ├── admin/                     # 13 Admin domain services (Customers, Deliveries, Payments, Bank, etc.)
│   │   ├── agent/                     # 2 Agent delivery & mapping services
│   │   ├── authentication/            # 4 Authentication, user detection, and uniqueness services
│   │   ├── common/                    # Platform plan caching & validation service
│   │   ├── customer/                  # 13 Customer domain services (Automation, Monthly Billing, OCR, etc.)
│   │   ├── marketplace/               # 16 Multi-vendor marketplace services (Reconciliation, Queues, Ledgers)
│   │   ├── propertyHierarchy/         # Cascading residential hierarchy resolution service
│   │   ├── public/                    # Public dairy search and geo-discovery service
│   │   └── shared/                    # 6 Shared utilities (ETA calculation, WhatsApp, Delivery Charges)
│   ├── socket/
│   │   └── locationHandler.js         # Socket.IO rooms and bidirectional real-time GPS broadcasting
│   ├── sql/
│   │   ├── DROP_UNUSED_TABLES.sql     # Cleanup script for deprecated test structures
│   │   ├── PRODUCTION_HARDENING_MIGRATIONS.sql # Indexes, auth sessions, rate limit logs, snapshots
│   │   ├── PROPERTY_HIERARCHY_MIGRATIONS.sql   # Tables for properties, buildings, wings, floors, units
│   │   ├── SUPABASE_MIGRATIONS.sql    # Primary database schema with 37+ core tables, RLS & triggers
│   │   ├── WALLET_ATOMIC_SETTLEMENT_RPC.sql    # Atomic in-database customer wallet debit function
│   │   └── seed_customer_todays_delivery.sql   # Development seed data
│   ├── tests/
│   │   ├── agentHistory.test.js       # Pagination, aggregation, and status sort test suite
│   │   ├── deliveryCharge.test.js     # Currency rounding, persistence, and pricing calculation tests
│   │   ├── emailArchitecture.test.js  # Brevo/SMTP priority, fallback, and OTP formatting tests
│   │   ├── planAuthorization.test.js  # SaaS plan feature gate assertion tests
│   │   ├── propertyHierarchy.test.js  # Complete tree resolution, dual-write & no-wing scenario tests
│   │   └── services.test.js           # Date formatting, order calculations, and role hierarchy tests
│   ├── utils/
│   │   ├── bankAccountSecurity.js     # Bank account masking and encryption helpers
│   │   ├── crypto.js                  # Field-level AES-256-GCM deterministic encryption & recursive decrypter
│   │   ├── cutoff.js                  # Daily order cutoff time evaluators
│   │   ├── date.js                    # Timezone-resilient ISO date formatters
│   │   ├── dbErrors.js                # Schema-missing column and table error classifiers
│   │   ├── email.js                   # Multi-provider email sender (Brevo HTTP API + SMTP Nodemailer)
│   │   ├── jwt.js                     # Access and refresh token generator, verifier, and blacklister
│   │   ├── logger.js                  # JSON structured logging framework
│   │   ├── metrics.js                 # In-memory Prometheus-style metrics tracker
│   │   ├── portResolver.js            # Port conflict resolver and automated port search
│   │   ├── validation.js              # General validation regexes
│   │   └── verifyEmail.js             # Token verification link builders
│   ├── workers/
│   │   └── marketplace.worker.js      # BullMQ background worker process for asynchronous marketplace jobs
│   ├── Dockerfile                     # Multi-stage production container definition (Node 22 Alpine)
│   └── server.js                      # Application entry point, Express bootstrapper, Cron & Socket init
├── Frontend/
│   ├── android/                       # Capacitor Android native studio project (Gradle, Manifest, Java)
│   ├── public/                        # Static web assets, manifest, PWA icons
│   ├── src/
│   │   ├── api/                       # Axios API client modules with interceptors & offline sync
│   │   ├── components/                # Modular React components grouped by user domain
│   │   │   ├── admin/                 # Admin layouts, delivery rows, performance charts, modals
│   │   │   ├── agent/                 # Agent modals (Proof, Failure reason, Details, Stats)
│   │   │   ├── buyOnce/               # Ad-hoc product cards, slot selectors, order summaries
│   │   │   ├── common/                # AppSplash, NetworkErrorScreen, PropertyHierarchySelector, Loaders
│   │   │   ├── customer/              # Customer modals (Add subscription, Skip, Pause, Invoices)
│   │   │   ├── dairy/                 # LocationSelector component
│   │   │   ├── login/                 # BrandPanels, RoleBadges, PasswordReset forms
│   │   │   └── steps/                 # 7-Step Dairy Registration Wizard
│   │   ├── hooks/                     # Custom hooks (useAuth, useBackButtonHandler, useNetworkStatus, etc.)
│   │   ├── pages/                     # Routed pages (Admin, Agent, Customer, Super Admin, Public)
│   │   ├── utils/                     # Front-end routing (OSRM), floor grouping, formatters, and tests
│   │   ├── validators/                # Front-end Zod schemas for onboarding
│   │   ├── App.jsx                    # Client-side router configuration with lazy loading
│   │   ├── index.css                  # Tailwind styles and global UI design tokens
│   │   └── main.jsx                   # React 19 root bootstrap
│   ├── capacitor.config.ts            # Capacitor native Android configuration
│   ├── Dockerfile                     # Multi-stage build with Nginx static delivery
│   ├── nginx.conf                     # Nginx configuration with gzip, caching, and SPA fallback
│   ├── package.json                   # Frontend dependencies and build scripts
│   └── vite.config.js                 # Vite bundler configuration
├── docker-compose.yml                 # Orchestrates frontend, backend, marketplace-worker, and Redis
├── package.json                       # Monorepo root workspace orchestrator scripts
├── README.md                          # Repository overview and quickstart guide
├── REMEDIATION_AUDIT_REPORT.md        # Audit record of canonical plan matrix remediation
└── plan_matrix_audit_findings.md      # Historical analysis of plan discrepancies
```

---

## 9. Complete Functional Modules

### Module 9.1: Multi-Role Authentication & Smart Identity Gateway
- **Entry Points:** `POST /api/auth/detect`, `POST /api/auth/login/otp`, `POST /api/auth/admin/login`, `POST /api/auth/agent/login`.
- **Purpose:** Provide a unified login page where the system automatically discovers the user's role without forcing them to manually toggle role tabs.
- **Workflow:**
  1. User enters an identifier (e.g., `9876543210`, `dairyowner@gmail.com`, or `STF1023`).
  2. `detectUserService` checks the identifier against `admins` (Email/Phone), `customers` (Email/Phone), and `agents` (Staff ID / Phone).
  3. If identifier is recognized as an Admin or Agent, the backend responds with `nextStep: "PASSWORD"`.
  4. If recognized as a Customer, the backend triggers `generateCustomerOtp`, sends a 6-digit numeric OTP via Brevo or SMTP, and responds with `nextStep: "OTP"`.
  5. If unrecognized, the user is directed to the customer registration page.
- **Related Files:** [detectUser.controller.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/controllers/authentication/detectUser.controller.js), [detectUser.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/authentication/detectUser.service.js), [LoginPage.jsx](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/pages/LoginPage.jsx).

### Module 9.2: Customer Subscription & Daily Automation
- **Entry Points:** `GET /api/customer/subscription`, `POST /api/customer/subscription`, `POST /api/customer/deliveries/:id/skip`.
- **Purpose:** Manage recurrent milk subscriptions (Milk Type, Quantity in Liters, Delivery Slot, Selected Days of Week) and automate daily delivery row generation.
- **Workflow:**
  1. Customer selects cow milk, 1.5L, MORNING slot, and custom delivery days (`MONDAY`, `WEDNESDAY`, `FRIDAY`).
  2. The subscription is saved in `subscriptions` table with `approval_status = "PENDING"`.
  3. Dairy Admin reviews and approves the subscription.
  4. Daily at 00:00 IST, `runDailySubscriptionAutomationForAllCustomers` scans all active, approved subscriptions, checks if today matches `delivery_days`, verifies the customer has not paused their subscription for today, and creates a record in `deliveries`.
  5. The customer can toggle "Skip Delivery" before the daily cutoff time (configured per dairy in `app_settings`), which marks the delivery as `SKIPPED` without incurring billing charges.
- **Related Files:** [subscription.automation.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/customer/subscription.automation.service.js), [CustomerSubscription.jsx](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/pages/customer/CustomerSubscription.jsx).

### Module 9.3: Smart Direct UPI Verification with Google Vision OCR & Fraud Engine
- **Entry Points:** `POST /api/customer/payments/verify-upi`, `POST /api/customer/payments/ocr-preview`.
- **Purpose:** Enable customers to pay bills directly to the dairy's UPI VPA and submit screenshots for automated and manual verification without payment gateway fees.
- **Workflow:**
  1. Customer scans the Dairy UPI QR, transfers ₹1,200, captures a screenshot, and submits the image + UTR in DairyVision.
  2. The backend generates a SHA-256 hash of the image buffer (`screenshot_sha256`) and checks for collisions across previous payments.
  3. Image buffer is sent to Google Cloud Vision API. The service parses full-text annotations and extracts the UTR number, paid amount, transaction timestamp, and UPI app (PhonePe, Google Pay, Paytm, BHIM).
  4. `analyzeUpiVerificationSubmission` evaluates risk:
     - Amount Delta $> ₹1$: Flag `AMOUNT_MISMATCH` (-35 confidence score).
     - Duplicate Screenshot: Flag `DUPLICATE_SCREENSHOT` (-45 confidence score, Severity `HIGH`).
     - Duplicate UTR in Database: Flag `DUPLICATE_UTR` (-45 confidence score, Severity `HIGH`).
     - UTR Text Mismatch between user entry and OCR text: Flag `UTR_TEXT_MISMATCH` (-25 confidence score).
  5. The verification record is stored in `payment_verifications` with risk flags and confidence score (0-100).
  6. Admin views submissions with live side-by-side screenshot previews and one-click "Approve" or "Reject". Approving automatically marks the monthly bill as `PAID`.
- **Related Files:** [ocr.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/customer/ocr.service.js), [smartPaymentVerification.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/customer/smartPaymentVerification.service.js), [AdminPayments.jsx](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/pages/admin/AdminPayments.jsx).

### Module 9.4: Atomic Customer Wallet Settlement
- **Entry Points:** `POST /api/customer/payments/pay-wallet`, `POST /api/customer/payments/wallet/order`.
- **Purpose:** Allow customers to top-up a prepaid wallet balance and settle monthly milk bills instantly with atomic concurrency protection.
- **Processing Logic:** Calls the PostgreSQL RPC `execute_customer_wallet_payment(customer_id, dairy_id, amount, month_key, idempotency_key, description)`.
  - Acquires exclusive row-level lock `SELECT ... FROM customers WHERE id = p_customer_id FOR UPDATE`.
  - Verifies idempotency key to prevent double debits.
  - Checks if `wallet_balance >= amount`.
  - Subtracts `amount` and updates `customers.wallet_balance`.
  - Inserts settlement record into `payments` table with status `PAID`.
- **Related Files:** [WALLET_ATOMIC_SETTLEMENT_RPC.sql](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/sql/WALLET_ATOMIC_SETTLEMENT_RPC.sql), [wallet.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/customer/payments/wallet.service.js).

### Module 9.5: Real-Time Geolocation Tracking & Smart ETA Engine
- **Entry Points:** WebSocket events `agent:locationUpdate`, `customer:trackOrder`, `agent:joinOrder`; REST `GET /api/customer/deliveries/:id/eta`.
- **Purpose:** Provide live agent location on a map for customers waiting for morning milk, calculate dynamic ETAs, and generate driving turn-by-turn routes.
- **Processing Logic:**
  - Agent app polls native GPS and emits `{ orderId, agentId, lat, lng }` over Socket.IO.
  - Server broadcasts to order room `order:<id>` and agent room `agent:<id>`.
  - ETA calculation evaluates Haversine distance between agent coordinates and customer coordinates.
  - Historical delivery times for the agent are fetched from `delivery_analytics` and filtered by time-of-day (`EARLY_MORNING`, `MORNING`, etc.) and distance bucket.
  - A weighted decay average $w_i = \exp(-i / 10)$ computes baseline minutes + 5-minute safety buffer.
  - Frontend queries OSRM (`router.project-osrm.org`) to render real road path geometries and turn-by-turn voice prompts.
- **Related Files:** [locationHandler.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/socket/locationHandler.js), [eta.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/shared/eta.service.js), [agentRouting.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/utils/agentRouting.js), [TrackAgent.jsx](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/pages/customer/TrackAgent.jsx).

### Module 9.6: High-Density Residential Property Hierarchy
- **Entry Points:** `GET /api/property-hierarchy/resolve`, `POST /api/property-hierarchy/resolve`.
- **Purpose:** Model residential delivery destinations with surgical precision across 5 tiers: Property / Society $\rightarrow$ Building $\rightarrow$ Wing $\rightarrow$ Floor $\rightarrow$ Unit / Flat.
- **Processing Logic:**
  - When customers register or agents create customers, `resolveHierarchy` checks if the society exists, matches the building, identifies the wing, checks the floor, and registers the unit.
  - For buildings without wings, `wing_id` remains `NULL` without forcing fake "N/A" entities.
  - Floor numbers can be explicitly selected or derived via regex `digits.slice(0, -2)` from flat numbers.
  - Agent app sorts delivery rosters: Building Alphabetical $\rightarrow$ Wing $\rightarrow$ Floor Ascending / Descending $\rightarrow$ Unit Number.
- **Related Files:** [PROPERTY_HIERARCHY_MIGRATIONS.sql](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/sql/PROPERTY_HIERARCHY_MIGRATIONS.sql), [propertyHierarchy.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/propertyHierarchy/propertyHierarchy.service.js), [PropertyHierarchySelector.jsx](file:///d:/DairyVision/Dairy-Stream-Cloud-1/Frontend/src/components/common/PropertyHierarchySelector.jsx).

### Module 9.7: Milk Procurement & Supplier Management
- **Entry Points:** `GET /api/admin/procurement`, `POST /api/admin/procurement`, `GET /api/admin/suppliers`, `POST /api/admin/suppliers`.
- **Purpose:** Enable dairies on the `ENTERPRISE` SaaS tier to manage raw milk intake from farmers and local suppliers.
- **Processing Logic:**
  - Admin registers suppliers with contact details and bank details.
  - Procurement log captures Supplier Name, Item (Cow Milk, Buffalo Milk), Quantity in Liters, Rate per Liter, FAT %, and SNF (Solids-Not-Fat) %.
  - Total purchase amount is calculated and added to the dairy's operational accounting ledger.
- **Related Files:** [procurement.controller.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/controllers/admin/procurement.controller.js), [supplier.controller.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/controllers/suppliers/supplier.controller.js), [AdminProcurement.jsx](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/pages/admin/AdminProcurement.jsx).

### Module 9.8: Super Admin Platform Oversight & Multi-Tenant Management
- **Entry Points:** `GET /api/super-admin/dashboard/metrics`, `GET /api/super-admin/dairies`, `GET /api/super-admin/plans`, `POST /api/super-admin/coupons`.
- **Purpose:** Centralized administration for the platform owner across all onboarded dairies.
- **Processing Logic:**
  - Dashboard displays platform-wide active dairies, total customer reach, aggregate platform revenue, and live server health metrics.
  - Dairies management provides status toggles (`ACTIVE`, `SUSPENDED`), plan upgrades, and owner password resets.
  - Plan management configures pricing and features for `STARTER`, `GROWTH`, and `ENTERPRISE` tiers with automatic cache invalidation (`clearPlanFeaturesCache`).
  - Coupon management allows creation of percentage/flat discount codes with redemption tracking.
- **Related Files:** [superAdminDashboard.controller.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/controllers/superAdmin/superAdminDashboard.controller.js), [SuperAdminDairies.jsx](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Frontend/src/pages/super-admin/SuperAdminDairies.jsx).

---

## 10. User Roles and Permissions

The platform enforces five distinct roles through dedicated middleware:

```
+----------------------------------------------------------------------------------------------------+
|                                    ROLE-BASED ACCESS CONTROL (RBAC)                                 |
+----------------------------------------------------------------------------------------------------+
|  Role Name    | Description & Scope               | Middleware Check | Accessible Path Hierarchy   |
|---------------|-----------------------------------|------------------|-----------------------------|
| CUSTOMER      | Household milk consumer           | authenticate     | /customer/*                 |
| AGENT / STAFF | Delivery workforce partner        | verifyAgent      | /agent/*                    |
| ADMIN         | Single Dairy Business Owner       | verifyAdmin      | /admin/*                    |
| SUPPLIER      | Raw milk vendor to a single dairy | (Admin Managed)  | (Managed via Admin Portal)  |
| SUPER_ADMIN   | SaaS Platform Global Operator     | verifySuperAdmin | /super-admin/*              |
+----------------------------------------------------------------------------------------------------+
```

### 10.1 Role Permissions Matrix

| Capability / Resource | CUSTOMER | AGENT | ADMIN (STARTER) | ADMIN (GROWTH) | ADMIN (ENTERPRISE) | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| View/Edit Own Profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Milk Subscriptions | ✅ | ❌ | ✅ (Full) | ✅ (Full) | ✅ (Full) | ❌ |
| Skip/Pause Delivery | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| View Building Delivery Roster | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Mark Delivered & Upload Photo | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Broadcast Live Location | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Track Live Agent on Map | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| View Customer Database | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Onboard Delivery Agents | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Approve Deliveries & Shifts | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Direct UPI Verification | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Cashfree Bank Verification | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Agent Performance Analytics | ❌ | ❌ | ❌ (Gated) | ✅ | ✅ | ❌ |
| Milk Procurement & FAT/SNF | ❌ | ❌ | ❌ (Gated) | ❌ (Gated) | ✅ | ❌ |
| Manage Milk Suppliers | ❌ | ❌ | ❌ (Gated) | ❌ (Gated) | ✅ | ❌ |
| Manage Platform Dairies | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configure SaaS Plans | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Issue Platform Coupons | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View System Error Logs | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 11. Complete User Workflows

### 11.1 Workflow A: Customer Discovery, Registration & Subscription Setup
```
1. Customer visits /explore -> Browses local dairies by City or Pincode
2. Customer selects a dairy -> Navigates to /join/:id or /customer/register
3. Enters Phone/Email -> Backend verifies uniqueness across system
4. Selects Residential Address via PropertyHierarchySelector:
   - Selects Society/Property -> Selects Building -> Selects Wing (or No Wing) -> Selects Floor -> Enters Flat Number
5. Chooses Subscription:
   - Product: Cow Milk (1.5 Liters)
   - Shift: MORNING
   - Schedule: Daily (or specific weekdays)
6. Submits registration -> Account created in customers table; subscription recorded as PENDING
7. Dairy Admin receives notification -> Approves subscription and assigns delivery agent
```

### 11.2 Workflow B: Daily Morning Delivery & Live Geolocation Tracking
```
1. 00:00 IST -> Cron automation creates today's delivery record in deliveries table
2. 05:00 AM -> Delivery agent logs into Android App (/agent/working)
3. Agent views Building-wise delivery tasks, ordered by Building -> Floor -> Unit
4. Agent begins delivery run -> Toggles "Start Route"
5. Background Geolocation tracks agent -> Socket.IO emits agent:locationUpdate
6. Customer opens /customer/dashboard/track/agent:
   - Web browser connects to Socket.IO room order:<delivery_id>
   - Customer sees moving agent icon on Leaflet map with live OSRM road geometry
   - Smart ETA displays: "Estimated arrival in 8 mins (Confidence: HIGH)"
7. Agent reaches doorstep -> Hands milk to customer -> Clicks "Mark Delivered"
   - Optionally captures proof photo -> Submits
8. Socket.IO emits agent:location with status update -> Customer UI transitions to "Delivered at 05:38 AM"
```

### 11.3 Workflow C: Month-End Billing & Direct UPI Verification
```
1. Last day of month (23:59 IST) -> Cron generates monthly bill in monthly_bills table
2. Customer receives WhatsApp notification & Web Push: "Your bill for August is ₹1,850"
3. Customer opens /customer/dashboard/payments:
   - Views itemized calendar breakdown of all delivered liters
4. Customer chooses payment method:
   - Option 1 (Wallet): Customer has ₹2,000 balance -> Clicks "Pay with Wallet"
     -> PostgreSQL RPC execute_customer_wallet_payment atomically debits ₹1,850 -> Instant PAID
   - Option 2 (Direct UPI): Customer clicks "Pay via UPI QR"
     -> Scans Dairy UPI QR code -> Pays ₹1,850 via PhonePe
     -> Uploads screenshot + enters UTR: 421839201948
5. Backend runs Google Vision OCR:
   - Confirms UTR matches screenshot
   - Confirms amount matches ₹1,850
   - Checks SHA-256 screenshot hash against duplicate database
   - Assigns Risk Confidence: 95/100 (Candidate for Auto-Approve)
6. Dairy Admin visits /admin/payments:
   - Sees pending verification with side-by-side screenshot preview
   - Clicks "Approve" -> Bill status transitions to PAID -> Customer receives confirmation WhatsApp
```

---

## 12. Complete Admin & Super Admin Workflows

### 12.1 Dairy Admin Daily Operations Workflow
1. **Morning Dispatch Oversight (`/admin/deliveries`):**
   - Admin opens the delivery console at 5:00 AM.
   - Filters by Morning Shift to inspect assigned deliveries grouped by Building.
   - Identifies any unassigned orders and performs bulk assignment to available agents.
   - Monitors live deliveries in real-time. If an agent reports a bike breakdown, admin reassigns the remaining building deliveries to another agent in two clicks.
   - At shift end, clicks "Approve All" to confirm verified deliveries.
2. **Customer Subscription Approvals (`/admin/customers`):**
   - Reviews incoming customer subscription requests.
   - Adjusts delivery quantities or prices if customized agreements exist.
   - Links the customer permanently to a dedicated route partner.
3. **Milk Procurement Logging (`/admin/procurement`):**
   - Raw milk truck arrives from rural suppliers at 10:00 AM.
   - Admin inputs supplier name, volume (e.g., 500 Liters), FAT (4.2%), and SNF (8.5%).
   - System calculates procurement cost and updates inventory ledger.
4. **Payment Reconciliation (`/admin/payments`):**
   - Reviews pending UPI verification requests.
   - Inspects Cashfree bank verification statuses for newly onboarded agents and suppliers.

### 12.2 Super Admin Platform Management Workflow
1. **Tenant Onboarding & Monitoring (`/super-admin/dairies`):**
   - Views registered dairies across all cities.
   - Inspects subscription status, customer counts, and storage utilization.
   - Can freeze fraudulent dairies or reset owner passwords.
2. **Plan & Coupon Configuration (`/super-admin/plans`, `/super-admin/coupons`):**
   - Edits feature matrices or pricing for `STARTER`, `GROWTH`, and `ENTERPRISE`.
   - Generates promotional discount coupons (e.g., `FIRST_MONTH_FREE` or `GROWTH20`).
3. **Observability & Health Monitoring (`/super-admin/monitoring`):**
   - Monitors server health, database connection pool status, and recent error traces.

---

## 13. Frontend Architecture & Component Documentation

### 13.1 Client Routing Architecture (`App.jsx`)
The frontend is a single-page application built on React Router v6 with code-splitting via `React.lazy` and `Suspense`:
- **Public Routes:** `/` (Auth landing), `/explore` (Dairy directory), `/join/:id` (Dairy public landing), `/buy-once/:id` (Direct retail checkout), `/customer/register`, `/register-dairy`.
- **Customer Protected Routes (`allowedRoles: ["CUSTOMER"]`):**
  - `/customer/dashboard` $\rightarrow$ `DairyCustomerDashboard.jsx`
  - `/customer/dashboard/deliveries` $\rightarrow$ `CustomerDeliveryHistory.jsx`
  - `/customer/dashboard/subscriptions` $\rightarrow$ `CustomerSubscription.jsx`
  - `/customer/dashboard/payments` $\rightarrow$ `CustomerPayments.jsx`
  - `/customer/dashboard/track/agent` $\rightarrow$ `TrackAgent.jsx`
  - `/customer/dashboard/profile` $\rightarrow$ `CustomerProfile.jsx`
- **Admin Protected Routes (`allowedRoles: ["ADMIN"]`):**
  - `/admin/AdminDashboard` $\rightarrow$ `AdminDashboard.jsx`
  - `/admin/customers` $\rightarrow$ `AdminCustomers.jsx`
  - `/admin/agents` $\rightarrow$ `AdminAgents.jsx`
  - `/admin/deliveries` $\rightarrow$ `AdminDeliveries.jsx`
  - `/admin/payments` $\rightarrow$ `AdminPayments.jsx`
  - `/admin/products` $\rightarrow$ `AdminProducts.jsx`
  - `/admin/profile` $\rightarrow$ `AdminProfile.jsx`
  - Gated via `AdminPlanRoute`:
    - `/admin/performance` (requires `performance` $\rightarrow$ `GROWTH` tier)
    - `/admin/procurement` (requires `procurement` $\rightarrow$ `ENTERPRISE` tier)
    - `/admin/suppliers` (requires `suppliers` $\rightarrow$ `ENTERPRISE` tier)
- **Agent Protected Routes (`allowedRoles: ["AGENT", "STAFF"]`):**
  - `/agent/dashboard` $\rightarrow$ `agentDashboard.jsx`
  - `/agent/working` $\rightarrow$ `AgentWorkingPage.jsx`
  - `/agent/working/building/:buildingName` $\rightarrow$ `AgentBuildingTasksPage.jsx`
  - `/agent/profile` $\rightarrow$ `AgentProfile.jsx`
  - `/agent/history` $\rightarrow$ `AgentHistory.jsx`
- **Super Admin Protected Routes (`allowedRoles: ["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"]`):**
  - `/super-admin/login` $\rightarrow$ `SuperAdminLogin.jsx`
  - `/super-admin/dashboard` $\rightarrow$ `SuperAdminDashboard.jsx`
  - `/super-admin/dairies` $\rightarrow$ `SuperAdminDairies.jsx`
  - `/super-admin/plans` $\rightarrow$ `SuperAdminPlans.jsx`
  - `/super-admin/coupons` $\rightarrow$ `SuperAdminCoupons.jsx`
  - `/super-admin/monitoring` $\rightarrow$ `SuperAdminMonitoring.jsx`
  - `/super-admin/settings` $\rightarrow$ `SuperAdminSettings.jsx`
  - `/super-admin/support` $\rightarrow$ `SuperAdminSupport.jsx`

### 13.2 Key Reusable Components
1. **`PropertyHierarchySelector.jsx` (19.5 KB):**
   - Cascading 5-level selector for Property $\rightarrow$ Building $\rightarrow$ Wing $\rightarrow$ Floor $\rightarrow$ Unit.
   - Supports creating new societies/buildings inline, handles buildings without wings, allows manual flat entry with regex-driven floor derivation, and provides search-as-you-type filtering.
2. **`TrackAgentMap.jsx` (10.6 KB):**
   - Leaflet map component with custom SVG marker pins for the agent (delivery bike icon) and customer house (destination pin).
   - Draws active OSRM polyline routing paths with animated pulses and automatic bounds zooming.
3. **`AdminSidebar.jsx` & `SuperAdminSidebar.jsx`:**
   - Responsive collateral sidebars with plan badge indicators, dynamic active state highlighting, notification counter pills, and mobile slide-over drawers.
4. **`InvoicePreviewModal.jsx` (24.7 KB):**
   - High-fidelity in-browser modal displaying exact physical invoice aesthetics with dairy brand logo, itemized calendar tables, tax calculations, and one-click PDF generation via jsPDF.

---

## 14. Backend Architecture & Request Lifecycle

### 14.1 Application Initialization (`server.js`)
1. **Environment Assertion:** Executes `validateRuntimeEnv()`, verifying `JWT_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. **Express & HTTP Server:** Initializes Express 5 application and wraps it with Node's native `http.createServer(app)`.
3. **Global Decryption Interceptor:** Overrides `res.json` and `res.send` to recursively inspect outgoing payloads and decrypt any deterministic ciphertext fields (`ENC_DET:...`).
4. **Security Middleware:** Mounts security headers, correlation tracer, CORS origin allowlister, 10MB payload body parsers with raw body buffer caching for webhooks, bot protection, SSRF guards, and CSRF token validator.
5. **Route Mounting:** Mounts `/healthz`, `/readyz`, `/api/auth/csrf`, and mounts the central route hub at `/api` behind `apiRateLimit`.
6. **Socket.IO Realtime Registration:** Attaches `SocketIOServer` to the HTTP instance and executes `registerLocationSocketHandlers(io)`.
7. **Port Conflict Resolution:** Invokes `getAvailablePort(preferredPort)` to automatically find an open port if 4000 is occupied.
8. **Scheduled Jobs & Redis Locks:** If `RUN_IN_PROCESS_JOBS !== "false"`, registers:
   - Daily Subscription Automation (Hourly heartbeat, locked via Redis).
   - Daily Auto-Fail Unfulfilled Deliveries (Cron `0 0 * * *` Asia/Kolkata).
   - Month-End Subscription Billing (Cron `59 23 * * *` Asia/Kolkata).
   - WhatsApp Notification Queue Processor (Cron `*/5 * * * *` Asia/Kolkata).
9. **Graceful Shutdown:** Intercepts `SIGTERM` and `SIGINT`, closes local background queue workers, shuts down HTTP listener, and exits process cleanly within a 10-second timeout window.

---

## 15. Complete API Reference (172 Endpoints)

The application implements exactly 172 distinct API route definitions across 8 modular route controllers. Below is the complete catalog:

### 15.1 Public Endpoints (`/api/public`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `GET` | `/api/public/dairies/search` | None | Search dairies by name, query, or pincode | `getSearchDairiesController` |
| `GET` | `/api/public/dairies/suggestions` | None | Autocomplete suggestions for dairy search | `getSearchSuggestionsController` |
| `GET` | `/api/public/dairies/nearby` | None | Find dairies by GPS coordinates and radius | `getNearbyDairiesController` |
| `GET` | `/api/public/dairies/city` | None | Grouped dairy listings by city name | `getCityDairiesController` |
| `GET` | `/api/public/dairies/:id` | None | Public profile, pricing, and catalog of a dairy | `getPublicDairy` |

### 15.2 Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `GET` | `/api/auth/csrf` | None | Issue CSRF token cookie and header response | `issueCsrfToken` |
| `POST` | `/api/auth/detect` | None | Smart gateway detecting role from email/phone/staffId | `detectUser` |
| `POST` | `/api/auth/admin/login` | None | Dairy Admin email/password login | `adminLogin` |
| `POST` | `/api/auth/admin/forgot-password/request-otp` | None | Request password reset OTP for Admin | `requestAdminResetOtp` |
| `POST` | `/api/auth/admin/forgot-password/reset` | None | Reset Admin password with verified OTP | `resetAdminPasswordWithOtp` |
| `POST` | `/api/auth/agent/login` | None | Agent staff ID / mobile password login | `agentLogin` |
| `POST` | `/api/auth/agent/forgot-password/request-otp` | None | Request password reset OTP for Agent | `requestAgentResetOtp` |
| `POST` | `/api/auth/agent/forgot-password/reset` | None | Reset Agent password with verified OTP | `resetAgentPasswordWithOtp` |
| `POST` | `/api/auth/login/otp` | None | Request 6-digit numeric login OTP for Customer | `requestOtpAuth` |
| `POST` | `/api/auth/login/otp/verify` | None | Verify OTP and issue JWT access/refresh tokens | `verifyOtpLoginAuth` |
| `GET` | `/api/auth/me` | JWT | Validate token and fetch current active session | `validateTokenAuth` |
| `POST` | `/api/auth/refresh` | None | Refresh expired access token using refresh token | `refreshAuth` |
| `POST` | `/api/auth/logout` | JWT | Revoke session tokens and clear authentication | `logout` |

### 15.3 Customer Endpoints (`/api/customer`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `POST` | `/api/customer/addCustomer` | None | Register a new customer under a dairy | `addCustomerAuth` |
| `GET` | `/api/customer/verify-email` | None | Verify customer email address via link | `verifyEmail` |
| `GET` | `/api/customer/profile` | Customer | Fetch logged-in customer profile & address | `getProfile` |
| `PUT` | `/api/customer/profile` | Customer | Update customer details with optional image | `updateProfile` |
| `GET` | `/api/customer/dashboard` | Customer | Calendar feed, stats, active delivery cards | `getDashboard` |
| `GET` | `/api/customer/deliveries` | Customer | Paginated historical and upcoming deliveries | `getDeliveries` |
| `POST` | `/api/customer/deliveries/:id/skip`| Customer | Skip delivery by ID for today/tomorrow | `skipDelivery` |
| `POST` | `/api/customer/deliveries/skip` | Customer | Skip delivery using date parameter | `skipDelivery` |
| `POST` | `/api/customer/deliveries/:id/issue`| Customer | Report missing/damaged milk packet | `reportIssue` |
| `POST` | `/api/customer/orders/one-time` | Customer | Create ad-hoc buy-once milk/paneer order | `createOneTimeOrder` |
| `POST` | `/api/customer/orders/one-time/cancel`| Customer | Cancel pending buy-once order | `cancelOneTimeOrder` |
| `GET` | `/api/customer/payments` | Customer | Customer billing ledger, unpaid bills, wallet | `getPayments` |
| `POST` | `/api/customer/payments/upi-intent`| Customer | Create UPI intent URI for direct banking app | `createUpiPaymentIntent` |
| `POST` | `/api/customer/payments/ocr-preview`| Customer | Pre-scan screenshot using Google Vision OCR | `previewUpiPaymentScreenshotOcr`|
| `POST` | `/api/customer/payments/verify-upi`| Customer | Submit UPI screenshot & UTR for verification | `submitUpiPaymentVerification` |
| `POST` | `/api/customer/payments/order` | Customer | Create legacy Razorpay order | `createPaymentOrder` |
| `POST` | `/api/customer/payments/verify` | Customer | Verify legacy Razorpay payment signature | `verifyPayment` |
| `POST` | `/api/customer/payments/wallet/order`| Customer | Create Razorpay order to top up wallet | `createWalletTopupOrder` |
| `POST` | `/api/customer/payments/wallet/verify`| Customer | Verify wallet top-up payment signature | `verifyWalletTopup` |
| `POST` | `/api/customer/payments/pay-wallet`| Customer | Settle monthly bill via atomic wallet RPC | `payBillWithWallet` |
| `GET` | `/api/customer/invoices` | Customer | List all historical monthly invoices | `fetchCustomerInvoices` |
| `GET` | `/api/customer/invoices/:id` | Customer | Fetch detailed invoice breakdown with items | `fetchCustomerInvoiceDetail` |
| `GET` | `/api/customer/invoices/:id/pdf` | Customer | Stream official invoice PDF buffer | `downloadCustomerInvoicePdf` |
| `POST` | `/api/customer/invoices/:id/share-whatsapp`| Customer | Share invoice link to customer WhatsApp | `shareCustomerInvoiceOnWhatsApp`|
| `GET` | `/api/customer/subscription` | Customer | Get active subscription configuration | `getSubscription` |
| `POST` | `/api/customer/subscription` | Customer | Create or update daily milk subscription | `saveSubscription` |
| `DELETE`| `/api/customer/subscription` | Customer | Cancel active subscription | `clearSubscription` |
| `POST` | `/api/customer/notifications/subscribe`| Customer | Register Web Push subscription object | `subscribeToNotifications` |
| `GET` | `/api/customer/deliveries/:id/eta`| Customer | Fetch smart ETA and distance for delivery | `fetchDeliveryETA` |
| `POST` | `/api/customer/forgot-password` | None | Customer password reset request | `forgotPassword` |
| `POST` | `/api/customer/reset-password` | None | Customer password reset submission | `resetPassword` |

### 15.4 Dairy Admin Endpoints (`/api/admin`)

| Method | Endpoint | Auth / Plan | Description | Controller Function |
|---|---|:---:|---|---|
| `POST` | `/api/admin` | None | Admin email/password login | `adminLogin` |
| `POST` | `/api/admin/register-dairy` | None | 7-Step dairy onboarding with logo upload | `registerDairy` |
| `GET` | `/api/admin/profile` | Admin | Fetch dairy profile, bank details, settings | `getAdminDairyProfile` |
| `PATCH`| `/api/admin/profile` | Admin | Update dairy profile, UPI ID, logo | `updateAdminDairyProfile` |
| `GET` | `/api/admin/bank/ifsc/:ifsc` | Admin | Lookup bank details from IFSC code | `lookupAdminBankIfsc` |
| `POST` | `/api/admin/bank/verify` | Admin | Verify bank account via Cashfree penny-drop | `verifyAdminBankAccount` |
| `GET` | `/api/admin/dashboard` | Admin | Main dashboard (Milk demand vs procurement) | `getDashboard` |
| `GET` | `/api/admin/notifications` | Admin | Fetch admin notification events | `getAdminNotifications` |
| `PATCH`| `/api/admin/notifications/:id/read`| Admin | Mark specific notification as read | `markNotificationAsRead` |
| `POST` | `/api/admin/notifications/read-all`| Admin | Mark all notifications as read | `markAllNotificationsAsRead` |
| `GET` | `/api/admin/monitoring/operations`| Admin | Operational monitoring statistics | `fetchOperationalMonitoring` |
| `POST` | `/api/admin/monitoring/whatsapp/process`| Admin | Force flush queued WhatsApp notifications | `processWhatsAppQueue` |
| `GET` | `/api/admin/health` | Admin | Health check endpoint | Inline handler (`{status: "ok"}`) |
| `GET` | `/api/admin/customers` | Admin | List all dairy customers with filters | `fetchAdminCustomers` |
| `GET` | `/api/admin/customers/:id` | Admin | Fetch detailed customer profile & bills | `fetchAdminCustomerById` |
| `GET` | `/api/admin/customers/:id/bill-details`| Admin | Fetch customer monthly delivery bill rows | `fetchAdminCustomerBillDetails` |
| `GET` | `/api/admin/customers/:id/bill-pdf`| Admin | Generate and download customer bill PDF | `downloadAdminCustomerBillPdf` |
| `GET` | `/api/admin/customers/:id/bills/:billId/pdf`| Admin | Download specific monthly bill PDF | `downloadAdminCustomerBillPdf` |
| `GET` | `/api/admin/invoices/:id/pdf` | Admin | Download invoice PDF by invoice ID | `downloadAdminCustomerBillPdf` |
| `PUT` | `/api/admin/customers/:id` | Admin | Update customer address and phone | `updateAdminCustomerById` |
| `DELETE`| `/api/admin/customers/:id` | Admin | Soft-delete / deactivate customer | `deleteAdminCustomerById` |
| `POST` | `/api/admin/customers/:id/subscription`| Admin | Upsert customer subscription plan | `upsertAdminCustomerSubscription`|
| `PATCH`| `/api/admin/customers/:id/subscription/approve`| Admin | Approve customer requested subscription | `approveAdminCustomerSubscription`|
| `PATCH`| `/api/admin/customers/:id/subscription/assign-partner`| Admin | Link permanent delivery agent to customer | `assignAdminCustomerPermanentPartner`|
| `PATCH`| `/api/admin/customers/:id/subscription/pause`| Admin | Pause customer subscription with date range | `pauseAdminCustomerSubscription` |
| `PATCH`| `/api/admin/customers/:id/subscription/resume`| Admin | Resume paused customer subscription | `resumeAdminCustomerSubscription`|
| `PATCH`| `/api/admin/customers/:id/subscription/cancel`| Admin | Cancel/terminate customer subscription | `cancelAdminCustomerSubscription`|
| `POST` | `/api/admin/customers/:id/extra-delivery`| Admin | Schedule one-off extra delivery packet | `addAdminExtraDelivery` |
| `GET` | `/api/admin/agents` | Admin | List all dairy delivery agents | `fetchAdminAgents` |
| `POST` | `/api/admin/addagent` | Admin | Onboard new agent with unique Staff ID | `addAgent` |
| `GET` | `/api/admin/agents/generate-id`| Admin | Auto-generate next unique agent Staff ID | `getUniqueAgentId` |
| `GET` | `/api/admin/agents/:id` | Admin | Fetch agent profile and performance stats | `fetchAdminAgentById` |
| `PUT` | `/api/admin/agents/:id` | Admin | Update agent phone, route, vehicle | `updateAdminAgentById` |
| `DELETE`| `/api/admin/agents/:id` | Admin | Deactivate agent account | `deleteAdminAgentById` |
| `GET` | `/api/admin/deliveries` | Admin | View current/historical delivery logs | `fetchAdminDeliveries` |
| `GET` | `/api/admin/deliveries/scheduling-options`| Admin | Get shift timings and scheduling options | `fetchDeliverySchedulingOptions` |
| `POST` | `/api/admin/deliveries/schedule`| Admin | Schedule single custom delivery | `scheduleAdminDelivery` |
| `POST` | `/api/admin/deliveries/schedule-bulk`| Admin | Batch schedule multiple deliveries | `scheduleAdminDeliveriesBulk` |
| `PATCH`| `/api/admin/deliveries/:id/approve`| Admin | Approve completed delivery record | `approveAdminDelivery` |
| `PATCH`| `/api/admin/deliveries/:id/assign-partner`| Admin | Change delivery agent for specific task | `assignAdminDeliveryPartner` |
| `PATCH`| `/api/admin/deliveries/:id/resolve-issue`| Admin | Resolve delivery issue / missed packet | `resolveAdminDeliveryIssue` |
| `POST` | `/api/admin/deliveries/approve-all`| Admin | Bulk approve all deliveries for current shift | `approveAllAdminDeliveries` |
| `GET` | `/api/admin/procurement` | Admin / `ENTERPRISE` | Fetch raw milk purchase history | `fetchProcurementLogs` |
| `POST` | `/api/admin/procurement` | Admin / `ENTERPRISE` | Log milk intake with volume, FAT %, SNF % | `addProcurementLog` |
| `PUT` | `/api/admin/procurement/:id` | Admin / `ENTERPRISE` | Correct existing procurement log entry | `updateProcurementLog` |
| `GET` | `/api/admin/payments` | Admin | Fetch payment ledger, totals, settlements | `fetchPageData` |
| `GET` | `/api/admin/payments/verifications`| Admin | Fetch pending UPI screenshot verifications | `fetchPaymentVerifications` |
| `GET` | `/api/admin/payments/reports/accounting`| Admin | Comprehensive accounting revenue report | `fetchDairyAccountingReport` |
| `PATCH`| `/api/admin/payments/verifications/:id/approve`| Admin | Approve UPI verification & mark bill PAID | `approvePaymentVerification` |
| `PATCH`| `/api/admin/payments/verifications/:id/reject`| Admin | Reject fraudulent/invalid UPI verification | `rejectPaymentVerification` |
| `PATCH`| `/api/admin/payments/:id/status`| Admin | Manually toggle payment status | `updateStatus` |
| `POST` | `/api/admin/payments/offline-collect`| Admin | Record offline cash collection into wallet | `collectOfflinePayment` |
| `PATCH`| `/api/admin/farm-plan` | Admin | Change SaaS platform tier | `changeFarmPlan` |
| `POST` | `/api/admin/farm-plan/order` | Admin | Create Razorpay order for SaaS renewal | `createFarmPlanOrder` |
| `POST` | `/api/admin/farm-plan/verify`| Admin | Verify payment signature for SaaS renewal | `verifyFarmPlanPayment` |
| `POST` | `/api/admin/farm-plan/subscription`| Admin | Create auto-recurring SaaS subscription | `createFarmPlanSubscription` |
| `POST` | `/api/admin/farm-plan/subscription/verify`| Admin | Verify recurring subscription signature | `verifyFarmPlanSubscriptionPayment`|
| `GET` | `/api/admin/products` | Admin | List dairy products (Milk, Dahi, Paneer) | `fetchAdminProducts` |
| `POST` | `/api/admin/products` | Admin | Create product with unit price and tax | `addAdminProduct` |
| `PUT` | `/api/admin/products/:id` | Admin | Edit product pricing and availability | `editAdminProduct` |
| `DELETE`| `/api/admin/products/:id` | Admin | Remove product from active catalog | `removeAdminProduct` |
| `GET` | `/api/admin/performance` | Admin / `GROWTH` | Overall agent performance analytics | `getPerformance` |
| `GET` | `/api/admin/performance/summary`| Admin / `GROWTH` | High-level KPI summary of delivery metrics | `getPerformanceSummaryData` |
| `GET` | `/api/admin/performance/monthly-trends`| Admin / `GROWTH` | Monthly completion and delay trend graphs | `getPerformanceMonthlyTrends` |
| `GET` | `/api/admin/performance/top-performers`| Admin / `GROWTH` | Leaderboard of top delivery partners | `getTopPerformers` |
| `GET` | `/api/admin/performance/missed-deliveries`| Admin / `GROWTH` | Detailed log of missed and failed drops | `getMissedDeliveries` |
| `POST` | `/api/admin/performance/update`| Admin / `GROWTH` | Recalculate agent performance scores | `updatePerformanceMetrics` |
| `GET` | `/api/admin/buildings` | Admin | Fetch distinct serviced society buildings | `getUniqueBuildings` |
| `GET` | `/api/admin/suppliers` | Admin / `ENTERPRISE` | List active raw milk suppliers | `fetchSuppliers` |
| `POST` | `/api/admin/suppliers` | Admin / `ENTERPRISE` | Register new dairy supplier with bank info | `addSupplier` |
| `PUT` | `/api/admin/suppliers/:id` | Admin / `ENTERPRISE` | Edit supplier contact or bank information | `updateSupplier` |
| `DELETE`| `/api/admin/suppliers/:id` | Admin / `ENTERPRISE` | Deactivate supplier record | `deactivateSupplier` |

### 15.5 Delivery Agent Endpoints (`/api/agent`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `GET` | `/api/agent/buildings` | Agent | Get list of assigned society buildings | `getUniqueBuildings` |
| `GET` | `/api/agent/dashboard` | Agent | Agent dashboard KPI metrics and progress | `fetchAgentDashboard` |
| `GET` | `/api/agent/deliveries/assigned`| Agent | Fetch assigned deliveries for active shift | `fetchAssignedDeliveries` |
| `GET` | `/api/agent/deliveries/history` | Agent | Paginated historical deliveries by date | `fetchAgentHistory` |
| `POST` | `/api/agent/deliveries/:id/online-qr`| Agent | Generate on-the-spot UPI QR for customer | `createAssignedDeliveryOnlineQr`|
| `POST` | `/api/agent/deliveries/:id/online-order`| Agent | Create instant payment order for doorstep drop | `createAssignedDeliveryOnlineOrder`|
| `POST` | `/api/agent/deliveries/:id/online-verify`| Agent | Verify doorstep online payment completion | `verifyAssignedDeliveryOnlinePayment`|
| `PATCH`| `/api/agent/deliveries/:id/status`| Agent | Update delivery status (`DELIVERED`, `FAILED`)| `patchAssignedDeliveryStatus` |
| `GET` | `/api/agent/profile` | Agent | Fetch agent self profile and shift timings | `fetchAgentSelfProfile` |
| `PATCH`| `/api/agent/profile/availability`| Agent | Toggle availability status (`ACTIVE`, `OFFLINE`)| `patchAgentAvailability` |
| `POST` | `/api/agent/deliveries/location/update`| Agent | Post GPS coordinate update to database | `updateAgentLocation` |
| `POST` | `/api/agent/deliveries/start` | Agent | Start delivery route and broadcast online state | `startDelivery` |

### 15.6 Live Location Endpoint (`/api/location`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `GET` | `/api/location/:orderId` | Any (Scoped) | Fetch real-time cached GPS coordinate of order | Inline router logic checking dairy/agent/customer scope |

### 15.7 Super Admin Endpoints (`/api/super-admin`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `POST` | `/api/super-admin/auth/login` | None | Super Admin email/password login | `superAdminLogin` |
| `POST` | `/api/super-admin/analytics/pageview`| None | Log website visitor pageview & location | `logPageview` |
| `POST` | `/api/super-admin/coupons/validate`| None | Validate coupon code during dairy checkout | `validateCoupon` |
| `GET` | `/api/super-admin/auth/me` | Super Admin | Validate Super Admin session | `getMe` |
| `GET` | `/api/super-admin/dashboard/metrics`| Super Admin | High-level platform KPIs across all dairies | `getDashboardMetrics` |
| `GET` | `/api/super-admin/dashboard/charts`| Super Admin | Multi-tenant growth and revenue charts | `getDashboardCharts` |
| `GET` | `/api/super-admin/dairies` | Super Admin | List all platform dairies with stats | `fetchDairies` |
| `PATCH`| `/api/super-admin/dairies/:id/status`| Super Admin | Toggle dairy status (`ACTIVE`, `SUSPENDED`)| `updateDairyStatus` |
| `PATCH`| `/api/super-admin/dairies/:id/upgrade`| Super Admin | Force upgrade dairy subscription plan | `upgradeDairySubscription` |
| `PATCH`| `/api/super-admin/dairies/:id/reset-password`| Super Admin | Reset dairy owner password | `resetOwnerPassword` |
| `DELETE`| `/api/super-admin/dairies/:id` | Super Admin | Delete dairy tenant and cascade data | `deleteDairy` |
| `GET` | `/api/super-admin/plans` | Super Admin | Fetch all SaaS platform subscription tiers | `fetchPlans` |
| `POST` | `/api/super-admin/plans` | Super Admin | Create new SaaS plan tier | `createPlan` |
| `PUT` | `/api/super-admin/plans/:id` | Super Admin | Update plan pricing, trial days, features | `updatePlan` |
| `DELETE`| `/api/super-admin/plans/:id` | Super Admin | Delete SaaS plan tier | `deletePlan` |
| `GET` | `/api/super-admin/coupons` | Super Admin | List all promotional coupon codes | `fetchCoupons` |
| `POST` | `/api/super-admin/coupons` | Super Admin | Create discount coupon code | `createCoupon` |
| `DELETE`| `/api/super-admin/coupons/:id`| Super Admin | Delete/deactivate coupon code | `deleteCoupon` |
| `GET` | `/api/super-admin/coupons/redemptions`| Super Admin | View log of redeemed coupons by dairies | `fetchRedemptions` |
| `GET` | `/api/super-admin/announcements`| Super Admin | Fetch platform-wide broadcast announcements | `fetchAnnouncements` |
| `POST` | `/api/super-admin/announcements`| Super Admin | Publish announcement to dairy dashboards | `createAnnouncement` |
| `GET` | `/api/super-admin/support/tickets`| Super Admin | Fetch customer/dairy support tickets | `fetchTickets` |
| `POST` | `/api/super-admin/support/tickets`| Super Admin | Create support ticket entry | `createTicket` |
| `PUT` | `/api/super-admin/support/tickets/:id`| Super Admin | Update ticket status (`OPEN`, `RESOLVED`) | `updateTicket` |
| `GET` | `/api/super-admin/settings` | Super Admin | Fetch platform-wide configuration settings | `fetchSettings` |
| `POST` | `/api/super-admin/settings` | Super Admin | Update global platform configuration | `updateSettings` |
| `GET` | `/api/super-admin/monitoring/health`| Super Admin | Live CPU, memory, DB latency health check | `getHealth` |
| `GET` | `/api/super-admin/monitoring/logs` | Super Admin | Fetch recent system error traces & logs | `getErrorLogs` |

### 15.8 Property Hierarchy Endpoints (`/api/property-hierarchy`)

| Method | Endpoint | Auth | Description | Controller Function |
|---|---|:---:|---|---|
| `GET` | `/api/property-hierarchy/properties`| Optional | List properties/societies under a dairy | `getProperties` |
| `POST` | `/api/property-hierarchy/properties`| Optional | Create property/society record | `createProperty` |
| `GET` | `/api/property-hierarchy/buildings`| Optional | List buildings for a property | `getBuildings` |
| `POST` | `/api/property-hierarchy/buildings`| Optional | Create building record under property | `createBuilding` |
| `GET` | `/api/property-hierarchy/wings` | Optional | List wings/blocks for a building | `getWings` |
| `POST` | `/api/property-hierarchy/wings` | Optional | Create wing under building | `createWing` |
| `GET` | `/api/property-hierarchy/floors` | Optional | List floors for a building/wing | `getFloors` |
| `POST` | `/api/property-hierarchy/floors` | Optional | Create floor record under building/wing | `createFloor` |
| `GET` | `/api/property-hierarchy/units` | Optional | List flats/rooms under a floor | `getUnits` |
| `POST` | `/api/property-hierarchy/units` | Optional | Create unit under floor | `createUnit` |
| `POST` | `/api/property-hierarchy/resolve` | Optional | Single-pass cascading tree resolution | `resolveHierarchy` |

---

## 16. Database Schema & Data Models (53 Tables)

The database schema is organized into 53 relational tables in PostgreSQL:

```
+----------------------------------------------------------------------------------------------------+
|                                    RELATIONAL ENTITY RELATIONSHIP MAP                              |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ platform_plans ] <----+                                                                         |
|                          |                                                                         |
|                          | (selected_plan)                                                         |
|                          |                                                                         |
|  [ dairies ] ------------+                                                                         |
|     |                                                                                              |
|     +---> [ admins ]                                                                               |
|     +---> [ products ]                                                                             |
|     +---> [ suppliers ] ----> [ procurement_logs ]                                                 |
|     +---> [ agents ] -------> [ agent_performance ], [ agent_locations ]                           |
|     +---> [ properties ] ---> [ buildings ] ---> [ wings ] ---> [ floors ] ---> [ units ]          |
|     |                                                                             ^                |
|     |                                                                             |                |
|     +---> [ customers ] ----------------------------------------------------------+                |
|              |                                                                                     |
|              +---> [ subscriptions ]                                                               |
|              +---> [ deliveries ]                                                                  |
|              +---> [ monthly_bills ]                                                               |
|              +---> [ payments ]                                                                    |
|              +---> [ payment_verifications ]                                                       |
|                                                                                                    |
+----------------------------------------------------------------------------------------------------+
```

### 16.1 Core Business Tables
1. **`dairies`:** Tenant profile (`id`, `dairy_name`, `dairy_phone`, `dairy_email`, `gstin`, `address`, `city`, `state`, `pincode`, `service_type`, `owner_name`, `bank_account_number_encrypted`, `masked_account_number`, `ifsc`, `upi_id`, `selected_plan`, `status`).
2. **`admins`:** Dairy administrators (`id`, `dairy_id`, `email`, `password_hash`, `name`, `phone`, `role`, `status`).
3. **`customers`:** Households (`id`, `dairy_id`, `customer_name`, `phone_number`, `email`, `address`, `property_id`, `building_id`, `wing_id`, `floor_id`, `unit_id`, `wallet_balance`, `latitude`, `longitude`, `status`).
4. **`agents`:** Delivery partners (`id`, `dairy_id`, `agent_id` [STF...], `agent_name`, `phone`, `password_hash`, `status`, `assigned_route`, `vehicle_details`).
5. **`products`:** Catalog items (`id`, `dairy_id`, `name`, `category`, `unit`, `price`, `stock_quantity`, `status`).
6. **`subscriptions`:** Daily milk plans (`id`, `customer_id`, `dairy_id`, `milk_type`, `quantity_liters`, `delivery_slot`, `delivery_days`, `status`, `approval_status`, `assigned_agent_id`, `start_date`).
7. **`deliveries`:** Daily fulfillment rows (`id`, `dairy_id`, `customer_id`, `agent_id`, `product_id`, `quantity`, `delivery_date`, `delivery_slot`, `status`, `notes`, `proof_image_url`, `agent_current_lat`, `agent_current_lng`).
8. **`payments`:** Financial settlement ledger (`id`, `customer_id`, `dairy_id`, `amount`, `status`, `method`, `description`, `billing_month`, `paid_at`, `idempotency_key`).
9. **`monthly_bills`:** Consolidated monthly statements (`id`, `customer_id`, `dairy_id`, `month_key`, `total_amount`, `delivered_count`, `due_date`, `status`).
10. **`payment_verifications`:** Direct UPI proof records (`id`, `dairy_id`, `customer_id`, `amount`, `utr_number`, `screenshot_url`, `screenshot_sha256`, `confidence_score`, `risk_flags`, `status`).
11. **`properties`:** Residential societies (`id`, `dairy_id`, `name`, `address`, `city`, `pincode`, `latitude`, `longitude`).
12. **`buildings`:** High-rise towers (`id`, `property_id`, `name`). Unique constraint: `(property_id, name)`.
13. **`wings`:** Building wings / blocks (`id`, `building_id`, `name`). Unique constraint: `(building_id, name)`.
14. **`floors`:** Building levels (`id`, `building_id`, `wing_id`, `name`, `floor_number`).
15. **`units`:** Individual flats/rooms (`id`, `floor_id`, `unit_type`, `unit_number`). Unique: `(floor_id, unit_type, unit_number)`.
16. **`suppliers`:** Raw milk vendors (`id`, `dairy_id`, `name`, `phone`, `address`, `status`).
17. **`procurement_logs`:** Raw milk intake (`id`, `dairy_id`, `supplier_id`, `item_name`, `quantity`, `rate_per_unit`, `fat_percentage`, `snf_percentage`, `procured_at`).

### 16.2 SaaS Platform & Super Admin Tables
18. **`super_admins`:** Platform operators (`id`, `email`, `password_hash`, `name`, `role`).
19. **`platform_plans`:** Canonical 3-tier matrix (`id`, `plan_key`, `name`, `monthly_price`, `yearly_price`, `features` [JSONB], `trial_period_days`, `status`).
20. **`platform_subscriptions`:** Dairy subscription records (`id`, `dairy_id`, `plan_id`, `billing_cycle`, `status`, `expires_at`).
21. **`platform_payments`:** SaaS renewal payments (`id`, `dairy_id`, `amount`, `method`, `status`).
22. **`coupons`:** Discount codes (`id`, `code`, `discount_percent`, `discount_amount`, `valid_until`, `max_uses`).
23. **`coupon_redemptions`:** Coupon usage history (`id`, `coupon_id`, `dairy_id`, `redeemed_at`).
24. **`platform_announcements`:** Global banners (`id`, `title`, `message`, `target_plan`, `is_active`).
25. **`support_tickets`:** Help desk tickets (`id`, `dairy_id`, `subject`, `description`, `status`, `priority`).
26. **`platform_settings`:** Global system toggles (`key`, `value` [JSONB]).
27. **`website_traffic_logs`:** Public pageview analytics (`id`, `path`, `ip_address`, `user_agent`, `city`, `country`).

### 16.3 Production Hardening, Observability & Security Tables
28. **`auth_sessions`:** Active user sessions with refresh token hashes.
29. **`auth_token_revocations`:** Blacklisted JWT jti identifiers.
30. **`otp_challenges`:** Rate-limited OTP dispatch attempts and expiry timestamps.
31. **`api_rate_limit_events`:** Logs of exceeded rate limits for IP analysis.
32. **`admin_action_audit_logs`:** Sensitive admin actions (Plan upgrades, customer deletions).
33. **`tenant_api_keys`:** Scoped API credentials for external integrations.
34. **`ocr_processing_logs`:** Raw Google Vision payload responses and duration benchmarks.
35. **`notification_events`:** WhatsApp and Web Push delivery queues with retry attempts.
36. **`security_events`:** Security audit logs for SSRF, bot, and signature alerts.
37. **`fraud_alerts`:** Triggered fraud warnings for duplicate UTRs and screenshot reuse.
38. **`agent_locations`:** Time-series GPS location logs for delivery agents.
39. **`agent_performance`:** Aggregated on-time delivery percentages and speed metrics.
40. **`agent_earnings`:** Delivery partner payout balances.
41. **`financial_ledger_entries`:** Immutable double-entry bookkeeping records.
42. **`settlement_ledger_entries`:** Bank payout settlements.
43. **`immutable_audit_logs`:** Write-once financial audit entries.
44. **`reconciliation_logs`:** Automated marketplace reconciliation run histories.
45. **`reconciliation_mismatches`:** Payment discrepancies flagged for manual review.
46. **`reconciliation_snapshots`:** End-of-day financial reconciliation balances.
47. **`delivery_analytics`:** ML training logs for ETA prediction (duration, distance, time-of-day).
48. **`dairy_notifications`:** Notifications displayed to dairy administrators.
49. **`admin_notifications`:** Push notifications routed to admin dashboard.
50. **`email_verification_tokens`:** Email verification tokens and expiration states.
51. **`password_reset_tokens`:** Self-service password reset challenges.
52. **`app_settings`:** Tenant-level settings (cutoff times, minimum wallet limits).
53. **`partition_maintenance_runs`:** Database partition audit records.

---

## 17. Authentication, Authorization & Security Hardening

### 17.1 Multi-Layered Authentication Architecture
- **Dual-Token Pattern:** On successful login, the server issues:
  1. A short-lived JSON Web Token (Access Token, signed with `JWT_SECRET`, default TTL 30 days).
  2. A persistent Refresh Token and Session ID tracked in the `auth_sessions` table.
- **Automatic Client Token Refresh:** Axios client interceptor in `client.js` intercepts `401 Unauthorized`. If a refresh token exists, it transparently invokes `/api/auth/refresh`, obtains a new access token, updates local storage, and replays the original failed request without interrupting the user.
- **Password Security:** Passwords are never stored in plain text. They are hashed using `bcryptjs` with salt work factor 10.
- **6-Digit OTP Delivery:** Customers receive a 6-digit numeric OTP with a strict 5-minute time-to-live. OTP verification uses rate limiting (`otpRateLimit`: 5 requests per 15 minutes) to block brute-force attacks.

### 17.2 Security Defenses & Hardening Middlewares
- **Field-Level Deterministic Encryption (`utils/crypto.js`):** Sensitive data (such as bank account numbers) is stored using AES-256-GCM authenticated encryption. The initialization vector (IV) is deterministically generated from `sha256(text + DET_IV_SALT).slice(0, 12)`, allowing search and uniqueness lookups while keeping stored data securely encrypted (`ENC_DET:aes-256-gcm:${iv}:${tag}:${ciphertext}`).
- **Global Response Decryption Middleware:** To guarantee encrypted data never leaks to users as raw ciphertext, `server.js` overrides `res.json` and recursively decrypts any `ENC_DET:` values before sending responses.
- **CSRF Cookie-to-Header Verification:** State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) require an `X-CSRF-Token` header that matches the `csrf_token` cookie value.
- **SSRF Payload Guard (`ssrfGuard`):** Inspects incoming JSON request bodies and drops requests containing AWS metadata IPs (`169.254.169.254`), Google internal metadata (`metadata.google.internal`), or local loopback interfaces (`127.0.0.1`, `localhost`).
- **Bot Protection & Request Fingerprinting:** Computes a SHA-256 hash of IP + User-Agent + Accept-Language and enforces a 600 req/min threshold in Redis.
- **API Request Signing (`validateApiSignature`):** Optional HMAC-SHA256 signature verification over `${timestamp}.${method}.${path}.${body}` using `API_REQUEST_SIGNING_SECRET`.

---

## 18. Algorithms and Core Business Logic

### 18.1 Atomic Wallet Payment Settlement (PostgreSQL RPC)
```sql
CREATE OR REPLACE FUNCTION public.execute_customer_wallet_payment(
    p_customer_id BIGINT,
    p_dairy_id BIGINT,
    p_amount NUMERIC(10, 2),
    p_month_key VARCHAR(50),
    p_idempotency_key VARCHAR(160),
    p_description TEXT
) RETURNS JSONB ...
```
1. **Row Lock:** Executes `SELECT dairy_id, wallet_balance FROM customers WHERE id = p_customer_id FOR UPDATE`, placing an exclusive row-level lock that serializes concurrent debit attempts.
2. **Idempotency Verification:** Checks if `p_idempotency_key` has already been recorded in `payments`. If found with matching parameters, returns the previous result safely without re-debiting.
3. **Balance Validation:** Raises an exception if `current_wallet < p_amount`.
4. **Atomic Debit & Ledger Update:** Debits `customers.wallet_balance`, records settlement in `payments` with status `PAID`, and logs the corresponding debit entry.

### 18.2 Smart ETA Calculation Algorithm
Calculates estimated arrival time using the Haversine distance formula and historical delivery analytics:
1. **Haversine Distance:**
   $$a = \sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1) \cos(\text{lat}_2) \sin^2\left(\frac{\Delta \text{lng}}{2}\right)$$
   $$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1-a}\right)$$
   $$d = R \cdot c \quad (R = 6371\text{ km})$$
2. **Exponentially Weighted Duration Average:** Fetches the agent's last 50 historical deliveries with similar distance ($\pm 2\text{ km}$) within the same time-of-day category:
   $$w_i = \exp\left(-\frac{i}{10}\right)$$
   $$\text{Estimated Minutes} = \text{round}\left(\frac{\sum_{i} \text{actual\_duration}_i \cdot w_i}{\sum_i w_i}\right) + 5 \text{ (Safety Buffer)}$$

### 18.3 Fuzzy Name Match Score (Bank Account Validation)
Compares account holder name from dairy records with the legal name returned by Cashfree:
1. Normalizes strings by converting to lowercase and stripping punctuation.
2. Tokenizes names into individual word sets.
3. Calculates set overlap score:
   $$\text{Token Score} = \text{round}\left(\frac{|T_{\text{expected}} \cap T_{\text{actual}}|}{\max(|T_{\text{expected}}|, |T_{\text{actual}}|)} \times 100\right)$$
4. If one compact name is a substring of the other, assigns $\max(\text{Token Score}, 85)$.

---

## 19. AI / Machine Learning & Intelligent Automation

### 19.1 Google Cloud Vision OCR Payment Analysis
- **Service File:** [ocr.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/customer/ocr.service.js)
- **Input:** Image buffer (JPEG/PNG) of customer UPI payment screenshot.
- **Provider:** Google Cloud Vision API (`TEXT_DETECTION`).
- **Processing:** Analyzes text annotations, averages word and block confidences, and parses structured fields:
  - UTR extraction regex: `/(?:UTR|UPI\s*(?:REF|REFERENCE)|REF(?:ERENCE)?\s*(?:NO|ID)?)[^A-Z0-9]{0,18}([A-Z0-9]{8,30})/i`.
  - Amount regex: `/(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i`.
  - App detection: Identifies PhonePe, Google Pay, Paytm, or BHIM based on signature keywords.
- **Heuristic Fallback:** If `GOOGLE_VISION_API_KEY` is not provided, the system falls back to regex matching on client-supplied metadata and original filenames, ensuring payment verification remains functional.

### 19.2 Fraud Risk Scoring Engine
- **Service File:** [smartPaymentVerification.service.js](file:///d:/DiaryVision/Dairy-Stream-Cloud-1/Backend/services/customer/smartPaymentVerification.service.js)
- **Scoring Logic:** Starts with a base confidence score of 95 points.
  - Amount Delta $> ₹1$: $-35$ points (Flag: `AMOUNT_MISMATCH`).
  - OCR Amount Delta $> ₹1$: $-25$ points (Flag: `OCR_AMOUNT_MISMATCH`).
  - Duplicate UTR detected in database: $-45$ points (Flag: `DUPLICATE_UTR`).
  - Duplicate Screenshot SHA-256 hash detected: $-45$ points (Flag: `DUPLICATE_SCREENSHOT`).
  - OCR Text UTR $\neq$ Customer Entered UTR: $-25$ points (Flag: `UTR_TEXT_MISMATCH`).
  - $\ge 3$ rejected verifications in last 24 hours: $-20$ points (Flag: `REPEATED_FAILED_ATTEMPTS`).
  - High OCR Confidence ($\ge 85\%$) with full parameter match: $+5$ points bonus.
- **Recommendation:** If score $\ge 90$ with zero critical flags, recommended as `AUTO_APPROVE_CANDIDATE`; otherwise flagged for `MANUAL_REVIEW`.

---

## 20. Third-Party Services and External Integrations

| Provider | Purpose | Integration Method | Environment Variables |
|---|---|---|---|
| **Supabase** | Cloud PostgreSQL, Database storage, PostgREST API | REST API / `@supabase/supabase-js` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Cashfree** | Bank account verification & Penny-drop validation | HTTPS REST API (`api.cashfree.com/verification`) | `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET` |
| **Google Cloud Vision**| Optical Character Recognition on payment receipts | REST API (`vision.googleapis.com/v1/images:annotate`)| `GOOGLE_VISION_API_KEY` |
| **WhatsApp Cloud API** | Customer bill reminders and delivery alerts | Meta Graph API v20.0 (`graph.facebook.com`) | `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID` |
| **Twilio** | Fallback SMS & WhatsApp notification provider | Twilio REST API (`api.twilio.com`) | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` |
| **Brevo (Sendinblue)** | High-priority transactional email for 6-digit OTPs| HTTPS REST API (`api.brevo.com/v3/smtp/email`) | `BREVO_API_KEY`, `EMAIL_FROM` |
| **Nodemailer / SMTP** | Secondary fallback email delivery provider | SMTP connection (`smtp.gmail.com:465`) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| **Cloudinary** | Cloud image storage for logos and delivery proof | Cloudinary SDK v2 (`cloudinary.uploader.upload_stream`)| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **OSRM** | Road network geometries & driving maneuvers | Open Source Routing Machine HTTP API | Public URL: `router.project-osrm.org` |
| **Redis** | Distributed cron locks and rate-limiting buckets | TCP via `ioredis` | `REDIS_URL`, `REDIS_ENABLED` |

---

## 21. UI/UX Documentation & Layout Breakdown

### 21.1 Design Philosophy & Aesthetics
- **Theme & Colors:** Clean, modern, dairy-inspired palette featuring warm creams (`#FAF6F0`), deep obsidian slate (`#1E293B`), emerald green accents (`#10B981`), and warm amber tones (`#B8641A`).
- **Typography:** Modern sans-serif typography with high legibility across mobile screens and desktop dashboards.
- **Feedback & States:** Loading skeletons for all cards and tables, optimistic UI updates, toast notifications via `react-hot-toast`, and animated modal overlays via Framer Motion.

### 21.2 Page Breakdown
1. **Landing & Login (`LoginPage.jsx`):** Single input for phone, email, or staff ID with instant role detection, animated role badges, password reset flow, and OTP entry modal.
2. **Customer Dashboard (`DairyCustomerDashboard.jsx`):** Interactive delivery calendar with status pills (Delivered, Skipped, Pending), quick-action buttons (Skip Tomorrow, Pause Milk, Extra Quantity), wallet balance card, and active delivery tracking card.
3. **Agent Working Page (`AgentWorkingPage.jsx` & `AgentBuildingTasksPage.jsx`):** Mobile-first delivery console grouped by building and floor. Features one-tap status toggling (`DELIVERED`/`FAILED`), proof photo capture, room-by-room checklist, and live GPS streaming toggle.
4. **Admin Dashboard (`AdminDashboard.jsx`):** Real-time metrics bar (Total Customers, Active Subscriptions, Today's Liters Required vs. Procured), delivery progress chart, quick dispatch shortcuts, and system health status.
5. **Dairy Onboarding Wizard (`RegisterDairyPage.jsx`):** 7-step onboarding process: Brand Details $\rightarrow$ Location & Service Area $\rightarrow$ Owner & Bank Setup $\rightarrow$ Plan Selection $\rightarrow$ Product Catalog $\rightarrow$ Review & Launch.

---

## 22. Installation, Environment Setup & Run Guide

### 22.1 Prerequisites
- **Node.js:** `v22.x LTS` (matches production container runtime).
- **Package Manager:** `npm` (comes bundled with Node.js).
- **Git:** Latest version.
- **Supabase Project:** Active PostgreSQL database on Supabase.
- **Redis (Optional):** Local Redis server or Docker container (required if `REDIS_ENABLED=true`).

### 22.2 Step-by-Step Installation

```bash
# 1. Clone repository
git clone https://github.com/automaterealitylab/Dairy-Stream-Cloud.git
cd Dairy-Stream-Cloud

# 2. Install monorepo dependencies
npm install                     # Installs root tooling
npm --prefix Backend install     # Installs Express API dependencies
npm --prefix Frontend install    # Installs React Vite dependencies

# 3. Configure environment files
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

### 22.3 Database Setup
Open the SQL Editor in your Supabase dashboard and run the migration scripts in this order:
1. `Backend/sql/SUPABASE_MIGRATIONS.sql` (Creates core tables, foreign keys, triggers, and RLS policies).
2. `Backend/sql/PROPERTY_HIERARCHY_MIGRATIONS.sql` (Adds properties, buildings, wings, floors, and units).
3. `Backend/sql/WALLET_ATOMIC_SETTLEMENT_RPC.sql` (Creates `execute_customer_wallet_payment` stored procedure).
4. `Backend/sql/PRODUCTION_HARDENING_MIGRATIONS.sql` (Creates audit ledgers, indexes, and session tables).
5. `Backend/scripts/migrate-super-admin.js` (`node Backend/scripts/migrate-super-admin.js` — seeds default SaaS plans).

### 22.4 Running the Application in Development

```bash
# Start both Backend and Frontend concurrently from repository root:
npm run dev

# Or run in separate terminal tabs:
# Tab 1: Express Backend (Nodemon with hot reload on port 4000)
npm run dev:backend

# Tab 2: React Frontend (Vite with HMR on port 5173)
npm run dev:frontend
```

---

## 23. Environment Variables Specification

### 23.1 Backend Configuration (`Backend/.env`)

| Variable | Required | Default / Format | Purpose |
|---|:---:|---|---|
| `PORT` | No | `4000` | Port for the Express HTTP server |
| `JWT_SECRET` | **Yes** | Long random string | Secret key used to sign and verify JSON Web Tokens |
| `ACCESS_TOKEN_TTL` | No | `30d` | Lifetime duration for access tokens |
| `SUPABASE_URL` | **Yes** | `https://xyz.supabase.co` | Supabase project API URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | JWT string | Supabase service role secret key (bypasses RLS) |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed frontend origin for CORS |
| `CORS_ORIGINS` | No | Comma-separated URLs | Additional allowed CORS origins |
| `DATA_ENCRYPTION_KEY` | **Yes** | 64-char hex / 32-byte key | Master key for AES-256-GCM deterministic encryption |
| `DET_IV_SALT` | **Yes** | Random string | Salt used to derive deterministic initialization vectors |
| `GOOGLE_VISION_API_KEY` | No | Google API key | Enables Google Cloud Vision OCR for payment receipts |
| `CASHFREE_CLIENT_ID` | No | Cashfree App ID | Cashfree client credential for bank account verification |
| `CASHFREE_CLIENT_SECRET` | No | Cashfree Secret | Cashfree client secret key |
| `WHATSAPP_CLOUD_TOKEN` | No | Meta Graph Token | Access token for WhatsApp Cloud API messaging |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | No | Numeric ID | Sender Phone Number ID in Meta Business Manager |
| `TWILIO_ACCOUNT_SID` | No | Twilio SID | Fallback SMS/WhatsApp messaging account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio Secret | Fallback SMS/WhatsApp messaging auth token |
| `BREVO_API_KEY` | No | Brevo API key | Primary transactional email API key for 6-digit OTPs |
| `SMTP_HOST` | No | `smtp.gmail.com` | Secondary fallback SMTP server hostname |
| `SMTP_USER` | No | Email address | Secondary fallback SMTP username |
| `SMTP_PASS` | No | App password | Secondary fallback SMTP application password |
| `REDIS_URL` | No | `redis://127.0.0.1:6379`| Connection string for Redis instance |
| `REDIS_ENABLED` | No | `false` | Enables Redis locks, rate limiting, and BullMQ queues |

### 23.2 Frontend Configuration (`Frontend/.env`)

| Variable | Required | Default | Purpose |
|---|:---:|---|---|
| `VITE_API_BASE_URL` | **Yes** | `http://localhost:4000` | Base URL of the backend API gateway |
| `VITE_USE_LOCAL_BACKEND` | No | `true` | Tells the browser client to target localhost in dev |
| `VITE_VAPID_KEY` | No | Public VAPID key | Public key for browser Web Push notification subscriptions |

---

## 24. Testing Suite & Quality Assurance

### 24.1 Backend Test Suite (Node Native Test Runner)
Executed via `npm --prefix Backend test`. Uses Node's built-in `node:test` runner and assertions:
- **`agentHistory.test.js`:** Tests pagination offsets, total pages calculation, status sorting (PENDING first, FAILED second, COMPLETED last), and summary aggregations over 1,000+ mock records.
- **`deliveryCharge.test.js`:** Validates delivery pricing arithmetic, exact 2-decimal money rounding, precedence of delivery notes unit price over global product price, and client override prevention.
- **`emailArchitecture.test.js`:** Tests Brevo HTTP priority over SMTP fallback, sender header parsing, 6-digit OTP formatting, and strict 5-minute expiration enforcement.
- **`planAuthorization.test.js`:** Verifies canonical plan matrix constants, cache invalidation exports, and route-level feature gating.
- **`propertyHierarchy.test.js`:** Tests full 5-level hierarchy resolution, buildings without wings (`NULL` wing preservation), dual-write legacy column compatibility, and agent delivery mapper enrichment.
- **`services.test.js`:** Tests date formatting utilities, milk delivery order cost calculations, and user role hierarchy validation.

**Result: 33 / 33 Tests Passed (0 failures).**

### 24.2 Frontend Test Suite (Vitest)
Executed via `npm --prefix Frontend test`:
- **`capacitorPlugins.test.js`:** Tests Capacitor native geolocation and app dialog plugin mock integrations.
- **`agentTaskGrouping.test.js`:** Tests building name extraction, flat label formatting, room-to-floor deduction (`digits.slice(0, -2)`), wing grouping, and delivery sorting.
- **`LoadingIndicator.test.jsx`:** Tests accessibility attributes, screen reader text, and render states of the global loader.

**Result: 25 / 25 Tests Passed (0 failures).**

---

## 25. Bugs, Historical Remediation & Production Fixes

### 25.1 Canonical Plan Matrix Remediation (Resolved August 2026)
- **Problem:** An audit revealed three conflicting plan definitions across the codebase:
  1. DB migration had `FREE` (₹0), `GROWTH` (₹999), and `PRIME` (₹2,499).
  2. Scratch seed script had `STARTER` (₹499), `GROWTH` (₹999), and `ENTERPRISE` (₹2,499).
  3. Frontend utilities mapped both `FREE` + `STARTER` to "Free" and `PRIME` + `ENTERPRISE` to "Prime".
- **Fix:** Standardized on a canonical 3-tier matrix across all layers:
  - **`STARTER`:** ₹499/month, ₹4,990/year (14-day trial) — Core dairy delivery, customers, payments.
  - **`GROWTH`:** ₹999/month, ₹9,990/year (14-day trial) — STARTER + Agent Performance analytics.
  - **`ENTERPRISE`:** ₹2,499/month, ₹24,990/year (14-day trial) — GROWTH + Procurement & Suppliers.
  - Updated constants in `Backend/constants/plans.js`, updated DB seeds, aligned route comments, and added regression tests in `planAuthorization.test.js`.

### 25.2 Property Hierarchy Dual-Write Migration
- **Problem:** Introducing a 5-level spatial hierarchy (`properties` $\rightarrow$ `buildings` $\rightarrow$ `wings` $\rightarrow$ `floors` $\rightarrow$ `units`) risked breaking legacy delivery agent views expecting flat text address columns (`building_name`, `wing`, `room_no`).
- **Fix:** Implemented a dual-write pattern in `propertyHierarchy.service.js`. When resolving hierarchy, the system writes foreign keys (`property_id`, `building_id`, etc.) while simultaneously writing denormalized text strings into legacy columns. Added migration fallback in `agent/delivery/mapping.service.js` to preserve backward compatibility.

### 25.3 ESM Response Decryption Leak Prevention
- **Problem:** Database encryption stored bank account numbers as `ENC_DET:aes-256-gcm:...`. In certain API paths, raw ciphertexts were returned in JSON responses.
- **Fix:** Implemented a global response interceptor in `server.js` that wraps `res.json` and `res.send`, recursively decrypting any string matching the `ENC_DET:` pattern before serialization.

---

## 26. Error Handling & Resilience Mechanisms

1. **Centralized Error Handling:** All unhandled errors pass to `globalErrorHandler` in `observability.middleware.js`, which assigns a correlation ID, logs the stack trace in non-production environments, and returns sanitized error responses.
2. **Database Resilience & Schema Drift Fallback:** Database queries check for schema drift via `isMissingColumnError` and `isMissingTableError` in `utils/dbErrors.js`. If optional columns (such as `delivery_days`) are missing from older database snapshots, queries automatically fall back to base column sets without crashing.
3. **Multi-Provider Email Fallback:** The email service in `utils/email.js` attempts primary delivery via Brevo's HTTP API. If Brevo fails (e.g., due to IP restrictions), it catches the error and retries delivery via Nodemailer SMTP.
4. **Offline Mobile Queue Sync:** If a delivery agent loses network connectivity, operations are saved to an offline queue in LocalStorage. When connectivity returns, `syncPendingOfflineActions` flushes queued actions sequentially.

---

## 27. Performance Considerations & Caching Strategies

1. **In-Memory & Redis Identity Caching:** The user detection service (`detectUser.service.js`) caches identity lookups with a 5-minute TTL to reduce database query volume during login spikes.
2. **IFSC Code Caching:** Bank IFSC lookups are cached in Redis and memory for 7 days (`IFSC_CACHE_TTL_SECONDS = 604,800`), eliminating redundant external API calls.
3. **SaaS Plan Features Cache:** SaaS subscription tier permissions are cached in memory in `adminPlan.middleware.js`. When a Super Admin updates plan features, `clearPlanFeaturesCache()` invalidates the cache immediately.
4. **Vite Dynamic Chunking & Code Splitting:** Frontend routes are loaded lazily via `React.lazy`, keeping the initial vendor bundle small and fast.
5. **Nginx Asset Caching:** Static assets in `/assets/` are served with `Cache-Control: public, immutable` and a 1-year expiration header.

---

## 28. Containerization, CI/CD & Deployment Guide

### 28.1 Docker Compose Full-Stack Deployment
The repository includes a production-ready `docker-compose.yml`:

```bash
# Build and run the complete containerized stack:
docker compose up --build -d
```

Services initialized:
- `frontend`: React Vite application built into static assets and served via Alpine Nginx on port 80.
- `backend`: Node.js 22 Express API server running on port 4000 with a `/healthz` health check.
- `marketplace-worker`: BullMQ background queue worker for asynchronous order reconciliation.
- `redis`: Redis 7 Alpine server with append-only data persistence.

### 28.2 GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)
Runs three parallel jobs on every push and pull request to `main` or `master`:
1. **Backend CI:** Installs dependencies, runs syntax validation (`node --check server.js`), executes ESLint, and runs all 33 Node backend tests.
2. **Frontend CI:** Installs dependencies, runs ESLint, runs all 25 Vitest tests, and compiles a production build.
3. **Android APK CI:** Sets up Java 17, builds the frontend web assets, syncs Capacitor Android, runs Gradle unit tests and lint checks (`testDebugUnitTest lintDebug`), compiles a debug APK (`assembleDebug`), and uploads the APK artifact for download.

---

## 29. Consolidated Feature Matrix

| Feature | Customer | Agent | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|
| Role Detection Gateway | ✅ | ✅ | ✅ | ✅ |
| 6-Digit Passwordless OTP Login | ✅ | ❌ | ❌ | ❌ |
| Email / Password Login | ❌ | ✅ | ✅ | ✅ |
| Daily Milk Subscription Setup | ✅ | ❌ | ✅ | ❌ |
| Skip & Pause Delivery Calendar | ✅ | ❌ | ✅ | ❌ |
| One-Time Ad-Hoc Milk Ordering | ✅ | ❌ | ✅ | ❌ |
| Live Leaflet Map Tracking | ✅ | ❌ | ✅ | ❌ |
| Smart ETA with OSRM Road Routing | ✅ | ❌ | ❌ | ❌ |
| Direct UPI QR Payment & Verification | ✅ | ❌ | ✅ | ❌ |
| Google Vision OCR Screenshot Scanning | ✅ | ❌ | ✅ | ❌ |
| Pre-paid Wallet Top-up & Debit | ✅ | ❌ | ✅ | ❌ |
| Official PDF Invoice Downloads | ✅ | ❌ | ✅ | ❌ |
| WhatsApp Notification Reminders | ✅ | ❌ | ✅ | ❌ |
| Society Property Hierarchy (5-Level) | ✅ | ✅ | ✅ | ❌ |
| Building Task Floor Sorting | ❌ | ✅ | ❌ | ❌ |
| Proof-of-Delivery Photo Upload | ❌ | ✅ | ✅ | ❌ |
| Offline Delivery Action Queue | ❌ | ✅ | ❌ | ❌ |
| Real-time Socket.IO Location Streaming | ❌ | ✅ | ❌ | ❌ |
| Customer Subscription Approval | ❌ | ❌ | ✅ | ❌ |
| Delivery Dispatch & Shift Approval | ❌ | ❌ | ✅ | ❌ |
| Agent Onboarding & Staff ID Generator | ❌ | ❌ | ✅ | ❌ |
| Cashfree Bank Account Penny-Drop | ❌ | ❌ | ✅ | ❌ |
| Milk Procurement with FAT & SNF | ❌ | ❌ | ✅ (Enterprise)| ❌ |
| Supplier Contact & Bank Management | ❌ | ❌ | ✅ (Enterprise)| ❌ |
| Agent Delivery Performance Analytics | ❌ | ❌ | ✅ (Growth) | ❌ |
| Multi-Dairy Tenant Onboarding | ❌ | ❌ | ❌ | ✅ |
| SaaS Platform Plan Configuration | ❌ | ❌ | ❌ | ✅ |
| Promotional Coupon Management | ❌ | ❌ | ❌ | ✅ |
| Support Ticket Desk | ❌ | ❌ | ❌ | ✅ |
| System Health & Error Trace Logs | ❌ | ❌ | ❌ | ✅ |

---

## 30. System Limitations

1. **GPS Signal in High-Rise Concrete Elevators:** When agents enter high-rise elevators, hardware GPS signals degrade. While the app continues to operate offline, live tracking displays the last known outdoor coordinates until the agent steps out.
2. **Direct UPI Reconciliation Speed:** Because Direct UPI transfers bypass payment gateways, transactions cannot be auto-verified via webhooks in real time. Verification relies on customer screenshot uploads + OCR extraction, followed by one-click admin confirmation.
3. **SMS Provider Dependency:** Delivery of 6-digit OTPs relies on Brevo and SMTP. If third-party email credentials fail or are rate-limited, customer authentication requires admin intervention.

---

## 31. Future Roadmap & Scope

1. **Automated Milk Analyzer Machine Integration:** Connect IoT milk testing hardware directly to the procurement module via Bluetooth or serial port to auto-populate FAT and SNF readings.
2. **Native iOS App Store Release:** Add CocoaPods and Xcode workspace configurations to compile the Capacitor project for Apple iOS devices.
3. **Smart Route Sequencing (Traveling Salesperson Problem):** Integrate automated route optimization algorithms to sequence building stops in the most fuel-efficient order based on live traffic.
4. **Customer WhatsApp Conversational Ordering:** Allow customers to pause subscriptions or request extra milk by sending simple WhatsApp keywords (e.g., `SKIP TOMORROW`) using incoming WhatsApp webhook handlers.

---

## 32. Technical Reference

### 32.1 Primary Source Code Files

| File | Purpose |
|---|---|
| `Backend/server.js` | Express app entry point, middleware chain, cron jobs, Socket.IO |
| `Backend/routes/index.route.js` | Central API route hub mounting all 8 route modules |
| `Backend/config/supabase.js` | Supabase database connection initialization |
| `Backend/config/redis.js` | Redis client and distributed lock implementation |
| `Backend/utils/crypto.js` | Field-level AES-256-GCM encryption & recursive response decrypter |
| `Backend/services/customer/subscription.automation.service.js` | Automated daily delivery generation and midnight auto-fail |
| `Backend/services/customer/smartPaymentVerification.service.js` | Fraud detection and payment risk analysis engine |
| `Backend/services/shared/eta.service.js` | Haversine distance, historical analytics, and ETA calculation |
| `Backend/socket/locationHandler.js` | Socket.IO rooms and real-time agent GPS coordinate broadcast |
| `Frontend/src/App.jsx` | React Router route definitions and role-based route guards |
| `Frontend/src/api/client.js` | Axios client with CSRF attachment, auth headers, and 401 retry |
| `Frontend/src/api/agent/offlineSync.js` | Offline action queue and synchronization manager for agents |
| `Frontend/src/utils/agentTaskGrouping.js` | Building, wing, and floor delivery grouping and sorting logic |
| `Frontend/src/utils/agentRouting.js` | OSRM road geometry fetching and turn-by-turn voice prompts |

### 32.2 Operational Commands

```bash
# Development
npm run dev                      # Start full-stack development environment
npm run dev:backend              # Start Express backend with Nodemon
npm run dev:frontend             # Start Vite frontend with HMR

# Quality Assurance & Testing
npm run test                     # Run backend and frontend test suites
npm run test:backend             # Run backend test suite (Node test runner)
npm run test:frontend            # Run frontend test suite (Vitest)
npm run lint                     # Run ESLint on frontend
npm --prefix Backend run lint    # Run ESLint on backend

# Production Builds & Mobile Packaging
npm run build                    # Build frontend production bundle into dist/
npm run build:android            # Build frontend and sync Capacitor Android project
docker compose up --build -d     # Build and start full containerized production stack
```

---

## 33. Glossary of Terms

- **Direct UPI:** Payment model where customers transfer funds directly to the dairy's UPI Virtual Payment Address (VPA) via QR code, bypassing third-party gateway transaction fees.
- **UTR (Unique Transaction Reference):** 12-digit reference number generated by the banking network to identify individual UPI transactions.
- **FAT %:** Percentage of butterfat content in raw milk, used to calculate procurement pricing.
- **SNF (Solids-Not-Fat):** Mineral, protein, and lactose content in raw milk excluding water and fat.
- **Property Hierarchy:** 5-level spatial data structure (`Property` $\rightarrow$ `Building` $\rightarrow$ `Wing` $\rightarrow$ `Floor` $\rightarrow$ `Unit`) used to organize high-density apartment deliveries.
- **Capacitor:** Cross-platform native runtime from Ionic that wraps modern web apps into native Android and iOS mobile binaries.
- **OSRM (Open Source Routing Machine):** High-performance routing engine used to compute driving directions and road network geometries.
- **Idempotency Key:** Unique client-generated token sent with payment requests to ensure an operation executes exactly once, even if retransmitted.

---

## 34. Final Project Summary

Dairy Stream Cloud (DairyVision) is a production-grade, multi-tenant SaaS platform built to modernize daily fresh milk distribution. Developed as a full-stack monorepo featuring Node.js 22, Express 5, React 19, Vite 7, Supabase PostgreSQL, Redis 7, and Capacitor 8, it addresses the core operational challenges of traditional dairy operations:
1. **Logistics Optimization:** Replaces paper ledgers with floor-by-floor delivery task queues and real-time Socket.IO GPS tracking with OSRM road navigation.
2. **Zero Commission Loss:** Replaces expensive payment gateways with a Direct UPI verification model powered by Google Cloud Vision OCR, SHA-256 duplicate detection, and heuristic fraud scoring.
3. **Data Integrity:** Guarantees financial consistency through an in-database atomic wallet settlement RPC (`execute_customer_wallet_payment`), distributed Redis cron locks, and deterministic AES-256-GCM encryption.
4. **Enterprise Scalability:** Backed by 53 hardened relational tables, 172 REST endpoints, an Android mobile app with offline synchronization, and comprehensive test suites passing at 100%.

Dairy Stream Cloud delivers an end-to-end, production-ready operational platform for independent dairies, delivery partners, and household consumers.
