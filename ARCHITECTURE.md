# System Architecture & Data Flow

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (Browser)                   │
│                                                              │
│  ┌──────────────────────┐      ┌──────────────────────┐    │
│  │   React Frontend     │      │   React Router       │    │
│  │  (Vite Development)  │      │   (Navigation)       │    │
│  └──────────────────────┘      └──────────────────────┘    │
│         ↕ HTTP/JSON                       ↕                │
│         ↕ (Port 5173)                     ↕                │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER (Backend)                      │
│                                                              │
│  ┌──────────────────────┐                                   │
│  │   Express.js Server  │                                   │
│  │  (Port 4000)         │                                   │
│  ├──────────────────────┤                                   │
│  │ - Authentication     │                                   │
│  │ - Routing            │                                   │
│  │ - Validation         │                                   │
│  │ - Error Handling     │                                   │
│  └──────────────────────┘                                   │
│         ↕ SQL Queries                                       │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                           │
│                                                              │
│  ┌──────────────────────────────────────────────┐          │
│  │        Supabase PostgreSQL                   │          │
│  │  ┌──────────────────────────────────────┐   │          │
│  │  │         Tables:                      │   │          │
│  │  │  • customers                         │   │          │
│  │  │  • agents                            │   │          │
│  │  │  • milk_deliveries                   │   │          │
│  │  │  • products                          │   │          │
│  │  │  • billing_records                   │   │          │
│  │  └──────────────────────────────────────┘   │          │
│  └──────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Frontend Component Structure

```
App.jsx
│
├── Routes
│
├── Public Routes
│   ├── /                          → CustomerLogin
│   ├── /register                  → CustomerRegister
│   └── /404                       → NotFound
│
├── Customer Routes
│   ├── /customer-dashboard        → CustomerDashboard
│   └── /customerDashbord          → DairyCustomerDashboard
│
├── Agent Routes
│   ├── /agent/AgentDashboard      → AgentDashboard
│   └── /dailyEntry                → DailyEntry
│
├── Admin Routes
│   ├── /admin/AdminDashboard      → AdminDashboard
│   ├── /admin/addCustomer         → AddNewCustomerForm
│   └── /admin/addAgent            → AddNewAgentForm
│
└── Components (Shared)
    ├── DailyMilkDeliveryForm
    ├── ProductForm
    └── Home
```

---

## 🔐 Authentication Flow

```
User
  ↓
[Login/Register Page]
  ↓
Validate Input (Client)
  ↓
Send to Backend API
  ↓
Backend: Verify Credentials
  ↓
Generate JWT Token
  ↓
Return Token + User Data
  ↓
Store in localStorage
  ↓
Redirect to Dashboard
  ↓
All API Requests → Add Authorization Header with JWT
```

---

## 📊 Data Model Relationships

```
┌──────────────────┐
│    Customers     │
├──────────────────┤
│ id (UUID)        │
│ email (unique)   │
│ phone (unique)   │
│ password         │
│ name             │
│ building         │
│ room_no          │
│ status           │
│ created_at       │
└──────────────────┘
        ↓ 1:N
        ↓
┌──────────────────────┐
│  milk_deliveries     │
├──────────────────────┤
│ id (UUID)            │
│ customer_id (FK)     │
│ agent_id (FK)        │
│ delivery_date        │
│ quantity_liters      │
│ amount_collected     │
│ status               │
└──────────────────────┘


┌──────────────────┐
│     Agents       │
├──────────────────┤
│ id (UUID)        │
│ email (unique)   │
│ phone (unique)   │
│ password         │
│ name             │
│ region           │
│ status           │
│ created_at       │
└──────────────────┘
        ↓ 1:N
        ↓
[milk_deliveries]


┌──────────────────┐
│    Products      │
├──────────────────┤
│ id (UUID)        │
│ product_name     │
│ price            │
│ category         │
│ stock_quantity   │
│ is_available     │
└──────────────────┘


┌──────────────────────┐
│  billing_records     │
├──────────────────────┤
│ id (UUID)            │
│ customer_id (FK)     │
│ period_start         │
│ period_end           │
│ total_amount         │
│ amount_paid          │
│ status               │
└──────────────────────┘
```

---

## 🔄 API Request/Response Flow

### Registration Flow
```
Frontend                           Backend                    Database
┌─────────┐                    ┌────────────┐             ┌──────────┐
│Register │─ POST /api/        │ Validation │─ Hash Pwd ─│ Insert  │
│ Form    │ customer/          │ Email Chk  │            │ Customer│
│         │ addCustomer        │ Phone Chk  │            │         │
│         │                    │            │            │         │
│         │←─ Success Response ←│ Generate  │←─ Success ─│ Return  │
│         │  (201, User Data)  │ JWT       │            │ ID, Data│
└─────────┘                    └────────────┘            └──────────┘
```

### Login Flow
```
Frontend                           Backend                    Database
┌──────────┐                   ┌──────────────┐          ┌──────────┐
│ Login    │─ POST /api/       │ Find User    │─ Query ─│ SELECT  │
│ Form     │ customer/login    │ Verify Pwd   │         │ WHERE   │
│          │                   │ Create JWT   │         │ email   │
│          │                   │              │         │ or phone│
│          │←─ Success Response│              │←─ User ─│ Return  │
│          │  (200, Token)     │              │ Data    │ Records │
└──────────┘                   └──────────────┘         └──────────┘
```

### Delivery Recording Flow
```
Frontend                           Backend                    Database
┌──────────────────┐           ┌────────────────┐        ┌──────────┐
│ Delivery Form    │─ POST /   │ Verify Auth    │        │ Insert  │
│ (Qty, Quality,   │ api/      │ Validate Data  │─ Insert│ Delivery│
│  Date)           │ deliveries│ Calculate Cost │        │ Record  │
│                  │           │ Update Stats   │        │ in DB   │
│                  │           │                │        │         │
│                  │←─ Response│                │←─ ID ──│ Return  │
│                  │(201, Data)│                │        │ New ID  │
└──────────────────┘           └────────────────┘        └──────────┘
```

---

## 🔐 Authentication Architecture

```
┌─────────────────────────────────────────────────────┐
│           JWT Token Flow                             │
└─────────────────────────────────────────────────────┘

1. User Logs In
   ↓
2. Backend creates JWT:
   Header:   { alg: "HS256", typ: "JWT" }
   Payload:  { id, email, role, iat, exp }
   Secret:   JWT_SECRET from .env
   ↓
3. Token sent to Frontend
   ↓
4. Frontend stores in localStorage
   ↓
5. Each API request includes:
   Authorization: Bearer eyJhbGciOiJIUzI1NiI...
   ↓
6. Backend middleware:
   - Extracts token from header
   - Verifies signature
   - Checks expiration
   - Allows/Denies request
```

---

## 📈 Database Indexes

```
Customers Table:
├── idx_customers_email      → Fast email lookups (unique)
└── idx_customers_phone      → Fast phone lookups (unique)

Agents Table:
├── idx_agents_email         → Fast email lookups (unique)
└── idx_agents_status        → Filter by active/inactive

Milk Deliveries Table:
├── idx_deliveries_customer  → Get customer's deliveries
├── idx_deliveries_agent     → Get agent's deliveries
└── idx_deliveries_date      → Range queries for reports

Products Table:
└── idx_products_category    → Filter by category

Billing Records Table:
├── idx_billing_customer     → Get customer's billing
└── idx_billing_status       → Filter by payment status
```

---

## 🚀 Deployment Architecture

```
Production Environment:
┌────────────────┐
│  Supabase.com  │ ← Cloud Hosted Database
└────────────────┘
       ↑
       │ PostgreSQL
       │
┌────────────────┐
│ Node.js Server │ ← Backend (Vercel/Railway/Render)
└────────────────┘
       ↑
       │ HTTP/JSON
       │
┌────────────────┐
│ Static Host    │ ← Frontend (Vercel/Netlify)
└────────────────┘
       ↑
       │ HTTPS
       │
┌────────────────┐
│   Browser      │
└────────────────┘
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────┐
│         Customer Interaction             │
└─────────────────────────────────────────┘
        ↓
    ┌───────────────────┐
    │ Register/Login    │
    └───────────────────┘
        ↓
    ┌───────────────────────┐
    │ Dashboard             │
    │ - View Profile        │
    │ - Record Deliveries   │
    │ - View Billing        │
    └───────────────────────┘
        ↓
    ┌──────────────────────────┐
    │ Data Storage             │
    │ (Supabase PostgreSQL)    │
    └──────────────────────────┘
        ↓
    ┌──────────────────────────┐
    │ Analytics & Reporting    │
    │ - Daily Deliveries       │
    │ - Monthly Revenue        │
    │ - Customer Stats         │
    └──────────────────────────┘
```

---

## 🔧 Technology Stack Summary

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | React | 19+ | UI Components |
| Frontend | Vite | 5+ | Build Tool |
| Frontend | Bootstrap | 5+ | UI Framework |
| Frontend | Axios | 1+ | HTTP Client |
| Backend | Express.js | 4+ | Web Server |
| Backend | Node.js | 14+ | Runtime |
| Backend | Supabase | 2+ | Database |
| Database | PostgreSQL | 13+ | DBMS |
| Auth | JWT | - | Token-based Auth |
| Security | bcryptjs | 2+ | Password Hashing |

---

## 🎯 System Features by Component

```
CUSTOMERS
├── Register & Login
├── View Profile
├── Record Milk Deliveries
├── Track Billing
├── View Dashboard
└── Manage Preferences

AGENTS
├── Login & Dashboard
├── View Assigned Customers
├── Record Deliveries
├── Track Performance
└── Manage Routes

ADMIN
├── Login & Dashboard
├── Manage Customers (CRUD)
├── Manage Agents (CRUD)
├── View Analytics
├── Generate Reports
└── System Configuration

SYSTEM
├── Database Management
├── User Authentication
├── Delivery Tracking
├── Billing Automation
├── Analytics & Reporting
└── Error Handling & Logging
```

---

## 📋 API Endpoints Structure

```
/api
├── /customer
│   ├── POST   /addCustomer          → Register customer
│   ├── POST   /login                → Customer login
│   ├── POST   /logout               → Customer logout
│   ├── GET    /:id                  → Get customer profile
│   ├── PUT    /:id                  → Update profile
│   ├── GET    /:id/deliveries       → Customer's deliveries
│   ├── GET    /:id/billing          → Customer's billing
│   └── GET    /:id/dashboard        → Customer dashboard
│
├── /agent
│   ├── POST   /register             → Register agent
│   ├── POST   /login                → Agent login
│   ├── POST   /logout               → Agent logout
│   ├── GET    /:id                  → Get agent profile
│   ├── PUT    /:id                  → Update agent
│   ├── GET    /:id/deliveries       → Agent's deliveries
│   └── GET    /:id/performance      → Agent's KPIs
│
├── /admin
│   ├── GET    /customers            → List all customers
│   ├── PUT    /customers/:id        → Update customer
│   ├── DELETE /customers/:id        → Delete customer
│   ├── GET    /agents               → List all agents
│   ├── PUT    /agents/:id           → Update agent
│   ├── DELETE /agents/:id           → Delete agent
│   └── GET    /analytics            → System analytics
│
├── /deliveries
│   ├── POST   /                     → Record delivery
│   ├── GET    /                     → List deliveries
│   ├── GET    /:id                  → Get delivery details
│   ├── PUT    /:id                  → Update delivery
│   └── DELETE /:id                  → Cancel delivery
│
├── /products
│   ├── GET    /                     → List products
│   ├── POST   /                     → Add product
│   ├── PUT    /:id                  → Update product
│   └── DELETE /:id                  → Delete product
│
└── /dashboard
    ├── GET    /stats                → Get dashboard stats
    └── GET    /reports              → Get reports data
```

---

This architecture is scalable, secure, and ready for production deployment.

