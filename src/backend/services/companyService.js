// src/backend/services/companyService.js
import { supabase, supabaseAdmin, createAdminClient } from '../../config/supabaseClient.js'; // Adjusted path

// Helper function to get user's company ID (using standard client respecting RLS)
const getUserCompanyId = async (userId) => {
    console.log(`CompanyService: Fetching company ID for user ${userId}`);
    const { data: user, error } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', userId)
        .single();

    if (error) {
        console.error(`CompanyService: Error fetching company ID for user ${userId}:`, error.message);
        throw new Error(`Failed to retrieve user's company affiliation: ${error.message}`);
    }
    if (!user || !user.company_id) {
        console.warn(`CompanyService: User ${userId} is not associated with any company.`);
        // Allow function to proceed but return null, let caller handle non-association
        // throw new Error('User is not associated with a company.');
        return null;
    }
    console.log(`CompanyService: User ${userId} belongs to company ${user.company_id}`);
    return user.company_id;
};


// Get Company details for the currently logged-in Company Admin
export const getCompanyForAdmin = async (userId) => {
    console.log(`CompanyService: getCompanyForAdmin called for user ${userId}`);
    try {
        const companyId = await getUserCompanyId(userId); // Verify user belongs to a company

        // Throw error if user is not associated with a company
        if (!companyId) {
             throw new Error('User is not associated with a company.');
        }

        // Fetch company details, including address and reseller info (name, contacts, address)
        // Use the standard client - RLS policy on 'companies' should allow users
        // to select their own company's details.
        const { data: companyData, error: companyError } = await supabase
            .from('companies')
            .select(`
                *,
                address: addresses (*),
                reseller: resellers (
                    id,
                    reseller_name,
                    contact_email,
                    contact_phone,
                    address: addresses (*)
                )
            `)
            .eq('id', companyId)
            .single();

        if (companyError) {
            console.error(`CompanyService: Error fetching company details for company ${companyId}:`, companyError.message);
            throw new Error(`Failed to fetch company details: ${companyError.message}`);
        }

        if (!companyData) {
            console.warn(`CompanyService: Company ${companyId} not found, though user ${userId} is linked.`);
            throw new Error(`Company not found for ID: ${companyId}`);
        }

        // Rename reseller.reseller_name to reseller.name for frontend consistency if needed
        if (companyData.reseller && companyData.reseller.reseller_name) {
            companyData.reseller.name = companyData.reseller.reseller_name;
            // delete companyData.reseller.reseller_name; // Optional: remove the original field
        }


        console.log(`CompanyService: Successfully fetched company details for company ${companyId}`);
        return companyData;

    } catch (error) {
        console.error(`CompanyService: Error in getCompanyForAdmin for user ${userId}:`, error.message);
        // Re-throw the error to be handled by the route
        throw error;
    }
};

// Update Company details for the currently logged-in Company Admin using RPC for atomicity
export const updateCompanyForAdmin = async (userId, updates) => {
    console.log(`CompanyService: updateCompanyForAdmin called for user ${userId} with updates:`, updates);
    try {
        // Note: The RPC function performs its own check to ensure the user is a company admin
        // and gets the company ID internally based on auth.uid(). We don't strictly need
        // getUserCompanyId here anymore for the core logic.

        // Separate address updates from company updates
        const { address: addressUpdates, ...companyUpdates } = updates;

        // Basic validation can still happen here if needed.
        if (companyUpdates.company_name === '') {
            throw new Error("Company name cannot be empty.");
        }
        // Add more validation as needed...


        console.log(`CompanyService: Calling RPC update_company_and_address for user ${userId}`);
        // *** USE THE RPC FUNCTION ***
        const { data: updatedCompanyData, error: rpcError } = await supabase.rpc(
            'update_company_and_address',
            {
                // Ensure parameters are passed as JSONB objects
                p_company_updates: companyUpdates || {}, // Pass company updates JSON, default to empty object
                p_address_updates: addressUpdates || {} // Pass address updates JSON, default to empty object
            }
        );

        if (rpcError) {
            console.error(`CompanyService: RPC call failed for user ${userId}:`, rpcError);
            // Check for specific errors raised by the function
            if (rpcError.message.includes('is not a company admin')) {
                 throw new Error('Forbidden: You are not authorized to perform this update.');
            }
            // Provide a more generic error for other cases
            throw new Error(rpcError.message || 'Failed to update company information via RPC.');
        }

        if (!updatedCompanyData) {
             console.error(`CompanyService: RPC call for user ${userId} returned no data.`);
             throw new Error('Update operation completed, but failed to retrieve updated company data.');
        }

        console.log(`CompanyService: Successfully updated company via RPC for user ${userId}.`);
        // The RPC function returns the data in the desired format already
        return updatedCompanyData;

    } catch (error) {
        console.error(`CompanyService: Error in updateCompanyForAdmin (RPC) for user ${userId}:`, error.message);
        // Re-throw the specific error message caught or a generic one
        throw new Error(error.message || 'An unexpected error occurred while updating company information.');
    }
};


// Get Users for a specific Company (with authorization checks)
export const getUsersForCompany = async (targetCompanyId, requestingUserId, requestingUserRole) => {
    console.log(`CompanyService: getUsersForCompany called for company ${targetCompanyId} by user ${requestingUserId} (${requestingUserRole})`);

    try {
        // Authorization Checks:
        if (requestingUserRole === 'company_admin') {
            // Company Admin can only see users of their own company.
            const adminCompanyId = await getUserCompanyId(requestingUserId);
             if (!adminCompanyId) {
                 throw new Error('Forbidden: Could not verify your company affiliation.');
             }
            if (adminCompanyId !== targetCompanyId) {
                console.warn(`CompanyService: Company Admin ${requestingUserId} attempted to access users of company ${targetCompanyId}`);
                throw new Error('Forbidden: You can only view users of your own company.');
            }
        } else if (requestingUserRole === 'reseller_admin') {
            // Reseller Admin can only see users of companies assigned to their reseller ID.
            // Use Admin Client to check the link between the requesting user (via resellers.admin_user_id)
            // and the target company (via companies.reseller_id).
             const adminClient = createAdminClient();
             if (!adminClient) throw new Error("Admin client is required for Reseller Admin check.");

             // Check if the target company belongs to the reseller managed by the requesting user
             const { data: checkData, error: checkError } = await adminClient
                .from('resellers')
                .select('id, companies!inner(id)')
                .eq('admin_user_id', requestingUserId) // Check if this user is the admin for the reseller
                .eq('companies.id', targetCompanyId) // Check if the target company is linked to this reseller
                .maybeSingle(); // Use maybeSingle as the link might not exist

             if (checkError) {
                 console.error(`CompanyService: Error checking reseller permissions for user ${requestingUserId} and company ${targetCompanyId}:`, checkError.message);
                 throw new Error(`Error checking reseller permissions: ${checkError.message}`);
             }
             if (!checkData) {
                 console.warn(`CompanyService: Reseller Admin ${requestingUserId} authorization failed for company ${targetCompanyId}.`);
                 throw new Error(`Forbidden: Company ${targetCompanyId} is not managed by you or you are not the designated admin for the reseller.`);
             }

             console.log(`CompanyService: Reseller Admin ${requestingUserId} authorized for company ${targetCompanyId}.`);

        } else if (requestingUserRole === 'global_admin') {
            // Global Admin can see users of any company. No specific check needed here.
            console.log(`CompanyService: Global Admin ${requestingUserId} authorized.`);
        } else {
            // Should not happen if authorizeRole middleware is used correctly
            throw new Error('Forbidden: Insufficient role for this operation.');
        }

        // Fetch users belonging to the target company
        // Use standard client - RLS on 'users' table should allow admins (CA, RA, GA)
        // to see users based on their own role and the target user's company_id.
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, role, created_at, first_name, last_name, is_active, license_consumed') // Select more fields for user management
            .eq('company_id', targetCompanyId);

        if (usersError) {
            console.error(`CompanyService: Error fetching users for company ${targetCompanyId}:`, usersError.message);
            throw new Error(`Failed to fetch users: ${usersError.message}`);
        }

        console.log(`CompanyService: Successfully fetched ${users.length} users for company ${targetCompanyId}`);
        return users || []; // Return empty array if no users found

    } catch (error) {
        console.error(`CompanyService: Error in getUsersForCompany for company ${targetCompanyId}:`, error.message);
        throw error; // Re-throw
    }
};


// --- Service functions for Reseller/Global Admins ---

// TODO: Implement functions like:
// - getAllCompanies(requestingUserId, requestingUserRole, filters)
// - getCompanyById(companyId, requestingUserId, requestingUserRole) // Needs auth checks
// - createCompany(companyData, requestingUserId, requestingUserRole)
// - updateCompany(companyId, companyUpdates, requestingUserId, requestingUserRole)
// - deleteCompany(companyId, requestingUserId, requestingUserRole)
