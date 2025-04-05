// src/backend/services/companyService.js
import { supabase, supabaseAdmin, createAdminClient } from '../../config/supabaseClient.js'; // Adjusted path

// Helper function to get user's company ID (remains the same)
const getUserCompanyId = async (userId) => {
    // --- DETAILED LOGGING START ---
    console.log(`DEBUG: getUserCompanyId called. Input userId: '${userId}' (Type: ${typeof userId})`);

    if (!userId) {
        console.error("DEBUG: getUserCompanyId received null or undefined userId. Throwing error.");
        throw new Error("User ID cannot be null or undefined.");
    }
    // --- DETAILED LOGGING END ---

    console.log(`CompanyService: Fetching company ID for user ${userId} using ADMIN client.`);

    if (!supabaseAdmin) {
        console.error("CompanyService: supabaseAdmin client is not available. Cannot fetch user company ID.");
        throw new Error("Internal server error: Admin client configuration missing.");
    }

    // --- DETAILED LOGGING START ---
    console.log(`DEBUG: Executing query: supabaseAdmin.from('users').select('company_id', { count: 'exact' }).eq('id', '${userId}').maybeSingle()`);
    // --- DETAILED LOGGING END ---

    const { data, error, count, status, statusText } = await supabaseAdmin // Use admin client
        .from('users')
        .select('company_id', { count: 'exact' }) // Request count explicitly
        .eq('id', userId) // Use the validated userId
        .maybeSingle(); // Use maybeSingle to handle 0 rows gracefully

    // --- DETAILED LOGGING START ---
    console.log("DEBUG: Supabase query result:");
    console.log(`  Status: ${status} ${statusText}`);
    console.log(`  Count: ${count}`);
    console.log(`  Error: ${error ? JSON.stringify(error) : 'null'}`);
    console.log(`  Data: ${data ? JSON.stringify(data) : 'null'}`);
    // --- DETAILED LOGGING END ---

    // Check for errors during the query itself
    if (error) {
        console.error(`CompanyService: Error fetching company ID for user ${userId} (Admin Client):`, error.message);
        // Log the full error object for more details
        console.error("Full Supabase Error Object:", JSON.stringify(error, null, 2));
        throw new Error(`Database error fetching user profile: ${error.message}`);
    }

    // Check the count explicitly
    if (count === 0) {
         console.warn(`CompanyService: User profile not found in users table for ID: ${userId} (Admin Client). Count was 0.`);
         throw new Error(`User profile not found for ID: ${userId}`);
    }

    if (count > 1) {
         // This should be impossible with the primary key constraint, but good to check.
         console.error(`CompanyService: CRITICAL - Found multiple (${count}) user profiles for ID: ${userId}. Data inconsistency.`);
         throw new Error(`Data integrity issue: Multiple profiles found for user ID: ${userId}`);
    }

    // At this point, we expect count to be 1
    if (count !== 1) {
        // This is a safeguard, should have been caught above.
        console.error(`CompanyService: Unexpected count value (${count}) after checks for user ID: ${userId}.`);
        throw new Error(`Unexpected database result count: ${count}`);
    }

    // Check if data is null/undefined even if count is 1
    if (!data) {
        // This case should theoretically not happen if count is 1 and no error occurred, but safeguard anyway.
        console.error(`CompanyService: Count was 1 but data is null/undefined for ID: ${userId}. Unexpected error.`);
        throw new Error(`Unexpected error retrieving profile data for user ID: ${userId}`);
    }

     if (!data.company_id) {
         console.warn(`CompanyService: User ${userId} exists but is not associated with any company (company_id is null/missing in data).`);
         // For getCompanyForAdmin, we need the ID, so throw error.
         throw new Error('User is not associated with a company.');
     }

    console.log(`CompanyService: User ${userId} belongs to company ${data.company_id}`);
    return data.company_id;
};


// Get Company details for the currently logged-in Company Admin
export const getCompanyForAdmin = async (userId) => {
    console.log(`CompanyService: getCompanyForAdmin called for user ${userId}`);
    try {
        const companyId = await getUserCompanyId(userId); // Uses admin client

        // Ensure admin client is available for ALL data fetching in this function
        if (!supabaseAdmin) {
            console.error("CompanyService: supabaseAdmin client is not available. Cannot fetch company details.");
            throw new Error("Internal server error: Admin client configuration missing.");
        }

        // Step 1: Fetch main company data using ADMIN client (bypasses RLS)
        console.log(`CompanyService: Fetching main company data for company ${companyId} using ADMIN client.`);
        const { data: companyData, error: companyError } = await supabaseAdmin // USE ADMIN CLIENT
            .from('companies')
            .select('*') // Select all company fields, including address_id and reseller_id
            .eq('id', companyId)
            .single(); // Use single() as we expect exactly one row for the ID

        if (companyError) {
            console.error(`CompanyService: Error fetching main company data for company ${companyId} (Admin Client):`, companyError.message);
            // If using .single(), PGRST116 means not found
            if (companyError.code === 'PGRST116') throw new Error(`Company not found for ID: ${companyId}`);
            throw new Error(`Failed to fetch company details: ${companyError.message}`);
        }
        if (!companyData) {
             // Should be caught by .single() error, but safeguard
             throw new Error(`Company not found for ID: ${companyId}`);
        }

        console.log("CompanyService: Main company data fetched (Admin Client):", JSON.stringify(companyData));

        // Initialize final result object
        const finalCompanyData = { ...companyData, address: null, reseller: null };

        // Step 2: Fetch address if address_id exists using ADMIN client
        if (companyData.address_id) {
            console.log(`CompanyService: Attempting to fetch address ${companyData.address_id} using ADMIN client.`);
            const { data: addressData, error: addressError } = await supabaseAdmin // USE ADMIN CLIENT
                .from('addresses')
                .select('*')
                .eq('id', companyData.address_id)
                .maybeSingle();

            console.log(`CompanyService: Admin client address fetch result - Error: ${addressError ? JSON.stringify(addressError) : 'null'}, Data: ${addressData ? JSON.stringify(addressData) : 'null'}`);

            if (addressError) {
                console.warn(`CompanyService: Error fetching address ${companyData.address_id} (Admin Client): ${addressError.message}. Proceeding without address.`);
            } else if (addressData) {
                finalCompanyData.address = addressData;
                console.log(`CompanyService: Successfully fetched and assigned address ${companyData.address_id} (Admin Client).`);
            } else {
                 console.warn(`CompanyService: Address ${companyData.address_id} linked to company ${companyId} not found (Admin Client).`);
            }
        } else {
             console.log(`CompanyService: Company ${companyId} has no linked address_id.`);
        }

        // Step 3: Fetch reseller if reseller_id exists using ADMIN client
        if (companyData.reseller_id) {
            console.log(`CompanyService: Attempting to fetch reseller ${companyData.reseller_id} using ADMIN client.`);
            const { data: resellerData, error: resellerError } = await supabaseAdmin // USE ADMIN CLIENT
                .from('resellers')
                .select(`
                    *,
                    address: addresses!address_id (*)
                `)
                .eq('id', companyData.reseller_id)
                .maybeSingle();

            console.log(`CompanyService: Admin client reseller fetch result - Error: ${resellerError ? JSON.stringify(resellerError) : 'null'}, Data: ${resellerData ? JSON.stringify(resellerData) : 'null'}`);

            if (resellerError) {
                console.warn(`CompanyService: Error fetching reseller ${companyData.reseller_id} (Admin Client): ${resellerError.message}. Proceeding without reseller.`);
            } else if (resellerData) {
                if (resellerData.reseller_name) {
                    resellerData.name = resellerData.reseller_name;
                }
                finalCompanyData.reseller = resellerData;
                console.log(`CompanyService: Successfully fetched and assigned reseller ${companyData.reseller_id} (Admin Client).`);
            } else {
                 console.warn(`CompanyService: Reseller ${companyData.reseller_id} linked to company ${companyId} not found (Admin Client).`);
            }
        } else {
             console.log(`CompanyService: Company ${companyId} has no linked reseller_id.`);
        }

        console.log("CompanyService: Final combined data being returned:", JSON.stringify(finalCompanyData));
        return finalCompanyData;

    } catch (error) {
        console.error(`CompanyService: Error in getCompanyForAdmin (multi-query) for user ${userId}:`, error.message);
        throw error; // Propagate specific error message
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
            throw new Error("Validation failed: Company name cannot be empty.");
        }
        // Add more validation as needed...


        console.log(`CompanyService: Calling RPC update_company_and_address for user ${userId}`);
        // *** USE THE RPC FUNCTION ***
        // Use the standard client, as the RPC function runs with invoker's rights
        // and performs its own authorization checks internally.
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
            // Use the admin client helper to be safe
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
        // If this fails, check RLS policies on 'users'.
        console.log(`CompanyService: Fetching users for company ${targetCompanyId} using STANDARD client.`);
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, role, created_at, first_name, last_name, is_active, license_consumed') // Select more fields for user management
            .eq('company_id', targetCompanyId);

        if (usersError) {
            console.error(`CompanyService: Error fetching users for company ${targetCompanyId} (Standard Client):`, usersError.message);
             if (usersError.code === '42501') { // RLS violation
                 console.error(`CompanyService: RLS VIOLATION fetching users for company ${targetCompanyId} by user ${requestingUserId}. Check 'users' table policies.`);
                 throw new Error(`Forbidden: You do not have permission to view users for this company.`);
             }
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
