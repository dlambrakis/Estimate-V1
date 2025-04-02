// src/backend/services/licenseService.js
import { supabase, createAdminClient } from '../../config/supabaseClient.js'; // Adjusted path

// Helper function to get user's company ID (can be reused or imported)
const getUserCompanyId = async (userId) => {
    // Use the standard client respecting RLS for fetching user's own data
    const { data: user, error } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userId)
        .single();

    if (error) throw new Error(`Failed to retrieve user's company affiliation: ${error.message}`);
    if (!user || !user.company_id) throw new Error('User is not associated with a company.');
    return user.company_id;
};


// Get License details for a specific Company ID
// Can be called by a user associated with the company, or an admin (RA, GA)
export const getLicenseByCompanyId = async (companyId = null, requestingUserId = null, requestingUserRole = null) => {
    console.log(`LicenseService: getLicenseByCompanyId called for company ${companyId || 'via user'} by user ${requestingUserId || 'N/A'}`);

    let targetCompanyId = companyId;

    try {
        // If companyId is not provided, derive it from the requestingUserId
        if (!targetCompanyId && requestingUserId) {
            targetCompanyId = await getUserCompanyId(requestingUserId);
            console.log(`LicenseService: Derived company ID ${targetCompanyId} from user ${requestingUserId}`);
        }

        if (!targetCompanyId) {
            throw new Error("Company ID is required to fetch license.");
        }

        // Authorization Check (Example - refine based on actual requirements)
        // If called by a user (CA/CU), they should only access their own company's license.
        // If called by RA/GA, they might access licenses based on their scope.
        // This check can be complex and might involve RLS or explicit checks here.
        // For now, we assume if the user could derive the company ID, they have basic access.
        // More robust checks needed for RA/GA access via direct companyId.

        // CRITICAL: Use an Admin Client to bypass RLS for fetching license details.
        // License details might be sensitive or RLS might be complex to grant direct user access.
        // Create a *fresh* admin client instance for this operation.
        const adminClient = createAdminClient();
        if (!adminClient) {
            throw new Error("Admin client is required to fetch license details but is not available.");
        }
        console.log("LicenseService: Using temporary Admin Client to fetch license.");


        // Fetch license details using the admin client
        const { data: licenseData, error: licenseError } = await adminClient
            .from('company_licenses')
            .select(`
                *,
                company: companies (id, name),
                reseller: resellers (id, name)
            `)
            .eq('company_id', targetCompanyId)
            .maybeSingle(); // Use maybeSingle as a company might not have a license yet

        if (licenseError) {
            console.error(`LicenseService: Error fetching license for company ${targetCompanyId} using admin client:`, licenseError.message);
            throw new Error(`Failed to fetch license details: ${licenseError.message}`);
        }

        if (!licenseData) {
            console.warn(`LicenseService: No license found for company ${targetCompanyId}.`);
            // Return null or throw specific error? Let's throw for clarity.
            throw new Error(`No license found for company ID: ${targetCompanyId}`);
        }

        console.log(`LicenseService: Successfully fetched license for company ${targetCompanyId}`);
        return licenseData;

    } catch (error) {
        console.error(`LicenseService: Error in getLicenseByCompanyId for company ${targetCompanyId || 'unknown'}:`, error.message);
        // Re-throw the error to be handled by the route
        throw error;
    }
};


// --- Service functions for Reseller/Global Admins ---

// TODO: Implement functions like:
// - getAllLicenses(requestingUserId, requestingUserRole, filters)
// - createLicense(licenseData, requestingUserId, requestingUserRole)
// - updateLicense(licenseId, licenseUpdates, requestingUserId, requestingUserRole)
// - deleteLicense(licenseId, requestingUserId, requestingUserRole)
