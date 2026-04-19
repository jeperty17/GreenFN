# GreenFN

A modern CRM platform designed for financial advisors to manage client relationships, track interactions, and streamline their sales pipeline.

## What is GreenFN?

GreenFN helps financial advisors stay organised and efficient by centralising:

- Client contact management  
- Interaction tracking  
- Sales pipeline management  
- Task and follow-up reminders  
- AI-generated summaries of client interactions  

It’s designed to reduce manual admin work so advisors can focus on closing deals.

## Project Team

**IS3108 Group 1**

Members: Alloy Chan, Cho Seungmin, Jesper Tay  

## Live App (Deployment)

- **Frontend**: https://greenfn-web.vercel.app/  
- **Backend**: https://greenfn-api-production.up.railway.app (only contains JSON responses, primarily intended to support frontend application only)

## Tech Stack

**Frontend**
- React (Vite + TypeScript)
- Radix UI
- Tailwind CSS + ShadCN

**Backend**
- Node.js + Express
- Supabase (PostgresQL + Prisma)

**Other**
- JWT Authentication  
- Google Generative AI (for summaries)  

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
- **AI-Powered Summaries**: Generate structured summaries of client interactions using Gemini (Do note there is a limit of 20 requests per day because we are using the free tier from Google AI Studio)
- **Task Management**: Create tasks and set reminders for follow-ups
- **User Authentication**: Secure JWT-based authentication system

## Getting Started

### Prerequisites
- Node.js
- Docker Desktop (for local Supabase)

1. Clone the repository
```bash
   git clone 
   cd GreenFN
```

2. Install dependencies
```bash
   # From project root
   npm install

   # Backend
   cd greenfn
   npm install

   # Frontend
   cd ../greenfn-web
   npm install
```

3. Set up backend environment variables
```bash
   cp greenfn/.env.example greenfn/.env
```
   Fill in the values in `greenfn/.env` — see the Environment Variables section below.

4. Start Docker Desktop, then start local Supabase (from project root)
```bash
   npx supabase start
```

5. Apply database migrations and seed (from greenfn/)
```bash
   cd greenfn
   npm run prisma:migrate:dev
   npm run prisma:seed
```

6. Start the backend (from greenfn/)
```bash
   npm run dev
```
   Runs at http://localhost:3000

7. Start the frontend in a separate terminal (from greenfn-web/)
```bash
   cd greenfn-web
   npm run dev
```
   Runs at http://localhost:5173

8. To stop local Supabase when done (from project root)
```bash
   npx supabase stop
```

## Environment Variables (greenfn/.env)
```
PORT=3000
NODE_ENV=development
DATABASE_URL=         # Supabase pooled connection URL (from supabase start output)
DIRECT_URL=           # Supabase direct connection URL (from supabase start output)
JWT_SECRET=           # Any secure random string
GEMINI_API_KEY=       # Google Gemini API key (get free key from Google AI Studio)
CORS_ALLOWED_ORIGINS=http://localhost:5173
```
