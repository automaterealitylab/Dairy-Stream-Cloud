export default function CustomersRow({ customer }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 font-medium">
        {customer.name}
      </td>

      <td className="px-6 py-4 text-gray-600">
        {customer.phone || "-"}
      </td>

      <td className="px-6 py-4 text-gray-600">
        {customer.address || "—"}
      </td>

      <td className="px-6 py-4 text-right">
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            customer.active
              ? "bg-green-50 text-green-600"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {customer.active ? "Active" : "Inactive"}
        </span>
      </td>
    </tr>
  );
}
