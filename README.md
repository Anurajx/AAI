# AeroStock — AAI Smart Inventory & Asset Management System

AeroStock is a complete, production-quality, full-stack web application designed for the Airport Authority of India (AAI) to track spare parts, ground support equipment, safety gear, IT hardware, and consumables across multiple airports and warehouses.

---

## Technical Architecture Overview

- **Frontend:** React (Vite) + TypeScript, Tailwind CSS, Lucide Icons, Recharts for charts, React Router, TanStack Query (React Query) for API requests, Zustand for lightweight client state.
- **Backend:** Node.js + Express (TypeScript), REST API.
- **Database:** PostgreSQL with Prisma ORM.
- **Auth:** JWT-based auth with refresh tokens, bcrypt password hashing, role-based access control (RBAC).
- **Scheduled Tasks:** node-cron for automated daily low-stock checks.
- **Reports:** PDF & Excel exports (pdfkit + exceljs).

---

## Prerequisites

- **Node.js** v20.x or higher
- **NPM** v10.x or higher
- **PostgreSQL** running locally on port 5432 (or running inside WSL2 Ubuntu, which shares ports with Windows)

---

## Getting Started

### 1. Configure Environment Variables

A `.env` file has been pre-configured in the root directory. You can customize the ports or connection strings.
See `.env.example` for details:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aerostock?schema=public"
JWT_SECRET="aerostock-super-secret-key-12345!"
JWT_REFRESH_SECRET="aerostock-super-refresh-secret-key-54321!"
PORT=5000
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"
```

### 2. Database Schema Sync

To push the database schema modeling to your PostgreSQL database and auto-generate the Prisma Client, run:
```bash
npm run db:push
```

### 3. Seed Realistic Demo Data

To populate the database with realistic AAI assets, departments, users, and 90 days of simulated transaction logs, run:
```bash
npm run db:seed
```

### 4. Run the Development Servers

To run both the Express backend server (on port 5000) and the React frontend Vite client (on port 5173 with proxying) concurrently, execute:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Live-Demo Test Credentials

The database seed script pre-populates several test accounts:

| Role | Username | Password | Assigned Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@aerostock.aai.aero` | `Admin@1234` | Global (All Airports) |
| **Delhi Airport Manager** | `delhi.mgr@aerostock.aai.aero` | `Manager@1234` | Indira Gandhi Int'l (DEL) |
| **Mumbai Airport Manager** | `mumbai.mgr@aerostock.aai.aero` | `Manager@1234` | CSMIA Airport (BOM) |
| **Delhi Warehouse Staff** | `delhi.staff@aerostock.aai.aero` | `Staff@1234` | Indira Gandhi Int'l (DEL) |
| **Delhi CNS Requester** | `delhi.req@aerostock.aai.aero` | `Req@1234` | Indira Gandhi Int'l (DEL) |
| **Auditor** | `auditor@aerostock.aai.aero` | `Auditor@1234` | Global (Read Only) |

---

## Key System Features

1. **Dashboard:** Role-aware metrics cards, low stock alerts, category-wise and airport-wise valuations, and area trend charts.
2. **Inventory Ledger:** Advanced searching, filtering by Category, Warehouse, or Availability status. Support for manual stock adjustments and inter-store transfers.
3. **Procurement (POs):** Create drafts with low-stock reorder suggestions, support for central Super Admin approval gating, ordered tracking, and regional partial receipt logging.
4. **Requisitions:** Department staff requests, regional manager approval with stock reservation logic, and staff fulfillment dispatches.
5. **Audit Reports:** Generates Excel sheets (`exceljs`) and PDF reports (`pdfkit`) of real-time valuation audits.
6. **Security Audit Log:** Displays diffs between the before and after JSON states of all changes (for Super Admin & Auditor roles).
