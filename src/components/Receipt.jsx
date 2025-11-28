import React from "react";
import { ChevronLeft, Download, Printer } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Receipt() {
  const navigate = useNavigate();
  const location = useLocation();
  const receiptData = location.state;

  if (!receiptData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-blue-50 px-4">
        <p className="text-gray-500 mb-4">No receipt data found</p>
        <button
          onClick={() => navigate("/history")}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-medium transition"
        >
          Go to History
        </button>
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
    <div className="min-h-screen flex flex-col items-center bg-blue-50 px-4 py-8 relative print:bg-white">
      {/* Back Button */}
      <button
        onClick={() => navigate("/history")}
        className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-300 transition cursor-pointer print:hidden"
      >
        <ChevronLeft className="w-6 h-6 text-gray-700" />
      </button>

      {/* Receipt Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 sm:p-8 mt-12 print:shadow-none print:max-w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-500 mb-2">Laundry Connect</h1>
          <p className="text-gray-600 text-sm">Receipt</p>
        </div>

        {/* Receipt Details */}
        <div className="space-y-4 mb-6">
          <div className="flex justify-between border-b pb-2">
            <p className="text-gray-600 font-medium">Order ID:</p>
            <p className="font-semibold text-gray-800">{receiptData.orderId}</p>
          </div>

          {(receiptData.paymentId || booking.payment_id) && (
            <div className="flex justify-between border-b pb-2">
              <p className="text-gray-600 font-medium">Payment ID:</p>
              <p className="font-semibold text-gray-800">{receiptData.paymentId || booking.payment_id}</p>
            </div>
          )}

          <div className="flex justify-between border-b pb-2">
            <p className="text-gray-600 font-medium">Date:</p>
            <p className="font-semibold text-gray-800">{formatDate(receiptData.date || booking.created_at)}</p>
          </div>

          {booking.pickup_date && (
            <div className="flex justify-between border-b pb-2">
              <p className="text-gray-600 font-medium">Pickup Date:</p>
              <p className="font-semibold text-gray-800">{formatDate(booking.pickup_date)}</p>
            </div>
          )}

          {booking.pickup_time && (
            <div className="flex justify-between border-b pb-2">
              <p className="text-gray-600 font-medium">Pickup Time:</p>
              <p className="font-semibold text-gray-800">{formatTime(booking.pickup_time)}</p>
            </div>
          )}

          {booking.payment_method && (
            <div className="flex justify-between border-b pb-2">
              <p className="text-gray-600 font-medium">Payment Method:</p>
              <p className="font-semibold text-gray-800">{booking.payment_method}</p>
            </div>
          )}

          {booking.payment_status && (
            <div className="flex justify-between border-b pb-2">
              <p className="text-gray-600 font-medium">Payment Status:</p>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                booking.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                booking.payment_status === 'unpaid' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {booking.payment_status}
              </span>
            </div>
          )}
        </div>

        {/* Services */}
        <div className="border-t border-b py-4 mb-4">
          <p className="text-gray-600 font-medium mb-3">Services:</p>
          {receiptData.services.map((service, index) => (
            <div key={index} className="flex justify-between mb-2">
              <div className="flex-1">
                <p className="text-gray-800 font-medium">{service.name}</p>
                {service.unit === "per kg" && service.quantity && (
                  <p className="text-gray-500 text-sm">{service.quantity} kg</p>
                )}
              </div>
              <p className="font-semibold text-gray-800">₱{parseFloat(service.price).toFixed(2)}</p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b">
          <p className="text-lg font-bold text-gray-800">Total Cost:</p>
          <p className="text-xl font-bold text-blue-500">₱{totalCost(receiptData.services).toFixed(2)}</p>
        </div>

        {/* Status */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-600 font-medium">Status:</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            receiptData.status === 'completed' || booking.status === 'completed' ? 'bg-green-100 text-green-700' :
            receiptData.status === 'pending' || booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
            receiptData.status === 'in_progress' || booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {receiptData.status || booking.status || "Pending"}
          </span>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm border-t pt-4">
          <p>Thank you for your business!</p>
          <p className="mt-2">Laundry Connect</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6 print:hidden">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-full font-medium transition"
        >
          <Printer className="w-5 h-5" />
          Print
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-medium transition"
        >
          <Download className="w-5 h-5" />
          Download
        </button>
      </div>
    </div>
  );
}

