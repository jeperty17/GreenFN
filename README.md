# GreenFN

## IS3108 Group 1
Built by: Alloy Chan, Cho Seungmin, Jesper Tay

A modern CRM platform designed for financial advisors to manage client relationships, track interactions, and streamline their sales pipeline.

## Overview

GreenFN is a full-stack web application that helps financial advisors organize and manage their client relationships efficiently. It provides tools for contact management, interaction tracking, pipeline management, task scheduling, and AI-powered summaries.

## Tech Stack

### Backend

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: bcryptjs for password hashing
- **AI Integration**: Google Generative AI
- **Database Adapter**: @prisma/adapter-pg

### Frontend

- **Framework**: React 19
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v7
- **Drag & Drop**: dnd-kit
- **Notifications**: Sonner
- **Themes**: next-themes
- **Deployment**: Vercel

### Deployment

- **Backend**: Railway
- **Frontend**: Vercel

## Project Structure

```
greenfn/                    # Backend application
├── src/
│   ├── app.js             # Express app setup
│   ├── server.js          # Server entry point
│   ├── config/            # Configuration files
│   ├── lib/               # Shared utilities
│   ├── middleware/        # Express middleware
│   ├── modules/           # Feature modules (auth, contacts, ai, etc.)
│   ├── routes/            # API routes
│   ├── utils/             # Utility functions
│   └── workers/           # Background workers (task reminders, etc.)
├── prisma/
│   ├── schema.prisma      # Database schema
│   ├── seed.js            # Database seeding script
│   └── migrations/        # Database migrations
├── generated/             # Generated Prisma client
└── package.json

greenfn-web/              # Frontend application
├── src/
│   ├── components/        # React components
│   ├── pages/            # Page components
│   ├── routes/           # Route configurations
│   ├── context/          # React context
│   ├── config/           # Frontend config
│   ├── lib/              # Utilities
│   └── types/            # TypeScript types
├── public/               # Static assets
├── vite.config.ts        # Vite configuration
├── tsconfig.json         # TypeScript config
└── package.json

supabase/                 # Supabase configuration
└── config.toml
```

## Key Features

- **Contact Management**: Create and manage client contacts with detailed information
- **Sales Pipeline**: Organize contacts into customizable pipeline stages
- **Interaction Tracking**: Record all communications and interactions with clients
- **AI-Powered Summaries**: Automatic summaries of client interactions using Google Generative AI
- **Task Management**: Create tasks and set reminders for follow-ups
- **User Authentication**: Secure JWT-based authentication system
- **Message Templates**: Pre-defined templates for common messages
- **Activity Logs**: Track changes and activities on contacts
- **Responsive UI**: Modern, intuitive interface with dark/light theme support

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn package manager

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd GreenFN
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env` in the `greenfn` directory:

   ```bash
   cp greenfn/.env.example greenfn/.env
   ```

   Update the `.env` file with your configuration:
   - Database connection string
   - JWT secret
   - Google Generative AI API key
   - CORS settings

4. **Set up the database**

   ```bash
   cd greenfn
   npm run prisma:migrate:deploy
   ```

5. **Seed the database (optional)**
   ```bash
   npm run prisma:seed
   ```

## Running the Application (Development)

### Backend

Start the development server:

```bash
cd greenfn
npm run dev
```

The API server will start on `http://localhost:3000` (or your configured port).

### Frontend

Start the development server:

```bash
cd greenfn-web
npm run dev
```

The web application will be available at `http://localhost:5173` (Vite default).

## Deployment

### Live URLs

- **Frontend**: https://greenfn-web.vercel.app/
- **Backend API**: greenfn-api-production.up.railway.app

### Frontend Deployment (Vercel)

The frontend is automatically deployed to Vercel on every push to the main branch:

1. Connect your GitHub repository to Vercel
2. Configure the build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**: Add `VITE_API_BASE_URL` pointing to your Railway backend

### Backend Deployment (Railway)

The backend is deployed on Railway and includes:

1. PostgreSQL database provisioning
2. Node.js server runtime
3. Automatic deployments on push to main branch

**Railway Setup**:

- Connect your GitHub repository to Railway
- Set up PostgreSQL plugin for the database
- Configure environment variables (DATABASE_URL, JWT_SECRET, etc.)
- Deploy using Railway CLI or GitHub integration

## Available Scripts

### Backend (greenfn/)

- `npm run dev` - Start development server with auto-reload
- `npm start` - Start production server
- `npm run server` - Alias for dev
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate:dev` - Create and apply new migrations
- `npm run prisma:migrate:status` - Check migration status
- `npm run prisma:migrate:deploy` - Deploy migrations to database
- `npm run prisma:db:push` - Push schema changes to database
- `npm run prisma:seed` - Seed database with initial data
- `npm run prisma:studio` - Open Prisma Studio for database management
- `npm run tasks:reminders` - Run task reminder worker

### Frontend (greenfn-web/)

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Environment Variables

Key environment variables required:

- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - Secret key for JWT signing
- `API_BASE_PATH` - API base path (e.g., `/api`)
- `GOOGLE_API_KEY` - Google Generative AI API key
- `CORS_ALLOWED_ORIGINS` - Comma-separated list of allowed origins
- `FRONTEND_URL` - Frontend application URL
