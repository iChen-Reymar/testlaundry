import React, { useState, useEffect } from "react";
import { ChevronLeft, Users, Package, ShoppingCart, TrendingUp, Eye, Edit, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient.js";

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

  // Check if user is admin
  useEffect(() => {
    checkAuth();
    checkAdmin();
    if (activeTab === "overview") fetchStats();
    if (activeTab === "bookings") fetchBookings();
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
    if (!userProfile || userProfile.role !== 'admin') {
      alert("Access denied. Admin only.");
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

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles:user_id (name, email),
          services:service_id (name, price, unit)
        `)
        .order('created_at', { ascending: false });

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
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
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
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;
      
      alert(`Booking status updated to ${newStatus}`);
      fetchBookings();
    } catch (error) {
      console.error("Error updating booking:", error);
      alert("Failed to update booking status");
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
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

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-2xl p-6 shadow hover:shadow-lg transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-blue-50 flex flex-col relative">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded-full hover:bg-gray-100 transition cursor-pointer">
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-blue-500">Admin Dashboard</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white shadow-sm px-4 py-3 flex gap-2 overflow-x-auto">
        {[
          { id: "overview", label: "Overview" },
          { id: "bookings", label: "Bookings" },
          { id: "users", label: "Users" },
          { id: "services", label: "Services" }
        ].map(tab => (
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
      <div className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
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
              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <p className="text-center text-gray-500">No bookings yet</p>
                ) : (
                  bookings.map(booking => (
                    <div key={booking.id} className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold text-gray-800">{booking.order_id}</p>
                            {getStatusBadge(booking.status)}
                          </div>
                          <p className="text-sm text-gray-600">Customer: {booking.profiles?.name || "N/A"}</p>
                          <p className="text-sm text-gray-600">Service: {booking.services?.name || "N/A"}</p>
                          <p className="text-sm text-gray-600">
                            Pickup: {formatDate(booking.pickup_date)} at {formatTime(booking.pickup_time)}
                          </p>
                          <p className="text-sm font-medium text-gray-800 mt-1">Total: ₱{booking.total_price}</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedBooking(booking)}
                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {booking.status === 'pending' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition cursor-pointer"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {booking.status === 'confirmed' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'in_progress')}
                              className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition cursor-pointer"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {booking.status === 'in_progress' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'completed')}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition cursor-pointer"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === "users" && (
              <div className="space-y-4">
                {users.length === 0 ? (
                  <p className="text-center text-gray-500">No users yet</p>
                ) : (
                  users.map(user => (
                    <div key={user.id} className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{user.name || "No name"}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.role}
                          </span>
                        </div>
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Services Tab */}
            {activeTab === "services" && (
              <div className="space-y-4">
                {services.length === 0 ? (
                  <p className="text-center text-gray-500">No services yet</p>
                ) : (
                  services.map(service => (
                    <div key={service.id} className="bg-white rounded-2xl p-4 shadow hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{service.name}</p>
                          <p className="text-sm text-gray-600">{service.description}</p>
                          <p className="text-sm font-medium text-gray-800 mt-1">₱{service.price} {service.unit}</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                            service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {service.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleServiceStatus(service.id, service.is_active)}
                          className={`p-2 rounded-lg transition cursor-pointer ${
                            service.is_active 
                              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                        >
                          {service.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))
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
                <p className="font-semibold">{selectedBooking.order_id}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Customer:</p>
                <p className="font-semibold">{selectedBooking.profiles?.name || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Email:</p>
                <p className="font-semibold text-sm">{selectedBooking.profiles?.email || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Service:</p>
                <p className="font-semibold">{selectedBooking.services?.name || "N/A"}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Quantity:</p>
                <p className="font-semibold">{selectedBooking.quantity}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Date:</p>
                <p className="font-semibold">{formatDate(selectedBooking.pickup_date)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Pickup Time:</p>
                <p className="font-semibold">{formatTime(selectedBooking.pickup_time)}</p>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Payment Method:</p>
                <p className="font-semibold">{selectedBooking.payment_method || "N/A"}</p>
              </div>
              {selectedBooking.payment_id && (
                <div className="flex justify-between">
                  <p className="text-gray-500">Payment ID:</p>
                  <p className="font-semibold">{selectedBooking.payment_id}</p>
                </div>
              )}
              <div className="flex justify-between">
                <p className="text-gray-500">Payment Status:</p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedBooking.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                  selectedBooking.payment_status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {selectedBooking.payment_status || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <p className="text-gray-500">Status:</p>
                {getStatusBadge(selectedBooking.status)}
              </div>
              <div className="flex justify-between border-t pt-3">
                <p className="text-gray-500 font-medium">Total:</p>
                <p className="font-semibold text-lg">₱{selectedBooking.total_price}</p>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => downloadReceipt(selectedBooking)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                >
                  Download Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}