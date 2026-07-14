# Enterprise Leave Management System (HRMS)

A production-ready, highly scalable, and visually stunning Leave & Attendance Management System (similar to Keka, Zoho People, and BambooHR) with an advanced Leave Policy Engine, Automatic Monthly Allocation Cron Jobs, Role-Based Approval Workflows, PDF/Excel reports, and a real-time NLP HR AI chatbot.

---

## 🛠 Technology Stack

### Backend
- **Node.js & Express.js**: REST API Service layer.
- **MongoDB & Mongoose**: Database models and audit log registries.
- **JWT & Bcryptjs**: Security, password hashing, and token-based protection.
- **Socket.io**: Real-time push notifications.
- **Node-Cron**: Monthly automatic leave credit engine.
- **ExcelJS & PDFKit**: Styled report builders and document generators.

### Frontend
- **Next.js 15 (App Router)**: Modern SSR React framework.
- **TypeScript**: Complete type safety.
- **Tailwind CSS**: Custom HSL dark/light visual theme tokens.
- **Zustand**: Global application and UI state management.
- **TanStack Query (React Query)**: Caching and data sync handlers.
- **NextAuth (JWT)**: Session credentials logins.
- **Recharts**: Data visualization & charts.
- **Date-fns**: Date-range algorithms.

---

## 📁 Workspace Folder Structure

```
├── backend/
│   ├── src/
│   │   ├── controllers/      # Auth, Employees, Policies, Leaves, Reports, AI, Dashboards
│   │   ├── cron/             # node-cron monthly allocations
│   │   ├── middleware/       # JWT protect, Role authorizations
│   │   ├── models/           # User, Department, Policy, Application Mongoose schemas
│   │   ├── routes/           # REST endpoints map (api.js)
│   │   ├── scripts/          # database seed script
│   │   └── server.js         # HTTP, Socket.io, and DB connection entry point
│   ├── tests/                # Jest testing suites
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router (login, dashboard, leaves, reports, calendar)
│   │   ├── components/       # Shell Navigation Layout, AI Chatbot drawer
│   │   ├── lib/              # Axios interceptors config
│   │   └── store/            # Zustand global state
│   ├── Dockerfile
│   └── package.json
│
└── docker-compose.yml        # Orchestration configuration
```

---

## 🔑 Sandbox Credentials (Demo Testing)

You can use the quick-sandbox buttons on the login page or enter these credentials directly:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@company.com` | `Admin@123` |
| **HR Admin** | `hr@company.com` | `Hr@123` |
| **Manager** | `manager@company.com` | `Manager@123` |
| **Employee** | `employee@company.com` | `Employee@123` |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Local instance or Atlas connection string)
- Docker & Docker Compose (Optional)

---

### Local Installation & Run

#### 1. Setup Backend
1. Navigate to `/backend` directory.
2. Create/edit `.env` file:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://bhattg439_db_user:<db_password>@leavemanagement.vl0l9ru.mongodb.net/LeaveManagement
   JWT_SECRET=jwt_secret_dev_123_enterprise_hrms_987
   CORS_ORIGIN=http://localhost:3000
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Seed the database (creates policies, types, departments, holidays, and users):
   ```bash
   npm run seed
   ```
5. Run in development mode:
   ```bash
   npm run dev
   ```

---

#### 2. Setup Frontend
1. Navigate to `/frontend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Next.js in development mode:
   ```bash
   npm run dev
   ```
4. Access the web app at: `http://localhost:3000`

---

### Run using Docker Compose

To spin up the database, backend, and frontend containers in one command, run in the root folder:

```bash
docker-compose up --build
```
This mounts:
- Database at `localhost:27017`
- REST APIs at `localhost:5000`
- Web Dashboard at `localhost:3000`

---

## 🧪 Running Tests
To run unit and integration tests (validating policy sandwich calculations and limit calculations):
```bash
cd backend
npm run test
```

---

## 🌐 Production Deployment Guide

Since this is a monorepo workspace, you will configure specific directories for your deployments.

### 1. Deploy Backend (Express.js) to Render

Render is ideal for hosting our Node.js API server and background cron processes.

1. **Sign in to Render**: Log in to [Render](https://render.com) and link your GitHub account.
2. **Create Web Service**: Click **New +** -> **Web Service**.
3. **Select Repository**: Pick your `GauravGauri/Leave-Management` repository.
4. **Configuration Details**:
   - **Name**: `leave-management-backend`
   - **Root Directory**: `backend` (This is critical so Render runs commands inside `/backend`)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. **Environment Variables**: Click **Advanced** and add the following keys:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `MONGODB_URI`: `mongodb+srv://bhattg439_db_user:<YOUR_PASSWORD>@leavemanagement.vl0l9ru.mongodb.net/LeaveManagement?retryWrites=true&w=majority`
   - `JWT_SECRET`: `<YOUR_JWT_SECRET_STRING>`
   - `CORS_ORIGIN`: `<YOUR_VERCEL_FRONTEND_URL>` (e.g. `https://leave-management-portal.vercel.app`)
6. **Deploy**: Click **Create Web Service**. Note down the backend URL generated by Render (e.g., `https://leave-management-backend.onrender.com`).

---

### 2. Deploy Frontend (Next.js) to Vercel

Vercel is the native host for Next.js applications.

1. **Sign in to Vercel**: Log in to [Vercel](https://vercel.com) and connect your GitHub account.
2. **Import Project**: Click **Add New** -> **Project**, and import `GauravGauri/Leave-Management`.
3. **Configure Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select the `frontend` folder.
   - **Build & Development Settings**: Keep defaults (`npm run build` / `.next`).
4. **Environment Variables**: Add the following configurations:
   - `NEXT_PUBLIC_API_URL`: `<YOUR_RENDER_BACKEND_URL>/api` (e.g., `https://leave-management-backend.onrender.com/api`)
   - `NEXTAUTH_URL`: Your Vercel deployment URL (e.g., `https://leave-management-portal.vercel.app`)
   - `NEXTAUTH_SECRET`: `<YOUR_NEXTAUTH_SECRET_STRING>` (Generate a secure random string)
5. **Deploy**: Click **Deploy**. Vercel will build the frontend, optimize assets, and launch your Next.js App router online.

