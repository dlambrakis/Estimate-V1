// src/backend/routes/companyRoutes.js
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js'; // Adjusted path
import { getCompanyById, getCompanyForAdmin, updateCompanyForAdmin, getUsersForCompany } from '../services/companyService.js'; // Adjusted path

const router = express.Router();

// GET /api/companies/my-company - Get the company details for the logged-in company admin
router.get('/my-company', authenticateToken, authorizeRole(['company_admin']), async (req, res) => {
    const userId = req.user.id; // User ID from token
    const userRole = req.user.role; // Role from token

    console.log(`CompanyRoutes: /my-company requested by user ${userId} with role ${userRole}`);

    try {
        // The service function will use the userId to find the associated company
        const companyData = await getCompanyForAdmin(userId);
        console.log(`CompanyRoutes: /my-company returning data for user ${userId}`);
        res.json(companyData);
    } catch (error) {
        console.error(`CompanyRoutes: Error in /my-company for user ${userId}:`, error);
        // Send appropriate status code based on error type
        if (error.message.includes('not found') || error.message.includes('No company associated')) {
            res.status(404).json({ message: error.message });
        } else if (error.message.includes('Forbidden') || error.message.includes('Unauthorized')) {
             res.status(403).json({ message: error.message });
        }
        else {
            res.status(500).json({ message: error.message || 'Failed to fetch company data.' });
        }
    }
});

// PUT /api/companies/my-company - Update the company details for the logged-in company admin
router.put('/my-company', authenticateToken, authorizeRole(['company_admin']), async (req, res) => {
    const userId = req.user.id;
    const companyUpdates = req.body; // { name, contact_email, contact_phone, address: { ... } }

    console.log(`CompanyRoutes: PUT /my-company requested by user ${userId} with data:`, companyUpdates);

    try {
        const updatedCompany = await updateCompanyForAdmin(userId, companyUpdates);
        console.log(`CompanyRoutes: /my-company updated successfully for user ${userId}`);
        res.json(updatedCompany);
    } catch (error) {
        console.error(`CompanyRoutes: Error updating /my-company for user ${userId}:`, error);
         if (error.message.includes('not found') || error.message.includes('No company associated')) {
             res.status(404).json({ message: error.message });
         } else if (error.message.includes('Forbidden') || error.message.includes('Unauthorized')) {
              res.status(403).json({ message: error.message });
         } else if (error.message.includes('Validation failed')) {
              res.status(400).json({ message: error.message });
         }
         else {
             res.status(500).json({ message: error.message || 'Failed to update company data.' });
         }
    }
});


// GET /api/companies/:companyId/users - Get users for a specific company (accessible by company admin of that company, reseller admin, global admin)
router.get('/:companyId/users', authenticateToken, authorizeRole(['company_admin', 'reseller_admin', 'global_admin']), async (req, res) => {
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role;
    const targetCompanyId = req.params.companyId;

    console.log(`CompanyRoutes: User ${requestingUserId} (${requestingUserRole}) requesting users for company ${targetCompanyId}`);

    try {
        // Service function needs to handle authorization internally based on role and relationship
        const users = await getUsersForCompany(targetCompanyId, requestingUserId, requestingUserRole);
        console.log(`CompanyRoutes: Returning users for company ${targetCompanyId}`);
        res.json(users);
    } catch (error) {
        console.error(`CompanyRoutes: Error fetching users for company ${targetCompanyId} by user ${requestingUserId}:`, error);
        if (error.message.includes('Forbidden') || error.message.includes('Unauthorized')) {
            res.status(403).json({ message: error.message });
        } else if (error.message.includes('not found')) {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message || 'Failed to fetch company users.' });
        }
    }
});


// --- Routes for Reseller/Global Admins ---

// GET /api/companies - Get a list of companies (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement a service function `getAllCompanies(requestingUserId, requestingUserRole)` that filters based on role/reseller assignment

// GET /api/companies/:id - Get a specific company's details (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Use or adapt `getCompanyById(companyId, requestingUserId, requestingUserRole)` with proper checks

// POST /api/companies - Create a new company (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement a service function `createCompany(companyData, requestingUserId, requestingUserRole)`

// PUT /api/companies/:id - Update a company (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement a service function `updateCompany(companyId, companyUpdates, requestingUserId, requestingUserRole)`

// DELETE /api/companies/:id - Delete a company (for Reseller/Global Admins - CAREFUL!)
// Add authorizeRole(['global_admin']) // Maybe only Global Admins?
// Implement a service function `deleteCompany(companyId, requestingUserId, requestingUserRole)`


export default router;
