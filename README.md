# RestoPOS — Professional Multi-Tenant POS System

A complete, production-ready restaurant management system built with **Next.js 15**, **React 18**, **Prisma ORM**, and **PostgreSQL**.

## 🎯 Features

- **Multi-Tenant Architecture** - Multiple restaurants in one platform
- **Role-Based Access Control** - SUPERADMIN, ADMIN, MANAGER, WAITER, KITCHEN, CASHIER
- **Real-time Updates** - Pusher integration for live notifications
- **Complete POS Flow** - Orders, Reservations, Payments, Reports
- **Kitchen Display System (KDS)** - Full-screen order management
- **Thermal Receipt Printing** - 80mm receipt format
- **Type-Safe** - Full TypeScript with strict mode
- **Database** - PostgreSQL with Prisma ORM

## 📦 Project Structure

```
restoran-pos/
├── apps/
│   ├── web/          → React 18 + Vite Frontend
│   └── server/       → Next.js 15 Backend
├── packages/
│   ├── types/        → Shared TypeScript types
│   ├── ui/           → Shared UI components (Radix UI + Tailwind)
│   └── utils/        → Shared utility functions
└── docker-compose.yml → PostgreSQL + Redis
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm 9+
- Docker (optional, for PostgreSQL/Redis)

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# 3. Start database (Docker)
docker-compose up -d

# 4. Initialize database
cd apps/server
pnpm prisma db push
pnpm prisma studio  # View data

# 5. Start development
cd ../..
pnpm dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Prisma Studio: http://localhost:5555

## 📚 Documentation

### Authentication
- **SuperAdmin**: Email + Password login at `/superadmin/login`
- **Restaurant Staff**: PIN login at `/login`

### API Structure
- SuperAdmin endpoints: `/api/superadmin/*`
- Staff endpoints: `/api/*` with `restaurantId` in JWT

### Database
- ORM: Prisma
- Database: PostgreSQL
- Migrations: `pnpm db:migrate`

## 🏗️ Development Workflow

```bash
# Development
pnpm dev              # All apps
pnpm build            # Production build
pnpm type-check       # TypeScript check
pnpm lint             # ESLint
pnpm format           # Code format

# Database
pnpm db:push          # Push schema
pnpm db:migrate       # Create migration
pnpm db:studio        # Prisma Studio
```

## 🔐 Security

- JWT-based authentication
- Role-based authorization middleware
- Input validation with Zod
- Password hashing with bcrypt
- Environment variable management
- CORS configured

## 🌍 Deployment

### Frontend (Vercel / Cloudflare Pages)
```bash
pnpm build
```

### Backend (Vercel / Railway)
- Database: Supabase or Railway PostgreSQL
- Redis: Upstash
- Files: Cloudinary

### Production Worker

Report exports run outside the request lifecycle with BullMQ:

```bash
pnpm --filter @restopos/server worker:reports
```

Deploy this as a separate Railway/Render worker process with the same `DATABASE_URL` and `REDIS_URL` as the API. Generated files are written under `REPORT_EXPORT_DIR`; mount persistent storage or replace `lib/report-storage.ts` with object storage for multi-instance deployments.

### Required Environment

Use `apps/server/.env.example` and `apps/web/.env.example` for Vercel, Railway, Supabase, Upstash, Pusher and Cloudinary. In production set `RATE_LIMIT_PROD_REDIS_ONLY=true`, strict `CORS_ORIGINS`, strong `JWT_SECRET`/`NEXTAUTH_SECRET`, and provider-specific webhook secrets.

## 📄 License

MIT

## 🤝 Support

For issues and questions, please open an issue on GitHub.
