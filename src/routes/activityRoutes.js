const router = require('express').Router();
const { getLogs } = require('../controllers/activityController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, authorizeRoles('admin'), getLogs);

module.exports = router;
