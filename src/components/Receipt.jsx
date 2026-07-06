import React, { useEffect } from "react";
import { ChevronLeft, Download, Printer, Receipt as ReceiptIcon, CheckCircle, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../lib/apiClient";

export default function Receipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const receiptData = location.state;

  useEffect(() => {
    checkAuth();
  }, []);

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

  if (!receiptData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 px-4">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl p-12 text-center max-w-md">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-6">No receipt data found</p>
          <button
            onClick={() => navigate("/history")}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-8 py-3 rounded-2xl font-bold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Go to History
          </button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return "N/A";
    try {
      const [hourStr, min] = timeStr.split(":");
      let hour = parseInt(hourStr, 10);
      const ampm = hour >= 12 ? "PM" : "AM";
      hour = hour % 12 || 12;
      return `${hour}:${min} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const totalCost = (services) => {
    return services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const booking = receiptData.booking || {};
    const receiptContent = `
LAUNDRY CONNECT - RECEIPT
========================

Order ID: ${receiptData.orderId}
Payment ID: ${receiptData.paymentId || booking.payment_id || "N/A"}
Date: ${receiptData.date || formatDate(booking.created_at)}

${booking.pickup_date ? `Pickup Date: ${formatDate(booking.pickup_date)}` : ""}
${booking.pickup_time ? `Pickup Time: ${formatTime(booking.pickup_time)}` : ""}
${booking.payment_method ? `Payment Method: ${booking.payment_method}` : ""}

Services:
${receiptData.services.map((s, i) => 
  `${i + 1}. ${s.name} ${s.unit === "per kg" ? `${s.quantity} kg` : ""} - ₱${parseFloat(s.price).toFixed(2)}`
).join("\n")}

Total Cost: ₱${totalCost(receiptData.services).toFixed(2)}
Status: ${receiptData.status || booking.status || "Pending"}
Payment Status: ${booking.payment_status || "N/A"}

Thank you for your business!
    `.trim();

    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receiptData.orderId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const booking = receiptData.booking || {};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-6 print:bg-white">
      {/* Simple Back Button */}
      <div className="max-w-lg w-full mb-4">
        <button
          onClick={() => navigate("/history")}
          className="p-2 rounded-lg hover:bg-gray-100 transition print:hidden"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Simple Receipt Card */}
      <div className="w-full max-w-lg bg-white rounded-xl shadow-sm p-6 print:shadow-none print:max-w-full border border-gray-200">
        {/* Simple Header */}
        <div className="text-center mb-6 pb-4 border-b border-gray-200">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Laundry Connect</h1>
          <p className="text-gray-600 text-sm">Receipt</p>
        </div>

        {/* Receipt Details */}
        <div className="space-y-4 mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-100">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-gray-600 font-medium">Order ID:</p>
              </div>
              <p className="font-bold text-gray-900 text-lg">{receiptData.orderId}</p>
            </div>
          </div>

          {(receiptData.paymentId || booking.payment_id) && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-medium">Payment ID:</p>
                <p className="font-bold text-gray-900">{receiptData.paymentId || booking.payment_id}</p>
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
            <div className="flex justify-between items-center">
              <p className="text-gray-600 font-medium">Date:</p>
              <p className="font-bold text-gray-900">{formatDate(receiptData.date || booking.created_at)}</p>
            </div>
          </div>

          {booking.pickup_date && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-medium">Pickup Date:</p>
                <p className="font-bold text-gray-900">{formatDate(booking.pickup_date)}</p>
              </div>
            </div>
          )}

          {booking.pickup_time && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-medium">Pickup Time:</p>
                <p className="font-bold text-gray-900">{formatTime(booking.pickup_time)}</p>
              </div>
            </div>
          )}

          {booking.payment_method && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-medium">Payment Method:</p>
                <p className="font-bold text-gray-900">{booking.payment_method}</p>
              </div>
            </div>
          )}

          {booking.payment_status && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-center">
                <p className="text-gray-600 font-medium">Payment Status:</p>
                <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-md ${
                  booking.payment_status === 'paid' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                  booking.payment_status === 'unpaid' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {booking.payment_status.toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Services */}
        <div className="mb-6">
          <p className="text-gray-900 font-semibold mb-3 text-sm">Services</p>
          <div className="space-y-2">
            {receiptData.services.map((service, index) => (
              <div key={index} className="flex justify-between py-2 border-b border-gray-100">
                <div className="flex-1">
                  <p className="text-gray-900 font-medium text-sm">{service.name}</p>
                  {service.unit === "per kg" && service.quantity && (
                    <p className="text-gray-500 text-xs mt-1">Quantity: {service.quantity} kg</p>
                  )}
                </div>
                <p className="font-semibold text-gray-900">₱{parseFloat(service.price).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
          <div className="flex justify-between items-center">
            <p className="text-gray-900 font-semibold">Total Cost:</p>
            <p className="text-gray-900 text-xl font-bold">₱{totalCost(receiptData.services).toFixed(2)}</p>
          </div>
        </div>

        {/* Status */}
        <div className="flex justify-between items-center py-3 border-t border-gray-200 mb-4">
          <p className="text-gray-600 text-sm">Status:</p>
          <span className={`px-3 py-1 rounded text-xs font-medium ${
            receiptData.status === 'completed' || booking.status === 'completed' ? 'bg-green-100 text-green-700' :
            receiptData.status === 'pending' || booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            receiptData.status === 'in_progress' || booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {(receiptData.status || booking.status || "Pending").replace('_', ' ')}
          </span>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-gray-600 text-sm">Thank you for your business!</p>
          <p className="text-gray-500 text-xs mt-1">Laundry Connect</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mt-6 print:hidden max-w-lg w-full">
        <button
          onClick={handlePrint}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg font-medium transition"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}

