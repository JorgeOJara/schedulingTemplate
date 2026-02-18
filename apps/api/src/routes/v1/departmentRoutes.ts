import { Router } from 'express';
import { DepartmentService } from '../../services/departmentService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/departments
router.get('/', async (req: AuthRequest, res) => {
  try {
    const departments = await DepartmentService.getDepartments(req.user!.orgId);
    
    res.status(200).json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/departments/:id
router.get('/:id', async (req, res) => {
  try {
    const department = await DepartmentService.getDepartment(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.status(200).json(department);
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/departments
router.post('/', async (req: AuthRequest, res) => {
  try {
    const department = await DepartmentService.createDepartment(
      req.user!.orgId,
      req.body.name,
      req.body.description
    );
    
    res.status(201).json(department);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/departments/:id
router.put('/:id', async (req, res) => {
  try {
    const department = await DepartmentService.updateDepartment(
      req.params.id,
      req.body.name,
      req.body.description,
      req.body.active
    );
    
    res.status(200).json(department);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/departments/:id
router.delete('/:id', async (req, res) => {
  try {
    await DepartmentService.deleteDepartment(req.params.id);
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
