# MyStreamingApp Backend

A secure, scalable backend API for a subscription-based streaming platform built with Node.js, Express, TypeScript, PostgreSQL, and Prisma.

## 🚀 Features

- **Authentication & Authorization**: JWT-based auth with role-based access control
- **Content Management**: Video/audio streaming with signed URLs and offline downloads
- **Subscription System**: Stripe integration with Google Play & Apple Store receipt validation
- **E-commerce**: Product management with customizable options and order processing
- **Push Notifications**: Firebase Cloud Messaging integration
- **Admin Dashboard**: Analytics, content management, and user administration
- **Security**: Rate limiting, input validation, SQL injection protection
- **File Storage**: AWS S3/CloudFront integration for media files
- **Documentation**: Auto-generated Swagger/OpenAPI documentation

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with security middleware
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Sessions**: Redis
- **Payments**: Stripe API
- **Storage**: AWS S3 + CloudFront
- **Push Notifications**: Firebase Admin SDK
- **Email**: Nodemailer
- **Testing**: Jest + Supertest
- **Deployment**: Docker + Docker Compose

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- PostgreSQL 12+
- Redis 6+
- AWS S3 account (or Cloudflare R2)
- Stripe account
- Firebase project (for push notifications)

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd mystreamingapp-backend