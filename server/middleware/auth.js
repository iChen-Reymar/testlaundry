import jwt from 'jsonwebtoken';
import pool from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'laundry-connect-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = header.slice(7);
    req.user = jwt.verify(token, JWT_SECRET);

    // Always use the latest role from MySQL (e.g. after Navicat admin promotion)
    const [rows] = await pool.query(
      'SELECT id, email, name, role FROM profiles WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { ...req.user, ...rows[0] };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

export function staffRequired(req, res, next) {
  if (!['admin', 'staff'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
}
