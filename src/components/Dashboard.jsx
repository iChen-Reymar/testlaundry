import React, { useState, useEffect } from "react";
import { ChevronLeft, Sparkles, TrendingUp, Clock, Award, Zap } from "lucide-react";
import { FaStar } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";

import popular1 from "../assets/popular1.png";
import popular2 from "../assets/popular2.png";
import service1 from "../assets/service1.png";
import service2 from "../assets/service2.png";
import service3 from "../assets/service3.png";
import history from "../assets/history.png";
import booking from "../assets/booking-laundry.png";
import profile from "../assets/profile.png";

export default function Dashboard() {
  const navigate = useNavigate();

  // ----- State -----
  const [modalService, setModalService] = useState(null);
  const [seeAllModal, setSeeAllModal] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(null);
  const [services, setServices] = useState([]);
  const [popularServices, setPopularServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Map service names to icons (fallback)
  const serviceIcons = {
    "Wash & Fold": service1,
    "Ironing & Pressing": service2,
    "Iron Only": service2,
    "Dry Cleaning": service3,
  };

  const serviceImages = {
    "Wash & Fold": popular1,
    "Ironing & Pressing": popular2,
    "Iron Only": popular2,
  };

  // Fetch services from Supabase on component mount
  useEffect(() => {
    fetchServices();
    getUserProfile();
  }, []);

  const getUserProfile = () => {
    const userProfile = JSON.parse(localStorage.getItem('userProfile'));
    if (userProfile && userProfile.id) {
      setUserId(userProfile.id);
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

  const [bookingForm, setBookingForm] = useState({
    serviceId: null,
    serviceType: "",
    price: 0,
    unit: "",
    quantity: 1,
    pickupDate: "",
    pickupTime: "",
  });

  // ----- Helpers -----
  const handleServiceChange = (e) => {
    const selectedServiceId = e.target.value;
    const selected = servicesList.find(s => s.id === selectedServiceId);
    if (selected) {
      setBookingForm({ 
        ...bookingForm, 
        serviceId: selected.id,
        serviceType: selected.name, 
        price: selected.price, 
        unit: selected.unit, 
        quantity: 1 
      });
    } else {
      setBookingForm({ ...bookingForm, serviceId: null, serviceType: "", price: 0, unit: "", quantity: 1 });
    }
  };

  const handleBook = () => {
    if (!bookingForm.serviceType || !bookingForm.pickupDate || !bookingForm.pickupTime) {
      alert("Please fill all fields!");
      return;
    }
    const orderId = "ORD-" + Math.floor(Math.random() * 100000);
    setShowBookingModal(false);
    setShowOrderDetailsModal({ ...bookingForm, orderId });
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

  const handleProceedToPayment = (booking) => {
    const totalPrice = booking.price * (booking.quantity || 1); // Calculate with quantity
    setShowOrderDetailsModal(null);
    setShowPaymentModal({ ...booking, totalPrice, paymentMethod: "" });
  };

  const handlePlaceOrder = async (booking) => {
    if (!userId) {
      alert("Please login to place an order");
      navigate("/login");
      return;
    }

    if (!booking.paymentMethod) {
      alert("Please select a payment method");
      return;
    }

    try {
      const totalPrice = booking.price * (booking.quantity || 1); // Calculate with quantity
      const paymentId = "PMT-" + Math.floor(Math.random() * 100000);

      // Save booking to Supabase
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          order_id: booking.orderId,
          user_id: userId,
          service_id: booking.serviceId,
          quantity: 1, // Always set to 1
          pickup_date: booking.pickupDate,
          pickup_time: booking.pickupTime,
          payment_method: booking.paymentMethod,
          payment_id: paymentId,
          payment_status: 'paid', // Set to paid when order is placed
          total_price: totalPrice.toFixed(2), // Use DECIMAL format
          status: 'pending'
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Prepare receipt data
      const servicesData = [
        {
          name: booking.serviceType,
          price: totalPrice,
          quantity: parseFloat(booking.quantity) || 1,
          unit: booking.unit,
        },
      ];

      const receiptData = {
        id: bookingData.id,
        orderId: booking.orderId,
        paymentId: paymentId,
        date: new Date().toLocaleDateString("en-US"),
        services: servicesData,
        status: "pending",
        booking: bookingData
      };

      setShowPaymentModal(null);
      setShowReceiptModal(receiptData);
    } catch (error) {
      console.error("Error placing order:", error);
      alert("Failed to place order. Please try again.");
    }
  };

  const totalCost = (services) => services.reduce((sum, s) => sum + (s.price || 0), 0);

  // ----- JSX -----
  return (
    <div className="min-h-screen bg-blue-50 flex flex-col relative">

      {/* Enhanced Header with Gradient */}
      <div className="relative bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-400 text-white px-4 py-6 shadow-lg">
        <div className="absolute inset-0 bg-black opacity-5"></div>
        <div className="relative flex items-center justify-between">
          <button onClick={() => navigate("/login")} className="p-2 rounded-full hover:bg-white/20 transition cursor-pointer backdrop-blur-sm">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-bold">Laundry Connect</h1>
          </div>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main content with enhanced styling */}
      <div className="flex-1 flex flex-col items-center px-4 pb-24 pt-6 md:pt-8 bg-gradient-to-b from-blue-50 via-white to-blue-50">

        {/* Welcome Section */}
        <div className="w-full max-w-5xl mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-3xl p-6 text-white shadow-xl transform hover:scale-[1.02] transition-transform duration-300">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-6 h-6 animate-bounce" />
              <h2 className="text-2xl font-bold">Welcome Back!</h2>
            </div>
            <p className="text-blue-50 text-sm">Book your laundry service with ease and convenience</p>
          </div>
        </div>

        {/* Popular Services with enhanced cards */}
        <section className="w-full max-w-5xl mb-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Popular Services</h2>
            </div>
            <button className="text-blue-600 text-sm sm:text-base font-semibold hover:text-blue-700 cursor-pointer transition flex items-center gap-1 hover:gap-2"
              onClick={() => setSeeAllModal({ type: "popular", data: popularServices })}>
              See all <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularServices.map((service, index) => (
              <div 
                key={service.id} 
                className="relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:-translate-y-2 overflow-hidden group"
                onClick={() => setModalService(service)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-cyan-500/0 group-hover:from-blue-500/10 group-hover:to-cyan-500/10 transition-all duration-300"></div>
                
                <div className="relative">
                  <img 
                    src={service.image} 
                    alt={service.name} 
                    className="w-full h-48 sm:h-56 lg:h-64 object-cover group-hover:scale-110 transition-transform duration-300" 
                  />
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                    <span className="text-sm font-bold text-gray-800">{service.rating}</span>
                    <FaStar className="text-yellow-400 text-sm fill-yellow-400" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <Award className="w-5 h-5 text-yellow-400 drop-shadow-lg" />
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-center font-bold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">{service.name}</p>
                  <p className="text-center text-sm text-gray-500 mt-1">{service.displayPrice}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Services with enhanced grid */}
        <section className="w-full max-w-5xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl sm:text-2xl font-bold text-gray-800">All Services</h2>
            </div>
            <button className="text-blue-600 text-sm sm:text-base font-semibold hover:text-blue-700 cursor-pointer transition flex items-center gap-1 hover:gap-2"
              onClick={() => setSeeAllModal({ type: "services", data: services })}>
              See all <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 place-items-center">
            {services.map((service, index) => (
              <div 
                key={service.id} 
                className="flex flex-col items-center bg-white rounded-2xl p-5 hover:shadow-xl transition-all duration-300 cursor-pointer w-full max-w-[120px] transform hover:-translate-y-1 hover:scale-105 border-2 border-transparent hover:border-blue-300 group"
                onClick={() => setModalService(service)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="bg-gradient-to-br from-blue-100 to-cyan-100 rounded-2xl p-4 mb-3 group-hover:from-blue-200 group-hover:to-cyan-200 transition-all duration-300">
                  <img 
                    src={service.icon} 
                    alt={service.name} 
                    className="w-12 h-12 sm:w-14 sm:h-14 object-contain group-hover:scale-110 transition-transform duration-300" 
                  />
                </div>
                <p className="text-sm sm:text-base font-semibold text-gray-700 text-center group-hover:text-blue-600 transition-colors leading-tight">{service.name}</p>
                <p className="text-xs text-gray-500 mt-1 text-center">{service.displayPrice}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Enhanced Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg py-4 shadow-2xl border-t border-gray-200 flex justify-around items-center md:rounded-t-3xl">
        {bottomNav.map(item => (
          <button 
            key={item.id} 
            onClick={item.action} 
            className="flex flex-col items-center text-gray-600 cursor-pointer hover:text-blue-600 transition-all duration-300 transform hover:scale-110 group"
          >
            <div className="p-2 rounded-full group-hover:bg-blue-50 transition-all duration-300">
              <img src={item.icon} alt={item.label} className="w-6 h-6 object-contain group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-xs sm:text-sm font-semibold mt-1 group-hover:font-bold transition-all">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* -- Modals (Booking, Order, Payment, Receipt, Individual, See All) -- */}
      {/* Individual Service Modal */}
      {modalService && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative shadow-lg">
            <button onClick={() => setModalService(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <img src={modalService.image || modalService.icon} alt={modalService.name} className="w-full h-40 sm:h-48 object-cover rounded-lg mb-4" />
            <h3 className="text-lg font-semibold mb-2">{modalService.name}</h3>
            <p className="text-gray-600 mb-2">{modalService.description}</p>
            <p className="font-medium">{modalService.displayPrice || `₱${modalService.price} ${modalService.unit}`}</p>
          </div>
        </div>
      )}

      {/* See All Modal */}
      {seeAllModal && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full relative shadow-lg">
            <button onClick={() => setSeeAllModal(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h3 className="text-lg font-semibold mb-4">{seeAllModal.type === "popular" ? "All Popular Services" : "All Services"}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {seeAllModal.data.map(service => (
                <div key={service.id} className="flex flex-col items-center bg-blue-50 rounded-2xl p-4 hover:shadow-md transition cursor-pointer"
                  onClick={() => { setModalService(service); setSeeAllModal(null); }}>
                  <img src={service.image || service.icon} alt={service.name} className="w-20 h-20 object-contain mb-2" />
                  <p className="font-medium text-gray-700 text-center">{service.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setShowBookingModal(false)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h1 className="text-xl font-bold text-blue-500 mb-6 text-center">Booking Laundry</h1>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Service Type</label>
                {loading ? (
                  <div className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-600">Loading services...</div>
                ) : (
                  <select value={bookingForm.serviceId || ""} onChange={handleServiceChange}
                    className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                    <option value="">Choose an option</option>
                    {servicesList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ₱{s.price} {s.unit}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dynamic Quantity Input */}
              <div>
                <label className="block text-gray-700 font-medium mb-2">
                  Quantity {bookingForm.unit === "per kg" ? "(kg)" : bookingForm.unit === "per item" ? "(items)" : ""}
                </label>
                <input 
                  type="number" 
                  min="1" 
                  value={bookingForm.quantity} 
                  onChange={(e) => setBookingForm({ ...bookingForm, quantity: parseInt(e.target.value) || 1 })}
                  className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                  placeholder={`Enter ${bookingForm.unit === "per kg" ? "kilograms" : "number of items"}`}
                />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Pickup Date</label>
                <input type="date" value={bookingForm.pickupDate} onChange={(e) => setBookingForm({ ...bookingForm, pickupDate: e.target.value })}
                  className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              </div>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Pickup Time</label>
                <input type="time" value={bookingForm.pickupTime} onChange={(e) => setBookingForm({ ...bookingForm, pickupTime: e.target.value })}
                  className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-400 transition" />
              </div>

              <button onClick={handleBook} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-semibold transition mt-4 cursor-pointer">Book Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetailsModal && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setShowOrderDetailsModal(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h1 className="text-xl font-bold text-blue-500 mb-6 text-center">Order Details</h1>

            <div className="space-y-3">
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Order ID:</p><p className="font-semibold">{showOrderDetailsModal.orderId}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Status:</p><p className="font-semibold">{showOrderDetailsModal.status || "Pending"}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Pickup Date:</p><p className="font-semibold">{formatDate(showOrderDetailsModal.pickupDate)}</p></div>
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Pickup Time:</p><p className="font-semibold">{formatTime(showOrderDetailsModal.pickupTime)}</p></div>

              <div className="border-t border-gray-200 pt-3">
                <p className="text-gray-500 font-medium mb-2">Service Type:</p>
                <div className="flex justify-between">
                  <p className="text-gray-700">
                    {showOrderDetailsModal.serviceType} 
                    {showOrderDetailsModal.unit === "per kg" ? ` (${showOrderDetailsModal.quantity} kg)` : 
                     showOrderDetailsModal.unit === "per item" ? ` (${showOrderDetailsModal.quantity} items)` : ""}
                  </p>
                  <p className="font-semibold">₱{(showOrderDetailsModal.price * (showOrderDetailsModal.quantity || 1)).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-3">
                <p className="text-gray-500 font-medium">Total:</p>
                <p className="font-semibold">₱{(showOrderDetailsModal.price * (showOrderDetailsModal.quantity || 1)).toFixed(2)}</p>
              </div>

              <button onClick={() => handleProceedToPayment(showOrderDetailsModal)} className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-semibold transition mt-4 cursor-pointer">Proceed to Payment</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-blue-50 bg-opacity-50 flex justify-center items-center z-50 overflow-auto p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full relative shadow-lg">
            <button onClick={() => setShowPaymentModal(null)} className="absolute top-2 right-2 text-gray-500 hover:text-black font-bold cursor-pointer">✕</button>
            <h1 className="text-xl font-bold text-blue-500 mb-6 text-center">Payment</h1>

            <div className="space-y-4">
              <label className="block text-gray-700 font-medium mb-2">Payment Method</label>
              <select value={showPaymentModal.paymentMethod || ""} 
                      onChange={(e) => setShowPaymentModal({ ...showPaymentModal, paymentMethod: e.target.value })}
                      className="w-full border border-blue-300 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition">
                <option value="">Select payment method</option>
                <option value="GCash">GCash</option>
                <option value="PayPal">PayPal</option>
                <option value="Card">Credit / Debit Card</option>
              </select>

              <button onClick={() => handlePlaceOrder(showPaymentModal)} 
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-semibold transition mt-4 cursor-pointer">
                Place Order
              </button>
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
              <div className="flex justify-between"><p className="text-gray-500 font-medium">Payment ID:</p><p className="font-semibold">{showReceiptModal.paymentId}</p></div>
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
                <p className="text-gray-500 font-medium">Status:</p>
                <p className="font-semibold text-green-600">{showReceiptModal.status}</p>
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
