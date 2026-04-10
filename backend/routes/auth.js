const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

router.post('/register', authController.register);
router.post('/login', rateLimiter, authController.login);
router.get('/me', auth, authController.getMe);
router.get('/settings', auth, authController.getSettings);
router.put('/settings', auth, authController.updateSettings);
router.put('/profile', auth, authController.updateProfile);
router.delete('/user/:username', auth, authController.deleteUser);

module.exports = router;
