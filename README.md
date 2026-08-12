# 🚀 TeamOS

<div align="center">

### Production-grade Multi-Tenant SaaS Project Management Platform

*Inspired by Linear • Asana • Jira*

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis)
![BullMQ](https://img.shields.io/badge/BullMQ-FFB000?style=for-the-badge)
![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker)

*A portfolio-grade backend project focused on real SaaS architecture rather than CRUD.*

</div>

---

> **⚠️ Frontend is currently under development.**
>
> This repository currently focuses on a production-inspired backend architecture. UI screenshots and a live demo will be added once the React frontend is complete.

---

# ✨ Why TeamOS?

TeamOS is a production-inspired SaaS project management platform built from scratch to learn how modern software companies architect scalable backend systems.

Instead of optimizing for the fastest MVP, this project prioritizes:

- 🏗 Modular architecture
- 👥 Multi-tenant SaaS design
- 🔐 Secure authentication & RBAC
- ⚡ Realtime infrastructure
- 📬 Background job processing
- 📊 Production engineering practices
- 🐳 Containerized development
- 📦 Maintainability and extensibility

---

# 🚀 Engineering Highlights

| | |
|---|---|
| 🏢 | Shared Database Multi-Tenancy |
| 🔐 | Better Auth Authentication |
| 👥 | Workspace RBAC |
| 📁 | Projects & Tasks |
| 🏃 | Sprint Management |
| 💬 | Comments |
| 📎 | Attachment Storage |
| 📈 | Activity Feed |
| 🔔 | Notification Infrastructure |
| 📬 | Queue-based Email Delivery |
| 🔍 | PostgreSQL Full-Text Search |
| ⚡ | Socket.IO Infrastructure |
| 🐳 | Docker Development Environment |

---

# 🏗 Architecture

```text
                 Client (Frontend)

              REST API / Socket.IO
                      │
               Express Application
                      │
      ┌───────────────┼───────────────┐
      │               │               │
 Authentication   Feature Modules   Realtime
      │               │               │
      └───────────────┼───────────────┘
                      │
                 Service Layer
                      │
      ┌───────────────┼───────────────┐
      │               │               │
 PostgreSQL        Redis          File Storage
      │               │
   Prisma ORM      BullMQ
                      │
             Background Workers
```

---

# 📦 Current Features

| Module | Status |
|--------|:------:|
| Authentication | ✅ |
| Workspace Management | ✅ |
| Invitations | ✅ |
| Multi-tenancy | ✅ |
| Projects | ✅ |
| Tasks | ✅ |
| Comments | ✅ |
| Sprint Management | ✅ |
| Sprint Task Assignment | ✅ |
| Activity Feed | ✅ |
| Attachments | ✅ |
| PostgreSQL Search | ✅ |
| Notifications Infrastructure | ✅ |
| Queue-based Email | ✅ |
| Socket.IO Infrastructure | ✅ |
| Docker Development | ✅ |

---

# 🛠 Tech Stack

## Backend

- Node.js
- Express
- TypeScript

## Database

- PostgreSQL
- Prisma ORM

## Infrastructure

- Docker
- Docker Compose
- Redis
- BullMQ

## Authentication

- Better Auth

## Validation

- Zod

## Email

- Resend

## Realtime

- Socket.IO

---

# 📂 Project Structure

```text
backend/
├── prisma/
├── src/
│   ├── modules/
│   ├── middleware/
│   ├── realtime/
│   ├── storage/
│   ├── queues/
│   ├── config/
│   ├── lib/
│   └── shared/
├── uploads/
├── Dockerfile
└── package.json
```

---

# ⚡ Quick Start

```bash
git clone https://github.com/kush-dabade/TeamOS.git
cd TeamOS

# Copy the example env files and fill in the required values (database/redis
# credentials, TRUSTED_ORIGINS, etc.) - the backend image always runs with
# NODE_ENV=production, so these are required even for local development.
cp .env.example .env
cp backend/.env.example backend/.env

docker compose up --build
```

---

# ⭐ Backend Features

- Shared database multi-tenancy
- Role-based access control
- Modular monolith architecture
- Queue-driven background workers
- Redis integration
- Email processing
- Notification infrastructure
- PostgreSQL full-text search
- Activity logging
- Local storage abstraction
- Future S3-ready storage design
- Socket.IO realtime foundation
- Dockerized development workflow
- Strict TypeScript
- Prisma ORM

---

# 🗺 Roadmap

## ✅ Completed

- [x] Authentication
- [x] Multi-tenancy
- [x] Workspace Management
- [x] Invitations
- [x] Projects
- [x] Tasks
- [x] Comments
- [x] Sprint Management
- [x] Activity Feed
- [x] Attachments
- [x] PostgreSQL Search
- [x] Notification Infrastructure
- [x] Queue-based Email
- [x] Socket.IO Infrastructure
- [x] Docker Development Environment

## 🚧 Next

- [ ] React Frontend
- [ ] Kanban Board
- [ ] Dashboard
- [ ] S3 Storage Provider
- [ ] Production Deployment
- [ ] CI/CD Pipeline

---

# 🎯 Project Goals

This project exists to demonstrate practical experience with:

- Backend Engineering
- SaaS Architecture
- System Design
- Docker
- PostgreSQL
- Redis
- BullMQ
- Socket.IO
- Production TypeScript
- Scalable Backend Design

---

# 🤝 Contributing

This project is currently a personal learning and portfolio project. Contributions and feedback are welcome once the core MVP is complete.

---

# 📄 License

MIT
