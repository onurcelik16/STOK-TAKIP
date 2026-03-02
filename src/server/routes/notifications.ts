import { Router } from 'express';
import { db } from '../data/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get recent notifications for user
router.get('/', authMiddleware, (req: AuthRequest, res) => {
    try {
        const notifications = db.prepare(`
      SELECT id, type, title, message, is_read, product_id, created_at 
      FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 100
    `).all(req.userId!);

        res.json(notifications);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Mark a specific notification as read
router.put('/:id/read', authMiddleware, (req: AuthRequest, res) => {
    try {
        const id = Number(req.params.id);
        db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
            .run(id, req.userId!);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Mark all as read
router.put('/read-all', authMiddleware, (req: AuthRequest, res) => {
    try {
        db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')
            .run(req.userId!);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Delete all notifications
router.delete('/', authMiddleware, (req: AuthRequest, res) => {
    try {
        db.prepare('DELETE FROM notifications WHERE user_id = ?')
            .run(req.userId!);
        res.json({ ok: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
