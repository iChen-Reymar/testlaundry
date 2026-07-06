import { supabase, supabaseConfigError } from './supabaseClient.js';

function formatAuthError(error, fallback = 'Request failed') {
  if (!error) return null;
  const msg = error.message || fallback;

  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_NAME_NOT_RESOLVED')) {
    return 'Cannot connect to Supabase. Your Vercel env vars may be wrong or missing. Set VITE_SUPABASE_URL to your real project URL (e.g. https://zqlxsnhgqmdjhjmlvicb.supabase.co), add VITE_SUPABASE_PUBLISHABLE_KEY, then redeploy on Vercel.';
  }
  if (msg.includes('Signups not allowed')) {
    return 'Sign-ups are disabled in Supabase. Enable them under Authentication → Sign In / Providers → Email → Allow new users to sign up.';
  }
  if (msg.includes('Invalid login credentials')) {
    return 'Invalid email or password. Use an account created in this app after Supabase was set up, or confirm your email if required.';
  }
  if (msg.includes('Email not confirmed')) {
    return 'Please confirm your email before logging in, or disable email confirmation in Supabase Auth settings.';
  }

  return msg;
}

function throwIfError(error, fallback = 'Request failed') {
  if (!error) return;
  const err = new Error(formatAuthError(error, fallback) || fallback);
  err.code = error.code;
  err.status = error.status;
  throw err;
}

function syncUserProfile(user) {
  if (!user) return;
  const existing = JSON.parse(localStorage.getItem('userProfile') || '{}');
  localStorage.setItem('userProfile', JSON.stringify({
    ...existing,
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    profile_image: user.profile_image ?? existing.profile_image,
  }));
}

async function fetchProfile(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role, profile_image, created_at, updated_at')
    .eq('id', id)
    .single();
  throwIfError(error, 'Profile not found');
  return data;
}

function formatBooking(row) {
  if (!row) return null;
  const profile = row.profiles;
  const service = row.services;
  return {
    ...row,
    profile_name: profile?.name,
    profile_email: profile?.email,
    service_name: service?.name,
    service_price: service?.price,
    service_unit: service?.unit,
    profiles: profile ? { name: profile.name, email: profile.email } : undefined,
    services: service ? { name: service.name, price: service.price, unit: service.unit } : undefined,
  };
}

function getBaseOrderId(orderId) {
  if (!orderId) return orderId;
  const match = orderId.match(/^(ORD-[^-]+-[^-]+)-\d+$/);
  return match ? match[1] : orderId;
}

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

const BOOKING_SELECT = `
  *,
  profiles:user_id (name, email),
  services:service_id (name, price, unit)
`;

const auth = {
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { data: { session: null } };

    try {
      const profile = await fetchProfile(session.user.id);
      syncUserProfile(profile);
      return { data: { session: { user: profile } } };
    } catch {
      return { data: { session: null } };
    }
  },

  async getUser() {
    const { data } = await auth.getSession();
    return { data: { user: data.session?.user || null } };
  },

  async signInWithPassword({ email, password }) {
    if (supabaseConfigError) throw new Error(supabaseConfigError);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error, 'Invalid email or password');
    const profile = await fetchProfile(data.user.id);
    syncUserProfile(profile);
    return { data: { user: profile, session: { user: profile } }, error: null };
  },

  async signUp({ email, password, options }) {
    if (supabaseConfigError) throw new Error(supabaseConfigError);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: options?.data?.name || '' } },
    });
    throwIfError(error, 'Failed to create account');
    return { data: { user: { email } }, error: null };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    throwIfError(error);
    localStorage.removeItem('userProfile');
    return { error: null };
  },
};

export const api = {
  auth,

  profiles: {
    get: async (id) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, role, profile_image, created_at, updated_at')
        .eq('id', id)
        .single();
      throwIfError(error);
      return data;
    },

    getAll: async () => {
      const [{ data: profiles, error: pErr }, { data: staffRows, error: sErr }] = await Promise.all([
        supabase.from('profiles').select('id, email, name, role, profile_image, created_at, updated_at').order('created_at', { ascending: false }),
        supabase.from('staff').select('id, employee_id, department, can_confirm_payments, can_manage_bookings, promoted_at'),
      ]);
      throwIfError(pErr);
      throwIfError(sErr);

      const staffMap = Object.fromEntries((staffRows || []).map((s) => [s.id, s]));
      return (profiles || []).map((p) => ({
        ...p,
        employee_id: staffMap[p.id]?.employee_id || null,
        department: staffMap[p.id]?.department || null,
        can_confirm_payments: staffMap[p.id]?.can_confirm_payments ?? false,
        can_manage_bookings: staffMap[p.id]?.can_manage_bookings ?? false,
        promoted_at: staffMap[p.id]?.promoted_at || null,
      }));
    },

    update: async (id, body) => {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          name: body.name,
          email: body.email,
          profile_image: body.profile_image ?? null,
        })
        .eq('id', id)
        .select('id, email, name, role, profile_image, created_at, updated_at')
        .single();
      throwIfError(error);
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      throwIfError(error);
      return { success: true };
    },

    byRole: async (roles) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .in('role', roles);
      throwIfError(error);
      return data || [];
    },
  },

  users: {
    getProfile: async (id) => {
      const [{ data: profile, error: pErr }, { data: customer }, { data: staff }] = await Promise.all([
        supabase.from('profiles').select('id, email, name, role, profile_image, created_at').eq('id', id).single(),
        supabase.from('customers').select('phone, address, total_bookings, preferred_pickup_time').eq('id', id).maybeSingle(),
        supabase.from('staff').select('employee_id, department, can_confirm_payments, can_manage_bookings').eq('id', id).maybeSingle(),
      ]);
      throwIfError(pErr);
      if (!profile) throw new Error('User not found');

      return {
        ...profile,
        phone: customer?.phone || null,
        address: customer?.address || null,
        total_bookings: customer?.total_bookings ?? 0,
        preferred_pickup_time: customer?.preferred_pickup_time || null,
        employee_id: staff?.employee_id || null,
        department: staff?.department || null,
        can_confirm_payments: Boolean(staff?.can_confirm_payments),
        can_manage_bookings: Boolean(staff?.can_manage_bookings),
      };
    },
  },

  customers: {
    get: async (id) => {
      const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
      throwIfError(error);
      return data;
    },

    upsert: async (id, body) => {
      const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', id).maybeSingle();
      const { data: existing } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();

      const row = {
        id,
        name: body.name !== undefined ? body.name : (existing?.name || profile?.name || ''),
        email: body.email !== undefined ? body.email : (existing?.email || profile?.email || ''),
        phone: body.phone !== undefined ? body.phone : (existing?.phone ?? null),
        address: body.address !== undefined ? body.address : (existing?.address ?? null),
        preferred_pickup_time: body.preferred_pickup_time !== undefined
          ? body.preferred_pickup_time
          : (existing?.preferred_pickup_time ?? null),
        total_bookings: body.total_bookings !== undefined
          ? body.total_bookings
          : (existing?.total_bookings ?? 0),
      };

      const { data, error } = await supabase.from('customers').upsert(row).select('*').single();
      throwIfError(error);
      return data;
    },
  },

  staff: {
    promote: async (targetUserId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const year = new Date().getFullYear();

      const { data: lastStaff } = await supabase
        .from('staff')
        .select('employee_id')
        .order('created_at', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (lastStaff?.[0]?.employee_id) {
        const match = lastStaff[0].employee_id.match(/EMP-\d{4}-(\d+)/);
        if (match) nextNumber = parseInt(match[1], 10) + 1;
      }
      const employeeId = `EMP-${year}-${String(nextNumber).padStart(4, '0')}`;

      await supabase.from('profiles').update({ role: 'staff' }).eq('id', targetUserId);
      await supabase.from('customers').delete().eq('id', targetUserId);
      const { error } = await supabase.from('staff').upsert({
        id: targetUserId,
        employee_id: employeeId,
        promoted_by: user.id,
        promoted_at: new Date().toISOString(),
        can_confirm_payments: true,
        can_manage_bookings: true,
        department: 'operations',
      });
      throwIfError(error);
      return { employeeId };
    },

    demote: async (targetUserId) => {
      const { data: profile } = await supabase.from('profiles').select('name, email').eq('id', targetUserId).single();

      await supabase.from('profiles').update({ role: 'customer' }).eq('id', targetUserId);
      await supabase.from('staff').delete().eq('id', targetUserId);
      await supabase.from('customers').upsert({
        id: targetUserId,
        name: profile?.name || '',
        email: profile?.email || '',
        total_bookings: 0,
      });

      return { success: true };
    },
  },

  services: {
    list: async (activeOnly = false) => {
      let query = supabase.from('services').select('*').order('created_at', { ascending: false });
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      throwIfError(error);
      return data || [];
    },

    mostBooked: async (limit = 10) => {
      const capped = Math.min(limit, 20);
      const { data: services, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true);
      throwIfError(error);

      const { data: bookings } = await supabase
        .from('bookings')
        .select('service_id, status')
        .not('status', 'eq', 'cancelled');

      const counts = {};
      for (const b of bookings || []) {
        if (b.service_id) counts[b.service_id] = (counts[b.service_id] || 0) + 1;
      }

      return (services || [])
        .map((s) => ({
          ...s,
          booking_count: counts[s.id] || 0,
          rating: parseFloat(s.rating) || 0,
        }))
        .sort((a, b) => b.booking_count - a.booking_count || b.rating - a.rating || a.name.localeCompare(b.name))
        .slice(0, capped);
    },

    create: async (body) => {
      const { data, error } = await supabase
        .from('services')
        .insert({
          name: body.name,
          description: body.description,
          price: body.price,
          unit: body.unit || 'per kg',
          is_active: body.is_active ?? true,
          is_popular: body.is_popular ?? false,
          image_url: body.image_url ?? null,
        })
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },

    update: async (id, body) => {
      const allowed = ['name', 'description', 'price', 'unit', 'is_active', 'is_popular', 'image_url'];
      const patch = {};
      for (const key of allowed) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      const { data, error } = await supabase.from('services').update(patch).eq('id', id).select('*').single();
      throwIfError(error);
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('services').delete().eq('id', id);
      throwIfError(error);
      return { success: true };
    },
  },

  bookings: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = user ? await fetchProfile(user.id) : null;

      let query = supabase.from('bookings').select(BOOKING_SELECT).order('created_at', { ascending: false });
      if (profile && !['admin', 'staff'].includes(profile.role)) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map(formatBooking);
    },

    availability: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('pickup_date, pickup_time, status')
        .in('status', ['pending', 'confirmed', 'in_progress']);
      throwIfError(error);
      return data || [];
    },

    create: async (body) => {
      const bookings = Array.isArray(body) ? body : [body];
      const { data: { user } } = await supabase.auth.getUser();
      const results = [];

      for (const booking of bookings) {
        if (booking.service_id) {
          const { data: service } = await supabase
            .from('services')
            .select('is_active')
            .eq('id', booking.service_id)
            .single();
          if (!service?.is_active) {
            throw new Error('One or more selected services are not available');
          }
        }

        const { data, error } = await supabase
          .from('bookings')
          .insert({
            order_id: booking.order_id,
            user_id: booking.user_id || user.id,
            service_id: booking.service_id,
            quantity: booking.quantity || 1,
            pickup_date: booking.pickup_date,
            pickup_time: booking.pickup_time,
            payment_method: booking.payment_method ?? null,
            payment_id: booking.payment_id ?? null,
            payment_status: booking.payment_status || 'unpaid',
            total_price: booking.total_price || 0,
            status: booking.status || 'pending',
          })
          .select('*')
          .single();

        if (error?.code === '23505') {
          const err = new Error('Order ID already exists');
          err.code = '23505';
          throw err;
        }
        throwIfError(error);
        results.push(data);
      }

      return Array.isArray(body) ? results : results[0];
    },

    update: async (id, body) => {
      const allowed = ['status', 'payment_status', 'payment_id', 'payment_method', 'quantity', 'actual_weight', 'total_price', 'notes'];
      const patch = {};
      for (const key of allowed) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      const { data, error } = await supabase.from('bookings').update(patch).eq('id', id).select('*').single();
      throwIfError(error);
      return data;
    },

    cancel: async (id) => {
      const { data, error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },

    delete: async (id) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      throwIfError(error);
      return { success: true };
    },
  },

  notifications: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .neq('title', 'New message')
        .order('created_at', { ascending: false })
        .limit(20);
      throwIfError(error);
      return data || [];
    },

    create: async (body) => {
      const items = Array.isArray(body) ? body : [body];
      const rows = items.map((item) => ({
        user_id: item.user_id,
        title: item.title,
        message: item.message,
        type: item.type || 'info',
        related_booking_id: item.related_booking_id ?? null,
      }));

      const { data, error } = await supabase.from('notifications').insert(rows).select('*');
      throwIfError(error);
      return Array.isArray(body) ? data : data[0];
    },

    markRead: async (id) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);
      throwIfError(error);
      return { success: true };
    },

    markAllRead: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      throwIfError(error);
      return { success: true };
    },

    delete: async (id) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id);
      throwIfError(error);
      return { success: true };
    },
  },

  messages: {
    recipients: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = await fetchProfile(user.id);
      const role = normalizeRole(profile.role);

      let roleFilter = ['admin', 'staff'];
      if (role === 'staff') roleFilter = ['admin', 'customer', 'user'];
      if (role === 'admin') roleFilter = ['admin', 'staff', 'customer', 'user'];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, profile_image')
        .neq('id', user.id)
        .in('role', roleFilter)
        .order('name');
      throwIfError(error);
      return data || [];
    },

    conversations: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = await fetchProfile(user.id);
      const staffOrAdmin = ['admin', 'staff'].includes(profile.role);

      const { data: allMessages, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, message, is_read, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      throwIfError(error);

      const partnerIds = new Set();
      for (const m of allMessages || []) {
        const partnerId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const partnerSentToMe = (allMessages || []).some(
          (msg) => msg.sender_id === partnerId && msg.receiver_id === user.id
        );
        if (!staffOrAdmin || partnerSentToMe) {
          partnerIds.add(partnerId);
        }
      }

      if (partnerIds.size === 0) return [];

      const { data: partners } = await supabase
        .from('profiles')
        .select('id, name, email, role, profile_image')
        .in('id', [...partnerIds]);

      return (partners || []).map((p) => {
        const thread = (allMessages || []).filter(
          (m) => (m.sender_id === user.id && m.receiver_id === p.id) || (m.sender_id === p.id && m.receiver_id === user.id)
        );
        const last = thread[0];
        const unread_count = thread.filter((m) => m.sender_id === p.id && m.receiver_id === user.id && !m.is_read).length;
        return {
          ...p,
          last_message: last?.message || null,
          last_message_at: last?.created_at || null,
          unread_count,
        };
      }).sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
    },

    thread: async (userId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: partner, error: pErr } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', userId)
        .single();
      throwIfError(pErr);
      if (!partner) throw new Error('User not found');

      const me = await fetchProfile(user.id);
      if (!canMessage(me.role, partner.role)) {
        throw new Error('You cannot message this user');
      }

      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      throwIfError(error);

      const senderIds = [...new Set((messages || []).map((m) => m.sender_id))];
      const [{ data: senders }, { data: staffRows }] = await Promise.all([
        supabase.from('profiles').select('id, name, email, role').in('id', senderIds),
        supabase.from('staff').select('id, employee_id').in('id', senderIds),
      ]);

      const senderMap = Object.fromEntries((senders || []).map((s) => [s.id, s]));
      const staffMap = Object.fromEntries((staffRows || []).map((s) => [s.id, s]));

      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('sender_id', userId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      return (messages || []).map((m) => ({
        ...m,
        sender_name: senderMap[m.sender_id]?.name,
        sender_email: senderMap[m.sender_id]?.email,
        sender_role: senderMap[m.sender_id]?.role,
        sender_employee_id: staffMap[m.sender_id]?.employee_id || null,
      }));
    },

    send: async (receiverId, message) => {
      const { data: { user } } = await supabase.auth.getUser();
      const me = await fetchProfile(user.id);
      const { data: receiver, error: rErr } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', receiverId)
        .single();
      throwIfError(rErr);

      if (receiverId === user.id) throw new Error('You cannot message yourself');
      if (!canMessage(me.role, receiver.role)) throw new Error('You cannot message this user');

      const { data, error } = await supabase
        .from('messages')
        .insert({ sender_id: user.id, receiver_id: receiverId, message: message.trim() })
        .select('*')
        .single();
      throwIfError(error);

      return {
        ...data,
        sender_name: me.name,
        sender_email: me.email,
        sender_role: me.role,
        is_read: false,
      };
    },

    unreadCount: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);
      throwIfError(error);
      return { count: count || 0 };
    },
  },

  hiddenBookings: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('user_hidden_bookings')
        .select('booking_id')
        .eq('user_id', user.id);
      throwIfError(error);
      return data || [];
    },

    hide: async (bookingId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('user_hidden_bookings')
        .upsert({ user_id: user.id, booking_id: bookingId }, { onConflict: 'user_id,booking_id' })
        .select('*')
        .single();
      throwIfError(error);
      return data;
    },
  },

  stats: {
    get: async () => {
      const [{ count: userCount }, { data: bookings }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('total_price, status, pickup_date'),
      ]);
      return { userCount: userCount || 0, bookings: bookings || [] };
    },
  },

  ratings: {
    list: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = await fetchProfile(user.id);

      let query = supabase
        .from('booking_ratings')
        .select('*, profiles:user_id (name, email)')
        .order('created_at', { ascending: false });

      if (!['admin', 'staff'].includes(profile.role)) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      throwIfError(error);
      return (data || []).map((r) => ({
        ...r,
        customer_name: r.profiles?.name,
        customer_email: r.profiles?.email,
      }));
    },

    getByOrder: async (orderId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const baseOrderId = getBaseOrderId(orderId);
      const { data, error } = await supabase
        .from('booking_ratings')
        .select('*')
        .eq('order_id', baseOrderId)
        .eq('user_id', user.id)
        .maybeSingle();
      throwIfError(error);
      return data;
    },

    submit: async (body) => {
      const { data: { user } } = await supabase.auth.getUser();
      const baseOrderId = getBaseOrderId(body.order_id);

      const stars = parseInt(body.rating, 10);
      if (!stars || stars < 1 || stars > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      const { data: bookingRows } = await supabase
        .from('bookings')
        .select('id, user_id, status, order_id')
        .eq('user_id', user.id)
        .or(`order_id.eq.${baseOrderId},order_id.like.${baseOrderId}-%`);

      if (!bookingRows?.length) throw new Error('Order not found');
      if (!bookingRows.every((b) => b.status === 'completed')) {
        throw new Error('Order must be completed before rating');
      }

      const { data: existing } = await supabase
        .from('booking_ratings')
        .select('id')
        .eq('user_id', user.id)
        .eq('order_id', baseOrderId)
        .maybeSingle();

      if (existing) throw new Error('You have already rated this order');

      const { data: rating, error } = await supabase
        .from('booking_ratings')
        .insert({
          order_id: baseOrderId,
          user_id: user.id,
          booking_id: bookingRows[0].id,
          rating: stars,
          comment: body.comment?.trim() || null,
        })
        .select('*')
        .single();
      throwIfError(error);

      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'staff']);

      if (admins?.length) {
        const starLabel = `${stars} star${stars !== 1 ? 's' : ''}`;
        await supabase.from('notifications').insert(
          admins.map((admin) => ({
            user_id: admin.id,
            title: 'New Customer Rating',
            message: `Order #${baseOrderId} was rated ${starLabel}${body.comment?.trim() ? `: "${body.comment.trim()}"` : '.'}`,
            type: 'success',
            related_booking_id: bookingRows[0].id,
          }))
        );

        await supabase.from('messages').insert({
          sender_id: admins[0].id,
          receiver_id: user.id,
          message: `Thank you for rating order #${baseOrderId} with ${starLabel}! We appreciate your feedback and hope to serve you again soon.`,
        });
      }

      return rating;
    },
  },

  uploads: {
    profile: async (file) => {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(path, file, { upsert: true, contentType: file.type });
      throwIfError(uploadError);

      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(path);

      await supabase.from('profiles').update({ profile_image: publicUrl }).eq('id', user.id);
      return { url: publicUrl };
    },

    service: async (file) => {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('services')
        .upload(path, file, { upsert: true, contentType: file.type });
      throwIfError(uploadError);

      const { data: { publicUrl } } = supabase.storage.from('services').getPublicUrl(path);
      return { url: publicUrl };
    },

    deleteProfile: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = await fetchProfile(user.id);

      if (profile.profile_image?.includes('/profiles/')) {
        const urlParts = profile.profile_image.split('/profiles/');
        const storagePath = urlParts[1];
        if (storagePath) {
          await supabase.storage.from('profiles').remove([storagePath]);
        }
      }

      await supabase.from('profiles').update({ profile_image: null }).eq('id', user.id);
      return { success: true };
    },
  },
};

export default api;
