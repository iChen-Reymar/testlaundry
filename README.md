# Laundry Connect - Complete System

A comprehensive laundry service management system with role-based access control.

## 🚀 Quick Start

### 1. Database Setup

1. Open your Supabase project
2. Go to **SQL Editor**
3. Copy and paste the entire contents of `database_schema.sql`
4. Click **Run**

See `DATABASE_SETUP.md` for detailed instructions.

### 2. Create Your First Admin

After running the schema, sign up a user, then run:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### 3. Start the Application

```bash
npm install
npm run dev
```

## 👥 User Roles

### **Admin** (`admin`)
- Full system access
- Manage users (promote to staff, demote, delete)
- Manage services (create, edit, delete)
- View and manage all bookings
- Access to Admin Dashboard

### **Staff** (`staff`)
- View all bookings
- Update booking statuses
- View all users (read-only)
- View services (read-only)
- Access to Staff Dashboard (limited features)
- **Cannot** delete users or manage services

### **User** (`user`)
- View active services
- Create bookings
- View own booking history
- Update own profile
- **Cannot** access admin/staff dashboard

## 📁 Project Structure

```
Laundry_Connect_Finals/
├── database_schema.sql          # Complete database schema
├── DATABASE_SETUP.md            # Database setup guide
├── IMPLEMENTATION_SUMMARY.md    # Implementation details
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx        # Main dashboard (with staff button)
│   │   ├── AdminDashboard.jsx  # Admin/Staff dashboard
│   │   ├── Profile.jsx          # User profile
│   │   └── ...
│   ├── context/
│   │   └── authcontext.jsx      # Auth utilities
│   └── lib/
│       └── supabaseClient.js   # Supabase client
└── README.md
```

## 🔐 Security Features

- **Row Level Security (RLS)**: Database-level access control
- **Role-based permissions**: Frontend and backend validation
- **Secure authentication**: Supabase Auth integration

## 📚 Documentation

- **`DATABASE_SETUP.md`**: Step-by-step database setup
- **`IMPLEMENTATION_SUMMARY.md`**: Complete feature documentation
- **`database_schema.sql`**: Database schema with comments

## 🎯 Key Features

✅ Role-based access control (Admin, Staff, User)  
✅ Staff management (promote/demote users)  
✅ Booking management system  
✅ Service management (admin only)  
✅ User profile management  
✅ Secure authentication  
✅ Responsive design  

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (for profile images)

## 📝 Notes

- All new users are created as 'user' by default
- Only admins can promote users to staff
- Staff can manage bookings but cannot delete users
- Users can only view and book active services

For detailed implementation information, see `IMPLEMENTATION_SUMMARY.md`.
