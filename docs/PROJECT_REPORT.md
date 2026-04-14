# Dairy Stream Cloud Detailed Project Report

**Prepared on:** April 10, 2026  
**Project type:** Full-stack dairy operations, subscription, delivery, and billing platform  
**Repository reviewed:** `Dairy-Stream-Cloud`

## 1. Introduction

Dairy Stream Cloud is a multi-role digital platform created to manage the day-to-day operations of a dairy business. The project brings together customer onboarding, subscription handling, product ordering, delivery tracking, payment management, procurement logging, supplier management, and admin analytics inside a single application.

The repository shows that this is not just a concept-stage project. It already contains a working frontend, a structured backend, database integration through Supabase, payment integration through Razorpay, image upload support, notification support, and scheduled automation for recurring subscription workflows.

At a high level, the system serves three main stakeholders:

- Customers, who subscribe to dairy products, track deliveries, and manage payments
- Agents, who handle delivery execution and operational updates in the field
- Admins, who oversee customers, agents, deliveries, suppliers, products, procurement, billing, and platform plans

## 2. Project Purpose and Problem Statement

Traditional dairy businesses often face operational problems such as:

- manual delivery planning,
- delayed or unclear payment collection,
- difficulty tracking recurring subscriptions,
- lack of real-time coordination between admin and delivery staff,
- poor visibility into customer dues and farm revenue,
- no centralized digital system for procurement and supplier records.

This project aims to solve those issues by providing a centralized web application that improves operational efficiency, reduces manual work, and gives each user role a focused digital interface.

## 3. Project Goals

From the current repository state, the major goals of the project can be summarized as:

- Digitize dairy onboarding and profile setup
- Enable customer registration and authenticated access
- Support recurring subscription-based milk delivery
- Allow one-time extra product ordering in addition to regular subscriptions
- Track delivery partner assignment and delivery execution
- Handle customer billing, wallet flows, and payment collection
- Provide admin dashboards for business monitoring and control
- Manage procurement and suppliers
- Support mobile-friendly and partially offline-ready operation

## 4. Scope of the System

The scope of Dairy Stream Cloud includes:

- Public dairy discovery and customer onboarding
- Customer self-service dashboard and delivery management
- Agent operational dashboard and location-related updates
- Admin-side operational control center
- Recurring billing and end-of-day automation
- Online and offline payment handling
- Reporting-oriented views for performance and earnings

The current codebase indicates that the system has already moved beyond static interfaces and includes real business logic for recurring subscription delivery generation, payment normalization, and operational scheduling.

## 5. Technology Stack

### Frontend stack

- React 19
- Vite 5
- React Router 7
- Tailwind CSS
- Bootstrap and React Bootstrap
- Framer Motion
- Recharts
- Leaflet and React Leaflet
- `vite-plugin-pwa`
- Axios
- Zod

### Backend stack

- Node.js
- Express 5
- Supabase JavaScript client
- PostgreSQL via Supabase
- Razorpay
- JWT
- bcryptjs
- multer
- Cloudinary
- Nodemailer
- node-cron
- web-push

### Architecture style

The project follows a layered full-stack architecture:

- Frontend pages and components for UI
- API client layer for backend communication
- Express route layer for endpoint grouping
- Controller layer for request handling
- Service layer for business logic
- Supabase/PostgreSQL for persistent storage

## 6. Repository Structure Overview

The project is divided into two main application areas:

- `Frontend/`
- `Backend/`

Other supporting folders include:

- `docs/` for project-level documentation
- `project_details_&_project_setup/` for older handoff and planning documents

### Frontend structure

The frontend includes:

- `src/pages/` for page-level screens
- `src/components/` for reusable UI pieces
- `src/api/` for API wrappers
- `src/hooks/` for shared logic
- `src/offline/` and `src/utils/` for offline and helper utilities
- `public/` for static assets and PWA files

### Backend structure

The backend includes:

- `routes/` for endpoint groups
- `controllers/` for route handlers
- `services/` for business logic
- `middleware/` for auth and request processing
- `config/` for integration setup
- `sql/` for migration and seed-related scripts
- `utils/` for shared server utilities

## 7. Codebase Size Snapshot

Based on the current repository:

- Backend route files: 6
- Backend controller files: 29
- Backend service files: 27
- Frontend page files: 33
- Frontend component files: 48

This is a meaningful project size for a serious student project, startup MVP, or operational product prototype.

## 8. System Architecture

The high-level system flow is:

1. The user interacts with the React frontend.
2. The frontend sends authenticated API requests to the Express backend.
3. The backend validates the request, applies business rules, and reads/writes data through Supabase.
4. Payment, upload, and notification integrations are used when relevant.
5. Scheduled automation tasks update deliveries and billing data regularly.

The backend startup flow visible in [server.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/server.js) includes:

- environment loading,
- middleware setup,
- health check routes,
- centralized `/api` mounting,
- global error handling,
- periodic subscription automation,
- daily auto-fail routines,
- month-end billing automation.

The database client is initialized through [supabase.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/config/supabase.js), which uses the Supabase service role key and URL from environment variables.

## 9. Frontend Application Overview

The main application routing is defined in [App.jsx](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/src/App.jsx). The route structure shows clear separation between:

- public routes,
- customer routes,
- admin routes,
- agent routes.

### Frontend design patterns used

The frontend uses several solid patterns:

- lazy loading for many route components,
- `ProtectedRoute` wrappers for role-based access,
- admin plan-gated screens through `AdminPlanRoute`,
- modular API clients,
- reusable layout components for customer, agent, and admin interfaces.

### Frontend capabilities visible in the repo

- Dashboard views for each role
- Payment and billing screens
- Delivery history and issue reporting
- Map and tracking related components
- Modal-based workflows for forms and actions
- Background sync and offline utility code
- PWA assets such as service worker and manifest

## 10. Backend Application Overview

The main route hub in [index.route.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/routes/index.route.js) groups APIs into:

- `/api/public`
- `/api/customer`
- `/api/admin`
- `/api/agent`
- `/api/auth`

This organization makes the backend easier to maintain because route ownership aligns with the user roles and feature domains.

### Backend implementation style

The backend uses:

- route files for grouping,
- controllers for request lifecycle handling,
- service files for database/business logic,
- middleware for admin, agent, and customer authorization.

This is a good pattern because it keeps the code more maintainable than placing all logic directly in route files.

## 11. Major Functional Modules

### 11.1 Public module

The public module supports:

- dairy browsing,
- dairy details viewing,
- dairy joining/onboarding,
- buy-once entry flows.

This allows prospective customers to explore the platform before becoming authenticated users.

### 11.2 Customer module

The customer routes in [customer.routes.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/routes/customer.routes.js) show the following features:

- customer registration,
- OTP-based login,
- email verification,
- profile fetch and update,
- dashboard fetch,
- deliveries view,
- issue reporting,
- one-time order creation,
- one-time order cancellation,
- payment order creation,
- payment verification,
- wallet top-up order creation,
- wallet top-up verification,
- subscription fetch/save/delete,
- notification subscription,
- delivery ETA fetch.

The customer dashboard implementation in [DairyCustomerDashboard.jsx](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/src/pages/customer/DairyCustomerDashboard.jsx) is especially rich and includes:

- greeting and dashboard summaries,
- subscription pause/resume support,
- issue reporting,
- add-extra ordering,
- payment handling,
- delivery status awareness,
- repeated dashboard refresh logic,
- product selection with stock checks,
- tomorrow delivery visibility.

This is one of the clearest signs that the project is functionally deep rather than superficial.

### 11.3 Admin module

The admin routes in [admin.routes.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/routes/admin.routes.js) make the admin role the operational control center of the platform.

Admin capabilities include:

- admin login,
- dairy registration,
- dashboard access,
- customer listing and editing,
- customer subscription approval,
- permanent delivery partner assignment,
- agent onboarding,
- unique agent ID generation,
- delivery scheduling,
- bulk scheduling,
- delivery approval,
- delivery reassignment,
- issue resolution,
- procurement logging,
- payment ledger access,
- payment status updates,
- farm plan changes,
- product CRUD,
- performance dashboards,
- earnings summaries,
- building list utilities,
- supplier CRUD.

On the frontend, admin API support is visible in [admin.api.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/src/api/admin.api.js), which wraps a large set of operations for dashboard, customer, agent, delivery, payment, product, performance, earnings, procurement, and supplier workflows.

The admin payments experience in [AdminPayments.jsx](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/src/pages/admin/AdminPayments.jsx) includes:

- farm plan display,
- revenue summary,
- pending dues summary,
- payment filtering,
- manual payment collection modal,
- plan upgrade flow,
- autopay preference storage in local storage,
- customer reminder actions.

### 11.4 Agent module

The agent routes in [agent.routes.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/routes/agent.routes.js) include:

- dashboard access,
- assigned deliveries,
- delivery history,
- online QR payment creation,
- online payment order creation,
- online payment verification,
- delivery status patching,
- self profile access,
- availability updates,
- location updates,
- delivery start.

This module is important because the dairy delivery process depends on field execution, not just back-office data entry.

## 12. Payments and Billing Module

The payment system is one of the most important parts of this application.

### Customer-side payment support

The customer module supports:

- standard payment orders,
- verification flows,
- wallet top-up orders,
- wallet top-up verification.

### Admin-side payment support

The payment controller in [adminPayments.controller.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/controllers/admin/adminPayments.controller.js) and the service logic in [adminPayments.service.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/services/admin/adminPayments.service.js) show that the admin can:

- view farm subscription data,
- fetch customer payment ledgers,
- update customer payment status,
- change the dairy plan,
- collect offline payments,
- settle pending dues,
- credit excess money into customer wallet balance.

The offline collection flow is particularly useful because it reflects a real business scenario: if an admin collects cash directly and the amount exceeds the pending dues, the extra amount can be credited to the customer wallet.

## 13. Subscription and Delivery Automation

One of the strongest technical areas in the repository is subscription automation.

The service in [subscription.automation.service.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/services/customer/subscription.automation.service.js) includes logic to:

- identify the latest active approved subscription for a customer,
- create a delivery for the correct date,
- respect delivery day selection,
- skip dates before the subscription start date,
- avoid duplicate delivery creation,
- attach billing metadata to deliveries,
- create payment records for delivered subscription items,
- auto-fail pending deliveries after the day ends,
- summarize unpaid delivered subscription items.

This is a strong implementation feature because many student projects stop at CRUD operations, while this code includes recurring business automation and state-aware operational logic.

## 14. Data Flow Summary

### Customer journey

1. A customer registers or logs in through OTP.
2. The customer accesses the dashboard.
3. The customer manages subscription or places one-time extra orders.
4. The backend generates deliveries and payment records.
5. The customer tracks deliveries and clears bills.

### Admin journey

1. The admin logs in and accesses the dashboard.
2. The admin manages customers, agents, products, deliveries, and suppliers.
3. The admin views payment ledgers and outstanding dues.
4. The admin collects offline or monitors online payments.
5. The admin changes the dairy’s SaaS plan when needed.

### Agent journey

1. The agent logs in and checks assigned work.
2. The agent starts delivery operations.
3. The agent updates status and location.
4. The system reflects delivery progress back to the customer/admin sides.

## 15. UI and UX Observations

The frontend is not a minimal placeholder UI. It includes thoughtful user interaction patterns such as:

- loading states,
- dashboard cards,
- action tiles,
- modal-based task flows,
- role-specific layouts,
- mobile-friendly spacing and navigation,
- meaningful state-based labels for pending, delivered, failed, paused, and approval-required scenarios.

The customer dashboard especially suggests strong attention to real usage flows such as:

- extra order placement,
- duplicate order confirmation,
- pause/resume subscription,
- issue reporting,
- scheduled delivery visibility.

## 16. Strengths of the Project

The most important strengths visible in the current codebase are:

- Clear role-based product design
- Strong separation between frontend and backend concerns
- Meaningful service-layer business logic
- Real-world billing and settlement logic
- Subscription automation and scheduled operations
- Admin coverage beyond basic CRUD, including procurement and suppliers
- Mobile-aware and offline-supporting frontend utilities
- Payment integration and wallet handling
- Good project breadth for a final-year or portfolio project

## 17. Risks, Gaps, and Issues

Although the project is strong, the repository also shows some risks that should be documented honestly.

### 17.1 Missing or limited automated tests

I did not find automated test files in the repository. This means important flows such as:

- payment verification,
- delivery automation,
- subscription billing,
- wallet crediting,
- agent status updates,

may still depend mostly on manual testing.

### 17.2 Route wiring issue in admin offline payment collection

In [admin.routes.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/routes/admin.routes.js), the route:

- `POST /payments/offline-collect`

is registered without the `collectOfflinePayment` controller handler, even though that controller exists in [adminPayments.controller.js](C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/controllers/admin/adminPayments.controller.js). That means the frontend call may fail unless this route is corrected.

### 17.3 Older documentation may not reflect the live codebase

The documents under `project_details_&_project_setup/` contain useful context, but some of them appear to describe an earlier project phase. They should be treated as historical guidance, not the final source of truth.

### 17.4 Encoding cleanup needed

Some files show text encoding artifacts in comments and console messages. This does not block the app, but it reduces readability and should be cleaned up.

### 17.5 Production readiness still depends on environment setup

Because the project uses Supabase service credentials, payment gateways, and cloud integrations, production readiness still depends on:

- correct environment variables,
- secure secret management,
- database policy setup,
- deployment validation,
- logging and monitoring.

## 18. Recommendations for Improvement

The following improvements would strengthen the project significantly:

1. Add automated tests for payment flows, subscription automation, and delivery state changes.
2. Fix incomplete or mismatched route wiring, especially admin offline collection.
3. Add API documentation for major endpoints and response shapes.
4. Add deployment documentation for staging and production environments.
5. Clean up outdated documents so the repo has one clear project source of truth.
6. Add schema diagrams or ER diagrams for easier academic presentation.
7. Add role-based end-to-end testing for customer, admin, and agent journeys.
8. Improve observability with logging and error tracking.

## 19. Future Scope

This project has good expansion potential. Possible future enhancements include:

- recurring autopay mandate integration,
- advanced analytics dashboards,
- GPS route optimization for agents,
- invoice generation and export,
- customer feedback scoring,
- supplier performance analytics,
- inventory forecasting,
- multilingual support,
- SMS and WhatsApp notification workflows,
- dedicated super-admin or multi-dairy SaaS controls.

## 20. Overall Assessment

Dairy Stream Cloud is a substantial and well-scoped full-stack project. It is stronger than a typical simple CRUD academic app because it includes:

- role-based workflows,
- recurring subscription logic,
- operational delivery management,
- payment and wallet flows,
- supplier and procurement handling,
- automation through scheduled jobs,
- mobile-friendly dashboard UX.

The project already demonstrates:

- practical business problem understanding,
- reasonable architectural organization,
- strong feature breadth,
- meaningful business logic implementation.

Its biggest remaining needs are testing, documentation alignment, and final hardening of a few integration points.

## 21. Conclusion

This project is a strong example of applying modern web development to a real operations problem. It combines frontend design, backend services, payment handling, database integration, role-based authorization, and recurring automation in a way that is useful and technically credible.

With a final round of testing, documentation cleanup, and route/integration fixes, Dairy Stream Cloud can be presented confidently as:

- a detailed academic major project,
- a startup-ready MVP,
- a portfolio-quality full-stack system,
- or a foundation for a production dairy operations platform.
