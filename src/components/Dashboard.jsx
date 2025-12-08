import React, { useState, useEffect } from "react";
import { ChevronLeft, Sparkles, TrendingUp, Clock, Award, Zap, Calendar } from "lucide-react";
import { FaStar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";
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
  const [popularServices, setPopularServices] = useState([]);
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

  // Fetch services from Supabase on component mount
  useEffect(() => {
    checkAuth();
    fetchServices();
    getUserProfile();
  }, []);

  // Fetch booking availability when booking modal opens
  useEffect(() => {
    if (showBookingModal) {
      fetchBookingAvailability();
    }
  }, [showBookingModal]);

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

  const getUserProfile = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (userProfile && userProfile.id) {
      setUserId(userProfile.id);
      setUserRole(userProfile.role || 'user');
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map services with icons and images
      // Keep original price as numeric for calculations, add displayPrice for UI
      const mappedServices = (data || []).map(service => ({
        ...service,
        price: parseFloat(service.price), // Ensure price is numeric
        // Use database URLs if available, otherwise fallback to local assets
        icon: service.icon_url || serviceIcons[service.name] || service1,
        image: service.image_url || serviceImages[service.name] || popular1,
        displayPrice: `₱${service.price} ${service.unit}`,
        rating: parseFloat(service.rating) || 0, // Use rating from database
      }));

      setServices(mappedServices);
      
      // Set popular services using is_popular field from database
      setPopularServices(mappedServices.filter(s => s.is_popular === true));
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
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('pickup_date, pickup_time, status')
        .in('status', ['pending', 'confirmed', 'in_progress']);

      if (error) throw error;

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

  // Bottom navigation
  const bottomNav = [
    { id: 1, icon: history, label: "History", action: () => navigate("/history") },
    { id: 2, icon: booking, label: "Booking Laundry", action: () => setShowBookingModal(true) },
    { id: 3, icon: profile, label: "Profile", action: () => navigate("/profile") },
  ];

  // Get services list for booking form (from Supabase services)
  const servicesList = services.map(service => ({
    id: service.id,
    name: service.name,
    price: parseFloat(service.price), // Original price from Supabase is numeric
    unit: service.unit,
  }));

  // Predefined services for booking modal
  const bookingServices = [
    { id: "wash", name: "Wash", price: 35, unit: "kg" },
    { id: "dry", name: "Dry", price: 30, unit: "kg" },
    { id: "fold", name: "Fold", price: 20, unit: "kg" },
    { id: "ironing", name: "Ironing", price: 25, unit: "pc" },
    { id: "pressing", name: "Pressing", price: 30, unit: "pc" },
    { id: "drycleaning", name: "Dry Cleaning", price: 100, unit: "pc" },
  ];

  const [bookingForm, setBookingForm] = useState({
    selectedServices: [], // Array of selected service IDs
    pickupDate: "",
    pickupTime: "",
  });

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
    // Use timestamp + random to ensure uniqueness
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `ORD-${timestamp}-${random}`;
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

      // Save each service as a separate booking entry
      const bookingPromises = servicesToSave.map(async (service) => {
        // Find matching service ID from database if available
        const dbService = services.find(s => s.name === service.name);
        
        // Ensure user_id is a valid UUID string
        if (!userId || typeof userId !== 'string') {
          throw new Error('Invalid user ID. Please log in again.');
        }
        
        // Validate required fields
        if (!booking.pickupDate || !booking.pickupTime) {
          throw new Error('Pickup date and time are required.');
        }
        
        // Prepare booking data with correct types
        const bookingData = {
          order_id: orderId,
          user_id: userId, // Should be UUID string
          service_id: dbService?.id || null,
          quantity: parseFloat(service.quantity) || 1.0,
          pickup_date: booking.pickupDate, // Should be YYYY-MM-DD format
          pickup_time: booking.pickupTime, // Should be HH:MM:SS format
          payment_method: null, // Will be set by staff when confirming payment
          payment_id: paymentId,
          payment_status: 'unpaid', // Staff will confirm payment later
          total_price: parseFloat(service.price) || 0.00, // Must be number, not string
          status: 'pending'
        };
        
        console.log('Inserting booking:', JSON.stringify(bookingData, null, 2));
        
        return supabase
          .from('bookings')
          .insert(bookingData)
          .select()
          .single();
      });

      const bookingResults = await Promise.all(bookingPromises);
      let bookingData = bookingResults[0]?.data || bookingResults[0];

      // Check for errors
      const errors = bookingResults.filter(r => r.error);
      if (errors.length > 0) {
        const error = errors[0].error;
        // If it's a duplicate key error, try with a new order ID
        if (error.code === '23505' && error.message?.includes('order_id')) {
          // Retry with a new order ID (only once)
          const newOrderId = generateUniqueOrderId();
          const retryPromises = servicesToSave.map(async (service) => {
            const dbService = services.find(s => s.name === service.name);
            return supabase
              .from('bookings')
              .insert({
                order_id: newOrderId,
                user_id: userId,
                service_id: dbService?.id || null,
                quantity: service.quantity || 1,
                pickup_date: booking.pickupDate,
                pickup_time: booking.pickupTime,
                payment_method: booking.paymentMethod,
                payment_id: paymentId,
                payment_status: 'paid',
                total_price: service.price.toFixed(2),
                status: 'pending'
              })
              .select()
              .single();
          });
          
          const retryResults = await Promise.all(retryPromises);
          const retryErrors = retryResults.filter(r => r.error);
          if (retryErrors.length > 0) throw retryErrors[0].error;
          
          // Use the new order ID and booking data
          orderId = newOrderId;
          bookingData = retryResults[0]?.data || retryResults[0];
        } else {
          throw error;
        }
      }

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

      // Send notification to customer
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'Booking Submitted!',
        message: `Your booking #${orderId} has been submitted. Total: ₱${totalPrice}. Waiting for staff confirmation.`,
        type: 'info'
      });

      // Send notification to all admin and staff
      const { data: staffAndAdmins } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'staff']);

      if (staffAndAdmins && staffAndAdmins.length > 0) {
        const staffNotifications = staffAndAdmins.map(staff => ({
          user_id: staff.id,
          title: 'New Booking Received!',
          message: `New booking #${orderId} needs attention. Services: ${servicesData.map(s => s.name).join(', ')}. Total: ₱${totalPrice}`,
          type: 'info'
        }));

        await supabase.from('notifications').insert(staffNotifications);
      }

      // Update customer's preferred_pickup_time and increment total_bookings
      const { data: currentCustomer } = await supabase
        .from('customers')
        .select('total_bookings')
        .eq('id', userId)
        .single();

      await supabase
        .from('customers')
        .upsert({
          id: userId,
          preferred_pickup_time: booking.pickupTime,
          total_bookings: (currentCustomer?.total_bookings || 0) + 1
        }, { onConflict: 'id' });

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
            {userId && <Notifications userId={userId} variant="dark" />}
            <div className="w-7 sm:w-9"></div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 md:px-6 pb-24 pt-4 sm:pt-6 bg-blue-50">

        {/* Welcome Section - Enhanced */}
        <div className="w-full max-w-6xl mb-4 sm:mb-6 md:mb-8">
          <div className="bg-blue-600 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg text-white">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6" />
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Welcome Back!</h2>
            </div>
            <p className="text-blue-50 text-sm sm:text-base">Book your laundry service with ease and convenience</p>
          </div>
        </div>

        {/* Popular Services - Enhanced */}
        <section className="w-full max-w-6xl mb-4 sm:mb-6 md:mb-8">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900">Popular Services</h2>
            </div>
            <button 
              className="text-blue-600 text-xs sm:text-sm font-medium hover:text-blue-700 transition flex items-center gap-1"
              onClick={() => setSeeAllModal({ type: "popular", data: popularServices })}
            >
              See all <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4 rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {(popularServices.length >= 2 ? popularServices.slice(0, 2) : [
              {
                id: "wash-popular",
                name: "Wash",
                price: 35,
                unit: "kg",
                displayPrice: "P35/kg",
                image: popular1,
                rating: 4.8
              },
              {
                id: "iron-popular",
                name: "Iron",
                price: 25,
                unit: "pc",
                displayPrice: "P25/pc",
                image: popular2,
                rating: 4.5
              }
            ]).map((service) => (
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
                    <span>{service.rating || "4.5"}</span>
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
              onClick={() => setSeeAllModal({ type: "services", data: services.map(s => ({
                id: s.id,
                name: s.name,
                price: s.price,
                unit: s.unit,
                displayPrice: s.displayPrice || `P${s.price}/${s.unit}`,
                icon: s.icon || serviceIcons[s.name] || service1,
                image: s.image_url || s.image || serviceImages[s.name] || popular1
              })) })}
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
                    id: service.id,
                    name: service.name,
                    price: service.price,
                    unit: service.unit,
                    displayPrice: service.displayPrice || `P${service.price}/${service.unit}`,
                    icon: service.icon || serviceIcons[service.name] || service1,
                    image: serviceImage
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
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1 text-center">P{service.price}/{service.unit}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>

      {/* Staff Dashboard Button - Only visible to staff */}
      {(userRole === 'staff' || userRole === 'admin') && (
        <div className="fixed top-16 sm:top-20 right-3 sm:right-4 z-40">
          <button
            onClick={() => navigate("/admindashboard")}
            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white p-2.5 sm:px-4 sm:py-2 rounded-lg shadow-lg flex items-center justify-center gap-2 transition font-medium touch-manipulation"
            aria-label="Staff Dashboard"
            title="Staff Dashboard"
          >
            <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Staff Dashboard</span>
          </button>
        </div>
      )}

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
            <p className="font-medium text-sm sm:text-base">{modalService.displayPrice || `₱${modalService.price} ${modalService.unit}`}</p>
          </div>
        </div>
      )}

      {/* See All Modal */}
      {seeAllModal && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-3xl relative shadow-lg max-h-[90vh] overflow-y-auto">
            <button onClick={() => setSeeAllModal(null)} className="absolute top-3 right-3 sm:top-2 sm:right-2 text-gray-500 hover:text-black font-bold cursor-pointer z-10 bg-white/80 rounded-full p-1">✕</button>
            <h3 className="text-base sm:text-lg font-semibold mb-4">{seeAllModal.type === "popular" ? "All Popular Services" : "All Services"}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {seeAllModal.data.map(service => (
                <div key={service.id} className="flex flex-col items-center bg-white rounded-xl sm:rounded-2xl overflow-hidden hover:shadow-md transition cursor-pointer border border-gray-100"
                  onClick={() => { setModalService(service); setSeeAllModal(null); }}>
                  <div className="w-full h-24 sm:h-32 bg-gray-100 overflow-hidden">
                    <img src={service.image || service.icon} alt={service.name} className="w-full h-full object-cover" />
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
        <div className="fixed inset-0 bg-black/50 flex justify-center items-end sm:items-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 w-full sm:max-w-md relative shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h1 className="text-lg sm:text-xl font-bold text-blue-500">Booking Laundry</h1>
              <button onClick={() => {
                setShowBookingModal(false);
                setBookingForm({ selectedServices: [], pickupDate: "", pickupTime: "" });
              }} className="text-black font-bold cursor-pointer text-xl p-1 hover:bg-gray-100 rounded-full">✕</button>
            </div>

            <div className="space-y-4">
              {/* Availability Legend */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <p className="text-xs font-semibold text-blue-800 mb-2">📅 Booking Information</p>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🕐</span>
                    <span className="text-gray-700"><strong>Hours:</strong> 8:00 AM - 8:00 PM</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📆</span>
                    <span className="text-gray-700"><strong>Daily Limit:</strong> 20 bookings/day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⏰</span>
                    <span className="text-gray-700"><strong>Per Window:</strong> 5 bookings/2hrs</span>
                  </div>
                </div>
                <div className="border-t border-blue-200 mt-2 pt-2 flex flex-wrap gap-2 text-[10px]">
                  <span className="text-green-600">🟢 Available</span>
                  <span className="text-yellow-600">🟡 Almost Full</span>
                  <span className="text-red-600">🔴 Full</span>
                </div>
              </div>

              {/* Service Type - Checkboxes */}
              <div>
                <label className="block text-gray-900 font-bold mb-2">Service Type</label>
                <div className="grid grid-cols-2 gap-3">
                  {bookingServices.map((service) => (
                    <label key={service.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingForm.selectedServices.includes(service.id)}
                        onChange={() => handleServiceToggle(service.id)}
                        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-400"
                      />
                      <span className="text-gray-700">
                        {service.name} - P{service.price}/{service.unit}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div>
                <label className="block text-gray-900 font-bold mb-2">Total</label>
                <input 
                  type="text" 
                  value={calculateTotal()}
                  readOnly
                  className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                />
              </div>

              {/* Pickup Date */}
              <div>
                <label className="block text-gray-900 font-bold mb-2">
                  Pickup Date
                  {bookingForm.pickupDate && (() => {
                    const availability = getDateAvailability(bookingForm.pickupDate);
                    if (availability.status === 'full') {
                      return <span className="ml-2 text-xs text-red-600 font-normal">(Fully Booked - 10/10)</span>;
                    } else if (availability.status === 'warning') {
                      return <span className="ml-2 text-xs text-yellow-600 font-normal">({availability.remaining} slots left)</span>;
                    } else {
                      return <span className="ml-2 text-xs text-green-600 font-normal">({availability.remaining} slots available)</span>;
                    }
                  })()}
                </label>
                <div className="relative">
                  <input 
                    type="date" 
                    value={bookingForm.pickupDate} 
                    onChange={(e) => {
                      const selectedDate = e.target.value;
                      if (!isDateDisabled(selectedDate)) {
                        setBookingForm({ ...bookingForm, pickupDate: selectedDate, pickupTime: "" });
                      } else {
                        alert(`This date (${selectedDate}) is fully booked. Please select another date.`);
                      }
                    }}
                    min={new Date().toISOString().split('T')[0]} // Prevent past dates
                    className={`w-full border rounded-lg px-4 py-3 pr-10 text-gray-600 focus:outline-none focus:ring-2 transition ${
                      bookingForm.pickupDate ? (() => {
                        const availability = getDateAvailability(bookingForm.pickupDate);
                        if (availability.status === 'full') {
                          return 'border-red-500 bg-red-50 focus:ring-red-400';
                        } else if (availability.status === 'warning') {
                          return 'border-yellow-500 bg-yellow-50 focus:ring-yellow-400';
                        }
                        return 'border-blue-300 focus:ring-blue-400';
                      })() : 'border-blue-300 focus:ring-blue-400'
                    }`}
                  />
                  <Calendar className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                    bookingForm.pickupDate ? (() => {
                      const availability = getDateAvailability(bookingForm.pickupDate);
                      if (availability.status === 'full') {
                        return 'text-red-500';
                      } else if (availability.status === 'warning') {
                        return 'text-yellow-500';
                      }
                      return 'text-gray-400';
                    })() : 'text-gray-400'
                  }`} />
                </div>
                {bookingForm.pickupDate && (() => {
                  const availability = getDateAvailability(bookingForm.pickupDate);
                  if (availability.status === 'full') {
                    return <p className="text-xs text-red-600 mt-1">⚠️ This date is fully booked (10/10). Please choose another date.</p>;
                  } else if (availability.status === 'warning') {
                    return <p className="text-xs text-yellow-600 mt-1">⚠️ This date is almost full ({availability.count}/10 bookings). {availability.remaining} slot(s) left!</p>;
                  } else {
                    return <p className="text-xs text-green-600 mt-1">✓ {availability.remaining} booking slot(s) available for this date</p>;
                  }
                })()}
              </div>

              {/* Pickup Time */}
              <div>
                <label className="block text-gray-900 font-bold mb-2">
                  Pickup Time
                  {bookingForm.pickupDate && bookingForm.pickupTime && (() => {
                    const availability = getTimeAvailability(bookingForm.pickupDate, bookingForm.pickupTime);
                    if (availability.status === 'full') {
                      return <span className="ml-2 text-xs text-red-600 font-normal">(Window Full: {availability.windowInfo})</span>;
                    } else if (availability.status === 'warning') {
                      return <span className="ml-2 text-xs text-yellow-600 font-normal">({availability.remaining} slots left in {availability.windowInfo})</span>;
                    } else if (availability.remaining) {
                      return <span className="ml-2 text-xs text-green-600 font-normal">({availability.remaining} slots available)</span>;
                    }
                    return null;
                  })()}
                </label>
                <div className="relative">
                  <select
                    value={bookingForm.pickupTime}
                    onChange={(e) => {
                      const selectedTime = e.target.value;
                      if (bookingForm.pickupDate && selectedTime && isTimeDisabled(bookingForm.pickupDate, selectedTime)) {
                        const availability = getTimeAvailability(bookingForm.pickupDate, selectedTime);
                        alert(`The time window ${availability.windowInfo} is fully booked (5/5). Please select a time in a different 2-hour window.`);
                        return;
                      }
                      setBookingForm({ ...bookingForm, pickupTime: selectedTime });
                    }}
                    disabled={!bookingForm.pickupDate}
                    className={`w-full border rounded-lg px-4 py-3 pr-10 text-gray-600 focus:outline-none focus:ring-2 transition appearance-none cursor-pointer ${
                      !bookingForm.pickupDate 
                        ? 'border-gray-300 bg-gray-100 cursor-not-allowed' 
                        : bookingForm.pickupTime ? (() => {
                            const availability = getTimeAvailability(bookingForm.pickupDate, bookingForm.pickupTime);
                            if (availability.status === 'full') {
                              return 'border-red-500 bg-red-50 focus:ring-red-400';
                            } else if (availability.status === 'warning') {
                              return 'border-yellow-500 bg-yellow-50 focus:ring-yellow-400';
                            }
                            return 'border-blue-300 focus:ring-blue-400';
                          })() : 'border-blue-300 focus:ring-blue-400'
                    }`}
                  >
                    <option value="">Select pickup time</option>
                    {/* Generate time slots from 8 AM to 8 PM (every 30 minutes) */}
                    {Array.from({ length: 25 }, (_, i) => {
                      const hour = Math.floor(i / 2) + 8;
                      const minute = (i % 2) * 30;
                      if (hour >= 20 && minute > 0) return null; // Stop at 8:00 PM
                      const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                      const displayHour = hour > 12 ? hour - 12 : hour;
                      const ampm = hour >= 12 ? 'PM' : 'AM';
                      const displayTime = `${displayHour}:${String(minute).padStart(2, '0')} ${ampm}`;
                      
                      // Check availability for this time slot
                      const availability = bookingForm.pickupDate ? getTimeAvailability(bookingForm.pickupDate, timeValue) : null;
                      const isFull = availability?.status === 'full';
                      const isWarning = availability?.status === 'warning';
                      
                      return (
                        <option 
                          key={timeValue} 
                          value={timeValue}
                          disabled={isFull}
                          className={isFull ? 'text-red-500' : isWarning ? 'text-yellow-600' : ''}
                        >
                          {displayTime} {isFull ? '(Full)' : isWarning ? `(${availability.remaining} left)` : ''}
                        </option>
                      );
                    }).filter(Boolean)}
                  </select>
                  <Clock className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 pointer-events-none ${
                    !bookingForm.pickupDate 
                      ? 'text-gray-300' 
                      : bookingForm.pickupTime ? (() => {
                          const availability = getTimeAvailability(bookingForm.pickupDate, bookingForm.pickupTime);
                          if (availability.status === 'full') {
                            return 'text-red-500';
                          } else if (availability.status === 'warning') {
                            return 'text-yellow-500';
                          }
                          return 'text-blue-500';
                        })() : 'text-gray-400'
                  }`} />
                </div>
                {bookingForm.pickupDate && bookingForm.pickupTime && (() => {
                  const availability = getTimeAvailability(bookingForm.pickupDate, bookingForm.pickupTime);
                  if (availability.status === 'full') {
                    return <p className="text-xs text-red-600 mt-1">⚠️ Time window {availability.windowInfo} is fully booked (5/5). Please choose a different time.</p>;
                  } else if (availability.status === 'warning') {
                    return <p className="text-xs text-yellow-600 mt-1">⚠️ Time window {availability.windowInfo} has {availability.count}/5 bookings. Only {availability.remaining} slot(s) left!</p>;
                  } else if (availability.remaining) {
                    return <p className="text-xs text-green-600 mt-1">✓ Time window {availability.windowInfo} - {availability.remaining} slot(s) available</p>;
                  }
                  return null;
                })()}
              </div>

              {/* Book Now Button */}
              <button 
                onClick={handleBook} 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold transition mt-4 cursor-pointer"
              >
                Book now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetailsModal && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setShowOrderDetailsModal(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h1 className="text-xl font-bold text-blue-500 mb-6 text-center">Booking Details</h1>

            <div className="space-y-3">
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Order ID:</p><p className="font-semibold">{showOrderDetailsModal.orderId}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Status:</p><p className="font-semibold">{showOrderDetailsModal.status || "Pending"}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Pickup Date:</p><p className="font-semibold">{formatDate(showOrderDetailsModal.pickupDate)}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Pickup Time:</p><p className="font-semibold">{formatTime(showOrderDetailsModal.pickupTime)}</p></div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-gray-500 font-medium mb-2">Service Type:</p>
                {showOrderDetailsModal.services ? (
                  showOrderDetailsModal.services.map((service, index) => (
                    <div key={index} className="flex justify-between mb-2">
                      <p className="text-gray-700">
                        {service.name} - P{service.price}/{service.unit}
                      </p>
                      <p className="font-semibold">₱{service.price.toFixed(2)}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex justify-between">
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
                <p className="text-gray-500 font-medium">Total:</p>
                <p className="font-semibold">₱{(showOrderDetailsModal.total || (showOrderDetailsModal.price * (showOrderDetailsModal.quantity || 1))).toFixed(2)}</p>
              </div>

              <button onClick={() => handlePlaceOrder(showOrderDetailsModal)} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-semibold transition mt-4 cursor-pointer">Done</button>
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
