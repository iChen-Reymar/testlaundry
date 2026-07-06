import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import pool from './db.js';
import { signToken, authRequired, adminRequired, staffRequired } from './middleware/auth.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

const uploadsDir = path.join(__dirname, '..', 'uploads');
const profileUploadsDir = path.join(uploadsDir, 'profiles');
const serviceUploadsDir = path.join(uploadsDir, 'services');

[uploadsDir, profileUploadsDir, serviceUploadsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = req.uploadType === 'service' ? serviceUploadsDir : profileUploadsDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

function publicUrl(req, relativePath) {
  return `${req.protocol}://${req.get('host')}${relativePath}`;
}

function formatProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    profile_image: row.profile_image,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatBooking(row) {
  if (!row) return null;
  return {
    ...row,
    is_active: row.is_active !== undefined ? Boolean(row.is_active) : undefined,
    is_popular: row.is_popular !== undefined ? Boolean(row.is_popular) : undefined,
    is_read: row.is_read !== undefined ? Boolean(row.is_read) : undefined,
    can_confirm_payments: row.can_confirm_payments !== undefined ? Boolean(row.can_confirm_payments) : undefined,
    can_manage_bookings: row.can_manage_bookings !== undefined ? Boolean(row.can_manage_bookings) : undefined,
    profiles: row.profile_name ? { name: row.profile_name, email: row.profile_email } : undefined,
    services: row.service_name ? { name: row.service_name, price: row.service_price, unit: row.service_unit } : undefined,
  };
}

function getBaseOrderId(orderId) {
  if (!orderId) return orderId;
  const match = orderId.match(/^(ORD-[^-]+-[^-]+)-\d+$/);
  return match ? match[1] : orderId;
}

async function updateServiceRatingsForOrder(baseOrderId) {
  const [bookings] = await pool.query(
    'SELECT DISTINCT service_id FROM bookings WHERE order_id = ? OR order_id LIKE ?',
    [baseOrderId, `${baseOrderId}-%`]
  );

  for (const { service_id } of bookings) {
    if (!service_id) continue;
    const [[{ avgRating }]] = await pool.query(
      `SELECT AVG(br.rating) AS avgRating
       FROM booking_ratings br
       JOIN bookings b ON b.user_id = br.user_id
         AND (b.order_id = br.order_id OR b.order_id LIKE CONCAT(br.order_id, '-%'))
       WHERE b.service_id = ?`,
      [service_id]
    );
    if (avgRating != null) {
      await pool.query('UPDATE services SET rating = ?, updated_at = NOW() WHERE id = ?', [
        parseFloat(Number(avgRating).toFixed(2)),
        service_id,
      ]);
    }
  }
}

// ----- Auth -----
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM profiles WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO profiles (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [id, email, passwordHash, name, 'customer']
    );

    await pool.query(
      'INSERT INTO customers (id, name, email, total_bookings) VALUES (?, ?, ?, 0)',
      [id, name, email]
    );

    res.status(201).json({ message: 'Account created successfully' });
  } catch (error) {
    console.error('Signup error:', error);
    const message = error.code === 'ER_NO_SUCH_TABLE'
      ? 'Database tables not set up. Run: npm run setup-db'
      : error.code === 'ER_BAD_DB_ERROR'
        ? `Database "${process.env.DB_NAME}" not found. Run: npm run setup-db`
        : 'Failed to create account';
    res.status(500).json({ error: message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM profiles WHERE email = ?', [email]);
    const profile = rows[0];
    if (!profile) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, profile.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(profile);
    const user = formatProfile(profile);

    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/session', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM profiles WHERE id = ?', [req.user.id]);
    const profile = formatProfile(rows[0]);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json({ user: profile });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// ----- Profiles -----
app.get('/api/profiles/by-role', authRequired, async (req, res) => {
  try {
    const roles = (req.query.roles || '').split(',').filter(Boolean);
    if (roles.length === 0) return res.json([]);

    const placeholders = roles.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT id FROM profiles WHERE role IN (${placeholders})`,
      roles
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profiles by role' });
  }
});

app.get('/api/profiles/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, email, name, role, profile_image, created_at, updated_at FROM profiles WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/profiles', authRequired, staffRequired, async (req, res) => {
  try {
    const [profiles] = await pool.query(
      'SELECT id, email, name, role, profile_image, created_at, updated_at FROM profiles ORDER BY created_at DESC'
    );
    const [staffRows] = await pool.query(
      'SELECT id, employee_id, department, can_confirm_payments, can_manage_bookings, promoted_at FROM staff'
    );

    const staffMap = Object.fromEntries(staffRows.map((s) => [s.id, s]));
    const result = profiles.map((p) => ({
      ...p,
      employee_id: staffMap[p.id]?.employee_id || null,
      department: staffMap[p.id]?.department || null,
      can_confirm_payments: staffMap[p.id]?.can_confirm_payments ?? false,
      can_manage_bookings: staffMap[p.id]?.can_manage_bookings ?? false,
      promoted_at: staffMap[p.id]?.promoted_at || null,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

app.get('/api/users/:id/profile', authRequired, staffRequired, async (req, res) => {
  try {
    const userId = req.params.id;
    const [profileRows] = await pool.query(
      'SELECT id, email, name, role, profile_image, created_at FROM profiles WHERE id = ?',
      [userId]
    );

    if (!profileRows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const profile = profileRows[0];
    const [customerRows] = await pool.query(
      'SELECT phone, address, total_bookings, preferred_pickup_time FROM customers WHERE id = ?',
      [userId]
    );
    const [staffRows] = await pool.query(
      'SELECT employee_id, department, can_confirm_payments, can_manage_bookings FROM staff WHERE id = ?',
      [userId]
    );

    const customer = customerRows[0] || {};
    const staff = staffRows[0] || {};

    res.json({
      ...profile,
      phone: customer.phone || null,
      address: customer.address || null,
      total_bookings: customer.total_bookings ?? 0,
      preferred_pickup_time: customer.preferred_pickup_time || null,
      employee_id: staff.employee_id || null,
      department: staff.department || null,
      can_confirm_payments: Boolean(staff.can_confirm_payments),
      can_manage_bookings: Boolean(staff.can_manage_bookings),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

app.put('/api/profiles/:id', authRequired, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, email, profile_image } = req.body;
    await pool.query(
      'UPDATE profiles SET name = ?, email = ?, profile_image = ?, updated_at = NOW() WHERE id = ?',
      [name, email, profile_image ?? null, req.params.id]
    );

    const [rows] = await pool.query(
      'SELECT id, email, name, role, profile_image, created_at, updated_at FROM profiles WHERE id = ?',
      [req.params.id]
    );
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.delete('/api/profiles/:id', authRequired, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await pool.query('DELETE FROM profiles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ----- Customers -----
app.get('/api/customers/:id', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

app.put('/api/customers/:id', authRequired, async (req, res) => {
  try {
    if (req.user.id !== req.params.id && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { name, email, phone, address, preferred_pickup_time, total_bookings } = req.body;

    const [profileRows] = await pool.query(
      'SELECT name, email FROM profiles WHERE id = ?',
      [req.params.id]
    );
    const [existingRows] = await pool.query(
      'SELECT * FROM customers WHERE id = ?',
      [req.params.id]
    );

    const profile = profileRows[0] || {};
    const existing = existingRows[0];

    const finalName = name !== undefined ? name : (existing?.name || profile.name || '');
    const finalEmail = email !== undefined ? email : (existing?.email || profile.email || '');
    const finalPhone = phone !== undefined ? phone : (existing?.phone ?? null);
    const finalAddress = address !== undefined ? address : (existing?.address ?? null);
    const finalPickup = preferred_pickup_time !== undefined
      ? preferred_pickup_time
      : (existing?.preferred_pickup_time ?? null);
    const finalBookings = total_bookings !== undefined
      ? total_bookings
      : (existing?.total_bookings ?? 0);

    await pool.query(
      `INSERT INTO customers (id, name, email, phone, address, preferred_pickup_time, total_bookings)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         email = VALUES(email),
         phone = VALUES(phone),
         address = VALUES(address),
         preferred_pickup_time = VALUES(preferred_pickup_time),
         total_bookings = VALUES(total_bookings),
         updated_at = NOW()`,
      [
        req.params.id,
        finalName,
        finalEmail,
        finalPhone,
        finalAddress,
        finalPickup,
        finalBookings,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// ----- Staff -----
app.post('/api/staff/promote', authRequired, adminRequired, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const year = new Date().getFullYear();

    const [existingStaff] = await pool.query(
      'SELECT employee_id FROM staff ORDER BY created_at DESC LIMIT 1'
    );

    let nextNumber = 1;
    if (existingStaff[0]?.employee_id) {
      const match = existingStaff[0].employee_id.match(/EMP-\d{4}-(\d+)/);
      if (match) nextNumber = parseInt(match[1], 10) + 1;
    }
    const employeeId = `EMP-${year}-${String(nextNumber).padStart(4, '0')}`;

    await pool.query("UPDATE profiles SET role = 'staff', updated_at = NOW() WHERE id = ?", [targetUserId]);
    await pool.query('DELETE FROM customers WHERE id = ?', [targetUserId]);
    await pool.query(
      `INSERT INTO staff (id, employee_id, promoted_by, promoted_at, can_confirm_payments, can_manage_bookings, department)
       VALUES (?, ?, ?, NOW(), 1, 1, 'operations')
       ON DUPLICATE KEY UPDATE
         employee_id = VALUES(employee_id),
         promoted_by = VALUES(promoted_by),
         promoted_at = NOW(),
         can_confirm_payments = 1,
         can_manage_bookings = 1,
         department = 'operations'`,
      [targetUserId, employeeId, req.user.id]
    );

    res.json({ employeeId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

app.post('/api/staff/demote', authRequired, adminRequired, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    await pool.query("UPDATE profiles SET role = 'customer', updated_at = NOW() WHERE id = ?", [targetUserId]);
    await pool.query('DELETE FROM staff WHERE id = ?', [targetUserId]);

    const [profileRows] = await pool.query(
      'SELECT name, email FROM profiles WHERE id = ?',
      [targetUserId]
    );
    const profile = profileRows[0] || {};

    await pool.query(
      `INSERT INTO customers (id, name, email, total_bookings)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), updated_at = NOW()`,
      [targetUserId, profile.name || '', profile.email || '']
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to demote staff' });
  }
});

// ----- Services -----
app.get('/api/services', async (req, res) => {
  try {
    let sql = 'SELECT * FROM services';
    const params = [];
    if (req.query.active === 'true') {
      sql += ' WHERE is_active = 1';
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({ ...r, is_active: Boolean(r.is_active), is_popular: Boolean(r.is_popular) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

app.get('/api/services/most-booked', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 20);
    const [rows] = await pool.query(
      `SELECT s.*, COUNT(b.id) AS booking_count
       FROM services s
       LEFT JOIN bookings b ON b.service_id = s.id AND b.status NOT IN ('cancelled')
       WHERE s.is_active = 1
       GROUP BY s.id
       ORDER BY booking_count DESC, s.rating DESC, s.name ASC
       LIMIT ?`,
      [limit]
    );
    res.json(rows.map((r) => ({
      ...r,
      is_active: Boolean(r.is_active),
      is_popular: Boolean(r.is_popular),
      booking_count: Number(r.booking_count) || 0,
      rating: parseFloat(r.rating) || 0,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch most booked services' });
  }
});

app.post('/api/services', authRequired, adminRequired, async (req, res) => {
  try {
    const id = uuidv4();
    const { name, description, price, unit, is_active, is_popular, image_url } = req.body;
    await pool.query(
      `INSERT INTO services (id, name, description, price, unit, is_active, is_popular, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, price, unit || 'per kg', is_active ? 1 : 0, is_popular ? 1 : 0, image_url ?? null]
    );
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create service' });
  }
});

app.put('/api/services/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const allowed = ['name', 'description', 'price', 'unit', 'is_active', 'is_popular', 'image_url'];
    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'is_active' || key === 'is_popular') {
          values.push(req.body[key] ? 1 : 0);
        } else {
          values.push(req.body[key]);
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push('updated_at = NOW()');
    values.push(req.params.id);

    await pool.query(`UPDATE services SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Service not found' });
    res.json({ ...rows[0], is_active: Boolean(rows[0].is_active), is_popular: Boolean(rows[0].is_popular) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update service' });
  }
});

app.delete('/api/services/:id', authRequired, adminRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

// ----- Bookings -----
app.get('/api/bookings', authRequired, async (req, res) => {
  try {
    let sql = `
      SELECT b.*,
        p.name AS profile_name, p.email AS profile_email,
        s.name AS service_name, s.price AS service_price, s.unit AS service_unit
      FROM bookings b
      LEFT JOIN profiles p ON b.user_id = p.id
      LEFT JOIN services s ON b.service_id = s.id
    `;
    const params = [];

    if (!['admin', 'staff'].includes(req.user.role)) {
      sql += ' WHERE b.user_id = ?';
      params.push(req.user.id);
    }

    sql += ' ORDER BY b.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(formatBooking));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

app.get('/api/bookings/availability', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT pickup_date, pickup_time, status FROM bookings WHERE status IN ('pending', 'confirmed', 'in_progress')"
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

app.post('/api/bookings', authRequired, async (req, res) => {
  try {
    const bookings = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const booking of bookings) {
      if (booking.service_id) {
        const [serviceRows] = await pool.query(
          'SELECT is_active FROM services WHERE id = ?',
          [booking.service_id]
        );
        if (!serviceRows[0] || !serviceRows[0].is_active) {
          return res.status(400).json({ error: 'One or more selected services are not available' });
        }
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO bookings (id, order_id, user_id, service_id, quantity, pickup_date, pickup_time,
          payment_method, payment_id, payment_status, total_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          booking.order_id,
          booking.user_id || req.user.id,
          booking.service_id,
          booking.quantity || 1,
          booking.pickup_date,
          booking.pickup_time,
          booking.payment_method ?? null,
          booking.payment_id ?? null,
          booking.payment_status || 'unpaid',
          booking.total_price || 0,
          booking.status || 'pending',
        ]
      );
      const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
      results.push(rows[0]);
    }

    res.status(201).json(Array.isArray(req.body) ? results : results[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Order ID already exists', code: '23505' });
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

app.put('/api/bookings/:id', authRequired, staffRequired, async (req, res) => {
  try {
    const fields = [];
    const values = [];
    const allowed = ['status', 'payment_status', 'payment_id', 'payment_method', 'quantity', 'actual_weight', 'total_price', 'notes'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    fields.push('updated_at = NOW()');
    values.push(req.params.id);

    await pool.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, values);
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

app.put('/api/bookings/:id/cancel', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    const booking = rows[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (booking.user_id !== req.user.id && !['admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await pool.query("UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = ?", [req.params.id]);
    const [updated] = await pool.query('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

app.delete('/api/bookings/:id', authRequired, adminRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ----- Hidden bookings -----
app.get('/api/user-hidden-bookings', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT booking_id FROM user_hidden_bookings WHERE user_id = ?',
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hidden bookings' });
  }
});

app.post('/api/user-hidden-bookings', authRequired, async (req, res) => {
  try {
    const { booking_id } = req.body;
    const id = uuidv4();
    await pool.query(
      'INSERT IGNORE INTO user_hidden_bookings (id, user_id, booking_id) VALUES (?, ?, ?)',
      [id, req.user.id, booking_id]
    );
    res.status(201).json({ id, user_id: req.user.id, booking_id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to hide booking' });
  }
});

// ----- Notifications -----
app.get('/api/notifications', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? AND title != ? ORDER BY created_at DESC LIMIT 20',
      [req.user.id, 'New message']
    );
    res.json(rows.map((r) => ({ ...r, is_read: Boolean(r.is_read) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications', authRequired, async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const results = [];

    for (const item of items) {
      const id = uuidv4();
      await pool.query(
        `INSERT INTO notifications (id, user_id, title, message, type, related_booking_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, item.user_id, item.title, item.message, item.type || 'info', item.related_booking_id ?? null]
      );
      results.push({ id, ...item });
    }

    res.status(201).json(Array.isArray(req.body) ? results : results[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

app.put('/api/notifications/:id/read', authRequired, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.put('/api/notifications/mark-all-read', authRequired, async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

app.delete('/api/notifications/:id', authRequired, async (req, res) => {
  try {
    await pool.query('DELETE FROM notifications WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// ----- Messages -----
function normalizeRole(role) {
  return role === 'user' ? 'customer' : role;
}

function canMessage(senderRole, receiverRole) {
  const sender = normalizeRole(senderRole);
  const receiver = normalizeRole(receiverRole);
  if (sender === 'customer') return ['admin', 'staff'].includes(receiver);
  if (sender === 'staff') return ['admin', 'customer'].includes(receiver);
  if (sender === 'admin') return ['admin', 'staff', 'customer'].includes(receiver);
  return false;
}

function recipientRoleFilter(role) {
  const normalized = normalizeRole(role);
  if (normalized === 'customer') return "role IN ('admin', 'staff')";
  if (normalized === 'staff') return "role IN ('admin', 'customer', 'user')";
  if (normalized === 'admin') return "role IN ('admin', 'staff', 'customer', 'user')";
  return '1=0';
}

app.get('/api/messages/recipients', authRequired, async (req, res) => {
  try {
    const roleFilter = recipientRoleFilter(req.user.role);
    const [rows] = await pool.query(
      `SELECT id, name, email, role, profile_image FROM profiles
       WHERE id != ? AND ${roleFilter}
       ORDER BY FIELD(role, 'admin', 'staff', 'customer', 'user'), name`,
      [req.user.id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

app.get('/api/messages/conversations', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const role = normalizeRole(req.user.role);
    const staffOrAdmin = role === 'admin' || role === 'staff';

    const incomingClause = staffOrAdmin
      ? `AND EXISTS (
           SELECT 1 FROM messages m_in
           WHERE m_in.sender_id = p.id AND m_in.receiver_id = ?
         )`
      : '';

    const params = [uid, uid, uid, uid, uid, uid, uid, uid];
    if (staffOrAdmin) params.push(uid);

    const [rows] = await pool.query(
      `SELECT
         p.id, p.name, p.email, p.role, p.profile_image,
         (SELECT m2.message FROM messages m2
          WHERE (m2.sender_id = ? AND m2.receiver_id = p.id)
             OR (m2.sender_id = p.id AND m2.receiver_id = ?)
          ORDER BY m2.created_at DESC LIMIT 1) AS last_message,
         (SELECT m2.created_at FROM messages m2
          WHERE (m2.sender_id = ? AND m2.receiver_id = p.id)
             OR (m2.sender_id = p.id AND m2.receiver_id = ?)
          ORDER BY m2.created_at DESC LIMIT 1) AS last_message_at,
         (SELECT COUNT(*) FROM messages m3
          WHERE m3.sender_id = p.id AND m3.receiver_id = ? AND m3.is_read = 0) AS unread_count
       FROM profiles p
       WHERE p.id != ?
         AND EXISTS (
           SELECT 1 FROM messages m
           WHERE (m.sender_id = ? AND m.receiver_id = p.id)
              OR (m.sender_id = p.id AND m.receiver_id = ?)
         )
         ${incomingClause}
       ORDER BY last_message_at DESC`,
      params
    );
    res.json(rows.map((r) => ({ ...r, unread_count: Number(r.unread_count) || 0 })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.get('/api/messages/unread-count', authRequired, async (req, res) => {
  try {
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

app.get('/api/messages/thread/:userId', authRequired, async (req, res) => {
  try {
    const partnerId = req.params.userId;
    const [partnerRows] = await pool.query('SELECT id, name, email, role FROM profiles WHERE id = ?', [partnerId]);
    if (!partnerRows[0]) return res.status(404).json({ error: 'User not found' });

    if (!canMessage(req.user.role, partnerRows[0].role)) {
      return res.status(403).json({ error: 'You cannot message this user' });
    }

    const [rows] = await pool.query(
      `SELECT m.*, sp.name AS sender_name, sp.email AS sender_email, sp.role AS sender_role,
              st.employee_id AS sender_employee_id
       FROM messages m
       JOIN profiles sp ON m.sender_id = sp.id
       LEFT JOIN staff st ON m.sender_id = st.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?)
          OR (m.sender_id = ? AND m.receiver_id = ?)
       ORDER BY m.created_at ASC`,
      [req.user.id, partnerId, partnerId, req.user.id]
    );

    await pool.query(
      'UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [partnerId, req.user.id]
    );

    res.json(rows.map((r) => ({ ...r, is_read: Boolean(r.is_read) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/messages', authRequired, async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    if (!receiver_id || !message?.trim()) {
      return res.status(400).json({ error: 'Receiver and message are required' });
    }

    const [receiverRows] = await pool.query('SELECT id, name, email, role FROM profiles WHERE id = ?', [receiver_id]);
    if (!receiverRows[0]) return res.status(404).json({ error: 'Receiver not found' });

    if (receiver_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot message yourself' });
    }

    if (!canMessage(req.user.role, receiverRows[0].role)) {
      return res.status(403).json({ error: 'You cannot message this user' });
    }

    const id = uuidv4();
    const trimmed = message.trim();

    await pool.query(
      'INSERT INTO messages (id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)',
      [id, req.user.id, receiver_id, trimmed]
    );

    const [rows] = await pool.query(
      `SELECT m.*, sp.name AS sender_name, sp.email AS sender_email, sp.role AS sender_role,
              st.employee_id AS sender_employee_id
       FROM messages m
       JOIN profiles sp ON m.sender_id = sp.id
       LEFT JOIN staff st ON m.sender_id = st.id
       WHERE m.id = ?`,
      [id]
    );
    res.status(201).json({ ...rows[0], is_read: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ----- Ratings -----
app.get('/api/ratings', authRequired, async (req, res) => {
  try {
    let sql = `
      SELECT r.*, p.name AS customer_name, p.email AS customer_email
      FROM booking_ratings r
      JOIN profiles p ON r.user_id = p.id
    `;
    const params = [];

    if (!['admin', 'staff'].includes(req.user.role)) {
      sql += ' WHERE r.user_id = ?';
      params.push(req.user.id);
    }

    sql += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

app.get('/api/ratings/order/:orderId', authRequired, async (req, res) => {
  try {
    const baseOrderId = getBaseOrderId(req.params.orderId);
    const [rows] = await pool.query(
      'SELECT * FROM booking_ratings WHERE order_id = ? AND user_id = ?',
      [baseOrderId, req.user.id]
    );
    res.json(rows[0] || null);
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json(null);
    }
    res.status(500).json({ error: 'Failed to fetch rating' });
  }
});

app.post('/api/ratings', authRequired, async (req, res) => {
  try {
    const { order_id, rating, comment } = req.body;
    const baseOrderId = getBaseOrderId(order_id);

    if (!baseOrderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const stars = parseInt(rating, 10);
    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    const [bookingRows] = await pool.query(
      `SELECT id, user_id, status FROM bookings
       WHERE user_id = ? AND (order_id = ? OR order_id LIKE ?)`,
      [req.user.id, baseOrderId, `${baseOrderId}-%`]
    );

    if (bookingRows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const allCompleted = bookingRows.every((b) => b.status === 'completed');
    if (!allCompleted) {
      return res.status(400).json({ error: 'Order must be completed before rating' });
    }

    const [existing] = await pool.query(
      'SELECT id FROM booking_ratings WHERE user_id = ? AND order_id = ?',
      [req.user.id, baseOrderId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You have already rated this order' });
    }

    const id = uuidv4();
    const firstBookingId = bookingRows[0].id;

    await pool.query(
      `INSERT INTO booking_ratings (id, order_id, user_id, booking_id, rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, baseOrderId, req.user.id, firstBookingId, stars, comment?.trim() || null]
    );

    await updateServiceRatingsForOrder(baseOrderId);

    const [admins] = await pool.query(
      "SELECT id FROM profiles WHERE role IN ('admin', 'staff')"
    );
    if (admins.length > 0) {
      const starLabel = `${stars} star${stars !== 1 ? 's' : ''}`;
      const adminNotifications = admins.map((admin) => ({
        user_id: admin.id,
        title: 'New Customer Rating',
        message: `Order #${baseOrderId} was rated ${starLabel}${comment?.trim() ? `: "${comment.trim()}"` : '.'}`,
        type: 'success',
        related_booking_id: firstBookingId,
      }));
      for (const item of adminNotifications) {
        await pool.query(
          `INSERT INTO notifications (id, user_id, title, message, type, related_booking_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), item.user_id, item.title, item.message, item.type, item.related_booking_id]
        );
      }

      const senderId = admins[0].id;
      const thankYouMessage = `Thank you for rating order #${baseOrderId} with ${starLabel}! We appreciate your feedback and hope to serve you again soon.`;
      await pool.query(
        'INSERT INTO messages (id, sender_id, receiver_id, message) VALUES (?, ?, ?, ?)',
        [uuidv4(), senderId, req.user.id, thankYouMessage]
      );
    }

    const [rows] = await pool.query('SELECT * FROM booking_ratings WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create rating error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(503).json({ error: 'Ratings table not set up. Run add_ratings_table.sql' });
    }
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// ----- Stats (admin dashboard) -----
app.get('/api/stats', authRequired, staffRequired, async (req, res) => {
  try {
    const [[{ userCount }]] = await pool.query('SELECT COUNT(*) AS userCount FROM profiles');
    const [bookings] = await pool.query('SELECT total_price, status, pickup_date FROM bookings');
    res.json({ userCount, bookings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ----- Uploads -----
app.post('/api/uploads/profile', authRequired, (req, res, next) => {
  req.uploadType = 'profile';
  next();
}, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const url = publicUrl(req, `/uploads/profiles/${req.file.filename}`);
    await pool.query('UPDATE profiles SET profile_image = ?, updated_at = NOW() WHERE id = ?', [
      url,
      req.user.id,
    ]);

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

app.delete('/api/uploads/profile', authRequired, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT profile_image FROM profiles WHERE id = ?', [req.user.id]);
    const imageUrl = rows[0]?.profile_image;

    if (imageUrl?.includes('/uploads/profiles/')) {
      const filename = path.basename(imageUrl);
      const filePath = path.join(profileUploadsDir, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('UPDATE profiles SET profile_image = NULL, updated_at = NOW() WHERE id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete profile image' });
  }
});

app.post('/api/uploads/service', authRequired, adminRequired, (req, res, next) => {
  req.uploadType = 'service';
  next();
}, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = publicUrl(req, `/uploads/services/${req.file.filename}`);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload service image' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', database: 'mysql' });
});

const server = app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    const [tables] = await pool.query('SHOW TABLES');
    if (tables.length === 0) {
      console.warn('WARNING: No tables found. Run "npm run setup-db" to create the database schema.');
    }
    console.log(`Laundry Connect API running on http://localhost:${PORT}`);
    console.log(`MySQL connected: ${process.env.DB_NAME || 'laundry_connect'}`);
  } catch (error) {
    console.error('MySQL connection failed:', error.message);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.error(`Database "${process.env.DB_NAME}" does not exist. Run: npm run setup-db`);
    }
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} is already in use — skipping API start (existing server may still be running).`);
    process.exit(0);
  }
  console.error('Server failed to start:', error.message);
  process.exit(1);
});
