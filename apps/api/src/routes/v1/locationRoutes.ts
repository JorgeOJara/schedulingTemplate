import { Router } from 'express';
import { LocationService } from '../../services/locationService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/locations
router.get('/', async (req: AuthRequest, res) => {
  try {
    const locations = await LocationService.getLocations(req.user!.orgId);
    
    res.status(200).json(locations);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/locations/:id
router.get('/:id', async (req, res) => {
  try {
    const location = await LocationService.getLocation(req.params.id);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.status(200).json(location);
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/locations
router.post('/', async (req: AuthRequest, res) => {
  try {
    const location = await LocationService.createLocation(
      req.user!.orgId,
      req.body.name,
      req.body.address,
      req.body.phone
    );
    
    res.status(201).json(location);
  } catch (error) {
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/locations/:id
router.put('/:id', async (req, res) => {
  try {
    const location = await LocationService.updateLocation(
      req.params.id,
      req.body.name,
      req.body.address,
      req.body.phone,
      req.body.active
    );
    
    res.status(200).json(location);
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/locations/:id
router.delete('/:id', async (req, res) => {
  try {
    await LocationService.deleteLocation(req.params.id);
    
    res.status(204).send();
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
