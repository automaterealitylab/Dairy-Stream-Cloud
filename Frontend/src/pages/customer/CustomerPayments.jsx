import React from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { CreditCard, Wallet, ArrowRight, CheckCircle } from 'lucide-react';

const Payments = () => {
  return (
    <CustomerLayout>
      <div className="space-y-8">

        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Payments
          </h2>
        </div>

        {/* Billing Summary */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:justify-between gap-6">

          <div>
            <p className="text-xs uppercase text-gray-400 tracking-wide">
              Billing Summary
            </p>

            <h3 className="text-3xl font-bold text-gray-900 mt-2">
              ₹1200
            </h3>

            <p className="text-sm text-red-500 mt-1">
              Due in 5 days
            </p>
          </div>

          <div className="space-y-2 text-right">
            <p className="text-sm text-gray-400">Wallet Balance</p>
            <p className="text-lg font-semibold text-gray-900">₹450</p>

            <button className="text-blue-600 text-sm font-medium hover:underline mt-2">
              View Full Invoice
            </button>
          </div>

        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-6">

          {/* Pay Bill */}
          <div className="bg-green-50 border border-green-100 rounded-2xl p-6 flex justify-between items-center hover:shadow-md transition cursor-pointer">
            <div>
              <p className="text-sm font-medium text-green-700">
                Pay Bill
              </p>
              <p className="text-xs text-green-600 mt-1">
                Clear your dues instantly
              </p>
            </div>

            <CreditCard className="text-green-600" />
          </div>

          {/* Add Money */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex justify-between items-center hover:shadow-md transition cursor-pointer">
            <div>
              <p className="text-sm font-medium text-blue-700">
                Add to Wallet
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Recharge your balance
              </p>
            </div>

            <Wallet className="text-blue-600" />
          </div>

          {/* Payment History */}
          <div className="bg-purple-50 border border-purple-100 rounded-2xl p-6 flex justify-between items-center hover:shadow-md transition cursor-pointer">
            <div>
              <p className="text-sm font-medium text-purple-700">
                Payment History
              </p>
              <p className="text-xs text-purple-600 mt-1">
                View past transactions
              </p>
            </div>

            <ArrowRight className="text-purple-600" />
          </div>

        </div>

        {/* Recent Payments */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">

          <h4 className="text-lg font-semibold text-gray-900">
            Recent Payments
          </h4>

          {/* Payment Row */}
          <div className="flex justify-between items-center border-b pb-3">

            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-full text-green-600">
                <CheckCircle size={18} />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">
                  January Milk Bill
                </p>
                <p className="text-xs text-gray-500">
                  25 Jan 2026
                </p>
              </div>
            </div>

            <p className="font-semibold text-gray-900">
              ₹1200
            </p>

          </div>

          <div className="flex justify-between items-center">

            <div className="flex items-center gap-3">
              <div className="bg-green-50 p-2 rounded-full text-green-600">
                <CheckCircle size={18} />
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900">
                  December Milk Bill
                </p>
                <p className="text-xs text-gray-500">
                  25 Dec 2025
                </p>
              </div>
            </div>

            <p className="font-semibold text-gray-900">
              ₹980
            </p>

          </div>

        </div>

      </div>
    </CustomerLayout>
  );
};

export default Payments;
