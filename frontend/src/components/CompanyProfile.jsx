import React, { useState, useEffect } from 'react';
import axios from 'axios';

function CompanyProfile({ profileData, onProfileUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Initialize form data when profileData changes or component mounts
  useEffect(() => {
    if (profileData) {
      setFormData({
        company_name: profileData.company_name || '',
        contact_email: profileData.contact_email || '',
        contact_phone: profileData.contact_phone || '',
        // Flatten address data for the form
        street_address: profileData.addresses?.street_address || '',
        city: profileData.addresses?.city || '',
        state_province: profileData.addresses?.state_province || '',
        postal_code: profileData.addresses?.postal_code || '',
        country: profileData.addresses?.country || '',
        // Keep address_id if available, needed for PUT request
        address_id: profileData.addresses?.id || null
      });
    }
  }, [profileData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Prepare data for API: Nest address fields
    const updatePayload = {
      company_name: formData.company_name,
      contact_email: formData.contact_email,
      contact_phone: formData.contact_phone,
      address: { // Nest address data
        id: formData.address_id, // Include address ID if updating existing address
        street_address: formData.street_address,
        city: formData.city,
        state_province: formData.state_province,
        postal_code: formData.postal_code,
        country: formData.country,
        location_type: 'company_hq' // Assuming this is the type for company profile address
      }
    };

    console.log("Submitting profile update:", updatePayload);


    try {
      // Use PUT request to the specific company endpoint
      const response = await axios.put(`/api/companies/${profileData.id}`, updatePayload);
      console.log("Profile update response:", response.data);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
      // Notify parent component about the update
      if (onProfileUpdate) {
        // Pass the updated data back (merge nested address back for consistency if needed)
        const updatedProfile = {
            ...profileData, // Keep existing data like id, reseller info etc.
            company_name: updatePayload.company_name,
            contact_email: updatePayload.contact_email,
            contact_phone: updatePayload.contact_phone,
            addresses: { // Re-nest the address from the response or payload
                ...(profileData.addresses || {}), // Keep potential other address fields
                ...updatePayload.address,
                id: response.data.address_id || updatePayload.address.id // Use ID from response if available
            }
        };
        onProfileUpdate(updatedProfile);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.response?.data?.message || 'Failed to update profile.');
    }
  };

  if (!profileData) {
    return <p>Loading profile data...</p>;
  }

  // Safely access reseller details
  const resellerName = profileData.resellers?.reseller_name || 'N/A';
  const resellerContact = profileData.resellers?.contact_email || 'N/A';

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Company Information
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            isEditing
              ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>
      <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
        {error && <p className="text-red-500 px-4 py-2">{error}</p>}
        {success && <p className="text-green-500 px-4 py-2">{success}</p>}
        <form onSubmit={handleSubmit}>
          <dl className="sm:divide-y sm:divide-gray-200">
            {/* Display Fields */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Company Name</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input
                    type="text"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                ) : (
                  profileData.company_name
                )}
              </dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Contact Email</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input
                    type="email"
                    name="contact_email"
                    value={formData.contact_email}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                ) : (
                  profileData.contact_email
                )}
              </dd>
            </div>

            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Contact Phone</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input
                    type="tel"
                    name="contact_phone"
                    value={formData.contact_phone}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                ) : (
                  profileData.contact_phone || 'N/A'
                )}
              </dd>
            </div>

             {/* Address Fields */}
             <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Street Address</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input type="text" name="street_address" value={formData.street_address} onChange={handleChange} className="input-field"/>
                ) : (
                  profileData.addresses?.street_address || 'N/A'
                )}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">City</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input type="text" name="city" value={formData.city} onChange={handleChange} className="input-field"/>
                ) : (
                  profileData.addresses?.city || 'N/A'
                )}
              </dd>
            </div>
             <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">State/Province</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input type="text" name="state_province" value={formData.state_province} onChange={handleChange} className="input-field"/>
                ) : (
                  profileData.addresses?.state_province || 'N/A'
                )}
              </dd>
            </div>
             <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Postal Code</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input type="text" name="postal_code" value={formData.postal_code} onChange={handleChange} className="input-field"/>
                ) : (
                  profileData.addresses?.postal_code || 'N/A'
                )}
              </dd>
            </div>
             <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Country</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {isEditing ? (
                  <input type="text" name="country" value={formData.country} onChange={handleChange} className="input-field"/>
                ) : (
                  profileData.addresses?.country || 'N/A'
                )}
              </dd>
            </div>


            {/* Reseller Info (Read-only) */}
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
              <dt className="text-sm font-medium text-gray-500">Associated Reseller</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {resellerName}
              </dd>
            </div>
             <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
              <dt className="text-sm font-medium text-gray-500">Reseller Contact</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                 {resellerContact}
              </dd>
            </div>

          </dl>
          {isEditing && (
            <div className="px-4 py-3 bg-gray-50 text-right sm:px-6">
              <button
                type="submit"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>
      <style jsx>{`
        .input-field {
          shadow-sm: focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md;
        }
      `}</style>
    </div>
  );
}

export default CompanyProfile;
