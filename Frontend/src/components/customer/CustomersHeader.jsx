export default function CustomersHeader({ count }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <p className="text-sm text-gray-500 mt-1">
        Managing {count} registered customers
      </p>
    </div>
  );
}
