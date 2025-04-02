import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import CompanyProfile from '../components/CompanyProfile'; // Assuming component exists
import UserManagement from '../components/UserManagement'; // Assuming component exists
// import LicenseManagement from '../components/LicenseManagement'; // Future component

function CompanyAdminDashboard() {
  const { user, logout } = useAuth();
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [errorProfile, setErrorProfile] = useState('');
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'users', 'licenses'

  useEffect(() => {
    const fetchCompanyProfile = async () => {
      console.log("CompanyAdminDashboard: Fetching company profile...");
      setLoadingProfile(true);
      setErrorProfile('');
      try {
        // Token should be automatically included by axios interceptor/defaults in AuthContext
        const response = await axios.get('/api/companies/my-company');
        console.log("CompanyAdminDashboard: Profile data received:", response.data);
        setCompanyProfile(response.data);
      } catch (err) {
        console.error("CompanyAdminDashboard: Error fetching company profile:", err);
        setErrorProfile(err.response?.data?.message || 'Failed to fetch company profile.');
        if (err.response?.status === 401 || err.response?.status === 403) {
           // Handle unauthorized access, maybe logout or show specific message
           console.log("CompanyAdminDashboard: Unauthorized access detected, logging out.");
           // logout(); // Consider if auto-logout is desired UX
        }
      } finally {
        setLoadingProfile(false);
        console.log("CompanyAdminDashboard: Finished fetching profile.");
      }
    };

    if (user) { // Only fetch if user is logged in
        fetchCompanyProfile();
    } else {
        setLoadingProfile(false); // Not logged in, stop loading
        console.log("CompanyAdminDashboard: User not logged in, skipping profile fetch.");
    }
  }, [user]); // Re-fetch if user changes (e.g., after login)

  const handleProfileUpdate = (updatedProfileData) => {
    // Optimistically update the local state
    setCompanyProfile(prev => ({ ...prev, ...updatedProfileData }));
    // Note: The actual update happens via the CompanyProfile component's submit handler
    console.log("CompanyAdminDashboard: Profile updated locally (optimistic).", updatedProfileData);
  };


  if (!user) {
    // Should be handled by ProtectedRoute, but as a fallback
    return <p>Please log in.</p>;
  }

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-6 pb-4 border-b">
        <h1 className="text-3xl font-bold">Company Admin Dashboard</h1>
        <div>
          <span className="mr-4">Welcome, {user.email} ({user.role})</span>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="mb-6">
        <ul className="flex space-x-4 border-b">
          <li>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-2 px-4 ${activeTab === 'profile' ? 'border-b-2 border-indigo-500 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Company Profile
            </button>
          </li>
          <li>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-4 ${activeTab === 'users' ? 'border-b-2 border-indigo-500 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              User Management
            </button>
          </li>
          {/* <li>
            <button
              onClick={() => setActiveTab('licenses')}
              className={`py-2 px-4 ${activeTab === 'licenses' ? 'border-b-2 border-indigo-500 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            >
              License Management
            </button>
          </li> */}
        </ul>
      </nav>

      <main>
        {activeTab === 'profile' && (
          loadingProfile ? <p>Loading profile...</p> :
          errorProfile ? <p className="text-red-500">{errorProfile}</p> :
          companyProfile ? <CompanyProfile profileData={companyProfile} onProfileUpdate={handleProfileUpdate} /> : <p>Company profile not found.</p>
        )}

        {activeTab === 'users' && companyProfile && (
           <UserManagement companyId={companyProfile.id} />
        )}

        {/* {activeTab === 'licenses' && companyProfile && (
          // <LicenseManagement companyId={companyProfile.id} />
           <p>License Management (Coming Soon)</p>
        )} */}
      </main>
    </div>
  );
}

export default CompanyAdminDashboard;
