import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdminUser() {
  try {
    console.log('🌱 Seeding admin user...');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@deenmate.app';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminRole = process.env.ADMIN_ROLE || 'super_admin';

    // Check if admin user already exists
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log(`✅ Admin user ${adminEmail} already exists`);
      return;
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    // Create admin user
    const admin = await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        role: adminRole,
        isActive: true,
      },
    });

    console.log(`✅ Admin user created successfully:`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}`);
    console.log(`   Password: ${adminPassword} (change this in production!)`);

  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seedAdminUser()
  .then(() => {
    console.log('🎉 Admin user seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Admin user seeding failed:', error);
    process.exit(1);
  });
