const router = require('express').Router();
const {
  login,
  register,
  getMe,
  getAllUsers,
  updateUser,
} = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { loginRules, registerRules, validate } = require('../validators/authValidator');

router.post('/login',    loginRules, validate, login);
router.post('/register', protect, authorizeRoles('admin'), registerRules, validate, register);
router.get('/me',        protect, getMe);
router.get('/users',     protect, authorizeRoles('admin'), getAllUsers);
router.patch('/users/:id', protect, authorizeRoles('admin'), updateUser);

module.exports = router;
