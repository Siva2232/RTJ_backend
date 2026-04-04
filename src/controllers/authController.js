const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const { generateToken } = require('../utils/generateToken');
const { logActivity } = require('../services/activityService');

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
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
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
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    },
    'User created successfully'
  );
};

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  return sendSuccess(
    res,
    200,
    {
      user: {
        id:        req.user._id,
        name:      req.user.name,
        email:     req.user.email,
        role:      req.user.role,
        isActive:  req.user.isActive,
        createdAt: req.user.createdAt,
      },
    },
    'Profile fetched'
  );
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

module.exports = { login, register, getMe, getAllUsers, updateUser };
