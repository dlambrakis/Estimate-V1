import React, { useState, useEffect } from 'react';
import axios from 'axios';

function CompanyProfile({ companyData: initialCompanyData, sessionToken, onProfileUpdate }) {
  const [companyData, setCompanyData] = useState(initialCompanyData || {});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Use effect to update local state if the prop changes (e.g., after fetch in parent)
  useEffect(() => {
    setCompanyData(initialCompanyData || {});
  }, [initialCompanyData]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    // Handle nested address fields
    if (name.startsWith('address.')) {
      const field = name.split('.')[1];
      setCompanyData(prev => ({
        ...prev,
        address: {
          ...prev.address,
          [field]: value
        }
      }));
    } else {
      setCompanyData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Ensure address exists before sending
    const dataToSend = {
        ...companyData,
        address: companyData.address || {} // Send empty object if no address
    };
     // Remove fields that shouldn't be sent or are read-only from backend perspective
     delete dataToSend.id; // Don't send ID for update payload usually
     delete dataToSend.reseller; // Don't send reseller object
     delete dataToSend.created_at;
     delete dataToSend.updated_at;
     delete dataToSend.address?.id; // Don't send address ID if it exists
     delete dataToSend.address?.created_at;
     delete dataToSend.address?.updated_at;


    try {
      console.log("Submitting company profile update:", dataToSend);
      const response = await axios.put('/api/companies/my-company', dataToSend, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("Update response:", response.data);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      // Notify parent component about the update
      if (onProfileUpdate) {
          onProfileUpdate(response.data); // Pass the updated data back
      }
       setCompanyData(response.data); // Update local state with response data
    } catch (err) {
      console.error("Error updating company profile:", err);
      setError(err.response?.data?.message || err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  // Safely access nested properties
  const address = companyData?.address || {};
  const reseller = companyData?.reseller || {};
  const resellerAddress = reseller?.address || {};

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4">Company Profile</h2>
      {error && <p className="text-red-500 bg-red-100 p-2 rounded mb-4">{error}</p>}
      {success && <p className="text-green-500 bg-green-100 p-2 rounded mb-4">{success}</p>}

      {!isEditing ? (
        <div className="space-y-4">
          <p><strong>Company Name:</strong> {companyData?.name || 'N/A'}</p>
          <p><strong>Contact Email:</strong> {companyData?.contact_email || 'N/A'}</p>
          <p><strong>Contact Phone:</strong> {companyData?.contact_phone || 'N/A'}</p>
          <h3 className="text-xl font-semibold mt-4">Address</h3>
          <p><strong>Street:</strong> {address?.street || 'N/A'}</p>
          <p><strong>City:</strong> {address?.city || 'N/A'}</p>
          <p><strong>State:</strong> {address?.state || 'N/A'}</p>
          <p><strong>Postal Code:</strong> {address?.postal_code || 'N/A'}</p>
          <p><strong>Country:</strong> {address?.country || 'N/A'}</p>

          <h3 className="text-xl font-semibold mt-4">Reseller Information</h3>
           {reseller?.id ? (
               <>
                   <p><strong>Reseller Name:</strong> {reseller?.name || 'N/A'}</p>
                   <p><strong>Reseller Contact:</strong> {reseller?.contact_email || 'N/A'} / {reseller?.contact_phone || 'N/A'}</p>
                   <p><strong>Reseller Address:</strong> {`${resellerAddress?.street || ''}, ${resellerAddress?.city || ''}, ${resellerAddress?.state || ''} ${resellerAddress?.postal_code || ''}, ${resellerAddress?.country || ''}`.replace(/ ,|^, |, $/g, '') || 'N/A'}</p>
               </>
           ) : (
               <p>No reseller assigned.</p>
           )}


          <button
            onClick={() => setIsEditing(true)}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
          >
            Edit Profile
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Company Name</label>
            <input type="text" name="name" id="name" value={companyData.name || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">Contact Email</label>
            <input type="email" name="contact_email" id="contact_email" value={companyData.contact_email || ''} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700">Contact Phone</label>
            <input type="tel" name="contact_phone" id="contact_phone" value={companyData.contact_phone || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>

          <h3 className="text-xl font-semibold mt-4 border-t pt-4">Address</h3>
          <div>
            <label htmlFor="address.street" className="block text-sm font-medium text-gray-700">Street</label>
            <input type="text" name="address.street" id="address.street" value={address.street || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="address.city" className="block text-sm font-medium text-gray-700">City</label>
            <input type="text" name="address.city" id="address.city" value={address.city || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="address.state" className="block text-sm font-medium text-gray-700">State</label>
            <input type="text" name="address.state" id="address.state" value={address.state || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="address.postal_code" className="block text-sm font-medium text-gray-700">Postal Code</label>
            <input type="text" name="address.postal_code" id="address.postal_code" value={address.postal_code || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="address.country" className="block text-sm font-medium text-gray-700">Country</label>
            <input type="text" name="address.country" id="address.country" value={address.country || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>

          <div className="flex space-x-4 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => { setIsEditing(false); setError(''); setSuccess(''); setCompanyData(initialCompanyData || {}); }} // Reset changes on cancel
              disabled={loading}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default CompanyProfile;
