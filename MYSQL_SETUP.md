# MySQL + Navicat Setup Guide

This project uses **MySQL** instead of Supabase. Use **Navicat** to manage the database visually.

## 1. Install MySQL

If you don't have MySQL yet:

1. Download [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) or install via [XAMPP](https://www.apachefriends.org/) / [WAMP](https://www.wampserver.com/)
2. During setup, set a **root password** (remember it for Navicat)
3. Make sure the MySQL service is **running**

Default connection:
- **Host:** `localhost`
- **Port:** `3306`
- **User:** `root`
- **Password:** (your MySQL root password)

## 2. Connect Navicat to MySQL

1. Open **Navicat**
2. Click **Connection** → **MySQL**
3. Fill in:
   - **Connection Name:** `Laundry Connect` (any name)
   - **Host:** `localhost`
   - **Port:** `3306`
   - **User Name:** `root`
   - **Password:** your MySQL password
4. Click **Test Connection** — it should succeed
5. Click **OK** to save

## 3. Create the Database

1. In Navicat, right-click your connection → **New Database**
   - **Database name:** `laundry_connect`
   - **Character set:** `utf8mb4`
   - **Collation:** `utf8mb4_unicode_ci`

   **OR** run the schema file:

2. Open **Query** → **New Query**
3. Open `database_schema.sql` from this project folder
4. Paste the full contents into the query window
5. Click **Run** (or press F5)

This creates all tables and sample laundry services.

## 4. Configure the App

1. Copy `.env.example` to `.env` (if needed)
2. Set your MySQL password in `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=laundry_connect
```

3. Install dependencies and start:

```bash
npm install
npm run server
```

In a **second terminal**:

```bash
npm run dev
```

4. Open the app: http://localhost:5173

## 5. Create Your First Admin

1. Sign up in the app with your email
2. In Navicat, open the `laundry_connect` database → **profiles** table
3. Find your row and change **role** from `customer` to `admin`
4. Log out and log back in — you now have admin access

Or run this SQL in Navicat:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

## 6. Browse Data in Navicat

**Important:** Your accounts are saved in the **`laundry_connect`** database — not `laundry` or any other name. In Navicat:

1. Expand your MySQL connection
2. Double-click **`laundry_connect`** (match the name in your `.env` → `DB_NAME`)
3. Click the **`profiles`** table → **View Data** (or right-click → Open Table)
4. Right-click the table and choose **Refresh** after signing up in the app

You should see rows like `admin@gmail.com` with role `customer`.

After using the app, you can view and edit data in Navicat:

| Table | Purpose |
|-------|---------|
| `profiles` | Users, roles, login emails |
| `customers` | Customer phone, address, booking counts |
| `staff` | Staff employee IDs and permissions |
| `services` | Laundry services and prices |
| `bookings` | All orders |
| `notifications` | In-app notifications |
| `user_hidden_bookings` | Orders hidden from customer history |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` | Start MySQL service (Services → MySQL) |
| `Access denied for user 'root'` | Check password in `.env` matches Navicat |
| `Unknown database 'laundry_connect'` | Run `database_schema.sql` in Navicat |
| API not reachable | Run `npm run server` on port 3001 |
| Login fails after signup | Confirm row exists in `profiles` table |

## What Was Removed

- Supabase URL and API keys (no longer needed)
- `@supabase/supabase-js` package
- Supabase Auth, PostgreSQL, and Supabase Storage

Data is now stored in **MySQL** and accessed through the local **Express API** (`server/`).
