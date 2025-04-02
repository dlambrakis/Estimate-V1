import React from 'react';
import { useAuth } from '../context/AuthContext';

function ResellerAdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="container mx-auto p-4">
       <header className="flex justify-between items-center mb-6 pb-4 border-b">
         <h1 className="text-3xl font-bold">Reseller Admin Dashboard</h1>
         <div>
           <span className="mr-4">Welcome, {user?.email} ({user?.role})</span>
           <button
             onClick={logout}
             className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
           >
             Logout
           </button>
         </div>
       </header>
       <main>
         <p>Reseller-specific content goes here.</p>
         {/* Add components for managing companies, users within those companies, etc. */}
       </main>
    </div>
  );
}

export default ResellerAdminDashboard;
