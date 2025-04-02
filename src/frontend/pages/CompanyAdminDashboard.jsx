import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Correct path
import CompanyProfile from '../components/CompanyProfile'; // Correct path
import UserManagement from '../components/UserManagement'; // Correct path

function CompanyAdminDashboard() {
  const { logout, sessionToken } = useAuth();
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'users'

  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!sessionToken) {
        setError("Authentication token not found.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        console.log("CompanyAdminDashboard: Fetching company data...");
        const response = await axios.get('/api/companies/my-company', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        console.log("CompanyAdminDashboard: Received company data:", response.data);
        setCompanyData(response.data);
      } catch (err) {
        console.error("Error fetching company data:", err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch company data.');
         if (err.response?.status === 401 || err.response?.status === 403) {
             // Optionally trigger logout on auth errors
             // logout();
         }
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [sessionToken]); // Re-fetch if token changes

  const handleProfileUpdate = (updatedData) => {
      // Optimistically update UI or re-fetch
      console.log("Profile updated in dashboard, new data:", updatedData);
      setCompanyData(updatedData); // Update local state
  };


  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Company Admin Dashboard</h1>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>

       {/* Tab Navigation */}
       <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('profile')}
              className={`${
                activeTab === 'profile'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Company Profile
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              User Management
            </button>
          </nav>
        </div>


      {loading && <p>Loading company information...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {!loading && !error && companyData && (
         <div className="bg-white p-6 rounded shadow">
            {activeTab === 'profile' && (
                <CompanyProfile
                    companyData={companyData}
                    sessionToken={sessionToken}
                    onProfileUpdate={handleProfileUpdate} // Pass handler
                 />
            )}
             {activeTab === 'users' && companyData.id && (
                 <UserManagement
                    companyId={companyData.id}
                    sessionToken={sessionToken}
                 />
             )}
         </div>
      )}
       {!loading && !error && !companyData && (
           <p>No company data found.</p>
       )}
    </div>
  );
}

export default CompanyAdminDashboard;
