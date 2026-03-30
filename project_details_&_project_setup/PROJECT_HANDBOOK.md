# 📘 Dairy Stream Cloud - comprehensive Project Handbook

This document explains **how the project works**, detailing every route, middleware, controller, database model, and frontend component. It is written for a new person to understand the entire system without reading the code.

---

## 🏗️ high-Level Architecture

The project is a **Dairy Automation System** built with a **Monolithic Client-Server Architecture**:

- **Frontend**: React.js (Vite) for the user interface.
- **Backend**: Node.js with Express.js for the API.
- **Database**: Supabase (PostgreSQL) for data storage and auth.
- **Authentication**: JWT (JSON Web Tokens) and Supabase Auth.

---

## 🔙 Backend Architecture (`/Backend`)

The backend is the brain of the application, handling data processing, security, and database interactions.

### 1. Entry Point
- **`server.js`**: The main entry file.
  - Loads environment variables (`dotenv`).
  - Connects to Supabase.
  - Sets up Middleware (CORS, JSON parsing).
  - Mounts all API routes under `/api`.
  - Starts the server on port `4000` (default).

### 2. API Routes Structure
All routes are prefixed with `/api`. The main router (`routes/index.route.js`) delegates traffic to specific sub-routers.

| Base Path | Router File | Purpose |
|-----------|------------|---------|
| `/api/` | `routes/public.routes.js` | Publicly accessible endpoints (e.g., Smart Detect). |
| `/api/customer` | `routes/customer.routes.js` | Customer-specific actions (Auth, Profile, etc.). |
| `/api/admin` | `routes/admin.routes.js` | Admin/Owner actions (Login, Staff management). |

### 3. Detailed Route Map

#### 🟢 **Public Routes** (`/api`)
| Method | Endpoint | Controller Function | Description |
|--------|----------|---------------------|-------------|
| `POST` | `/detect` | `checkUserStatus` | **"Smart Detect":** Checks if an identifier (Email/Phone/ID) is a User, Staff, or Admin, and directs them to the correct login flow. |

#### 🔵 **Customer Routes** (`/api/customer`)
| Method | Endpoint | Controller Function | Middleware | Description |
|--------|----------|---------------------|------------|-------------|
| `POST` | `/register` | `registerCustomer` | None | Creates a new customer account in Supabase. |
| `POST` | `/login` | `verifyLogin` | None | Authenticates customer and returns a JWT token. |
| `POST` | `/forgot-password` | `forgotPassword` | None | Initiates password reset flow. |
| `POST` | `/reset-password` | `resetPassword` | None | Completes password reset. |
| `GET` | `/verify-email` | `verifyEmail` | None | Verifies email address. |
| `GET` | `/profile` | `getProfile` | **`authenticate`** | Fetches the logged-in customer's profile. |
| `PUT` | `/profile` | `updateProfile` | **`authenticate`** | Updates profile details. |

#### 🔴 **Admin Routes** (`/api/admin`)
| Method | Endpoint | Controller Function | Middleware | Description |
|--------|----------|---------------------|------------|-------------|
| `POST` | `/login` | `adminLogin` | None | Authenticates dairy owner/admin. |

### 4. Database Models (Supabase)
The database uses **PostgreSQL** hosted on Supabase. Tables are defined in SQL (`Backend/sql/SUPABASE_MIGRATIONS.sql`).

#### **`customers` Table**
Stores customer data.
- **`id`**: Primary Key.
- **`email`**: Unique identifier.
- **`phone_number`**: Alternative Login ID.
- **`password`**: Hashed password.
- **`default_milk_quantity_liters`**: Subscription detail.
- **`billing_cycle`**: e.g., "Monthly".
- **`building_name`, `wing`, `room_no`**: Delivery address.

#### **`agents` Table**
Stores delivery staff/agent data.
- **`id`**: Primary Key.
- **`email`, `phone_number`**: Identifiers.
- **`building`**: Assigned delivery zone.

### 5. Middleware
- **`authenticate`** (`middleware/customer/auth.middleware.js`):
  - Intercepts requests to protected routes.
  - Verifies the `Authorization: Bearer <token>` header.
  - Decodes the JWT.
  - If valid, attaches user info to `req.user` and allows the request to proceed.
  - If invalid, returns `401 Unauthorized`.

---

## 🖥️ Frontend Architecture (`/Frontend`)

The frontend is a Single Page Application (SPA) built with React.

### 1. Page Routing (`src/App.jsx`)
The app uses `react-router-dom` to navigate between pages.

| URL Path | Component (Page) | Access Level | Description |
|----------|-----------------|--------------|-------------|
| `/` | `LoginPage` | Public | The main entry. Uses "Smart Detect" logic. |
| `/explore` | `ExploreDairiesPage` | Public | Browse nearby dairies (without login). |
| `/register` | `RegisterNewuserPage` | Public | Customer registration form. |
| `/register-dairy` | `RegisterDairyPage` | Public | Form for new Dairies to join the platform. |
| `/customer-dashboard` | `CustomerDashboard` | **User** | Main hub for customers to view deliveries. |
| `/customer/deliveries` | `Deliveries` | **User** | Detailed delivery history. |
| `/customer/profile` | `Profile` | **User** | View/Edit account details. |
| `/agent-dashboard` | `AgentDashboard` | **Staff** | Dashboard for delivery agents. |
| `/admin/AdminDashboard` | `AdminDashboard` | **Admin** | Main control center for Dairy Owners. |

### 2. Key Pages & Components

#### **Login Page (`LoginPage.jsx`)**
- **Logic**: It's a "Smart Login". You enter *any* details (Phone, Email, Staff ID).
- **Process**:
  1. Calls `detect` API (currently blocked/mocked in frontend code).
  2. Determines if you are a Customer, Staff, or Admin.
  3. Adapts the UI (e.g., asks for OTP for customers, Password for admins).
  4. On success, stores token and redirects to the appropriate Dashboard.

#### **Customer Dashboard (`CustomerDashboard.jsx`)**
- **Purpose**: The daily view for a milk subscriber.
- **Data Source**: Calls `useCustomerDashboard` hook.
- **Features**:
  - Shows "Today's Delivery Status" (Delivered/Pending).
  - Shows "Tomorrow's Plan" (e.g., 1.5 Liters).
  - Quick Actions: Pause, Add Extra, Pay Bill.
  - Billing Summary: Current due amount.

#### **Registration Page (`RegisterNewuserPage.jsx`)**
- **Purpose**: Onboards new customers.
- **Flow**:
  1. **Personal Info**: Name, Mobile.
  2. **Address**: Building, Room (Critical for delivery routing).
  3. **Plan**: Daily Quantity, Billing Cycle.
  4. **Submit**: Calls `/api/customer/register`.

### 3. API Integration Layer
The frontend abstracts API calls in the `src/api` folder.
- **`customer.api.js`**: Contains functions like `fetchCustomerDashboard`.
- **`useAuth.jsx`** (`src/pages/hooks/`): Manages global login state (Context API).

---

## 🔄 How Data Flows (Example: Customer Login)

1. **User Action**: User enters mobile number `9876543210` on `LoginPage`.
2. **Frontend Logic**:
   - `LoginPage` calls `mockDetectAPI` (Client-side simulation).
   - Identifies user as "CUSTOMER".
   - Prompts for OTP (or Password).
3. **Authentication**:
   - User enters OTP/Password.
   - Frontend calls Backend API `/api/customer/login` (in a full implementation).
4. **Backend Processing**:
   - `loginCustomer` controller receives credentials.
   - Checks `customers` table in Supabase.
   - Validates password/OTP.
   - Generates a **JWT Token**.
   - Sends Token back to Frontend.
5. **Session Start**:
   - Frontend stores Token in `localStorage`.
   - Redirects user to `/customer-dashboard`.
6. **Data Fetching**:
   - `CustomerDashboard` loads.
   - Calls `/api/customer/dashboard` with Token.
   - Backend `authenticate` middleware verifies Token.
   - Controller queries `customers` table for delivery data.
   - Data is displayed on screen.
