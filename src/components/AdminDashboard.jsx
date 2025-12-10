import React, { useState, useEffect } from "react";
import { ChevronLeft, Users, Package, ShoppingCart, TrendingUp, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, CreditCard, Calendar, ChevronRight, ChevronLeft as ChevronLeftIcon, Plus, Scale } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";
import Notifications from "./Notifications";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBookings: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState('user');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookingsByDate, setBookingsByDate] = useState({});
  
  // Service management state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    price: '',
    unit: 'per kg',
    is_active: true,
    is_popular: false,
    image_url: ''
  });
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [groupedBookings, setGroupedBookings] = useState([]);
  
  // Weigh items state
  const [showWeighModal, setShowWeighModal] = useState(false);
  const [weighingOrder, setWeighingOrder] = useState(null);
  const [weighInputs, setWeighInputs] = useState({});

  // Get base order ID (remove -1, -2, etc. suffix)
  const getBaseOrderId = (orderId) => {
    if (!orderId) return orderId;
    const match = orderId.match(/^(ORD-[^-]+-[^-]+)-\d+$/);
    return match ? match[1] : orderId;
  };

  // Check if user is admin
  useEffect(() => {
    checkAuth();
    checkAdmin();
    
    // Check if we should open a specific tab (from notification click)
    const openTab = sessionStorage.getItem('openTab');
    if (openTab) {
      setActiveTab(openTab);
      sessionStorage.removeItem('openTab');
    }
    
    if (activeTab === "overview") fetchStats();
    if (activeTab === "bookings") {
      fetchBookings();
      setSelectedDate(null); // Reset date filter when switching to bookings tab
    }
    if (activeTab === "users") fetchUsers();
    if (activeTab === "services") fetchServices();
  }, [activeTab]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      
      const userProfile = localStorage.getItem('userProfile');
      if (!userProfile) {
        navigate("/login");
        return;
      }
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/login");
    }
  };

  const checkAdmin = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (!userProfile) {
      navigate("/dashboard");
      return;
    }
    setCurrentUserRole(userProfile.role || 'user');
    setUserId(userProfile.id || null);
    // Allow both admin and staff to access, but with different permissions
    if (userProfile.role !== 'admin' && userProfile.role !== 'staff') {
      alert("Access denied. Admin or Staff only.");
      navigate("/dashboard");
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get total bookings
      const { data: allBookings } = await supabase
        .from('bookings')
        .select('total_price, status');

      // Calculate stats
      const totalRevenue = allBookings?.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0) || 0;
      const pendingOrders = allBookings?.filter(b => b.status === 'pending').length || 0;

      setStats({
        totalUsers: userCount || 0,
        totalBookings: allBookings?.length || 0,
        totalRevenue: totalRevenue.toFixed(2),
        pendingOrders
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      alert("Failed to load statistics. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async (filterDate = null) => {
    setLoading(true);
    try {
      // First, fetch all bookings to populate calendar
      const { data: allBookings, error: allError } = await supabase
        .from('bookings')
        .select('pickup_date')
        .not('pickup_date', 'is', null);
      
      if (allError) throw allError;
      
      // Group all bookings by pickup date for calendar
      const grouped = {};
      (allBookings || []).forEach(booking => {
        if (booking.pickup_date) {
          const dateKey = booking.pickup_date;
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(booking);
        }
      });
      setBookingsByDate(grouped);
      
      // Now fetch detailed bookings (filtered by date if provided)
      let query = supabase
        .from('bookings')
        .select(`
          *,
          profiles:user_id (name, email),
          services:service_id (name, price, unit)
        `);
      
      if (filterDate) {
        query = query.eq('pickup_date', filterDate);
      }
      
      const { data, error } = await query
        .order('pickup_date', { ascending: true })
        .order('pickup_time', { ascending: true });

      if (error) throw error;
      setBookings(data || []);

      // Group bookings by base order ID
      const groupedMap = {};
      (data || []).forEach(booking => {
        const baseOrderId = getBaseOrderId(booking.order_id);
        
        if (!groupedMap[baseOrderId]) {
          groupedMap[baseOrderId] = {
            baseOrderId,
            pickup_date: booking.pickup_date,
            pickup_time: booking.pickup_time,
            status: booking.status,
            payment_status: booking.payment_status,
            user_id: booking.user_id,
            customerName: booking.profiles?.name || "N/A",
            customerEmail: booking.profiles?.email || "",
            services: [],
            bookingIds: [],
            totalPrice: 0,
            created_at: booking.created_at
          };
        }
        
        groupedMap[baseOrderId].services.push({
          id: booking.id,
          name: booking.services?.name || "Unknown Service",
          price: parseFloat(booking.total_price) || 0,
          quantity: booking.quantity || 1,
          actual_weight: booking.actual_weight,
          pricePerUnit: parseFloat(booking.services?.price) || 0,
          unit: booking.services?.unit || "per item",
          status: booking.status,
          payment_status: booking.payment_status,
          services: booking.services // Keep original service data
        });
        
        groupedMap[baseOrderId].bookingIds.push(booking.id);
        groupedMap[baseOrderId].totalPrice += parseFloat(booking.total_price) || 0;
      });

      // Convert to array and sort
      const groupedArray = Object.values(groupedMap).sort(
        (a, b) => new Date(a.pickup_date + ' ' + a.pickup_time) - new Date(b.pickup_date + ' ' + b.pickup_time)
      );
      setGroupedBookings(groupedArray);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      alert("Failed to load bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch staff data to get employee_id and permissions
      const { data: staffData } = await supabase
        .from('staff')
        .select('id, employee_id, department, can_confirm_payments, can_manage_bookings, promoted_at');

      // Merge staff data with profiles
      const usersWithStaffData = (profiles || []).map(profile => {
        const staffInfo = staffData?.find(s => s.id === profile.id);
        return {
          ...profile,
          employee_id: staffInfo?.employee_id || null,
          department: staffInfo?.department || null,
          can_confirm_payments: staffInfo?.can_confirm_payments || false,
          can_manage_bookings: staffInfo?.can_manage_bookings || false,
          promoted_at: staffInfo?.promoted_at || null
        };
      });

      setUsers(usersWithStaffData);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      alert("Failed to load services. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, newStatus, silent = false) => {
    try {
      // Get booking details first
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        if (!silent) alert("Booking not found");
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', bookingId);

      if (error) throw error;

      // Prepare notification message based on status
      let statusMessage = '';
      let notificationType = 'info';
      switch (newStatus) {
        case 'confirmed':
          statusMessage = `Your booking #${booking.order_id} has been confirmed! Please prepare your laundry for pickup.`;
          notificationType = 'success';
          break;
        case 'in_progress':
          statusMessage = `Your laundry for order #${booking.order_id} is now being processed.`;
          notificationType = 'info';
          break;
        case 'ready':
          statusMessage = `Your laundry for order #${booking.order_id} is ready for pickup/delivery!`;
          notificationType = 'success';
          break;
        case 'completed':
          statusMessage = `Your order #${booking.order_id} has been completed. Thank you for choosing Laundry Connect!`;
          notificationType = 'success';
          break;
        case 'cancelled':
          statusMessage = `Your booking #${booking.order_id} has been cancelled.`;
          notificationType = 'warning';
          break;
        default:
          statusMessage = `Your booking #${booking.order_id} status has been updated to ${newStatus}.`;
      }

      // Send notification to customer
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        title: `Booking ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace('_', ' ')}`,
        message: statusMessage,
        type: notificationType,
        related_booking_id: bookingId
      });

      // Send notification to all admins (except current user if admin)
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const adminNotifications = admins
          .filter(admin => admin.id !== userId) // Don't notify yourself
          .map(admin => ({
            user_id: admin.id,
            title: `Booking Status Updated`,
            message: `Order #${booking.order_id} status changed to "${newStatus}" by staff.`,
            type: 'info',
            related_booking_id: bookingId
          }));

        if (adminNotifications.length > 0) {
          await supabase.from('notifications').insert(adminNotifications);
        }
      }
      
      if (!silent) {
        alert(`Booking status updated to ${newStatus}`);
        fetchBookings();
      }
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      if (!silent) alert("Failed to update booking status");
    }
  };

  const declineBooking = async (bookingId, reason = '', silent = false) => {
    const declineReason = reason || (silent ? '' : prompt("Please provide a reason for declining this booking (optional):"));
    
    if (!silent && !confirm("Are you sure you want to decline this booking? The customer will be notified.")) return;

    try {
      // Get booking details
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        alert("Booking not found");
        return;
      }

      // Get current user info
      const userProfile = JSON.parse(localStorage.getItem('userProfile'));
      const declinedBy = userProfile?.name || userProfile?.email || 'Staff';

      // Update booking status to declined/cancelled
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          payment_status: 'refunded',
          notes: `Declined by ${declinedBy}. Reason: ${declineReason || 'No reason provided'}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      // Send notification to customer
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        title: 'Booking Declined',
        message: `Your booking #${booking.order_id} has been declined.${declineReason ? ` Reason: ${declineReason}` : ''} Please contact us for more information or try booking again.`,
        type: 'error',
        related_booking_id: bookingId
      });

      // Notify all admins about the decline
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const adminNotifications = admins
          .filter(admin => admin.id !== userId)
          .map(admin => ({
            user_id: admin.id,
            title: 'Booking Declined',
            message: `Order #${booking.order_id} was declined by ${declinedBy}.${declineReason ? ` Reason: ${declineReason}` : ''}`,
            type: 'warning',
            related_booking_id: bookingId
          }));

        if (adminNotifications.length > 0) {
          await supabase.from('notifications').insert(adminNotifications);
        }
      }

      if (!silent) {
        alert("Booking declined successfully. The customer has been notified.");
        fetchBookings();
      }
      
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
      }
    } catch (error) {
      console.error("Error declining booking:", error);
      if (!silent) alert("Failed to decline booking: " + error.message);
    }
  };

  const confirmPayment = async (bookingId, silent = false) => {
    if (!silent && !confirm("Confirm payment for this booking? This will mark the payment as paid and the user will see this update in their history.")) return;
    
    try {
      // Get booking details
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        alert("Booking not found");
        return;
      }

      const paymentId = `PMT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      
      // Get current user info for staff confirmation
      const userProfile = JSON.parse(localStorage.getItem('userProfile'));
      const confirmedBy = userProfile?.name || userProfile?.email || 'Staff';
      
      const { error } = await supabase
        .from('bookings')
        .update({ 
          payment_status: 'paid',
          payment_id: paymentId,
          payment_method: `Confirmed by ${confirmedBy}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (error) throw error;

      // Send notification to customer
      await supabase.from('notifications').insert({
        user_id: booking.user_id,
        title: 'Payment Confirmed!',
        message: `Your payment for order #${booking.order_id} has been confirmed. Amount: ₱${booking.total_price}. Thank you!`,
        type: 'success',
        related_booking_id: bookingId
      });

      // Send notification to all admins (except current user if admin)
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const adminNotifications = admins
          .filter(admin => admin.id !== userId)
          .map(admin => ({
            user_id: admin.id,
            title: 'Payment Confirmed',
            message: `Payment confirmed for order #${booking.order_id}. Amount: ₱${booking.total_price}. Confirmed by ${confirmedBy}.`,
            type: 'success',
            related_booking_id: bookingId
          }));

        if (adminNotifications.length > 0) {
          await supabase.from('notifications').insert(adminNotifications);
        }
      }
      
      if (!silent) {
        alert("Payment confirmed successfully! The user will see this update in their history.");
        fetchBookings();
      }
      
      // Update selected booking if it's the same one
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ 
          ...selectedBooking, 
          payment_status: 'paid',
          payment_id: paymentId,
          payment_method: `Confirmed by ${confirmedBy}`
        });
      }
    } catch (error) {
      console.error("Error confirming payment:", error);
      if (!silent) alert("Failed to confirm payment. Please try again.");
    }
  };

  // Open weigh modal for an order
  const openWeighModal = (order) => {
    setWeighingOrder(order);
    // Initialize weight inputs for each service
    const initialInputs = {};
    order.services.forEach((service, idx) => {
      initialInputs[idx] = {
        actualWeight: service.actual_weight || service.quantity || 1,
        pricePerUnit: service.pricePerUnit || parseFloat(service.services?.price || service.price || 0)
      };
    });
    setWeighInputs(initialInputs);
    setShowWeighModal(true);
  };

  // Calculate total for weighed items
  const calculateWeighedTotal = () => {
    let total = 0;
    Object.values(weighInputs).forEach(input => {
      total += (parseFloat(input.actualWeight) || 0) * (parseFloat(input.pricePerUnit) || 0);
    });
    return total;
  };

  // Save weighed items
  const saveWeighedItems = async () => {
    if (!weighingOrder) return;
    
    try {
      // Update each booking with actual weight and recalculated price
      for (let i = 0; i < weighingOrder.services.length; i++) {
        const service = weighingOrder.services[i];
        const input = weighInputs[i];
        const actualWeight = parseFloat(input?.actualWeight) || 1;
        const pricePerUnit = parseFloat(input?.pricePerUnit) || 0;
        const newTotalPrice = actualWeight * pricePerUnit;

        await supabase
          .from('bookings')
          .update({
            quantity: actualWeight,
            actual_weight: actualWeight,
            total_price: newTotalPrice,
            updated_at: new Date().toISOString()
          })
          .eq('id', service.id);
      }

      // Notify customer
      const totalAmount = calculateWeighedTotal();
      await supabase.from('notifications').insert({
        user_id: weighingOrder.user_id,
        title: 'Items Weighed - Ready for Payment',
        message: `Your laundry for order ${weighingOrder.baseOrderId} has been weighed. Total amount: ₱${totalAmount.toFixed(2)}. Please proceed with payment.`,
        type: 'info'
      });

      alert(`Items weighed successfully! Total: ₱${totalAmount.toFixed(2)}`);
      setShowWeighModal(false);
      setWeighingOrder(null);
      setWeighInputs({});
      fetchBookings();
    } catch (error) {
      console.error("Error saving weighed items:", error);
      alert("Failed to save weighed items. Please try again.");
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    // Only admins can delete users
    if (currentUserRole !== 'admin') {
      alert("Only admins can delete users");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      
      alert("User deleted successfully");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user");
    }
  };

  const promoteToStaff = async (targetUserId) => {
    if (!confirm("Promote this user to staff? Staff can manage bookings and view all orders.")) return;
    
    // Only admins can promote users
    if (currentUserRole !== 'admin') {
      alert("Only admins can promote users to staff");
      return;
    }
    
    try {
      // Generate unique employee ID (e.g., EMP-2024-0001)
      const year = new Date().getFullYear();
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('employee_id')
        .order('created_at', { ascending: false })
        .limit(1);
      
      let nextNumber = 1;
      if (existingStaff && existingStaff.length > 0 && existingStaff[0].employee_id) {
        const lastId = existingStaff[0].employee_id;
        const match = lastId.match(/EMP-\d{4}-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const employeeId = `EMP-${year}-${String(nextNumber).padStart(4, '0')}`;

      // 1. Update role in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'staff', updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (profileError) throw profileError;

      // 2. Remove from customers table (if exists)
      await supabase
        .from('customers')
        .delete()
        .eq('id', targetUserId);

      // 3. Insert into staff table with employee_id
      const { error: staffError } = await supabase
        .from('staff')
        .upsert({
          id: targetUserId,
          employee_id: employeeId,
          promoted_by: userId, // current admin's ID
          promoted_at: new Date().toISOString(),
          can_confirm_payments: true,
          can_manage_bookings: true,
          department: 'operations'
        }, { onConflict: 'id' });

      if (staffError) {
        console.error("Staff table insert error:", staffError);
        // Don't throw - the main promotion (profiles update) succeeded
      }

      // 4. Create notification for the promoted user
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          title: 'You have been promoted to Staff!',
          message: `Congratulations! Your Employee ID is ${employeeId}. You now have staff privileges to manage bookings and confirm payments.`,
          type: 'success'
        });
      
      alert("User promoted to staff successfully!");
      fetchUsers();
    } catch (error) {
      console.error("Error promoting user:", error);
      alert("Failed to promote user: " + error.message);
    }
  };

  const demoteToUser = async (targetUserId) => {
    if (!confirm("Demote this staff member to customer?")) return;
    
    // Only admins can demote staff
    if (currentUserRole !== 'admin') {
      alert("Only admins can demote staff");
      return;
    }
    
    try {
      // 1. Update role in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'customer', updated_at: new Date().toISOString() })
        .eq('id', targetUserId);

      if (profileError) throw profileError;

      // 2. Remove from staff table
      await supabase
        .from('staff')
        .delete()
        .eq('id', targetUserId);

      // 3. Insert into customers table
      const { error: customerError } = await supabase
        .from('customers')
        .upsert({
          id: targetUserId
        }, { onConflict: 'id' });

      if (customerError) {
        console.error("Customers table insert error:", customerError);
      }

      // 4. Create notification for the demoted user
      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          title: 'Role Changed',
          message: 'Your account role has been changed to customer.',
          type: 'info'
        });
      
      alert("Staff demoted to customer successfully!");
      fetchUsers();
    } catch (error) {
      console.error("Error demoting staff:", error);
      alert("Failed to demote staff: " + error.message);
    }
  };

  const toggleServiceStatus = async (serviceId, currentStatus) => {
    // Only admin can toggle service status
    if (currentUserRole !== 'admin') {
      alert("Only administrators can change service status");
      return;
    }

    try {
      const { error } = await supabase
        .from('services')
        .update({ is_active: !currentStatus })
        .eq('id', serviceId);

      if (error) throw error;
      
      alert(`Service ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchServices();
    } catch (error) {
      console.error("Error updating service:", error);
      alert("Failed to update service");
    }
  };

  // Service Management Functions
  const openAddServiceModal = () => {
    // Only admin can add services
    if (currentUserRole !== 'admin') {
      alert("Only administrators can add services");
      return;
    }
    setEditingService(null);
    setServiceForm({
      name: '',
      description: '',
      price: '',
      unit: 'per kg',
      is_active: true,
      is_popular: false,
      image_url: ''
    });
    setSelectedImage(null);
    setImagePreview(null);
    setShowServiceModal(true);
  };

  const openEditServiceModal = (service) => {
    // Only admin can edit services
    if (currentUserRole !== 'admin') {
      alert("Only administrators can edit services");
      return;
    }
    setEditingService(service);
    setServiceForm({
      name: service.name || '',
      description: service.description || '',
      price: service.price?.toString() || '',
      unit: service.unit || 'per kg',
      is_active: service.is_active ?? true,
      is_popular: service.is_popular ?? false,
      image_url: service.image_url || ''
    });
    setSelectedImage(null);
    setImagePreview(service.image_url || null);
    setShowServiceModal(true);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert("Please select an image file");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB");
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const uploadServiceImage = async (file) => {
    try {
      setUploadingImage(true);
      
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `service-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `services/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('service_images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('service_images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setServiceForm({ ...serviceForm, image_url: '' });
  };

  const handleServiceSubmit = async () => {
    // Only admin can add/edit services
    if (currentUserRole !== 'admin') {
      alert("Only administrators can add or edit services");
      return;
    }

    if (!serviceForm.name || !serviceForm.price) {
      alert("Please fill in service name and price");
      return;
    }

    try {
      let imageUrl = serviceForm.image_url;

      // Upload new image if selected
      if (selectedImage) {
        imageUrl = await uploadServiceImage(selectedImage);
      }

      if (editingService) {
        // Update existing service
        const { error } = await supabase
          .from('services')
          .update({
            name: serviceForm.name,
            description: serviceForm.description,
            price: parseFloat(serviceForm.price),
            unit: serviceForm.unit,
            is_active: serviceForm.is_active,
            is_popular: serviceForm.is_popular,
            image_url: imageUrl || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingService.id);

        if (error) throw error;
        alert("Service updated successfully!");
      } else {
        // Add new service
        const { error } = await supabase
          .from('services')
          .insert({
            name: serviceForm.name,
            description: serviceForm.description,
            price: parseFloat(serviceForm.price),
            unit: serviceForm.unit,
            is_active: serviceForm.is_active,
            is_popular: serviceForm.is_popular,
            image_url: imageUrl || null
          });

        if (error) throw error;
        alert("Service added successfully!");
      }

      setShowServiceModal(false);
      setSelectedImage(null);
      setImagePreview(null);
      fetchServices();
    } catch (error) {
      console.error("Error saving service:", error);
      alert("Failed to save service: " + error.message);
    }
  };

  const deleteService = async (serviceId, serviceName) => {
    // Only admin can delete services
    if (currentUserRole !== 'admin') {
      alert("Only administrators can delete services");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;
      
      alert("Service deleted successfully!");
      fetchServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      alert("Failed to delete service: " + error.message);
    }
  };

  const generateReceiptText = (b) => {
    const lines = [];
    lines.push('========================================');
    lines.push('         LAUNDRY CONNECT RECEIPT        ');
    lines.push('========================================');
    lines.push('');
    lines.push(`Order ID: ${b.order_id || b.baseOrderId || 'N/A'}`);
    if (b.payment_id) {
      lines.push(`Payment ID: ${b.payment_id}`);
    }
    lines.push(`Date: ${new Date().toLocaleDateString('en-US')}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('CUSTOMER INFORMATION');
    lines.push('----------------------------------------');
    lines.push(`Name: ${b.profiles?.name || b.customerName || 'N/A'}`);
    lines.push(`Email: ${b.profiles?.email || b.customerEmail || 'N/A'}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('PICKUP DETAILS');
    lines.push('----------------------------------------');
    lines.push(`Pickup Date: ${formatDate(b.pickup_date || b.pickupDate)}`);
    lines.push(`Pickup Time: ${formatTime(b.pickup_time || b.pickupTime)}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('SERVICES');
    lines.push('----------------------------------------');
    
    let subtotal = 0;
    
    // Handle grouped orders with multiple services
    if (b.allServices && b.allServices.length > 0) {
      b.allServices.forEach((service, idx) => {
        const weight = service.actual_weight || service.quantity || 1;
        const pricePerUnit = parseFloat(service.pricePerUnit || service.services?.price || service.price || 0);
        const unit = service.unit || service.services?.unit || 'per kg';
        const itemTotal = weight * pricePerUnit;
        subtotal += itemTotal;
        
        lines.push(`${idx + 1}. ${service.name}`);
        lines.push(`   ${weight} ${unit.replace('per ', '')} x ₱${pricePerUnit.toFixed(2)} = ₱${itemTotal.toFixed(2)}`);
      });
    } else if (b.services?.name) {
      // Single service booking
      const weight = b.actual_weight || b.quantity || 1;
      const pricePerUnit = parseFloat(b.services?.price || 0);
      const unit = b.services?.unit || 'per kg';
      const itemTotal = weight * pricePerUnit;
      subtotal = itemTotal;
      
      lines.push(`1. ${b.services.name}`);
      lines.push(`   ${weight} ${unit.replace('per ', '')} x ₱${pricePerUnit.toFixed(2)} = ₱${itemTotal.toFixed(2)}`);
    }
    
    lines.push('');
    lines.push('----------------------------------------');
    const totalAmount = parseFloat(b.total_price || b.totalPrice || subtotal || 0);
    lines.push(`SUBTOTAL:                    ₱${subtotal.toFixed(2)}`);
    lines.push(`TOTAL:                       ₱${totalAmount.toFixed(2)}`);
    lines.push('----------------------------------------');
    lines.push('');
    lines.push(`Payment Status: ${b.payment_status || 'unpaid'}`);
    lines.push(`Order Status: ${b.status || 'pending'}`);
    if (b.payment_method) {
      lines.push(`Payment Method: ${b.payment_method}`);
    }
    lines.push('');
    lines.push('========================================');
    lines.push('     Thank you for choosing us!        ');
    lines.push('         Laundry Connect               ');
    lines.push('========================================');
    return lines.join('\n');
  };

  const downloadReceipt = (booking) => {
    if (!booking) return;
    const text = generateReceiptText(booking);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${booking.order_id || 'receipt'}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US');
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hourStr, min] = timeStr.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-700",
      confirmed: "bg-blue-100 text-blue-700",
      in_progress: "bg-purple-100 text-purple-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100 text-gray-700"}`}>
        {status}
      </span>
    );
  };

  const getPaymentStatusBadge = (paymentStatus) => {
    if (!paymentStatus) return null;
    const colors = {
      paid: "bg-green-100 text-green-700",
      unpaid: "bg-orange-100 text-orange-700",
      refunded: "bg-gray-100 text-gray-700"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${colors[paymentStatus] || "bg-gray-100 text-gray-700"}`}>
        {paymentStatus}
      </span>
    );
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow hover:shadow-lg transition">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-gray-500 text-xs sm:text-sm mb-1 truncate">{label}</p>
          <p className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 truncate">{value}</p>
        </div>
        <div className={`p-2 sm:p-3 rounded-full ${color} flex-shrink-0`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col relative">
      {/* Header */}
      <div className="bg-white shadow-sm px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          <button onClick={() => navigate("/dashboard")} className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer touch-manipulation flex-shrink-0">
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
          </button>
          <h1 className="text-base sm:text-xl md:text-2xl font-bold text-blue-500 truncate">
            <span className="hidden sm:inline">
              {currentUserRole === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard'}
            </span>
            <span className="sm:hidden">
              {currentUserRole === 'admin' ? 'Admin' : 'Staff'}
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {userId && <Notifications userId={userId} />}
          {currentUserRole === 'staff' && (
            <span className="hidden sm:inline px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Staff Mode
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm px-4 py-3 flex gap-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", roles: ['admin', 'staff'] },
          { id: "bookings", label: "Bookings", roles: ['admin', 'staff'] },
          { id: "users", label: "Users", roles: ['admin'] },
          { id: "services", label: "Services", roles: ['admin', 'staff'] }
        ].filter(tab => tab.roles.includes(currentUserRole)).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full font-medium text-sm transition whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-3 sm:px-4 md:px-6 py-4 sm:py-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-blue-500 text-lg">Loading...</div>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Total Users" value={stats.totalUsers} color="bg-blue-500" />
                  <StatCard icon={ShoppingCart} label="Total Bookings" value={stats.totalBookings} color="bg-purple-500" />
                  <StatCard icon={TrendingUp} label="Total Revenue" value={`₱${stats.totalRevenue}`} color="bg-green-500" />
                  <StatCard icon={Clock} label="Pending Orders" value={stats.pendingOrders} color="bg-yellow-500" />
                </div>
              </div>
            )}

            {/* Bookings Tab */}
            {activeTab === "bookings" && (
              <div className="space-y-6">
                {/* Calendar View */}
                <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      <span className="hidden xs:inline">Booking Calendar</span>
                      <span className="xs:hidden">Calendar</span>
                    </h3>
                    <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <button
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                          className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg transition"
                        >
                          <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                        </button>
                        <span className="text-xs sm:text-sm font-medium text-gray-700 min-w-[100px] sm:min-w-[140px] text-center">
                          {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                          className="p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg transition"
                        >
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                        </button>
                      </div>
                      {selectedDate && (
                        <button
                          onClick={() => {
                            setSelectedDate(null);
                            fetchBookings(null);
                          }}
                          className="px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div key={idx} className="text-center text-[10px] sm:text-xs font-medium text-gray-500 py-1 sm:py-2">
                        <span className="sm:hidden">{day}</span>
                        <span className="hidden sm:inline">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][idx]}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {(() => {
                      const year = currentMonth.getFullYear();
                      const month = currentMonth.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const daysInMonth = lastDay.getDate();
                      const startingDayOfWeek = firstDay.getDay();
                      
                      const days = [];
                      
                      // Empty cells for days before the first day of the month
                      for (let i = 0; i < startingDayOfWeek; i++) {
                        days.push(null);
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dateBookings = bookingsByDate[dateStr] || [];
                        const isSelected = selectedDate === dateStr;
                        const isToday = dateStr === new Date().toISOString().split('T')[0];
                        
                        days.push(
                          <button
                            key={day}
                            onClick={() => {
                              setSelectedDate(dateStr);
                              fetchBookings(dateStr);
                            }}
                            className={`relative p-1 sm:p-2 rounded-md sm:rounded-lg transition text-xs sm:text-sm font-medium min-h-[32px] sm:min-h-[40px] ${
                              isSelected
                                ? 'bg-blue-500 text-white'
                                : isToday
                                ? 'bg-blue-100 text-blue-700'
                                : dateBookings.length > 0
                                ? 'bg-green-50 text-gray-700 hover:bg-green-100'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            {day}
                            {dateBookings.length > 0 && (
                              <span className={`absolute top-0 right-0 w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-green-500'
                              }`}></span>
                            )}
                            {dateBookings.length > 0 && (
                              <span className={`absolute -bottom-0.5 sm:-bottom-1 left-1/2 transform -translate-x-1/2 text-[6px] sm:text-[8px] ${
                                isSelected ? 'text-white' : 'text-green-600 font-bold'
                              }`}>
                                {dateBookings.length}
                              </span>
                            )}
                          </button>
                        );
                      }
                      
                      return days;
                    })()}
                  </div>
                  
                  {selectedDate && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        Showing bookings for: <strong>{new Date(selectedDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</strong>
                      </p>
                    </div>
                  )}
                </div>

                {/* Bookings List - Grouped by Order */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                    {selectedDate ? `Bookings for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'All Bookings'}
                    {groupedBookings.length > 0 && <span className="text-sm font-normal text-gray-500 ml-2">({groupedBookings.length} orders)</span>}
                  </h3>
                  {groupedBookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-6 sm:py-8 text-sm">No bookings {selectedDate ? 'for this date' : 'yet'}</p>
                  ) : (
                    groupedBookings.map(order => (
                      <div key={order.baseOrderId} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow hover:shadow-md transition">
                        <div className="flex flex-col gap-3 sm:gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                              <p className="font-semibold text-gray-800 text-sm sm:text-base">{order.baseOrderId}</p>
                              {order.services.length > 1 && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs font-medium">
                                  {order.services.length} services
                                </span>
                              )}
                              {getStatusBadge(order.status)}
                              {getPaymentStatusBadge(order.payment_status)}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600">Customer: {order.customerName}</p>
                            
                            {/* Services List */}
                            <div className="mt-2 space-y-1">
                              {order.services.map((service, idx) => {
                                const weight = service.actual_weight || service.quantity || 1;
                                const unit = service.unit || service.services?.unit || 'per kg';
                                const pricePerUnit = parseFloat(service.pricePerUnit || service.services?.price || 0);
                                const displayPrice = service.actual_weight ? (weight * pricePerUnit) : service.price;
                                
                                return (
                                <div key={idx} className="flex items-center justify-between text-xs sm:text-sm bg-gray-50 px-2 py-1.5 rounded group">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="text-gray-700 truncate">{service.name}</span>
                                    {service.actual_weight && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded whitespace-nowrap">
                                        {weight} {unit.replace('per ', '')}
                                      </span>
                                    )}
                                    {service.status === 'cancelled' && (
                                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">removed</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">₱{displayPrice.toFixed(2)}</span>
                                    {/* Delete individual service button */}
                                    {service.status !== 'cancelled' && service.status !== 'completed' && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (!confirm(`Remove "${service.name}" (₱${service.price.toFixed(2)}) from this order?`)) return;
                                          try {
                                            // Delete the individual booking
                                            const { error } = await supabase
                                              .from('bookings')
                                              .delete()
                                              .eq('id', service.id);
                                            
                                            if (error) throw error;
                                            
                                            // Notify customer
                                            await supabase.from('notifications').insert({
                                              user_id: order.user_id,
                                              title: 'Service Removed from Order',
                                              message: `"${service.name}" has been removed from your order ${order.baseOrderId}. Refund/adjustment will be processed.`,
                                              type: 'warning'
                                            });
                                            
                                            alert(`"${service.name}" removed from order`);
                                            fetchBookings();
                                          } catch (error) {
                                            console.error("Error removing service:", error);
                                            alert("Failed to remove service. Please try again.");
                                          }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-100 rounded transition"
                                        title={`Remove ${service.name}`}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                              })}
                            </div>
                            
                            <p className="text-xs sm:text-sm text-gray-600 mt-2">
                              Pickup: {formatDate(order.pickup_date)} at {formatTime(order.pickup_time)}
                            </p>
                            <p className="text-sm sm:text-base font-bold text-blue-600 mt-1">Total: ₱{order.totalPrice.toFixed(2)}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                            <button
                              onClick={() => setSelectedBooking({
                                ...order,
                                order_id: order.baseOrderId,
                                profiles: { name: order.customerName, email: order.customerEmail },
                                total_price: order.totalPrice,
                                allServices: order.services,
                                bookingIds: order.bookingIds,
                                user_id: order.user_id
                              })}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {/* Weigh Items Button */}
                            {(currentUserRole === 'staff' || currentUserRole === 'admin') && order.status !== 'cancelled' && order.status !== 'completed' && (
                              <button
                                onClick={() => openWeighModal(order)}
                                className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition cursor-pointer flex items-center gap-1 text-sm font-medium"
                                title="Weigh Items"
                              >
                                <Scale className="w-4 h-4" />
                                <span>Weigh</span>
                              </button>
                            )}
                            {/* Confirm All Payments */}
                            {(currentUserRole === 'staff' || currentUserRole === 'admin') && order.payment_status === 'unpaid' && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Confirm payment for all ${order.services.length} service(s)? Total: ₱${order.totalPrice.toFixed(2)}`)) return;
                                  for (const bookingId of order.bookingIds) {
                                    await confirmPayment(bookingId, true); // silent mode
                                  }
                                  alert("All payments confirmed successfully!");
                                  fetchBookings();
                                }}
                                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition cursor-pointer flex items-center gap-1 text-sm font-medium"
                                title="Confirm All Payments"
                              >
                                <CreditCard className="w-4 h-4" />
                                <span>Pay All</span>
                              </button>
                            )}
                            {/* Confirm All Bookings */}
                            {order.status === 'pending' && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Confirm all ${order.services.length} service(s) in this order?`)) return;
                                  for (const bookingId of order.bookingIds) {
                                    await updateBookingStatus(bookingId, 'confirmed', true); // silent mode
                                  }
                                  alert("All bookings confirmed!");
                                  fetchBookings();
                                }}
                                className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                                title="Confirm All"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {/* Start Processing All */}
                            {order.status === 'confirmed' && (
                              <button
                                onClick={async () => {
                                  for (const bookingId of order.bookingIds) {
                                    await updateBookingStatus(bookingId, 'in_progress', true); // silent mode
                                  }
                                  alert("Order is now in progress!");
                                  fetchBookings();
                                }}
                                className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition cursor-pointer"
                                title="Start Processing All"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                            {/* Complete All */}
                            {order.status === 'in_progress' && (
                              <button
                                onClick={async () => {
                                  for (const bookingId of order.bookingIds) {
                                    await updateBookingStatus(bookingId, 'completed', true); // silent mode
                                  }
                                  alert("Order completed successfully!");
                                  fetchBookings();
                                }}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                                title="Complete All"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {/* Decline All */}
                            {(order.status === 'pending' || order.status === 'confirmed') && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Decline all ${order.services.length} service(s) in this order?`)) return;
                                  const reason = prompt("Reason for declining (optional):");
                                  for (const bookingId of order.bookingIds) {
                                    await declineBooking(bookingId, reason || '', true); // silent mode
                                  }
                                  alert("All bookings declined. Customer has been notified.");
                                  fetchBookings();
                                }}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition cursor-pointer"
                                title="Decline All"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="space-y-4">
                {currentUserRole === 'admin' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Admin Actions:</strong> You can promote users to staff or demote staff to users. 
                      Only admins can delete users.
                    </p>
                  </div>
                )}
                {users.length === 0 ? (
                  <p className="text-center text-gray-500">No users yet</p>
                ) : (
                  users.map(user => (
                    <div key={user.id} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow hover:shadow-md transition">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-800 text-sm sm:text-base">{user.name || "No name"}</p>
                            {user.role === 'staff' && user.employee_id && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] sm:text-xs font-mono">
                                {user.employee_id}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 truncate">{user.email}</p>
                          
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2">
                            <span className={`inline-block px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                              user.role === 'admin' ? 'bg-red-100 text-red-700' : 
                              user.role === 'staff' ? 'bg-green-100 text-green-700' : 
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {user.role === 'customer' ? 'customer' : user.role}
                            </span>
                            {user.role === 'staff' && user.department && (
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] sm:text-xs">
                                {user.department}
                              </span>
                            )}
                          </div>

                          {/* Staff Permissions */}
                          {user.role === 'staff' && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {user.can_manage_bookings && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] sm:text-xs">
                                  <CheckCircle className="w-3 h-3" />
                                  Manage Bookings
                                </span>
                              )}
                              {user.can_confirm_payments && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded text-[10px] sm:text-xs">
                                  <CreditCard className="w-3 h-3" />
                                  Confirm Payments
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {currentUserRole === 'admin' && (
                            <>
                              {(user.role === 'user' || user.role === 'customer') && (
                                <button
                                  onClick={() => promoteToStaff(user.id)}
                                  className="p-1.5 sm:p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                                  title="Promote to Staff"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              {user.role === 'staff' && (
                                <button
                                  onClick={() => demoteToUser(user.id)}
                                  className="p-1.5 sm:p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition cursor-pointer"
                                  title="Demote to Customer"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => deleteUser(user.id)}
                                className="p-1.5 sm:p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition cursor-pointer"
                                title="Delete User"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Services Tab */}
            {activeTab === "services" && (
              <div className="space-y-3 sm:space-y-4">
                {/* Add Service Button */}
                <div className="flex justify-between items-center gap-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                    {currentUserRole === 'admin' ? 'Manage Services' : 'View Services'}
                  </h3>
                  {currentUserRole === 'admin' && (
                    <button
                      onClick={openAddServiceModal}
                      className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition cursor-pointer text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">Add Service</span>
                      <span className="sm:hidden">Add</span>
                    </button>
                  )}
                </div>

                {services.length === 0 ? (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow text-center">
                    <Package className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm sm:text-base">No services yet</p>
                    {currentUserRole === 'admin' && (
                      <p className="text-xs sm:text-sm text-gray-400 mt-1">Click "Add Service" to create your first service</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {services.map(service => (
                      <div key={service.id} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow hover:shadow-md transition">
                        <div className="flex gap-3">
                          {/* Service Image */}
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {service.image_url ? (
                              <img 
                                src={service.image_url} 
                                alt={service.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">{service.name}</p>
                              {service.is_popular && (
                                <span className="px-1.5 sm:px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px] sm:text-xs font-medium">Popular</span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">{service.description}</p>
                            <p className="text-xs sm:text-sm font-medium text-gray-800 mt-1">₱{service.price} {service.unit}</p>
                            <span className={`inline-block mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                              service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {service.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                        {/* Only show action buttons for admin */}
                        {currentUserRole === 'admin' && (
                          <div className="flex items-center justify-end gap-1.5 sm:gap-2 mt-3 pt-3 border-t border-gray-100">
                            {/* Edit Button */}
                            <button
                              onClick={() => openEditServiceModal(service)}
                              className="p-1.5 sm:p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                              title="Edit Service"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {/* Toggle Status Button */}
                            <button
                              onClick={() => toggleServiceStatus(service.id, service.is_active)}
                              className={`p-1.5 sm:p-2 rounded-lg transition cursor-pointer ${
                                service.is_active 
                                  ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200' 
                                  : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                              title={service.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {service.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                            </button>
                            {/* Delete Button */}
                            <button
                              onClick={() => deleteService(service.id, service.name)}
                              className="p-1.5 sm:p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition cursor-pointer"
                              title="Delete Service"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h2 className="text-xl font-bold text-blue-500 mb-4">Booking Details</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <p className="text-gray-500">Order ID:</p>
                <p className="font-semibold text-sm">{selectedBooking?.order_id || selectedBooking?.baseOrderId || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Customer:</p>
                <p className="font-semibold">{selectedBooking?.profiles?.name || selectedBooking?.customerName || selectedBooking?.profiles?.email || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Email:</p>
                <p className="font-semibold text-sm">{selectedBooking?.profiles?.email || selectedBooking?.customerEmail || "N/A"}</p>
              </div>
              
              {/* Services List */}
              <div className="border-t pt-3">
                <p className="text-gray-500 mb-2">Services ({selectedBooking?.allServices?.length || (selectedBooking?.services?.name ? 1 : 0)}):</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedBooking?.allServices && selectedBooking.allServices.length > 0 ? (
                    selectedBooking.allServices.map((service, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded group">
                        <div>
                          <p className="font-medium text-gray-800">{service.name}</p>
                          <p className="text-xs text-gray-500">Qty: {service.quantity || 1} {service.unit || ''}</p>
                        </div>
                        <p className="font-semibold">₱{parseFloat(service.price || 0).toFixed(2)}</p>
                      </div>
                    ))
                  ) : selectedBooking?.services?.name ? (
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                      <div>
                        <p className="font-medium text-gray-800">{selectedBooking.services.name}</p>
                        <p className="text-xs text-gray-500">Qty: {selectedBooking.quantity || 1}</p>
                      </div>
                      <p className="font-semibold">₱{parseFloat(selectedBooking.total_price || 0).toFixed(2)}</p>
                    </div>
                  ) : (
                    <p className="text-gray-400 italic">No services found</p>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Date:</p>
                <p className="font-semibold">{selectedBooking?.pickup_date ? formatDate(selectedBooking.pickup_date) : selectedBooking?.pickupDate ? formatDate(selectedBooking.pickupDate) : "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Time:</p>
                <p className="font-semibold">{selectedBooking?.pickup_time ? formatTime(selectedBooking.pickup_time) : selectedBooking?.pickupTime ? formatTime(selectedBooking.pickupTime) : "N/A"}</p>
              </div>
              {selectedBooking?.payment_method && (
                <div className="flex justify-between">
                  <p className="text-gray-500">Payment Method:</p>
                  <p className="font-semibold">{selectedBooking.payment_method}</p>
                </div>
              )}
              {selectedBooking?.payment_id && (
                <div className="flex justify-between">
                  <p className="text-gray-500">Payment ID:</p>
                  <p className="font-semibold">{selectedBooking.payment_id}</p>
                </div>
              )}
              <div className="flex justify-between">
                <p className="text-gray-500">Payment Status:</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedBooking?.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                  selectedBooking?.payment_status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedBooking?.payment_status || "unpaid"}
                </span>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Status:</p>
                {getStatusBadge(selectedBooking?.status)}
              </div>
              <div className="flex justify-between border-t pt-3">
                <p className="text-gray-500 font-medium">Total:</p>
                <p className="font-semibold text-lg text-blue-600">₱{parseFloat(selectedBooking?.total_price || selectedBooking?.totalPrice || 0).toFixed(2)}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                {selectedBooking?.payment_status === 'unpaid' && selectedBooking?.status !== 'cancelled' && (
                  <button
                    onClick={async () => {
                      if (!confirm("Confirm payment for this order?")) return;
                      // Handle grouped orders (multiple bookingIds) or single booking (id)
                      if (selectedBooking?.bookingIds && selectedBooking.bookingIds.length > 0) {
                        for (const bookingId of selectedBooking.bookingIds) {
                          await confirmPayment(bookingId, true); // silent mode
                        }
                        alert("All payments confirmed!");
                        fetchBookings();
                      } else if (selectedBooking?.id) {
                        await confirmPayment(selectedBooking.id);
                      }
                      setSelectedBooking(null);
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Confirm Payment
                  </button>
                )}
                {(selectedBooking?.status === 'pending' || selectedBooking?.status === 'confirmed') && (
                  <button
                    onClick={async () => {
                      // Handle grouped orders (multiple bookingIds) or single booking (id)
                      if (selectedBooking?.bookingIds && selectedBooking.bookingIds.length > 0) {
                        if (!confirm(`Decline all ${selectedBooking.bookingIds.length} service(s) in this order?`)) return;
                        const reason = prompt("Reason for declining (optional):");
                        for (const bookingId of selectedBooking.bookingIds) {
                          await declineBooking(bookingId, reason || '', true); // silent mode
                        }
                        alert("All bookings declined!");
                        fetchBookings();
                        setSelectedBooking(null);
                      } else if (selectedBooking?.id) {
                        declineBooking(selectedBooking.id);
                        setSelectedBooking(null);
                      }
                    }}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Decline
                  </button>
                )}
                {/* Weigh Button in Modal */}
                {selectedBooking?.status !== 'cancelled' && selectedBooking?.status !== 'completed' && (
                  <button
                    onClick={() => {
                      if (selectedBooking?.allServices) {
                        openWeighModal({
                          ...selectedBooking,
                          baseOrderId: selectedBooking.order_id,
                          services: selectedBooking.allServices
                        });
                        setSelectedBooking(null);
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition flex items-center gap-2"
                  >
                    <Scale className="w-4 h-4" />
                    Weigh
                  </button>
                )}
                <button
                  onClick={() => selectedBooking && downloadReceipt(selectedBooking)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Download Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weigh Items Modal */}
      {showWeighModal && weighingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full relative shadow-lg max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => {
                setShowWeighModal(false);
                setWeighingOrder(null);
                setWeighInputs({});
              }} 
              className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <Scale className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Weigh Items</h2>
                <p className="text-sm text-gray-500">Order: {weighingOrder.baseOrderId}</p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                <strong>Customer:</strong> {weighingOrder.customerName}
              </p>
              <p className="text-xs text-blue-600">{weighingOrder.customerEmail}</p>
            </div>

            <div className="space-y-4">
              {weighingOrder.services.map((service, idx) => {
                const unit = service.unit || service.services?.unit || 'per kg';
                const pricePerUnit = weighInputs[idx]?.pricePerUnit || parseFloat(service.services?.price || service.price || 0);
                const actualWeight = weighInputs[idx]?.actualWeight || service.quantity || 1;
                const itemTotal = actualWeight * pricePerUnit;
                const isKgService = unit.includes('kg');
                
                return (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-800">{service.name}</h3>
                        <p className="text-sm text-gray-500">₱{pricePerUnit.toFixed(2)} / {unit.replace('per ', '')}</p>
                      </div>
                      {service.status === 'cancelled' && (
                        <span className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded">Cancelled</span>
                      )}
                    </div>
                    
                    {service.status !== 'cancelled' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            {isKgService ? 'Actual Weight (kg)' : 'Quantity'}
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={actualWeight}
                            onChange={(e) => setWeighInputs(prev => ({
                              ...prev,
                              [idx]: { ...prev[idx], actualWeight: e.target.value, pricePerUnit }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Item Total</label>
                          <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-700">
                            ₱{itemTotal.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total Section */}
            <div className="mt-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-4 text-white">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Amount</span>
                <span className="text-2xl font-bold">₱{calculateWeighedTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowWeighModal(false);
                  setWeighingOrder(null);
                  setWeighInputs({});
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={saveWeighedItems}
                className="flex-1 py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition flex items-center justify-center gap-2"
              >
                <Scale className="w-4 h-4" />
                Save & Notify Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Add/Edit Modal */}
      {showServiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button 
              onClick={() => setShowServiceModal(false)} 
              className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold text-blue-500 mb-4">
              {editingService ? 'Edit Service' : 'Add New Service'}
            </h2>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Service Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Image</label>
                <div className="flex items-start gap-4">
                  {/* Image Preview */}
                  <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-dashed border-gray-300">
                    {imagePreview ? (
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                      id="service-image-upload"
                      disabled={uploadingImage}
                    />
                    <label
                      htmlFor="service-image-upload"
                      className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition cursor-pointer text-sm"
                    >
                      {uploadingImage ? 'Uploading...' : 'Choose Image'}
                    </label>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={removeImage}
                        className="ml-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Remove
                      </button>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Max 5MB, JPG/PNG</p>
                  </div>
                </div>
              </div>

              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input
                  type="text"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                  placeholder="e.g., Wash, Dry, Fold"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                  placeholder="Brief description of the service"
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Price and Unit */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱) *</label>
                  <input
                    type="number"
                    value={serviceForm.price}
                    onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={serviceForm.unit}
                    onChange={(e) => setServiceForm({ ...serviceForm, unit: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="per kg">per kg</option>
                    <option value="per pc">per pc</option>
                    <option value="per load">per load</option>
                    <option value="per set">per set</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_active}
                    onChange={(e) => setServiceForm({ ...serviceForm, is_active: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_popular}
                    onChange={(e) => setServiceForm({ ...serviceForm, is_popular: e.target.checked })}
                    className="w-4 h-4 text-blue-500 rounded"
                  />
                  <span className="text-sm text-gray-700">Mark as Popular</span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowServiceModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleServiceSubmit}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  {editingService ? 'Update Service' : 'Add Service'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}