// src/backend/routes/licenseRoutes.js
import express from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware.js'; // Adjusted path
import { getLicenseByCompanyId } from '../services/licenseService.js'; // Adjusted path

const router = express.Router();

// GET /api/licenses/my-license - Get license details for the logged-in user's company
// This assumes the user is a company_admin or company_user associated with a company.
router.get('/my-license', authenticateToken, authorizeRole(['company_admin', 'company_user']), async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log(`LicenseRoutes: /my-license requested by user ${userId} (${userRole})`);

    try {
        // Service function needs the user ID to find the associated company ID first
        const licenseData = await getLicenseByCompanyId(null, userId); // Pass userId, let service find companyId
        console.log(`LicenseRoutes: /my-license returning data for user ${userId}`);
        res.json(licenseData);
    } catch (error) {
        console.error(`LicenseRoutes: Error in /my-license for user ${userId}:`, error);
        if (error.message.includes('not found') || error.message.includes('No company associated') || error.message.includes('No license found')) {
            res.status(404).json({ message: error.message });
        } else if (error.message.includes('Forbidden') || error.message.includes('Unauthorized')) {
             res.status(403).json({ message: error.message });
        } else {
            res.status(500).json({ message: error.message || 'Failed to fetch license data.' });
        }
    }
});


// --- Routes for Reseller/Global Admins ---

// GET /api/licenses - Get a list of licenses (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement service function `getAllLicenses(requestingUserId, requestingUserRole, queryParams)`

// GET /api/licenses/company/:companyId - Get license for a specific company (for Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Use `getLicenseByCompanyId(companyId, requestingUserId, requestingUserRole)` with checks

// POST /api/licenses - Create a new license (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement service function `createLicense(licenseData, requestingUserId, requestingUserRole)`

// PUT /api/licenses/:licenseId - Update a license (for Reseller/Global Admins)
// Add authorizeRole(['reseller_admin', 'global_admin'])
// Implement service function `updateLicense(licenseId, licenseUpdates, requestingUserId, requestingUserRole)`

// DELETE /api/licenses/:licenseId - Delete a license (for Reseller/Global Admins - CAREFUL!)
// Add authorizeRole(['global_admin']) // Maybe only Global Admins?
// Implement service function `deleteLicense(licenseId, requestingUserId, requestingUserRole)`


export default router;
