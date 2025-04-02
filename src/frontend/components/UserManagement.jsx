import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

function UserManagement({ companyId, sessionToken }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState(''); // Add state for password
    const [isAddingUser, setIsAddingUser] = useState(false); // State for add user form visibility

    const fetchUsers = useCallback(async () => {
        if (!companyId || !sessionToken) {
            setError("Missing company ID or session token.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            console.log(`UserManagement: Fetching users for company ${companyId}`);
            const response = await axios.get(`/api/companies/${companyId}/users`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            console.log("UserManagement: Received users:", response.data);
            setUsers(response.data);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(err.response?.data?.message || err.message || 'Failed to fetch users.');
        } finally {
            setLoading(false);
        }
    }, [companyId, sessionToken]); // Dependencies for useCallback

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]); // fetchUsers is now stable due to useCallback

    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword) { // Check for password too
            setError("Please provide both email and password for the new user.");
            return;
        }
        setLoading(true);
        setError('');
        try {
            console.log(`UserManagement: Adding user ${newUserEmail} to company ${companyId}`);
            // Use the correct endpoint: POST /api/users (or a dedicated company user endpoint if you create one)
            // Assuming a general user creation endpoint that associates with the company via JWT/role
            // OR a specific endpoint like POST /api/companies/{companyId}/users
            // Let's assume POST /api/users and the backend handles association
             await axios.post('/api/users',
                 {
                     email: newUserEmail,
                     password: newUserPassword, // Send password
                     company_id: companyId // Explicitly send company_id if needed by backend
                 },
                 {
                     headers: { 'Authorization': `Bearer ${sessionToken}` }
                 }
             );
            console.log("UserManagement: User added successfully.");
            setNewUserEmail(''); // Clear email input
            setNewUserPassword(''); // Clear password input
            setIsAddingUser(false); // Hide form
            fetchUsers(); // Refresh the user list
        } catch (err) {
            console.error("Error adding user:", err);
            setError(err.response?.data?.message || err.message || 'Failed to add user.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            console.log(`UserManagement: Deleting user ${userId}`);
            // Use the correct endpoint: DELETE /api/users/{userId}
            await axios.delete(`/api/users/${userId}`, {
                headers: { 'Authorization': `Bearer ${sessionToken}` }
            });
            console.log("UserManagement: User deleted successfully.");
            fetchUsers(); // Refresh the user list
        } catch (err) {
            console.error("Error deleting user:", err);
            setError(err.response?.data?.message || err.message || 'Failed to delete user.');
             // Add specific handling if needed, e.g., cannot delete self
             if (err.response?.data?.message === "Cannot delete the user associated with the current session") {
                 setError("You cannot delete your own account.");
             }
        } finally {
            setLoading(false);
        }
    };


    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4">User Management</h2>
            {error && <p className="text-red-500 bg-red-100 p-2 rounded mb-4">{error}</p>}

            {!isAddingUser && (
                 <button
                    onClick={() => setIsAddingUser(true)}
                    className="mb-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-700"
                 >
                    Add New User
                 </button>
            )}


            {isAddingUser && (
                <form onSubmit={handleAddUser} className="mb-6 p-4 border rounded bg-gray-50 space-y-3">
                     <h3 className="text-lg font-medium">Add New User</h3>
                    <div>
                        <label htmlFor="newUserEmail" className="block text-sm font-medium text-gray-700">User Email:</label>
                        <input
                            type="email"
                            id="newUserEmail"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="new.user@example.com"
                        />
                    </div>
                     <div>
                         <label htmlFor="newUserPassword" className="block text-sm font-medium text-gray-700">Temporary Password:</label>
                         <input
                             type="password"
                             id="newUserPassword"
                             value={newUserPassword}
                             onChange={(e) => setNewUserPassword(e.target.value)}
                             required
                             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                             placeholder="Enter a strong password"
                         />
                     </div>
                    <div className="flex space-x-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Adding...' : 'Add User'}
                        </button>
                         <button
                             type="button"
                             onClick={() => { setIsAddingUser(false); setError(''); setNewUserEmail(''); setNewUserPassword(''); }}
                             disabled={loading}
                             className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-700"
                         >
                             Cancel
                         </button>
                    </div>
                </form>
            )}

            {loading && !users.length && <p>Loading users...</p>}

            {!loading && !error && users.length === 0 && <p>No users found for this company.</p>}

            {users.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.role || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        {/* Add edit button if needed */}
                                        {/* <button className="text-indigo-600 hover:text-indigo-900">Edit</button> */}
                                        <button
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={loading}
                                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
