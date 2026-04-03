import { Router } from 'express';
import { EmployeeGroupService } from '../../services/employeeGroupService.js';
const router = Router();
// GET /api/v1/employee-groups
router.get('/', async (req, res) => {
    try {
        const groups = await EmployeeGroupService.getGroups(req.user.orgId);
        res.status(200).json(groups);
    }
    catch (error) {
        console.error('Get employee groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/employee-groups/by-location/:locationId/employees
router.get('/by-location/:locationId/employees', async (req, res) => {
    try {
        const employees = await EmployeeGroupService.getEmployeesByLocation(req.user.orgId, String(req.params.locationId));
        res.status(200).json(employees);
    }
    catch (error) {
        console.error('Get employees by location error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/employee-groups/:id
router.get('/:id', async (req, res) => {
    try {
        const group = await EmployeeGroupService.getGroup(req.user.orgId, String(req.params.id));
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.status(200).json(group);
    }
    catch (error) {
        console.error('Get employee group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/employee-groups
router.post('/', async (req, res) => {
    try {
        const { name, locationId } = req.body;
        if (!name || !locationId) {
            return res.status(400).json({ error: 'name and locationId are required' });
        }
        const group = await EmployeeGroupService.createGroup(req.user.orgId, name, locationId);
        res.status(201).json(group);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A group with that name already exists' });
        }
        console.error('Create employee group error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// PUT /api/v1/employee-groups/:id
router.put('/:id', async (req, res) => {
    try {
        const group = await EmployeeGroupService.updateGroup(req.user.orgId, String(req.params.id), req.body.name, req.body.locationId);
        res.status(200).json(group);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'A group with that name already exists' });
        }
        console.error('Update employee group error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// DELETE /api/v1/employee-groups/:id
router.delete('/:id', async (req, res) => {
    try {
        await EmployeeGroupService.deleteGroup(req.user.orgId, String(req.params.id));
        res.status(204).send();
    }
    catch (error) {
        console.error('Delete employee group error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// POST /api/v1/employee-groups/:id/members
router.post('/:id/members', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }
        await EmployeeGroupService.addMember(req.user.orgId, String(req.params.id), userId);
        // Return the updated group with members
        const group = await EmployeeGroupService.getGroup(req.user.orgId, String(req.params.id));
        res.status(200).json(group);
    }
    catch (error) {
        console.error('Add member error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
// DELETE /api/v1/employee-groups/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
    try {
        await EmployeeGroupService.removeMember(req.user.orgId, String(req.params.id), String(req.params.userId));
        res.status(204).send();
    }
    catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});
export default router;
