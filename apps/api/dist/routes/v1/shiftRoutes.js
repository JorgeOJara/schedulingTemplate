import { Router } from 'express';
import { ShiftService } from '../../services/shiftService.js';
const router = Router();
// GET /api/v1/shifts/:id
router.get('/:id', async (req, res) => {
    try {
        const shift = await ShiftService.getShift(String(req.params.id), req.user.orgId);
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        res.status(200).json(shift);
    }
    catch (error) {
        console.error('Get shift error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/shifts
router.get('/', async (req, res) => {
    try {
        const { weekId, departmentId, locationId, employeeId } = req.query;
        const shifts = await ShiftService.getShiftsByWeek(String(weekId), req.user.orgId, {
            departmentId: departmentId ? String(departmentId) : undefined,
            locationId: locationId ? String(locationId) : undefined,
            employeeId: employeeId ? String(employeeId) : undefined,
        });
        res.status(200).json(shifts);
    }
    catch (error) {
        console.error('Get shifts error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/shifts
router.post('/', async (req, res) => {
    try {
        const shift = await ShiftService.createShift(req.user.orgId, req.body);
        res.status(201).json(shift);
    }
    catch (error) {
        console.error('Create shift error:', error);
        const message = String(error?.message || 'Internal server error');
        const lower = message.toLowerCase();
        res.status(lower.includes('conflict') || lower.includes('overlap') ? 409 : 500).json({ error: message });
    }
});
// PUT /api/v1/shifts/:id
router.put('/:id', async (req, res) => {
    try {
        const shift = await ShiftService.updateShift(String(req.params.id), req.user.orgId, req.body);
        res.status(200).json(shift);
    }
    catch (error) {
        console.error('Update shift error:', error);
        const message = String(error?.message || 'Internal server error');
        const lower = message.toLowerCase();
        res.status(lower.includes('conflict') || lower.includes('overlap') ? 409 : 500).json({ error: message });
    }
});
// DELETE /api/v1/shifts/:id
router.delete('/:id', async (req, res) => {
    try {
        await ShiftService.deleteShift(String(req.params.id), req.user.orgId);
        res.status(204).send();
    }
    catch (error) {
        console.error('Delete shift error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
export default router;
