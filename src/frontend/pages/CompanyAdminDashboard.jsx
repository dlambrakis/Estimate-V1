import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Correct path
import CompanyProfile from '../components/CompanyProfile'; // Correct path
import UserManagement from '../components/UserManagement'; // Correct path

function CompanyAdminDashboard() {
  const { logout, sessionToken } = useAuth();
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true); // Start in loading state
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' or 'users'

  useEffect(() => {
    console.log("CompanyAdminDashboard: useEffect triggered."); // Log 1: Did the effect run?

    const fetchCompanyData = async () => {
      console.log("CompanyAdminDashboard: fetchCompanyData called. sessionToken:", sessionToken); // Log 2: Is token available here?

      if (!sessionToken) {
        console.log("CompanyAdminDashboard: No sessionToken found, skipping fetch."); // Log 3: Why skipped?
        // Don't attempt fetch if token isn't ready
        // Keep loading until token is available or fetch fails
        // setLoading(false); // Let's keep loading true if token is missing initially
        return;
      }

      console.log("CompanyAdminDashboard: sessionToken found, proceeding with fetch."); // Log 4: Reached fetch point?
      setLoading(true); // Ensure loading is true when fetch starts
      setError('');
      try {
        console.log("CompanyAdminDashboard: Attempting axios.get('/api/companies/my-company')..."); // Log 5: About to call API
        const response = await axios.get('/api/companies/my-company', {
          headers: {
            'Authorization': `Bearer ${sessionToken}`
          }
        });
        console.log("CompanyAdminDashboard: API call successful, response data:", response.data); // Log 6: API success
        setCompanyData(response.data);
      } catch (err) {
        console.error("CompanyAdminDashboard: Error fetching company data:", err); // Log 7: API error
        setError(err.response?.data?.message || err.message || 'Failed to fetch company data.');
         if (err.response?.status === 401 || err.response?.status === 403) {
             // Optionally trigger logout on auth errors
             // logout();
         }
      } finally {
        console.log("CompanyAdminDashboard: fetchCompanyData finally block."); // Log 8: Reached finally
        setLoading(false);
      }
    };

    fetchCompanyData();
    // Dependency array includes sessionToken to re-run fetch if token changes (e.g., after login)
  }, [sessionToken]); // Dependency array is crucial

  const handleProfileUpdate = (updatedData) => {
      // Optimistically update UI or re-fetch
      console.log("Profile updated in dashboard, new data:", updatedData);
      setCompanyData(updatedData); // Update local state
  };


  // Conditional Rendering Logic
  if (loading) {
    // Added a check for sessionToken here for debugging visibility
    console.log("CompanyAdminDashboard: Rendering Loading state. sessionToken:", sessionToken);
    return <div className="container mx-auto p-4 text-center">Loading company information...</div>;
  }

  if (error) {
     console.log("CompanyAdminDashboard: Rendering Error state:", error);
     return (
        <div className="container mx-auto p-4">
             <div className="flex justify-between items-center mb-6">
                 <h1 className="text-3xl font-bold text-red-600">Dashboard Error</h1>
                 <button
                     onClick={logout}
                     className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
                 >
                     Logout
                 </button>
             </div>
             <p className="text-red-500 bg-red-100 p-4 rounded border border-red-300">Error: {error}</p>
         </div>
     );
  }

  if (!companyData) {
      console.log("CompanyAdminDashboard: Rendering 'No company data' state.");
      // This case might happen if the API returns successfully but with empty/null data,
      // or if the fetch was skipped due to missing token and loading was set to false prematurely.
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
               <p className="text-gray-600 bg-yellow-100 p-4 rounded border border-yellow-300">No company data found, or data could not be loaded.</p>
           </div>
      );
  }

  // Only render the main dashboard if loading is false, there's no error, and companyData exists
  console.log("CompanyAdminDashboard: Rendering main dashboard content.");
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

        {/* Main Content Area */}
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
    </div>
  );
}

export default CompanyAdminDashboard;
