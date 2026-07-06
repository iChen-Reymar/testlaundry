import React, { useState, useEffect } from "react";
import { ChevronLeft, Sparkles, TrendingUp, Clock, Award, Zap, MessageSquare } from "lucide-react";
import { FaStar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient.js";
import Notifications from "./Notifications";
import popular1 from "../assets/popular1.png";
import popular2 from "../assets/popular2.png";
import service1 from "../assets/service1.png";
import service2 from "../assets/service2.png";
import service3 from "../assets/service3.png";
import history from "../assets/history.png";
import booking from "../assets/booking-laundry.png";
import profile from "../assets/profile.png";
import drycleaning from "../assets/drycleaning.png";
// Service images
import washImg from "../assets/wash.jpg";
import dryImg from "../assets/dry.jpg";
import foldImg from "../assets/Fold.jpg";
import ironingImg from "../assets/ironing.jpg";
import pressingImg from "../assets/pressing.jpg";

export default function Dashboard() {
  const navigate = useNavigate();

  // ----- State -----
  const [modalService, setModalService] = useState(null);
  const [seeAllModal, setSeeAllModal] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(null);
  const [services, setServices] = useState([]);
  const [mostBookedServices, setMostBookedServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState('user');
  const [bookingAvailability, setBookingAvailability] = useState({});
  const [maxBookingsPerDay] = useState(20); // Maximum bookings per day
  const [maxBookingsPerTimeWindow] = useState(5); // Maximum bookings per 2-hour time window
  const [dayWarningThreshold] = useState(15); // Yellow warning when 15+ bookings per day
  const [timeWarningThreshold] = useState(3); // Yellow warning when 3+ bookings per time window
  const [timeWindowHours] = useState(2); // 2-hour time windows
  const [openingHour] = useState(8); // 8 AM
  const [closingHour] = useState(20); // 8 PM (20:00)
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [bookingForm, setBookingForm] = useState({
    selectedServices: [],
    pickupDate: "",
    pickupTime: "",
  });


  // Map service names to icons (fallback)
  const serviceIcons = {
    "Wash": service1,
    "Dry": service1,
    "Fold": service1,
    "Ironing": service2,
    "Pressing": service2,
    "Dry Cleaning": service3,
    "Wash & Fold": service1,
    "Ironing & Pressing": service2,
    "Iron Only": service2,
  };

  const serviceImages = {
    "Wash": washImg || popular1,
    "Dry": dryImg || popular1,
    "Fold": foldImg || popular1,
    "Ironing": ironingImg || popular2,
    "Pressing": pressingImg || popular2,
    "Dry Cleaning": drycleaning,
    "Wash & Fold": popular1,
    "Ironing & Pressing": popular2,
    "Iron Only": popular2,
  };

  // Fetch services from API on component mount
  useEffect(() => {
    checkAuth();
    fetchServices();
    getUserProfile();
    fetchUnreadMessages();
  }, []);

  const fetchUnreadMessages = async () => {
    try {
      const { count } = await api.messages.unreadCount();
      setUnreadMessages(count || 0);
    } catch {
      setUnreadMessages(0);
    }
  };

  // Fetch booking availability when booking modal opens
  useEffect(() => {
    if (showBookingModal) {
      fetchBookingAvailability();
    }
  }, [showBookingModal]);

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

  const getUserProfile = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (userProfile && userProfile.id) {
      setUserId(userProfile.id);
      setUserRole(userProfile.role || 'user');
    }
  };

  const mapService = (service) => ({
    ...service,
    price: parseFloat(service.price),
    icon: service.icon_url || serviceIcons[service.name] || service1,
    image: service.image_url || serviceImages[service.name] || popular1,
    displayPrice: `₱${service.price} ${service.unit || 'per kg'}`,
    rating: parseFloat(service.rating) || 0,
    booking_count: Number(service.booking_count) || 0,
    is_active: service.is_active !== false,
  });

  const isServiceActive = (service) => service.is_active !== false && service.name;

  const fetchServices = async () => {
    setLoading(true);
    try {
      const [data, bookedData] = await Promise.all([
        api.services.list(true),
        api.services.mostBooked(10).catch(() => []),
      ]);

      const activeServices = (data || []).map(mapService).filter(isServiceActive);
      setServices(activeServices);

      const mappedMostBooked = (bookedData || [])
        .filter((s) => s.booking_count > 0 && s.is_active !== false && s.name)
        .map(mapService);
      setMostBookedServices(
        mappedMostBooked.length > 0 ? mappedMostBooked : activeServices.slice(0, 2)
      );
    } catch (error) {
      console.error("Error fetching services:", error);
      alert("Failed to load services. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get 2-hour time window start
  const getTimeWindowStart = (timeStr) => {
    if (!timeStr) return null;
    const [hours] = timeStr.split(':').map(Number);
    // Round down to nearest 2-hour window (0-2, 2-4, 4-6, etc.)
    const windowStart = Math.floor(hours / timeWindowHours) * timeWindowHours;
    return windowStart;
  };

  // Helper function to format time window for display
  const formatTimeWindow = (windowStart) => {
    const startHour = windowStart;
    const endHour = (windowStart + 2) % 24;
    const formatHour = (h) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 || 12;
      return `${hour12}:00 ${period}`;
    };
    return `${formatHour(startHour)} - ${formatHour(endHour)}`;
  };

  // Fetch booking availability for dates and times
  const fetchBookingAvailability = async () => {
    try {
      // Get all pending, confirmed, and in_progress bookings (exclude cancelled and completed)
      const bookings = await api.bookings.availability();

      // Count bookings per date and 2-hour time window
      const availability = {};
      
      (bookings || []).forEach(booking => {
        const dateKey = booking.pickup_date;
        const timeWindow = getTimeWindowStart(booking.pickup_time);
        
        if (timeWindow === null) return;
        
        if (!availability[dateKey]) {
          availability[dateKey] = {};
        }
        
        if (!availability[dateKey][timeWindow]) {
          availability[dateKey][timeWindow] = 0;
        }
        
        availability[dateKey][timeWindow]++;
      });

      setBookingAvailability(availability);
    } catch (error) {
      console.error("Error fetching booking availability:", error);
    }
  };

  // Get availability status for a date (max 10 bookings per day)
  const getDateAvailability = (date) => {
    if (!date) return { status: 'available', count: 0, remaining: maxBookingsPerDay };
    
    const dateBookings = bookingAvailability[date] || {};
    const totalBookings = Object.values(dateBookings).reduce((sum, count) => sum + count, 0);
    
    if (totalBookings >= maxBookingsPerDay) {
      return { status: 'full', count: totalBookings, remaining: 0 };
    } else if (totalBookings >= dayWarningThreshold) {
      return { status: 'warning', count: totalBookings, remaining: maxBookingsPerDay - totalBookings };
    }
    
    return { status: 'available', count: totalBookings, remaining: maxBookingsPerDay - totalBookings };
  };

  // Check if time is within working hours (8 AM - 8 PM)
  const isWithinWorkingHours = (time) => {
    if (!time) return true;
    const hour = parseInt(time.split(':')[0], 10);
    return hour >= openingHour && hour < closingHour;
  };

  // Get availability status for a specific time (max 5 bookings per 2-hour window)
  const getTimeAvailability = (date, time) => {
    if (!date || !time) return { status: 'available', count: 0, windowInfo: null, remaining: maxBookingsPerTimeWindow };
    
    // Check if time is outside working hours
    if (!isWithinWorkingHours(time)) {
      return { status: 'closed', count: 0, windowInfo: 'Outside working hours (8AM-8PM)', remaining: 0 };
    }
    
    const timeWindow = getTimeWindowStart(time);
    const count = bookingAvailability[date]?.[timeWindow] || 0;
    const windowInfo = formatTimeWindow(timeWindow);
    
    if (count >= maxBookingsPerTimeWindow) {
      return { status: 'full', count, windowInfo, remaining: 0 };
    } else if (count >= timeWarningThreshold) {
      return { status: 'warning', count, windowInfo, remaining: maxBookingsPerTimeWindow - count };
    }
    
    return { status: 'available', count, windowInfo, remaining: maxBookingsPerTimeWindow - count };
  };

  // Check if date is disabled (max 20 bookings per day reached)
  const isDateDisabled = (date) => {
    const availability = getDateAvailability(date);
    return availability.status === 'full';
  };

  // Check if time is disabled (outside working hours or max bookings reached)
  const isTimeDisabled = (date, time) => {
    // First check if time is outside working hours
    if (!isWithinWorkingHours(time)) return true;
    
    // Check if date is full
    const dateAvail = getDateAvailability(date);
    if (dateAvail.status === 'full') return true;
    
    // Then check if time window is full
    const timeAvail = getTimeAvailability(date, time);
    return timeAvail.status === 'full';
  };

  const getDateFieldState = (date) => {
    if (!date) return { hint: null, inputClass: 'border-gray-200 focus:ring-blue-500', iconClass: 'text-gray-400' };
    const availability = getDateAvailability(date);
    if (availability.status === 'full') {
      return {
        hint: 'This date is fully booked. Pick another date.',
        hintClass: 'text-red-600',
        inputClass: 'border-red-300 bg-red-50 focus:ring-red-400',
        iconClass: 'text-red-500',
      };
    }
    if (availability.status === 'warning') {
      return {
        hint: `${availability.remaining} slot(s) left today`,
        hintClass: 'text-amber-600',
        inputClass: 'border-amber-300 bg-amber-50 focus:ring-amber-400',
        iconClass: 'text-amber-500',
      };
    }
    return {
      hint: `${availability.remaining} slot(s) available`,
      hintClass: 'text-green-600',
      inputClass: 'border-gray-200 focus:ring-blue-500',
      iconClass: 'text-blue-500',
    };
  };

  const getTimeFieldState = (date, time) => {
    if (!date || !time) {
      return { hint: null, inputClass: 'border-gray-200 focus:ring-blue-500', iconClass: 'text-gray-400' };
    }
    const availability = getTimeAvailability(date, time);
    if (availability.status === 'full') {
      return {
        hint: `${availability.windowInfo} is full. Choose another time.`,
        hintClass: 'text-red-600',
        inputClass: 'border-red-300 bg-red-50 focus:ring-red-400',
        iconClass: 'text-red-500',
      };
    }
    if (availability.status === 'warning') {
      return {
        hint: `${availability.remaining} slot(s) left in ${availability.windowInfo}`,
        hintClass: 'text-amber-600',
        inputClass: 'border-amber-300 bg-amber-50 focus:ring-amber-400',
        iconClass: 'text-amber-500',
      };
    }
    return {
      hint: `${availability.remaining} slot(s) in ${availability.windowInfo}`,
      hintClass: 'text-green-600',
      inputClass: 'border-gray-200 focus:ring-blue-500',
      iconClass: 'text-blue-500',
    };
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setBookingForm({ selectedServices: [], pickupDate: "", pickupTime: "" });
  };

  // Bottom navigation
  const bottomNav = [
    { id: 1, icon: history, label: "History", action: () => navigate("/history") },
    { id: 2, icon: booking, label: "Booking Laundry", action: () => setShowBookingModal(true) },
    { id: 3, icon: profile, label: "Profile", action: () => navigate("/profile") },
  ];

  // Get services list for booking form (from API services)
  const servicesList = services.map(service => ({
    id: service.id,
    name: service.name,
    price: parseFloat(service.price), // Original price from Supabase is numeric
    unit: service.unit,
  }));

  // Use services from database for booking modal (filter only active ones)
  const bookingServices = services.map(s => ({
    id: s.id,
    name: s.name,
    price: parseFloat(s.price),
    unit: s.unit || 'per kg'
  }));

  // ----- Helpers -----
  const handleServiceToggle = (serviceId) => {
    setBookingForm(prev => {
      const isSelected = prev.selectedServices.includes(serviceId);
      return {
        ...prev,
        selectedServices: isSelected
          ? prev.selectedServices.filter(id => id !== serviceId)
          : [...prev.selectedServices, serviceId]
      };
    });
  };

  const calculateTotal = () => {
    return bookingForm.selectedServices.reduce((total, serviceId) => {
      const service = bookingServices.find(s => s.id === serviceId);
      return total + (service ? service.price : 0);
    }, 0);
  };

  const generateUniqueOrderId = () => {
    // Use timestamp + random + extra randomness to ensure uniqueness
    const timestamp = Date.now();
    const random1 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const random2 = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}${random1}-${random2}${uniqueSuffix}`;
  };

  const handleBook = () => {
    if (bookingForm.selectedServices.length === 0 || !bookingForm.pickupDate || !bookingForm.pickupTime) {
      alert("Please select at least one service and fill all fields!");
      return;
    }

    // Check if selected date/time is fully booked
    if (isDateDisabled(bookingForm.pickupDate)) {
      alert(`The selected date (${bookingForm.pickupDate}) is fully booked. Please choose another date.`);
      return;
    }

    if (isTimeDisabled(bookingForm.pickupDate, bookingForm.pickupTime)) {
      alert(`The selected time (${bookingForm.pickupTime}) is fully booked for ${bookingForm.pickupDate}. Please choose another time.`);
      return;
    }

    const orderId = generateUniqueOrderId();
    
    // Convert selected services to the format expected by order details modal
    const servicesData = bookingForm.selectedServices.map(serviceId => {
      const service = bookingServices.find(s => s.id === serviceId);
      return {
        id: service.id, // Include service ID for database
        name: service.name,
        price: service.price,
        unit: service.unit,
        quantity: 1
      };
    });

    setShowBookingModal(false);
    setShowOrderDetailsModal({ 
      services: servicesData,
      total: calculateTotal(),
      pickupDate: bookingForm.pickupDate,
      pickupTime: bookingForm.pickupTime,
      orderId 
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    const [hourStr, min] = timeStr.split(":");
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  };

  const handlePlaceOrder = async (booking) => {
    if (!userId) {
      alert("Please login to place an order");
      navigate("/login");
      return;
    }

    // Validate working hours (8 AM - 8 PM)
    if (booking.pickupTime && !isWithinWorkingHours(booking.pickupTime)) {
      alert("Booking is only available from 8:00 AM to 8:00 PM. Please select a valid pickup time.");
      return;
    }

    try {
      const totalPrice = booking.totalPrice || booking.total || (booking.price * (booking.quantity || 1));
      // Payment will be confirmed by staff later
      const paymentId = null;

      // Handle multiple services or single service
      const servicesToSave = booking.services || [{
        name: booking.serviceType,
        price: booking.price,
        unit: booking.unit,
        quantity: booking.quantity || 1
      }];

      // Generate a unique order ID using timestamp (very unlikely to collide)
      let orderId = booking.orderId || generateUniqueOrderId();
      
      console.log('Placing order with order_id:', orderId, 'user_id:', userId);

      const bookingsToCreate = servicesToSave.map((service, index) => {
        const serviceId = service.id || services.find(s => s.name === service.name)?.id || null;

        if (!userId || typeof userId !== 'string') {
          throw new Error('Invalid user ID. Please log in again.');
        }

        if (!booking.pickupDate || !booking.pickupTime) {
          throw new Error('Pickup date and time are required.');
        }

        const serviceOrderId = servicesToSave.length > 1
          ? `${orderId}-${index + 1}`
          : orderId;

        return {
          order_id: serviceOrderId,
          user_id: userId,
          service_id: serviceId,
          quantity: parseFloat(service.quantity) || 1.0,
          pickup_date: booking.pickupDate,
          pickup_time: booking.pickupTime,
          payment_method: null,
          payment_id: paymentId,
          payment_status: 'unpaid',
          total_price: parseFloat(service.price) || 0.00,
          status: 'pending'
        };
      });

      let bookingResults;
      try {
        bookingResults = await api.bookings.create(bookingsToCreate);
      } catch (error) {
        if (error.code === '23505') {
          orderId = generateUniqueOrderId();
          const retryBookings = servicesToSave.map((service, index) => {
            const serviceId = service.id || services.find(s => s.name === service.name)?.id || null;
            const serviceOrderId = servicesToSave.length > 1
              ? `${orderId}-${index + 1}`
              : orderId;
            return {
              order_id: serviceOrderId,
              user_id: userId,
              service_id: serviceId,
              quantity: parseFloat(service.quantity) || 1,
              pickup_date: booking.pickupDate,
              pickup_time: booking.pickupTime,
              payment_method: null,
              payment_id: paymentId,
              payment_status: 'unpaid',
              total_price: parseFloat(service.price) || 0,
              status: 'pending'
            };
          });
          bookingResults = await api.bookings.create(retryBookings);
        } else {
          throw error;
        }
      }

      const resultsArray = Array.isArray(bookingResults) ? bookingResults : [bookingResults];
      let bookingData = resultsArray[0];

      // Prepare receipt data
      const servicesData = servicesToSave.map(service => ({
        name: service.name,
        price: service.price,
        quantity: parseFloat(service.quantity) || 1,
        unit: service.unit,
      }));

      const receiptData = {
        id: bookingData.id,
        orderId: orderId, // Use the verified unique order ID
        paymentId: paymentId,
        date: new Date().toLocaleDateString("en-US"),
        services: servicesData,
        status: "pending",
        booking: bookingData
      };

      const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      let customerName = userProfile.name?.trim();
      if (!customerName) {
        try {
          const profile = await api.profiles.get(userId);
          customerName = profile?.name?.trim() || profile?.email?.split('@')[0] || 'Customer';
        } catch {
          customerName = userProfile.email?.split('@')[0] || 'Customer';
        }
      }

      await api.notifications.create({
        user_id: userId,
        title: 'Booking Submitted!',
        message: `${customerName}: Your booking #${orderId} has been submitted. Total: ₱${totalPrice}. Waiting for staff confirmation.`,
        type: 'info'
      });

      const staffAndAdmins = await api.profiles.byRole(['admin', 'staff']);

      if (staffAndAdmins && staffAndAdmins.length > 0) {
        const staffNotifications = staffAndAdmins.map(staff => ({
          user_id: staff.id,
          title: 'New Booking Received!',
          message: `${customerName} booked #${orderId}. Services: ${servicesData.map(s => s.name).join(', ')}. Total: ₱${totalPrice}`,
          type: 'info'
        }));

        await api.notifications.create(staffNotifications);
      }

      const currentCustomer = await api.customers.get(userId);

      await api.customers.upsert(userId, {
        preferred_pickup_time: booking.pickupTime,
        total_bookings: (currentCustomer?.total_bookings || 0) + 1
      });

      setShowOrderDetailsModal(null);
      setShowReceiptModal(receiptData);
    } catch (error) {
      console.error("Error placing order:", error);
      
      // Show more detailed error message
      let errorMessage = "Failed to place order. Please try again.";
      
      if (error.code === '23505') {
        errorMessage = "Order ID already exists. Please try again.";
      } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
        errorMessage = "Permission denied. Please check your account permissions or contact support.";
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      console.error("Full error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      alert(errorMessage);
    }
  };

  const totalCost = (services) => services.reduce((sum, s) => sum + (s.price || 0), 0);

  const dateFieldState = getDateFieldState(bookingForm.pickupDate);
  const timeFieldState = getTimeFieldState(bookingForm.pickupDate, bookingForm.pickupTime);
  const bookingTotal = calculateTotal();

  // ----- JSX -----
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">

      {/* Branded Header */}
      <div className="bg-blue-600 text-white px-3 sm:px-4 py-3 sm:py-4 shadow-md">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={() => navigate("/")} className="p-1.5 sm:p-2 rounded-lg hover:bg-white/20 active:bg-white/30 transition touch-manipulation">
            <ChevronLeft className="w-5 h-5 sm:w-5 sm:h-5" />
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
            <h1 className="text-base sm:text-lg font-bold">Laundry Connect</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {(userRole === 'staff' || userRole === 'admin') && (
              <button
                onClick={() => navigate("/admindashboard")}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg transition touch-manipulation"
                aria-label="Admin Dashboard"
                title="Admin Dashboard"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-medium">Admin</span>
              </button>
            )}
            <button
              onClick={() => navigate("/messages")}
              className="relative p-1.5 sm:p-2 rounded-lg hover:bg-white/20 active:bg-white/30 transition touch-manipulation"
              aria-label="Messages"
              title="Messages"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </button>
            {userId && <Notifications userId={userId} variant="dark" />}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 md:px-6 pb-28 sm:pb-24 pt-4 sm:pt-6 bg-blue-50 w-full max-w-6xl mx-auto">

        {/* Welcome Section - Enhanced */}
        <div className="w-full mb-4 sm:mb-6 md:mb-8">
          <div className="bg-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg text-white">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Welcome Back!</h2>
            </div>
            <p className="text-blue-50 text-sm sm:text-base">Book your laundry service with ease and convenience</p>
          </div>
        </div>

        {/* Most Booked Services */}
        <section className="w-full mb-4 sm:mb-6 md:mb-8">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Popular Services</h2>
            </div>
            <button 
              className="text-blue-600 text-xs sm:text-sm font-medium hover:text-blue-700 transition flex items-center gap-1"
              onClick={() => setSeeAllModal({ type: "mostBooked", data: mostBookedServices })}
            >
              See all <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {mostBookedServices.slice(0, 2).map((service) => (
              <div 
                key={service.id} 
                className="bg-white rounded-lg sm:rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100 overflow-hidden"
                onClick={() => setModalService(service)}
              >
                <div className="relative">
                  <img 
                    src={service.image} 
                    alt={service.name} 
                    className="w-full h-28 sm:h-36 md:h-40 object-cover" 
                  />
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium">
                    <FaStar className="text-yellow-400 fill-yellow-400 w-3 h-3" />
                    <span>{service.rating > 0 ? service.rating.toFixed(1) : "—"}</span>
                  </div>
                </div>
                <div className="p-2 sm:p-3 md:p-4">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base mb-0.5 sm:mb-1 truncate">{service.name}</p>
                  <p className="text-xs sm:text-sm text-gray-600">{service.displayPrice}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All Services - Enhanced */}
        <section className="w-full max-w-6xl">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">All Services</h2>
            </div>
            <button 
              className="text-blue-600 text-xs sm:text-sm font-medium hover:text-blue-700 transition flex items-center gap-1"
              onClick={() => setSeeAllModal({ type: "services", data: services })}
            >
              See all <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {services.slice(0, 6).map((service) => {
              const serviceImage = service.image_url || service.image || serviceImages[service.name] || popular1;
              return (
                <div 
                  key={service.id} 
                  className="flex flex-col items-center bg-white rounded-lg overflow-hidden hover:shadow-md transition-all cursor-pointer border border-gray-100"
                  onClick={() => setModalService({
                    ...service,
                    displayPrice: service.displayPrice || `₱${service.price}/${service.unit || 'per kg'}`,
                    image: serviceImage,
                  })}
                >
                  <div className="w-full h-16 sm:h-20 md:h-24 bg-gray-100 overflow-hidden">
                    <img 
                      src={serviceImage} 
                      alt={service.name} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="p-2 sm:p-3 w-full">
                    <p className="text-[10px] sm:text-xs font-medium text-gray-700 text-center leading-tight truncate">{service.name}</p>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">{service.displayPrice}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>


      {/* Enhanced Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-100 py-2 sm:py-3 flex justify-around items-center shadow-lg z-50 safe-area-bottom">
        {bottomNav.map(item => {
          const isActive = item.label === "Booking Laundry";
          return (
            <button 
              key={item.id} 
              onClick={item.action} 
              className={`flex flex-col items-center transition-all group touch-manipulation ${isActive ? 'text-blue-600' : 'text-gray-600 hover:text-blue-600 active:text-blue-600'}`}
            >
              <div className={`p-1.5 sm:p-2 rounded-lg transition ${isActive ? 'bg-blue-50' : 'group-hover:bg-blue-50 active:bg-blue-50'}`}>
                <img src={item.icon} alt={item.label} className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
              </div>
              <span className="text-[10px] sm:text-xs font-medium mt-0.5 sm:mt-1 truncate max-w-[60px] sm:max-w-none">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* -- Modals (Booking, Order, Payment, Receipt, Individual, See All) -- */}
      {/* Individual Service Modal */}
      {modalService && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-sm relative shadow-lg max-h-[85vh] overflow-y-auto">
            <button onClick={() => setModalService(null)} className="absolute top-3 right-3 sm:top-2 sm:right-2 text-gray-500 hover:text-black font-bold cursor-pointer z-10 bg-white/80 rounded-full p-1">✕</button>
            <img src={modalService.image || modalService.icon} alt={modalService.name} className="w-full h-40 sm:h-48 object-cover rounded-lg mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-semibold mb-2">{modalService.name}</h3>
            <p className="text-gray-600 mb-2 text-sm">{modalService.description}</p>
            <p className="font-medium text-sm sm:text-base">{modalService.displayPrice || `₱${modalService.price} ${modalService.unit || 'per kg'}`}</p>
          </div>
        </div>
      )}

      {/* See All Modal */}
      {seeAllModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-3xl relative shadow-lg max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSeeAllModal(null)} className="absolute top-3 right-3 sm:top-2 sm:right-2 text-gray-500 hover:text-black font-bold cursor-pointer z-10 bg-white/80 rounded-full p-1">✕</button>
            <h3 className="text-base sm:text-lg font-semibold mb-4">
              {seeAllModal.type === "mostBooked" ? "Popular Services" : "All Services"}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {seeAllModal.data.map(service => (
                <div key={service.id} className="flex flex-col items-center bg-white rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-md transition cursor-pointer border border-gray-100"
                  onClick={() => { setModalService(service); setSeeAllModal(null); }}>
                  <div className="relative w-full h-24 sm:h-32 bg-gray-100 overflow-hidden">
                    <img src={service.image || service.icon} alt={service.name} className="w-full h-full object-cover" />
                    {service.rating > 0 && (
                      <div className="absolute top-2 right-2 bg-white px-1.5 py-0.5 rounded-md flex items-center gap-1 text-[10px] font-medium">
                        <FaStar className="text-yellow-400 fill-yellow-400 w-3 h-3" />
                        <span>{service.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2 sm:p-4 w-full">
                    <p className="font-medium text-gray-700 text-center text-sm sm:text-base truncate">{service.name}</p>
                    {service.displayPrice && (
                      <p className="text-xs sm:text-sm text-gray-500 mt-1 text-center">{service.displayPrice}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="flex flex-col w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[88vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-4 pt-3 pb-3 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Book Laundry</h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Select services and pickup schedule</p>
                </div>
                <button
                  onClick={closeBookingModal}
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
                  aria-label="Close booking form"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-5 min-h-0">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-[11px] sm:text-xs text-gray-600">8AM – 8PM</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-[11px] sm:text-xs text-gray-600">20/day max</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-[11px] sm:text-xs text-gray-600">5 per 2hr window</span>
              </div>

              {/* Services */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Services</h3>
                <div className="space-y-2">
                  {bookingServices.map((service) => {
                    const isSelected = bookingForm.selectedServices.includes(service.id);
                    const unitLabel = (service.unit || 'per kg').replace('per ', '');
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleServiceToggle(service.id)}
                        className={`w-full flex items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border-2 transition text-left touch-manipulation ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                            isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300'
                          }`}>
                            {isSelected && <span className="text-xs leading-none">✓</span>}
                          </span>
                          <span className="font-medium text-sm sm:text-base text-gray-900 truncate">{service.name}</span>
                        </div>
                        <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                          ₱{service.price}/{unitLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Pickup schedule */}
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Pickup Schedule</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="pickup-date" className="block text-xs font-medium text-gray-600 mb-1.5">
                      Date
                    </label>
                    <input
                      id="pickup-date"
                      type="date"
                      value={bookingForm.pickupDate}
                      onChange={(e) => {
                        const selectedDate = e.target.value;
                        if (!isDateDisabled(selectedDate)) {
                          setBookingForm({ ...bookingForm, pickupDate: selectedDate, pickupTime: "" });
                        } else {
                          alert(`This date is fully booked. Please select another date.`);
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      className={`w-full border rounded-xl px-3 py-2.5 sm:py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 transition ${dateFieldState.inputClass}`}
                    />
                    {dateFieldState.hint && (
                      <p className={`text-[11px] sm:text-xs mt-1.5 ${dateFieldState.hintClass}`}>{dateFieldState.hint}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="pickup-time" className="block text-xs font-medium text-gray-600 mb-1.5">
                      Time
                    </label>
                    <div className="relative">
                      <select
                        id="pickup-time"
                        value={bookingForm.pickupTime}
                        onChange={(e) => {
                          const selectedTime = e.target.value;
                          if (bookingForm.pickupDate && selectedTime && isTimeDisabled(bookingForm.pickupDate, selectedTime)) {
                            const availability = getTimeAvailability(bookingForm.pickupDate, selectedTime);
                            alert(`The time window ${availability.windowInfo} is fully booked. Please select another time.`);
                            return;
                          }
                          setBookingForm({ ...bookingForm, pickupTime: selectedTime });
                        }}
                        disabled={!bookingForm.pickupDate}
                        className={`w-full border rounded-xl px-3 py-2.5 sm:py-3 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 transition appearance-none ${
                          !bookingForm.pickupDate
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                            : timeFieldState.inputClass
                        }`}
                      >
                        <option value="">Select time</option>
                        {Array.from({ length: 25 }, (_, i) => {
                          const hour = Math.floor(i / 2) + 8;
                          const minute = (i % 2) * 30;
                          if (hour >= 20 && minute > 0) return null;
                          const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                          const displayHour = hour > 12 ? hour - 12 : hour;
                          const ampm = hour >= 12 ? 'PM' : 'AM';
                          const displayTime = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
                          const availability = bookingForm.pickupDate ? getTimeAvailability(bookingForm.pickupDate, timeValue) : null;
                          const isFull = availability?.status === 'full';
                          return (
                            <option key={timeValue} value={timeValue} disabled={isFull}>
                              {displayTime}{isFull ? ' (Full)' : ''}
                            </option>
                          );
                        }).filter(Boolean)}
                      </select>
                      <Clock className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
                        !bookingForm.pickupDate ? 'text-gray-300' : timeFieldState.iconClass
                      }`} />
                    </div>
                    {timeFieldState.hint && (
                      <p className={`text-[11px] sm:text-xs mt-1.5 ${timeFieldState.hintClass}`}>{timeFieldState.hint}</p>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-gray-100 px-4 py-4 bg-white safe-area-bottom">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-600">
                  {bookingForm.selectedServices.length > 0
                    ? `${bookingForm.selectedServices.length} service(s) selected`
                    : 'No services selected'}
                </span>
                <span className="text-xl font-bold text-blue-600">₱{bookingTotal.toFixed(2)}</span>
              </div>
              <button
                onClick={handleBook}
                disabled={bookingForm.selectedServices.length === 0 || !bookingForm.pickupDate || !bookingForm.pickupTime}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition touch-manipulation"
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetailsModal && (
        <div className="modal-overlay animate-fadeIn z-[60]">
          <div className="modal-panel sm:max-w-md p-4 sm:p-6 relative animate-slideUp">
            <button onClick={() => setShowOrderDetailsModal(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h1 className="text-xl font-bold text-blue-500 mb-6 text-center">Confirm Booking</h1>

            <div className="space-y-3">
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Order ID:</p><p className="font-semibold text-sm">{showOrderDetailsModal.orderId}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Pickup Date:</p><p className="font-semibold">{formatDate(showOrderDetailsModal.pickupDate)}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Pickup Time:</p><p className="font-semibold">{formatTime(showOrderDetailsModal.pickupTime)}</p></div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-gray-500 font-medium mb-2">Services ({showOrderDetailsModal.services?.length || 1}):</p>
                {showOrderDetailsModal.services ? (
                  showOrderDetailsModal.services.map((service, index) => (
                    <div key={index} className="flex justify-between mb-2 bg-gray-50 p-2 rounded">
                      <p className="text-gray-700">
                        {service.name} - P{service.price}/{service.unit}
                      </p>
                      <p className="font-semibold">₱{service.price.toFixed(2)}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between bg-gray-50 p-2 rounded">
                    <p className="text-gray-700">
                      {showOrderDetailsModal.serviceType} 
                      {showOrderDetailsModal.unit === "per kg" ? ` (${showOrderDetailsModal.quantity} kg)` : 
                       showOrderDetailsModal.unit === "per item" ? ` (${showOrderDetailsModal.quantity} items)` : ""}
                    </p>
                    <p className="font-semibold">₱{(showOrderDetailsModal.price * (showOrderDetailsModal.quantity || 1)).toFixed(2)}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-3">
                <p className="text-gray-700 font-medium">Total:</p>
                <p className="font-bold text-lg text-blue-600">₱{(showOrderDetailsModal.total || (showOrderDetailsModal.price * (showOrderDetailsModal.quantity || 1))).toFixed(2)}</p>
              </div>

              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => setShowOrderDetailsModal(null)} 
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 rounded-full font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handlePlaceOrder(showOrderDetailsModal)} 
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-semibold transition cursor-pointer"
                >
                  Confirm Booking
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setShowReceiptModal(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h1 className="text-xl font-bold text-blue-500 mb-6 text-center">Receipt</h1>

            <div className="space-y-3">
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Order ID:</p><p className="font-semibold">{showReceiptModal.orderId}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Payment Status:</p><p className="font-semibold text-yellow-600">Pending - Staff will confirm payment</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Date:</p><p className="font-semibold">{showReceiptModal.date}</p></div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-gray-500 font-medium mb-2">Service Type:</p>
                {showReceiptModal.services.map((s, index) => (
                  <div key={index} className="flex justify-between">
                    <p className="text-gray-700">
                      {s.name} {s.unit === "per kg" ? `(${s.quantity} kg)` : s.unit === "per item" ? `(${s.quantity} items)` : ""}
                    </p>
                    <p className="font-semibold">₱{s.price}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-3">
                <p className="text-gray-500 font-medium">Total Cost:</p>
                <p className="font-semibold">₱{totalCost(showReceiptModal.services)}</p>
              </div>

              <div className="flex justify-between">
                <p className="text-gray-500 font-medium">Booking Status:</p>
                <p className="font-semibold text-blue-600">{showReceiptModal.status}</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Your booking has been submitted. Staff will review and confirm your payment. You'll be notified once it's confirmed.
                </p>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => navigate("/receipt", { state: showReceiptModal })} 
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 rounded-full font-semibold transition cursor-pointer">
                  View Full Receipt
                </button>
                <button onClick={() => setShowReceiptModal(null)} 
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-semibold transition cursor-pointer">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
