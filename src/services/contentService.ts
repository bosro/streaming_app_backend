import { ContentCategory, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ContentService {
  public async checkUserAccess(userId: string, contentId: string): Promise<boolean> {
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      select: { isPremium: true, isPublished: true },
    });

    if (!content || !content.isPublished) {
      return false;
    }

    // If content is not premium, allow access
    if (!content.isPremium) {
      return true;
    }

    // Check user's subscription tier
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    return user?.subscriptionTier !== 'FREE';
  }

  public async getUserProgress(userId: string, contentId: string) {
    return await prisma.contentView.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });
  }

  public async updateUserProgress(
    userId: string,
    contentId: string,
    progress: number,
    duration?: number
  ) {
    // Convert undefined to null for duration
    const durationValue = duration !== undefined ? duration : null;
  
    return await prisma.contentView.upsert({
      where: { userId_contentId: { userId, contentId } },
      update: {
        progress,
        duration: durationValue, // Use null instead of undefined
        completed: progress >= 90,
        updatedAt: new Date(),
      },
      create: {
        userId,
        contentId,
        progress,
        duration: durationValue, // Use null instead of undefined
        completed: progress >= 90,
      },
    });
  }

  public async getRecommendations(userId: string, limit: number = 10) {
    // Get user's viewing history
    const userViews = await prisma.contentView.findMany({
      where: { userId },
      include: { content: { select: { category: true, tags: true } } },
      orderBy: { viewedAt: 'desc' },
      take: 20,
    });

    if (userViews.length === 0) {
      // Return popular content for new users
      return await prisma.content.findMany({
        where: { isPublished: true },
        orderBy: { viewCount: 'desc' },
        take: limit,
      });
    }

    // Extract user preferences
    const categoryCount: Record<ContentCategory, number> = {
      VIDEOS: 0,
      SHORTS: 0,
      MINDGASM: 0,
      AUDIOBOOKS: 0
    }; // Use ContentCategory as key type
    const tagCount: Record<string, number> = {};

    userViews.forEach(view => {
      categoryCount[view.content.category] = (categoryCount[view.content.category] || 0) + 1;
      view.content.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    const preferredCategories: ContentCategory[] = Object.keys(categoryCount)
      .sort((a, b) => categoryCount[b as ContentCategory] - categoryCount[a as ContentCategory])
      .map(category => category as ContentCategory); // Ensure type is ContentCategory[]

    const preferredTags = Object.keys(tagCount)
      .sort((a, b) => tagCount[b] - tagCount[a])
      .slice(0, 5);

    // Get viewed content IDs to exclude
    const viewedContentIds = userViews.map(view => view.contentId);

    // Find similar content
    const recommendations = await prisma.content.findMany({
      where: {
        isPublished: true,
        id: { notIn: viewedContentIds },
        OR: [
          { category: { in: preferredCategories } }, // Now type-safe
          { tags: { hasSome: preferredTags } },
        ],
      },
      orderBy: [
        { viewCount: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    return recommendations;
  }

  public async getContentAnalytics(contentId: string) {
    const [content, views, downloads] = await Promise.all([
      prisma.content.findUnique({
        where: { id: contentId },
        select: { 
          viewCount: true, 
          downloadCount: true,
          createdAt: true,
        },
      }),
      prisma.contentView.count({
        where: { contentId },
      }),
      prisma.download.count({
        where: { contentId },
      }),
    ]);

    return {
      ...content,
      uniqueViews: views,
      totalDownloads: downloads,
    };
  }
}