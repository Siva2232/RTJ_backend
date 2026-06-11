const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const { generateToken } = require('../utils/generateToken');
const { logActivity } = require('../services/activityService');

const formatUser = (user) => ({
  id: user._id,
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  profilePicture: user.profilePicture || null,
  createdAt: user.createdAt,
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isActive: true }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const token = generateToken({ id: user._id, role: user.role });

  await logActivity({
    user,
    action: 'user_login',
    details: { email: user.email },
    ipAddress: req.ip,
  });

  return sendSuccess(
    res,
    200,
    {
      token,
      user: formatUser(user),
    },
    'Login successful'
  );
};

// ─── POST /api/auth/register (admin only) ─────────────────────────────────────
const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already registered');

  const user = await User.create({ name, email, password, role });

  await logActivity({
    user: req.user,
    action: 'user_created',
    details: { createdUser: email, role },
    ipAddress: req.ip,
  });

  return sendSuccess(
    res,
    201,
    {
      user: formatUser(user),
    },
    'User created successfully'
  );
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  return sendSuccess(res, 200, { user: formatUser(req.user) }, 'Profile fetched');
};

// ─── GET /api/auth/users (admin only) ────────────────────────────────────────
const getAllUsers = async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 });
  return sendSuccess(res, 200, { users, count: users.length }, 'Users fetched');
};

// ─── PATCH /api/auth/users/:id (admin only) ──────────────────────────────────
const updateUser = async (req, res) => {
  const { isActive, role, name } = req.body;
  const update = {};
  if (typeof isActive === 'boolean') update.isActive = isActive;
  if (role) update.role = role;
  if (name) update.name = name;

  const user = await User.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  }).select('-password');

  if (!user) throw new ApiError(404, 'User not found');

  return sendSuccess(res, 200, { user }, 'User updated successfully');
};

// ─── PATCH /api/auth/profile (logged-in user) ──────────────────────────────────
const updateProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw new ApiError(404, 'User not found');

  const { name, currentPassword, newPassword } = req.body;

  if (name && name.trim()) user.name = name.trim();

  if (newPassword) {
    if (!currentPassword) throw new ApiError(400, 'Current password is required to set a new password');
    if (!(await user.matchPassword(currentPassword))) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    if (newPassword.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
    user.password = newPassword;
  }

  if (req.file) {
    user.profilePicture = `/uploads/avatars/${req.file.filename}`;
  }

  await user.save();

  await logActivity({
    user,
    action: 'profile_updated',
    details: { fields: Object.keys(req.body).filter((k) => req.body[k]) },
    ipAddress: req.ip,
  });

  return sendSuccess(res, 200, { user: formatUser(user) }, 'Profile updated successfully');
};

module.exports = { login, register, getMe, getAllUsers, updateUser, updateProfile };
