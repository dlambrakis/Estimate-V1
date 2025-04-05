import React from 'react';
import { useAuth } from '../context/AuthContext'; // Correct path

function CompanyUserDashboard() {
  const { user, logout } = useAuth(); // Get user info and logout function

  return (
    <div className="container mx-auto p-4">
       <div className="flex justify-between items-center mb-6">
         <h1 className="text-3xl font-bold">User Dashboard</h1>
         {/* Logout Button */}
         <button
           onClick={logout}
           className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
         >
           Logout
         </button>
       </div>
      <p>Welcome, {user?.email || 'User'}! This is your dashboard.</p>
      {/* Add any specific content for normal users here */}
    </div>
  );
}

export default CompanyUserDashboard;
