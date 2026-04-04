/**
 * Seed script — creates 3 demo users if they don't already exist.
 * Run: node src/utils/seed.js
 * (requires a valid MONGODB_URI in .env)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

const DEMO_USERS = [
  { name: 'jaison',    email: 'admin@rtjmotors.com',    password: 'admin123',    role: 'admin'    },
  { name: 'Sinto', email: 'purchase@rtjmotors.com', password: 'purchase123', role: 'purchase' },
  { name: 'renjini',    email: 'sales@rtjmotors.com',    password: 'sales123',    role: 'sales'    },
];

const seed = async () => {
  await connectDB();

  for (const u of DEMO_USERS) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log(`⏭  ${u.email} already exists — skipping`);
      continue;
    }
    // User.create triggers the pre-save hook that hashes the password
    await User.create(u);
    console.log(`✅ Created: ${u.email} (${u.role})`);
  }

  console.log('\n🔑 Demo credentials:');
  console.log('   admin@carapp.com    / admin123');
  console.log('   purchase@carapp.com / purchase123');
  console.log('   sales@carapp.com    / sales123\n');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
