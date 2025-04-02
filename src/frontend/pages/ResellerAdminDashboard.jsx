import React from 'react';
import { useAuth } from '../context/AuthContext'; // Correct path

function ResellerAdminDashboard() {
  const { logout } = useAuth();

  return (
    <div className="container mx-auto p-4">
       <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-bold">Reseller Admin Dashboard</h1>
         <button
           onClick={logout}
           className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
         >
           Logout
         </button>
       </div>
      <p>Welcome, Reseller Admin! This area is under construction.</p>
      {/* Placeholder for reseller-specific components like company list, user management within companies, etc. */}
    </div>
  );
}

export default ResellerAdminDashboard;
