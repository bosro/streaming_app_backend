#!/bin/bash

# Production deployment script

echo "🚀 Deploying MyStreamingApp Backend to Production"

# Set production environment
export NODE_ENV=production

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Install dependencies
echo "📦 Installing production dependencies..."
npm ci --only=production

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "🗄️ Running database migrations..."
npm run prisma:deploy

# Build application
echo "🔨 Building application..."
npm run build

# Start application with PM2
echo "🎯 Starting application..."
pm2 start ecosystem.config.js --env production

echo "✅ Deployment complete!"