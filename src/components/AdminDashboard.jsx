import React, { useState, useEffect } from "react";
import { ChevronLeft, Users, Package, ShoppingCart, TrendingUp, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, CreditCard, Calendar, ChevronRight, ChevronLeft as ChevronLeftIcon, Plus, Scale, Search, MessageSquare, Send, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient.js";
import Notifications from "./Notifications";
import UserProfilePanel from "./UserProfilePanel";

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
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [messageUser, setMessageUser] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [profileViewUser, setProfileViewUser] = useState(null);
  const [profileDetails, setProfileDetails] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [messageProfileDetails, setMessageProfileDetails] = useState(null);

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
    if (activeTab === "bookings") fetchBookings();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "services") fetchServices();
  }, [activeTab]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await api.auth.getSession();
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

  const checkAdmin = async () => {
    try {
      const { data: { user } } = await api.auth.getUser();
      if (!user) {
        navigate("/dashboard");
        return;
      }

      setCurrentUserRole(user.role || 'user');
      setUserId(user.id || null);

      if (user.role !== 'admin' && user.role !== 'staff') {
        alert("Access denied. Admin or Staff only.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Admin check error:", error);
      navigate("/dashboard");
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { userCount, bookings: allBookings } = await api.stats.get();

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

  const fetchBookings = async (filterDate) => {
    const effectiveFilter = filterDate === undefined ? selectedDate : filterDate;
    setLoading(true);
    try {
      const allBookingsSummary = await api.bookings.list();

      const grouped = {};
      (allBookingsSummary || []).forEach(booking => {
        if (booking.pickup_date) {
          const dateKey = booking.pickup_date;
          if (!grouped[dateKey]) {
            grouped[dateKey] = [];
          }
          grouped[dateKey].push(booking);
        }
      });
      setBookingsByDate(grouped);

      let data = allBookingsSummary || [];
      if (effectiveFilter) {
        data = data.filter(b => b.pickup_date === effectiveFilter);
      }

      data.sort((a, b) => {
        const dateCompare = new Date(a.pickup_date) - new Date(b.pickup_date);
        if (dateCompare !== 0) return dateCompare;
        return (a.pickup_time || '').localeCompare(b.pickup_time || '');
      });

      setBookings(data);

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
      const profiles = await api.profiles.getAll();
      setUsers(profiles || []);
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
      const data = await api.services.list();
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

      await api.bookings.update(bookingId, { status: newStatus });

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

      await api.notifications.create({
        user_id: booking.user_id,
        title: `Booking ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace('_', ' ')}`,
        message: statusMessage,
        type: notificationType,
        related_booking_id: bookingId
      });

      const admins = await api.profiles.byRole(['admin']);

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
          await api.notifications.create(adminNotifications);
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

  const sendRatingRequest = async (order) => {
    try {
      const firstBookingId = order.bookingIds?.[0] || order.services?.[0]?.id;
      const baseOrderId = order.baseOrderId || order.order_id;

      await api.notifications.create({
        user_id: order.user_id,
        title: 'Rate Your Experience',
        message: `Your order #${baseOrderId} is complete! Tap here to rate your experience in Order History.`,
        type: 'info',
        related_booking_id: firstBookingId,
      });

      await api.messages.send(
        order.user_id,
        `Hi! Your order #${baseOrderId} has been completed. We'd love your feedback — please go to Order History and rate your experience (1–5 stars). Thank you for choosing Laundry Connect!`
      );
    } catch (error) {
      console.error('Failed to send rating request:', error);
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
      await api.bookings.update(bookingId, {
        status: 'cancelled',
        payment_status: 'refunded',
        notes: `Declined by ${declinedBy}. Reason: ${declineReason || 'No reason provided'}`
      });

      await api.notifications.create({
        user_id: booking.user_id,
        title: 'Booking Declined',
        message: `Your booking #${booking.order_id} has been declined.${declineReason ? ` Reason: ${declineReason}` : ''} Please contact us for more information or try booking again.`,
        type: 'error',
        related_booking_id: bookingId
      });

      const admins = await api.profiles.byRole(['admin']);

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
          await api.notifications.create(adminNotifications);
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
      
      await api.bookings.update(bookingId, {
        payment_status: 'paid',
        payment_id: paymentId,
        payment_method: `Confirmed by ${confirmedBy}`
      });

      await api.notifications.create({
        user_id: booking.user_id,
        title: 'Payment Confirmed!',
        message: `Your payment for order #${booking.order_id} has been confirmed. Amount: ₱${booking.total_price}. Thank you!`,
        type: 'success',
        related_booking_id: bookingId
      });

      const admins = await api.profiles.byRole(['admin']);

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
          await api.notifications.create(adminNotifications);
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

        await api.bookings.update(service.id, {
          quantity: actualWeight,
          actual_weight: actualWeight,
          total_price: newTotalPrice
        });
      }

      const totalAmount = calculateWeighedTotal();
      await api.notifications.create({
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
      await api.profiles.delete(userId);
      
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
      const { employeeId } = await api.staff.promote(targetUserId);

      await api.notifications.create({
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

  const sendMessageToUser = async () => {
    if (!messageUser || !messageText.trim()) {
      alert('Please enter a message');
      return;
    }

    setSendingMessage(true);
    try {
      await api.messages.send(messageUser.id, messageText.trim());

      alert(`Message sent to ${messageUser.name || messageUser.email}`);
      setMessageUser(null);
      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!userSearchQuery.trim()) return true;
    const query = userSearchQuery.toLowerCase();
    return (
      (user.name || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query) ||
      (user.role || '').toLowerCase().includes(query) ||
      (user.employee_id || '').toLowerCase().includes(query)
    );
  });

  const openMessageModal = async (user, e) => {
    e?.stopPropagation();
    if (user.id === userId) {
      alert('You cannot message yourself.');
      return;
    }
    setMessageUser(user);
    setMessageText('');
    setMessageProfileDetails(null);

    if (currentUserRole === 'admin' || currentUserRole === 'staff') {
      setLoadingProfile(true);
      try {
        const details = await api.users.getProfile(user.id);
        setMessageProfileDetails(details);
      } catch (error) {
        console.error('Error loading profile for message:', error);
      } finally {
        setLoadingProfile(false);
      }
    }
  };

  const openUserProfile = async (user) => {
    if (currentUserRole !== 'admin' && currentUserRole !== 'staff') return;

    setProfileViewUser(user);
    setProfileDetails(null);
    setLoadingProfile(true);
    try {
      const details = await api.users.getProfile(user.id);
      setProfileDetails(details);
    } catch (error) {
      console.error('Error loading user profile:', error);
      alert('Failed to load user profile.');
      setProfileViewUser(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const canViewUserProfiles = currentUserRole === 'admin' || currentUserRole === 'staff';
  const isStaffViewOnly = currentUserRole === 'staff';

  const demoteToUser = async (targetUserId) => {
    if (!confirm("Demote this staff member to customer?")) return;
    
    // Only admins can demote staff
    if (currentUserRole !== 'admin') {
      alert("Only admins can demote staff");
      return;
    }
    
    try {
      await api.staff.demote(targetUserId);

      await api.notifications.create({
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
    if (currentUserRole !== 'admin') {
      alert("Only administrators can change service status");
      return;
    }

    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      alert("Service not found");
      return;
    }

    try {
      await api.services.update(serviceId, { is_active: !currentStatus });
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
      const { url } = await api.uploads.service(file);
      return url;
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
        await api.services.update(editingService.id, {
          name: serviceForm.name,
          description: serviceForm.description,
          price: parseFloat(serviceForm.price),
          unit: serviceForm.unit,
          is_active: serviceForm.is_active,
          is_popular: serviceForm.is_popular,
          image_url: imageUrl || null
        });
        alert("Service updated successfully!");
      } else {
        await api.services.create({
          name: serviceForm.name,
          description: serviceForm.description,
          price: parseFloat(serviceForm.price),
          unit: serviceForm.unit,
          is_active: serviceForm.is_active,
          is_popular: serviceForm.is_popular,
          image_url: imageUrl || null
        });
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
      await api.services.delete(serviceId);
      
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

  const orderActionBtn = "px-2 py-1 h-8 !min-h-8 !min-w-0 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1 transition cursor-pointer touch-manipulation";
  const orderActionIcon = "w-3.5 h-3.5 shrink-0";

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col overflow-x-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30 safe-area-top border-b border-gray-100">
        <div className="page-container py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button onClick={() => navigate("/dashboard")} className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer touch-manipulation flex-shrink-0">
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-bold text-blue-500 truncate">
                {currentUserRole === 'admin' ? 'Admin Dashboard' : 'Staff Dashboard'}
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate hidden sm:block">
                Manage bookings, users, and services
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={() => navigate("/messages")}
              className="relative p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition touch-manipulation"
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </button>
            {userId && <Notifications userId={userId} />}
            {currentUserRole === 'staff' && (
              <span className="hidden md:inline px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">
                Staff Mode
              </span>
            )}
            {currentUserRole === 'admin' && (
              <span className="hidden md:inline px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium whitespace-nowrap">
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-[52px] sm:top-[60px] md:top-[68px] z-20">
        <div className="page-container py-2 sm:py-3">
          <div className="admin-tab-grid">
        {[
          { id: "overview", label: "Overview", roles: ['admin', 'staff'] },
          { id: "bookings", label: "Bookings", roles: ['admin', 'staff'] },
          { id: "users", label: "Users", roles: ['admin', 'staff'] },
          { id: "services", label: "Services", roles: ['admin', 'staff'] }
        ].filter(tab => tab.roles.includes(currentUserRole)).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-full font-medium text-sm transition whitespace-nowrap cursor-pointer touch-manipulation text-center ${
              activeTab === tab.id
                ? "bg-blue-500 text-white shadow-sm"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 page-container py-4 sm:py-6 pb-8 safe-area-bottom w-full">
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
                                            await api.bookings.delete(service.id);

                                            await api.notifications.create({
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
                                        className="p-1.5 text-red-500 hover:bg-red-100 rounded transition sm:opacity-0 sm:group-hover:opacity-100 touch-manipulation"
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
                          
                          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 pt-2 border-t border-gray-100">
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
                              className={`${orderActionBtn} bg-blue-100 text-blue-600 hover:bg-blue-200`}
                              title="View Details"
                            >
                              <Eye className={orderActionIcon} />
                              <span className="sm:hidden">View</span>
                            </button>
                            {/* Weigh Items Button */}
                            {(currentUserRole === 'staff' || currentUserRole === 'admin') && order.status !== 'cancelled' && order.status !== 'completed' && (
                              <button
                                onClick={() => openWeighModal(order)}
                                className={`${orderActionBtn} bg-amber-500 text-white hover:bg-amber-600`}
                                title="Weigh Items"
                              >
                                <Scale className={orderActionIcon} />
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
                                className={`${orderActionBtn} bg-green-500 text-white hover:bg-green-600`}
                                title="Confirm All Payments"
                              >
                                <CreditCard className={orderActionIcon} />
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
                                className={`${orderActionBtn} bg-green-100 text-green-600 hover:bg-green-200`}
                                title="Confirm All"
                              >
                                <CheckCircle className={orderActionIcon} />
                                <span className="sm:hidden">Confirm</span>
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
                                className={`${orderActionBtn} bg-purple-100 text-purple-600 hover:bg-purple-200`}
                                title="Start Processing All"
                              >
                                <Clock className={orderActionIcon} />
                                <span className="sm:hidden">Start</span>
                              </button>
                            )}
                            {/* Complete All */}
                            {order.status === 'in_progress' && (
                              <button
                                onClick={async () => {
                                  for (const bookingId of order.bookingIds) {
                                    await updateBookingStatus(bookingId, 'completed', true);
                                  }
                                  await sendRatingRequest(order);
                                  alert("Order completed successfully!");
                                  fetchBookings();
                                }}
                                className={`${orderActionBtn} bg-blue-100 text-blue-600 hover:bg-blue-200`}
                                title="Complete All"
                              >
                                <CheckCircle className={orderActionIcon} />
                                <span className="sm:hidden">Done</span>
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
                                className={`${orderActionBtn} bg-red-100 text-red-600 hover:bg-red-200`}
                                title="Decline All"
                              >
                                <XCircle className={orderActionIcon} />
                                <span className="sm:hidden">Decline</span>
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
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Admin Actions:</strong> Click a user to view profile. Search, message, promote to staff, or delete users.
                    </p>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by name, email, or role..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {users.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No users yet</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No users match your search</p>
                ) : (
                  filteredUsers.map(user => (
                    <div
                      key={user.id}
                      role={canViewUserProfiles ? 'button' : undefined}
                      tabIndex={canViewUserProfiles ? 0 : undefined}
                      onClick={() => openUserProfile(user)}
                      onKeyDown={(e) => {
                        if (canViewUserProfiles && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          openUserProfile(user);
                        }
                      }}
                      className={`bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow hover:shadow-md transition ${
                        canViewUserProfiles ? 'cursor-pointer hover:ring-2 hover:ring-blue-100' : ''
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:justify-between">
                        <div className="flex gap-3 flex-1 min-w-0">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden border border-blue-50">
                            {user.profile_image ? (
                              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            )}
                          </div>
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
                        </div>
                        <div
                          className="flex flex-wrap items-center gap-2 self-stretch sm:self-center justify-end sm:justify-start w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:border-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {user.id !== userId && (
                            <button
                              onClick={(e) => openMessageModal(user, e)}
                              className="p-1.5 sm:p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer touch-manipulation"
                              title="Message User"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                          {currentUserRole === 'admin' && (
                            <>
                              {(user.role === 'user' || user.role === 'customer') && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); promoteToStaff(user.id); }}
                                  className="p-1.5 sm:p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                                  title="Promote to Staff"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              {user.role === 'staff' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); demoteToUser(user.id); }}
                                  className="p-1.5 sm:p-2 bg-yellow-100 text-yellow-600 rounded-lg hover:bg-yellow-200 transition cursor-pointer"
                                  title="Demote to Customer"
                                >
                                  <Users className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteUser(user.id); }}
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
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel sm:max-w-md p-4 sm:p-6 relative animate-slideUp">
            <button onClick={() => setSelectedBooking(null)} className="absolute top-3 right-3 p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg font-bold cursor-pointer touch-manipulation">✕</button>
            <h2 className="text-lg sm:text-xl font-bold text-blue-500 mb-4 pr-8">Booking Details</h2>
            
            <div className="space-y-3">
              <div className="detail-row">
                <p className="text-gray-500 text-sm">Order ID:</p>
                <p className="font-semibold text-sm break-all text-right sm:text-left">{selectedBooking?.order_id || selectedBooking?.baseOrderId || "N/A"}</p>
              </div>
              <div className="detail-row">
                <p className="text-gray-500 text-sm">Customer:</p>
                <p className="font-semibold text-sm">{selectedBooking?.profiles?.name || selectedBooking?.customerName || selectedBooking?.profiles?.email || "N/A"}</p>
              </div>
              <div className="detail-row">
                <p className="text-gray-500 text-sm">Email:</p>
                <p className="font-semibold text-sm break-all">{selectedBooking?.profiles?.email || selectedBooking?.customerEmail || "N/A"}</p>
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

              <div className="detail-row">
                <p className="text-gray-500 text-sm">Pickup Date:</p>
                <p className="font-semibold text-sm">{selectedBooking?.pickup_date ? formatDate(selectedBooking.pickup_date) : selectedBooking?.pickupDate ? formatDate(selectedBooking.pickupDate) : "N/A"}</p>
              </div>
              <div className="detail-row">
                <p className="text-gray-500 text-sm">Pickup Time:</p>
                <p className="font-semibold text-sm">{selectedBooking?.pickup_time ? formatTime(selectedBooking.pickup_time) : selectedBooking?.pickupTime ? formatTime(selectedBooking.pickupTime) : "N/A"}</p>
              </div>
              {selectedBooking?.payment_method && (
                <div className="detail-row">
                  <p className="text-gray-500 text-sm">Payment Method:</p>
                  <p className="font-semibold text-sm">{selectedBooking.payment_method}</p>
                </div>
              )}
              {selectedBooking?.payment_id && (
                <div className="detail-row">
                  <p className="text-gray-500 text-sm">Payment ID:</p>
                  <p className="font-semibold text-sm break-all">{selectedBooking.payment_id}</p>
                </div>
              )}
              <div className="detail-row">
                <p className="text-gray-500 text-sm">Payment Status:</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedBooking?.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                  selectedBooking?.payment_status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedBooking?.payment_status || "unpaid"}
                </span>
              </div>
              <div className="detail-row">
                <p className="text-gray-500 text-sm">Status:</p>
                {getStatusBadge(selectedBooking?.status)}
              </div>
              <div className="detail-row border-t pt-3">
                <p className="text-gray-500 font-medium text-sm">Total:</p>
                <p className="font-semibold text-lg text-blue-600">₱{parseFloat(selectedBooking?.total_price || selectedBooking?.totalPrice || 0).toFixed(2)}</p>
              </div>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-2 justify-stretch sm:justify-end">
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
                    className="w-full sm:w-auto px-4 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition flex items-center justify-center gap-2 touch-manipulation"
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
                    className="w-full sm:w-auto px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2 touch-manipulation"
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
                    className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <Scale className="w-4 h-4" />
                    Weigh
                  </button>
                )}
                <button
                  onClick={() => selectedBooking && downloadReceipt(selectedBooking)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition touch-manipulation text-center"
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
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel sm:max-w-lg p-4 sm:p-6 relative animate-slideUp">
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
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel sm:max-w-md p-4 sm:p-6 relative animate-slideUp">
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

      {/* User Profile Modal (Admin & Staff) */}
      {profileViewUser && canViewUserProfiles && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel w-full sm:max-w-md md:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 animate-slideUp">
            <UserProfilePanel
              profile={profileDetails}
              loading={loadingProfile}
              viewOnly={isStaffViewOnly}
              onClose={() => {
                setProfileViewUser(null);
                setProfileDetails(null);
              }}
            />
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 shrink-0">
              {profileViewUser.id !== userId && (
                <button
                  type="button"
                  onClick={() => {
                    const user = profileViewUser;
                    setProfileViewUser(null);
                    setProfileDetails(null);
                    openMessageModal(user);
                  }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setProfileViewUser(null);
                  setProfileDetails(null);
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message User Modal */}
      {messageUser && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-panel w-full sm:max-w-lg md:max-w-3xl max-h-[92vh] overflow-hidden flex flex-col md:flex-row p-0 animate-slideUp">
            {canViewUserProfiles && (
              <div className="md:w-72 lg:w-80 border-b md:border-b-0 md:border-r border-gray-100 max-h-[40vh] md:max-h-none overflow-y-auto shrink-0">
                <UserProfilePanel
                  profile={messageProfileDetails}
                  loading={loadingProfile}
                  viewOnly={isStaffViewOnly}
                  compact
                />
              </div>
            )}

            <div className="flex-1 flex flex-col min-w-0 p-4 sm:p-6 relative">
            <button
              onClick={() => {
                setMessageUser(null);
                setMessageText('');
                setMessageProfileDetails(null);
              }}
              className="absolute top-3 right-3 p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-lg touch-manipulation z-10"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4 pr-8">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                {messageProfileDetails?.profile_image ? (
                  <img src={messageProfileDetails.profile_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900">Message User</h2>
                <p className="text-sm text-gray-500 truncate">
                  To: {messageUser.name || 'User'} ({messageUser.email})
                </p>
              </div>
            </div>

            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message here..."
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none flex-1 min-h-[120px]"
              disabled={sendingMessage}
            />

            <p className="text-xs text-gray-500 mt-2">
              Message is saved in chat only. The user will see it in the Messages icon.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => {
                  setMessageUser(null);
                  setMessageText('');
                  setMessageProfileDetails(null);
                }}
                disabled={sendingMessage}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={sendMessageToUser}
                disabled={sendingMessage || !messageText.trim()}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
              >
                {sendingMessage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}