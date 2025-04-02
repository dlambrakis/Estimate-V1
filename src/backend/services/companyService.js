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
        throw new Error('User is not associated with a company.');
    }
    console.log(`CompanyService: User ${userId} belongs to company ${user.company_id}`);
    return user.company_id;
};


// Get Company details for the currently logged-in Company Admin
export const getCompanyForAdmin = async (userId) => {
    console.log(`CompanyService: getCompanyForAdmin called for user ${userId}`);
    try {
        const companyId = await getUserCompanyId(userId); // Verify user belongs to a company

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
                    name,
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

        console.log(`CompanyService: Successfully fetched company details for company ${companyId}`);
        return companyData;

    } catch (error) {
        console.error(`CompanyService: Error in getCompanyForAdmin for user ${userId}:`, error.message);
        // Re-throw the error to be handled by the route
        throw error;
    }
};

// Update Company details for the currently logged-in Company Admin
export const updateCompanyForAdmin = async (userId, updates) => {
    console.log(`CompanyService: updateCompanyForAdmin called for user ${userId} with updates:`, updates);
    try {
        const companyId = await getUserCompanyId(userId); // Verify user belongs to a company and get ID

        // Separate address updates from company updates
        const { address: addressUpdates, ...companyUpdates } = updates;

        // Validate updates (basic example)
        if (companyUpdates.id || companyUpdates.reseller_id || companyUpdates.created_at || companyUpdates.updated_at) {
            console.warn("Attempted to update protected company fields.");
            // Unset forbidden fields instead of throwing error?
            delete companyUpdates.id;
            delete companyUpdates.reseller_id; // Admins shouldn't change their reseller link directly
            delete companyUpdates.created_at;
            delete companyUpdates.updated_at;
        }
         if (addressUpdates && (addressUpdates.id || addressUpdates.created_at || addressUpdates.updated_at)) {
             console.warn("Attempted to update protected address fields.");
             delete addressUpdates.id;
             delete addressUpdates.created_at;
             delete addressUpdates.updated_at;
         }


        // Use transaction if updating multiple tables (company and address)
        // Supabase JS client doesn't directly support multi-table transactions easily without RPC.
        // We'll perform updates sequentially. If one fails, the other might have succeeded.
        // Consider using a PL/pgSQL function (RPC) for atomicity if critical.

        let updatedCompanyData = null;

        // 1. Update Company table
        if (Object.keys(companyUpdates).length > 0) {
            console.log(`CompanyService: Updating companies table for ID ${companyId} with:`, companyUpdates);
            const { data: companyResult, error: companyError } = await supabase
                .from('companies')
                .update(companyUpdates)
                .eq('id', companyId)
                .select() // Select updated data
                .single();

            if (companyError) {
                console.error(`CompanyService: Error updating companies table for ${companyId}:`, companyError.message);
                throw new Error(`Failed to update company details: ${companyError.message}`);
            }
            updatedCompanyData = companyResult;
            console.log(`CompanyService: Companies table updated for ${companyId}.`);
        }

        // 2. Update Address table (Upsert logic: update if exists, insert if not)
        if (addressUpdates && Object.keys(addressUpdates).length > 0) {
             // Find the current address ID associated with the company
             const { data: currentCompany, error: fetchError } = await supabase
                 .from('companies')
                 .select('address_id')
                 .eq('id', companyId)
                 .single();

             if (fetchError) throw new Error(`Failed to fetch current address ID: ${fetchError.message}`);

             const currentAddressId = currentCompany?.address_id;

             if (currentAddressId) {
                 // Address exists, update it
                 console.log(`CompanyService: Updating addresses table for ID ${currentAddressId} with:`, addressUpdates);
                 const { error: addressError } = await supabase
                     .from('addresses')
                     .update(addressUpdates)
                     .eq('id', currentAddressId);

                 if (addressError) {
                     console.error(`CompanyService: Error updating addresses table for ${currentAddressId}:`, addressError.message);
                     throw new Error(`Failed to update address details: ${addressError.message}`);
                 }
                 console.log(`CompanyService: Addresses table updated for ${currentAddressId}.`);
             } else {
                 // No address exists, insert a new one and link it
                 console.log(`CompanyService: Inserting new address for company ${companyId} with:`, addressUpdates);
                 const { data: newAddress, error: insertError } = await supabase
                     .from('addresses')
                     .insert(addressUpdates)
                     .select('id')
                     .single();

                 if (insertError) {
                     console.error(`CompanyService: Error inserting new address for company ${companyId}:`, insertError.message);
                     throw new Error(`Failed to create address: ${insertError.message}`);
                 }

                 const newAddressId = newAddress.id;
                 console.log(`CompanyService: New address created with ID ${newAddressId}. Linking to company ${companyId}.`);

                 // Link the new address ID back to the company
                 const { error: linkError } = await supabase
                     .from('companies')
                     .update({ address_id: newAddressId })
                     .eq('id', companyId);

                 if (linkError) {
                     console.error(`CompanyService: Error linking new address ${newAddressId} to company ${companyId}:`, linkError.message);
                     // This leaves an orphaned address. Consider cleanup or RPC.
                     throw new Error(`Failed to link new address to company: ${linkError.message}`);
                 }
                 console.log(`CompanyService: Successfully linked new address ${newAddressId} to company ${companyId}.`);
             }
        }

        // 3. Fetch the final updated company data including potentially updated/created address and reseller info
        console.log(`CompanyService: Refetching updated company data for ${companyId}`);
        const finalData = await getCompanyForAdmin(userId); // Re-use the fetch logic
        return finalData;

    } catch (error) {
        console.error(`CompanyService: Error in updateCompanyForAdmin for user ${userId}:`, error.message);
        throw error; // Re-throw to be handled by the route
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
            if (adminCompanyId !== targetCompanyId) {
                console.warn(`CompanyService: Company Admin ${requestingUserId} attempted to access users of company ${targetCompanyId}`);
                throw new Error('Forbidden: You can only view users of your own company.');
            }
        } else if (requestingUserRole === 'reseller_admin') {
            // Reseller Admin can only see users of companies assigned to their reseller ID.
            // 1. Get reseller ID for the requesting user.
            // 2. Check if targetCompanyId belongs to that reseller.
            // This requires joining users -> resellers and companies -> resellers.
            // Using supabaseAdmin might be simpler here if RLS is complex.
             const adminClient = createAdminClient();
             if (!adminClient) throw new Error("Admin client is required for Reseller Admin check.");

             const { data: resellerLink, error: linkError } = await adminClient
                .from('resellers')
                .select('id, companies!inner(id)')
                .eq('admin_user_id', requestingUserId) // Assuming a link from resellers to their admin user
                .eq('companies.id', targetCompanyId)
                .maybeSingle();

             if (linkError) throw new Error(`Error checking reseller permissions: ${linkError.message}`);
             if (!resellerLink) throw new Error(`Forbidden: Company ${targetCompanyId} is not managed by you.`);

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
        // The RLS policy needs to handle these relationships.
        // Example RLS (simplified):
        // - GA: true
        // - RA: EXISTS (SELECT 1 FROM companies c JOIN resellers r ON c.reseller_id = r.id WHERE c.id = users.company_id AND r.admin_user_id = auth.uid())
        // - CA: users.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, email, role, created_at') // Select only necessary fields
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
