import CustomersRow from "./CustomersRow";

export default function CustomersTable({ customers }) {
  return (
    <div className="bg-white border rounded-xl overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left px-6 py-3">Name</th>
            <th className="text-left px-6 py-3">Phone</th>
            <th className="text-left px-6 py-3">Address</th>
            <th className="text-right px-6 py-3">Status</th>
          </tr>
        </thead>

        <tbody className="divide-y">
          {customers.map(customer => (
            <CustomersRow key={customer.id} customer={customer} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
