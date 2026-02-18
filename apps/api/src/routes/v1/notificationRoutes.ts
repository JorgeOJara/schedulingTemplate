import { Router } from 'express';
import { NotificationService } from '../../services/notificationService.js';
import { AuthRequest } from '../../middleware/auth.js';

const router = Router();

// GET /api/v1/notifications
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notifications = await NotificationService.getNotifications(req.user!.id, {
      isRead: req.query.isRead as string === 'true' ? true : req.query.isRead as string === 'false' ? false : undefined,
      type: req.query.type as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/notifications/:id/read
router.patch('/:id/read', async (req: AuthRequest, res) => {
  try {
    const notification = await NotificationService.markAsRead(req.params.id, req.user!.id);
    
    res.status(200).json(notification);
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', async (req: AuthRequest, res) => {
  try {
    await NotificationService.markAllAsRead(req.user!.id);
    
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/v1/notifications/unread-count
router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const count = await NotificationService.getUnreadCount(req.user!.id);
    
    res.status(200).json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
