const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../utils/auth');
const {
  getNotificationsByUserId,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../../utils/db');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await getNotificationsByUserId(req.user.id);
    const unreadCount = await getUnreadNotificationCount(req.user.id);
    res.json({ status: 'ok', notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await markNotificationAsRead(req.params.id, req.user.id);
    if (!notification) return res.status(404).json({ status: 'error', message: 'Notification not found' });
    res.json({ status: 'ok', notification });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    await markAllNotificationsAsRead(req.user.id);
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;
