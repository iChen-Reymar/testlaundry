# Laundry Connect - Complete System

A comprehensive laundry service management system with role-based access control.

## Quick Start

### 1. MySQL Database Setup

See **`MYSQL_SETUP.md`** for full Navicat connection steps.

1. Install MySQL and connect with **Navicat**
2. Run `database_schema.sql` in Navicat Query window
3. Update `.env` with your MySQL password

### 2. Create Your First Admin

After signing up in the app, run in Navicat:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 3. Start the Application

```bash
npm install
npm run server    # Terminal 1 - API on port 3001
npm run dev       # Terminal 2 - Frontend on port 5173
```

## User Roles

### Admin (`admin`)
- Full system access
- Manage users, services, and all bookings
- Admin Dashboard

### Staff (`staff`)
- View and manage bookings
- Confirm payments
- Cannot delete users or manage services

### Customer (`customer` / `user`)
- Book services and view history
- Update profile

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** Express.js + MySQL
- **Database:** MySQL (manage with Navicat)
- **Authentication:** JWT (local API)

## Project Structure

```
Laundry/
├── database_schema.sql    # MySQL schema (run in Navicat)
├── MYSQL_SETUP.md         # Navicat + MySQL setup guide
├── server/                # Express API
│   ├── index.js
│   ├── db.js
│   └── middleware/
├── src/
│   ├── lib/apiClient.js   # API client (replaces Supabase)
│   └── components/
└── uploads/               # Profile & service images
```

For detailed database setup, see **`MYSQL_SETUP.md`**.
