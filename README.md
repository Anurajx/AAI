# AeroStock, AAI Asset Management System

AeroStock is a full-stack inventory, procurement, and audit platform tailored for the Airport Authority of India (AAI). It is designed to help airport operations teams manage spares, ground support equipment, safety gear, IT infrastructure, and consumables across multiple airports and warehouses with role-aware workflows, real-time stock visibility, and audit-friendly reporting.

This repository contains the complete application stack:

- a React + TypeScript frontend
- an Express + TypeScript backend
- a PostgreSQL database served through Prisma ORM
- seeded demo data for airports, warehouses, users, items, transactions, purchase orders, requisitions, notifications, and audit logs

---

## 1. Project Overview

AeroStock supports the full lifecycle of airport inventory operations:

- inventory tracking and stock movement
- purchase order creation and approval
- requisition requests and fulfillment
- low-stock and reorder forecasting
- audit reporting and change history
- role-based operational access for admins, managers, staff, requesters, and auditors

The product is built around the realities of airport operations where stock accuracy, accountability, and rapid replenishment are critical.

---

## 2. Core Features

### Inventory Management

- track inventory items across multiple warehouses
- maintain stock levels, reserved stock, and available stock
- record stock transactions such as receipts, issues, transfers, adjustments, damage, and returns
- support search, filtering, warehouse/category views, and inventory ledger-style tracking

### Procurement Workflows

- create purchase orders from draft to approval to ordering and receipt
- support supplier and item-based organization
- track ordered quantities versus received quantities
- surface low-stock reorder suggestions based on thresholds and reorder quantities

### Requisition Workflows

- allow requesters to submit material requirements
- allow approvers to approve or reject requests
- support fulfillment workflows for approved requisitions
- maintain requisition history and status updates

### Reporting and Auditing

- compute valuation and reorder reporting
- export reports to Excel and PDF
- maintain audit logs with before/after state snapshots for administrative oversight
- expose dashboard KPIs such as total valuation, low stock counts, pending POs, and pending requisitions

### Notifications and Alerts

- generate low-stock and workflow-related notifications
- maintain notification inbox behavior for users
- support read/unread notification tracking

### Role-Based Access Control

The application supports the following roles:

- Super Admin: global oversight and administrative access
- Airport Manager: airport-level operational oversight
- Staff: warehouse and operations execution
- Requester: department-level requisition submission
- Auditor: read-only oversight with audit visibility

---

## 3. Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand for lightweight client state
- Axios for API requests
- TanStack React Query
- Recharts for visual summaries
- Lucide React icons

### Backend

- Node.js
- Express.js
- TypeScript
- REST API architecture
- JWT authentication with access and refresh tokens
- bcryptjs for password hashing
- zod for validation
- multer for uploads
- node-cron for scheduled background jobs
- ExcelJS and PDFKit for reporting

### Data Layer

- PostgreSQL
- Prisma ORM
- Prisma schema with strongly typed models for airports, warehouses, inventory, suppliers, purchase orders, requisitions, audit logs, maintenance records, and notifications

---

## 4. Project Structure

```text
AAI/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Shared layout and UI components
│   │   ├── lib/             # API client and shared utilities
│   │   ├── pages/           # Login, dashboard, inventory, requisitions, POs, admin, reports
│   │   └── store/           # Zustand stores for auth and notifications
│   ├── package.json
│   └── vite.config.ts
├── prisma/                  # Prisma schema and seed data
│   ├── schema.prisma
│   └── seed.ts
├── server/                  # Express backend
│   ├── src/
│   │   ├── controllers/     # Business logic handlers
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # API route definitions
│   │   ├── utils/           # Cron jobs, JWT helpers, notifications, scope logic
│   │   └── validation/      # Request validation schemas
│   └── package.json
├── docker-compose.yml       # PostgreSQL container setup
├── package.json             # Root scripts and workspace setup
├── .env.example             # Environment template
└── README.md                # Project documentation
```

---

## 5. Prerequisites

Before running the app locally, ensure you have:

- Node.js 20+ recommended
- npm 10+
- PostgreSQL 14+ or Docker Desktop with Docker Compose available
- Internet access for installing dependencies if needed

If you are using WSL2, PostgreSQL running in WSL or Docker will usually be reachable on the same ports.

---

## 6. Environment Configuration

A root-level `.env` file is used by the server and the app runtime. An example template is available in [.env.example](.env.example).

Typical variables include:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aerostock?schema=public"
JWT_SECRET="your-access-token-secret"
JWT_REFRESH_SECRET="your-refresh-token-secret"
PORT=5000
CLIENT_URL="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:5000"
VITE_API_URL="http://localhost:5000/api/v1"
CORS_ORIGINS="http://localhost:5173,http://localhost:3000"
NODE_ENV="development"
```

## 7. Local Development Setup

### Option A: Start with Dockerized PostgreSQL

From the repository root:

```bash
npm run db:up
```

This starts PostgreSQL using Docker Compose.

### Option B: Use an Existing PostgreSQL Instance

If PostgreSQL is already running locally, skip the Docker step and make sure your `DATABASE_URL` points to it.

### Step 1: Apply Prisma Schema

```bash
npm run db:push
```

This will:

- create or update the database schema in PostgreSQL
- generate the Prisma client

### Step 2: Seed Demo Data

```bash
npm run db:seed
```

This populates the database with:

- multiple airports and warehouses
- sample users and roles
- categories, suppliers, and inventory items
- realistic stock transactions over time
- sample purchase orders and requisitions
- notifications and audit data

### Step 3: Start the App

Run both frontend and backend together:

```bash
npm install
npm run dev
```

The default URLs are:

- frontend: http://localhost:5173
- backend: http://localhost:5000
- API base: http://localhost:5000/api/v1

---

## 4. Available Root Scripts

From the repository root:

```bash
npm run dev            # start frontend and backend together
npm run dev:server     # start only the backend
npm run dev:client     # start only the frontend
npm run build          # build both frontend and backend
npm run build:server   # build backend only
npm run build:client   # build frontend only
npm run db:up          # start PostgreSQL with Docker Compose
npm run db:down        # stop PostgreSQL containers
npm run db:push        # push Prisma schema to database
npm run db:seed        # seed demo data
npm run db:studio      # open Prisma Studio
npm run db:setup       # start db, push schema, seed data
```

## 5. Database Model Summary

The Prisma schema models the following domain objects:

- User
- Airport
- Warehouse
- Category
- Item
- StockLevel
- StockTransaction
- Supplier
- PurchaseOrder
- PurchaseOrderItem
- Requisition
- RequisitionItem
- AuditLog
- MaintenanceRecord
- Notification

This gives the system a relational foundation for inventory operations, warehouse movement, purchasing, approvals, and audits.
