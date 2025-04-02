import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function UserManagement({ companyId }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Add state for managing new user form if needed
  // const [newUserEmail, setNewUserEmail] = useState('');
  // const [newUserPassword, setNewUserPassword] = useState(''); // Consider security implications

  const fetchUsers = useCallback(async () => {
    console.log(`UserManagement: Fetching users for company ID: ${companyId}`);
    setLoading(true);
    setError('');
    try {
      // Assuming an endpoint like /api/companies/:companyId/users exists
      // Or maybe just /api/users?companyId=...
      // Let's assume /api/users fetches users for the admin's company based on JWT
      const response = await axios.get(`/api/users`); // Adjust endpoint if needed
      console.log("UserManagement: Users data received:", response.data);
      setUsers(response.data || []); // Ensure users is always an array
    } catch (err) {
      console.error("UserManagement: Error fetching users:", err);
      setError(err.response?.data?.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
      console.log("UserManagement: Finished fetching users.");
    }
  }, [companyId]); // Depend on companyId if it's used in the endpoint directly

  useEffect(() => {
    if (companyId) {
      fetchUsers();
    } else {
        setLoading(false); // No companyId, don't fetch
        console.log("UserManagement: No companyId provided, skipping user fetch.");
    }
  }, [companyId, fetchUsers]); // Re-run fetchUsers if companyId changes

  // Add functions for adding, editing, deleting users later

  if (loading) {
    return <p>Loading users...</p>;
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold mb-4">Manage Users</h3>
      {/* Add User Form (Optional) */}
      {/* ... form elements ... */}

      {/* User List */}
      <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined At
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {/* Assuming role is directly on user object, adjust if nested */}
                    {user.role || 'N/A'}
                  </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {/* Add Edit/Delete buttons later */}
                    <button className="text-indigo-600 hover:text-indigo-900 mr-2">Edit</button>
                    <button className="text-red-600 hover:text-red-900">Delete</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                  No users found for this company.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;
