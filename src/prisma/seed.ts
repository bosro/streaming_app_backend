import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mystreamingapp.com' },
    update: {},
    create: {
      email: 'admin@mystreamingapp.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      subscriptionTier: 'PREMIUM',
      isEmailVerified: true,
    },
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample products
  const products = [
    {
      name: 'Premium Meditation Cushion',
      description: 'High-quality meditation cushion for enhanced comfort during practice.',
      price: 49.99,
      category: 'meditation',
      images: ['https://example.com/cushion1.jpg', 'https://example.com/cushion2.jpg'],
      inStock: true,
      stockQuantity: 100,
      isDigital: false,
      weight: 1.5,
      dimensions: { length: 40, width: 40, height: 15 },
    },
    {
      name: 'Mindfulness Guide eBook',
      description: 'Complete digital guide to mindfulness and meditation practices.',
      price: 19.99,
      category: 'ebooks',
      images: ['https://example.com/ebook1.jpg'],
      inStock: true,
      stockQuantity: 999,
      isDigital: true,
      digitalFileUrl: 'https://example.com/mindfulness-guide.pdf',
    },
    {
      name: 'Aromatherapy Essential Oil Set',
      description: 'Premium essential oils for relaxation and meditation.',
      price: 79.99,
      category: 'aromatherapy',
      images: ['https://example.com/oils1.jpg', 'https://example.com/oils2.jpg'],
      inStock: true,
      stockQuantity: 50,
      isDigital: false,
      weight: 0.8,
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.upsert({
      where: { name: productData.name },
      update: {},
      create: productData,
    });
    console.log('✅ Product created:', product.name);
  }

  // Create sample content
  const content = [
    {
      title: 'Introduction to Mindfulness',
      description: 'A beginner-friendly guide to mindfulness meditation.',
      category: 'VIDEOS' as const,
      type: 'VIDEO' as const,
      thumbnailUrl: 'https://example.com/intro-mindfulness.jpg',
      duration: 1200, // 20 minutes
      isPremium: false,
      isAdultContent: false,
      tags: ['mindfulness', 'beginner', 'meditation'],
      fileUrl: 'videos/intro-mindfulness.mp4',
      hlsUrl: 'videos/intro-mindfulness.m3u8',
    },
    {
      title: 'Advanced Breathing Techniques',
      description: 'Deep breathing exercises for experienced practitioners.',
      category: 'AUDIOBOOKS' as const,
      type: 'AUDIO' as const,
      thumbnailUrl: 'https://example.com/breathing.jpg',
      duration: 1800, // 30 minutes
      isPremium: true,
      isAdultContent: false,
      tags: ['breathing', 'advanced', 'techniques'],
      fileUrl: 'audio/breathing-techniques.mp3',
    },
    {
      title: 'Quick Stress Relief',
      description: 'Short meditation for instant stress relief.',
      category: 'SHORTS' as const,
      type: 'AUDIO' as const,
      thumbnailUrl: 'https://example.com/stress-relief.jpg',
      duration: 300, // 5 minutes
      isPremium: false,
      isAdultContent: false,
      tags: ['stress', 'quick', 'relief'],
      fileUrl: 'audio/stress-relief.mp3',
    },
    {
      title: 'MindGasm Sensory Journey',
      description: 'Immersive sensory experience for deep relaxation.',
      category: 'MINDGASM' as const,
      type: 'AUDIO' as const,
      thumbnailUrl: 'https://example.com/mindgasm.jpg',
      duration: 2400, // 40 minutes
      isPremium: true,
      isAdultContent: true,
      tags: ['mindgasm', 'sensory', 'immersive'],
      fileUrl: 'audio/mindgasm-journey.mp3',
    },
  ];

  for (const contentData of content) {
    const contentItem = await prisma.content.upsert({
      where: { title: contentData.title },
      update: {},
      create: {
        ...contentData,
        metadata: {},
        isPublished: true,
      },
    });
    console.log('✅ Content created:', contentItem.title);
  }

  // Create sample notifications
  const notification = await prisma.notification.create({
    data: {
      title: 'Welcome to MyStreamingApp!',
      body: 'Start your mindfulness journey with our curated content.',
      type: 'GENERAL',
      targetUsers: ['all'],
      data: {
        action: 'welcome',
        category: 'onboarding',
      },
      sentAt: new Date(),
      sentCount: 1,
    },
  });

  console.log('✅ Notification created:', notification.title);

  // Create admin settings
  const settings = [
    {
      key: 'app_name',
      value: 'MyStreamingApp',
      updatedBy: admin.id,
    },
    {
      key: 'maintenance_mode',
      value: false,
      updatedBy: admin.id,
    },
    {
      key: 'max_downloads_standard',
      value: 10,
      updatedBy: admin.id,
    },
    {
      key: 'max_downloads_premium',
      value: -1, // unlimited
      updatedBy: admin.id,
    },
  ];

  for (const setting of settings) {
    await prisma.adminSettings.upsert({
      where: { key: setting.key },
      update: {
        value: setting.value,
        updatedBy: setting.updatedBy,
      },
      create: setting,
    });
    console.log('✅ Setting created:', setting.key);
  }

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });