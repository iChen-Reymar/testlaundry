import React, { useState, useEffect } from "react";
import { ChevronLeft, Users, Package, ShoppingCart, TrendingUp, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, CreditCard, Calendar, ChevronRight, ChevronLeft as ChevronLeftIcon, Plus } from "lucide-react";
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

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      // Get booking details first
      const booking = bookings.find(b => b.id === bookingId);
      if (!booking) {
        alert("Booking not found");
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
      
      alert(`Booking status updated to ${newStatus}`);
      fetchBookings();
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: newStatus });
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Failed to update booking status");
    }
  };

  const declineBooking = async (bookingId, reason = '') => {
    const declineReason = reason || prompt("Please provide a reason for declining this booking (optional):");
    
    if (!confirm("Are you sure you want to decline this booking? The customer will be notified.")) return;

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

      alert("Booking declined successfully. The customer has been notified.");
      fetchBookings();
      
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
      }
    } catch (error) {
      console.error("Error declining booking:", error);
      alert("Failed to decline booking: " + error.message);
    }
  };

  const confirmPayment = async (bookingId) => {
    if (!confirm("Confirm payment for this booking? This will mark the payment as paid and the user will see this update in their history.")) return;
    
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
      
      alert("Payment confirmed successfully! The user will see this update in their history.");
      fetchBookings();
      
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
      alert("Failed to confirm payment. Please try again.");
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
    lines.push('Laundry Connect - Receipt');
    lines.push('---------------------------------');
    lines.push(`Order ID: ${b.order_id}`);
    if (b.payment_id) {
      lines.push(`Payment ID: ${b.payment_id}`);
    }
    lines.push(`Customer: ${b.profiles?.name || 'N/A'}`);
    lines.push(`Email: ${b.profiles?.email || 'N/A'}`);
    lines.push(`Service: ${b.services?.name || 'N/A'}`);
    lines.push(`Quantity: ${b.quantity || 1}`);
    lines.push(`Pickup: ${formatDate(b.pickup_date)} ${formatTime(b.pickup_time)}`);
    lines.push(`Payment Method: ${b.payment_method || 'N/A'}`);
    if (b.payment_status) {
      lines.push(`Payment Status: ${b.payment_status}`);
    }
    lines.push(`Status: ${b.status}`);
    lines.push('');
    lines.push(`Total: ₱${b.total_price}`);
    lines.push('');
    lines.push('Thank you for choosing Laundry Connect.');
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

                {/* Bookings List */}
                <div className="space-y-3 sm:space-y-4">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">
                    {selectedDate ? `Bookings for ${new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'All Bookings'}
                  </h3>
                  {bookings.length === 0 ? (
                    <p className="text-center text-gray-500 py-6 sm:py-8 text-sm">No bookings {selectedDate ? 'for this date' : 'yet'}</p>
                  ) : (
                    bookings.map(booking => (
                      <div key={booking.id} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow hover:shadow-md transition">
                        <div className="flex flex-col gap-3 sm:gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2">
                              <p className="font-semibold text-gray-800 text-sm sm:text-base">{booking.order_id}</p>
                              {getStatusBadge(booking.status)}
                              {getPaymentStatusBadge(booking.payment_status)}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600">Customer: {booking.profiles?.name || "N/A"}</p>
                            <p className="text-xs sm:text-sm text-gray-600">Service: {booking.services?.name || "N/A"}</p>
                            <p className="text-xs sm:text-sm text-gray-600">
                              Pickup: {formatDate(booking.pickup_date)} at {formatTime(booking.pickup_time)}
                            </p>
                            <p className="text-xs sm:text-sm font-medium text-gray-800 mt-1">Total: ₱{booking.total_price}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setSelectedBooking(booking)}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {/* Staff: Confirm Payment Button */}
                            {(currentUserRole === 'staff' || currentUserRole === 'admin') && booking.payment_status === 'unpaid' && (
                              <button
                                onClick={() => confirmPayment(booking.id)}
                                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition cursor-pointer flex items-center gap-1 text-sm font-medium"
                                title="Confirm Payment"
                              >
                                <CreditCard className="w-4 h-4" />
                                <span>Pay</span>
                              </button>
                            )}
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                                title="Confirm Booking"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'in_progress')}
                                className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition cursor-pointer"
                                title="Start Processing"
                              >
                                <Clock className="w-4 h-4" />
                              </button>
                            )}
                            {booking.status === 'in_progress' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'completed')}
                                className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                                title="Mark as Completed"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {/* Decline Button - for pending or confirmed bookings */}
                            {(booking.status === 'pending' || booking.status === 'confirmed') && (
                              <button
                                onClick={() => declineBooking(booking.id)}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition cursor-pointer"
                                title="Decline Booking"
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
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Manage Services</h3>
                  <button
                    onClick={openAddServiceModal}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition cursor-pointer text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Service</span>
                    <span className="sm:hidden">Add</span>
                  </button>
                </div>

                {services.length === 0 ? (
                  <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 shadow text-center">
                    <Package className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm sm:text-base">No services yet</p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1">Click "Add Service" to create your first service</p>
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
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h2 className="text-xl font-bold text-blue-500 mb-4">Booking Details</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <p className="text-gray-500">Order ID:</p>
                <p className="font-semibold">{selectedBooking?.order_id || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Customer:</p>
                <p className="font-semibold">{selectedBooking?.profiles?.name || selectedBooking?.profiles?.email || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Email:</p>
                <p className="font-semibold text-sm">{selectedBooking?.profiles?.email || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Service:</p>
                <p className="font-semibold">{selectedBooking?.services?.name || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Quantity:</p>
                <p className="font-semibold">{selectedBooking?.quantity || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Date:</p>
                <p className="font-semibold">{selectedBooking?.pickup_date ? formatDate(selectedBooking.pickup_date) : "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Time:</p>
                <p className="font-semibold">{selectedBooking?.pickup_time ? formatTime(selectedBooking.pickup_time) : "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Payment Method:</p>
                <p className="font-semibold">{selectedBooking?.payment_method || "N/A"}</p>
              </div>
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
                  {selectedBooking?.payment_status || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Status:</p>
                {getStatusBadge(selectedBooking?.status)}
              </div>
              <div className="flex justify-between border-t pt-3">
                <p className="text-gray-500 font-medium">Total:</p>
                <p className="font-semibold text-lg">₱{selectedBooking?.total_price || "0.00"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 justify-end">
                {selectedBooking?.payment_status === 'unpaid' && selectedBooking?.status !== 'cancelled' && (
                  <button
                    onClick={() => selectedBooking?.id && confirmPayment(selectedBooking.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    Confirm Payment
                  </button>
                )}
                {(selectedBooking?.status === 'pending' || selectedBooking?.status === 'confirmed') && (
                  <button
                    onClick={() => {
                      if (selectedBooking?.id) {
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