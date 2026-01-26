# Quick Start Guide - Dairy Automation System

Welcome to the Dairy Automation System! Follow these steps to get the project running.

---

## 📋 Prerequisites

- **Node.js** (v14+): [Download](https://nodejs.org/)
- **Supabase Account**: [Create Free](https://supabase.com)
- **Git**: [Download](https://git-scm.com/)
- **Code Editor**: VS Code, WebStorm, or similar

---

## 🚀 Setup Steps

### Step 1: Clone the Repository

```bash
cd "d:\College\BE\Dairy Automation system"
```

### Step 2: Set Up Backend

```bash
cd Backend

# Install dependencies
npm install

# Create .env file (copy from `.env.example`)
# Windows (PowerShell):
#   copy .env.example .env
# macOS / Linux:
#   cp .env.example .env
# Safety: Do NOT commit your `.env` file (it may contain secrets). Keep `.env.example` committed with placeholder values only.
# For CI / GitHub Actions, add secrets in repository Settings → Secrets and reference them as `${{ secrets.NAME }}` in workflows. See SUPABASE_SETUP_GUIDE.md for details.
# Edit `.env` with your Supabase credentials
# (Instructions in SUPABASE_SETUP_GUIDE.md)

# Start the server
npm start
# or for development with auto-reload:
npm run dev
```

**Expected Output**:
```
✅ Connected to Supabase PostgreSQL
✅ Server started on port 4000
```

### Step 3: Set Up Frontend

```bash
cd Frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:4000" > .env

# Start the development server
npm run dev
```

**Expected Output**:
```
VITE v[version] ready in [X] ms

➜  Local:   http://localhost:5173/
```

### Step 4: Access the Application

Open your browser and go to:
```
http://localhost:5173/
```

---

## 📚 Project Structure

```
Dairy Automation System/
├── Backend/
│   ├── app.js                 # Express server
│   ├── config.js              # Supabase connection
│   ├── .env.example           # Environment variables template
│   ├── package.json           # Dependencies
│   ├── controller/            # Business logic
│   ├── models/                # Database models
│   ├── routes/                # API endpoints
│   └── utils/                 # Helper functions
│
├── Frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app component
│   │   ├── main.jsx           # Entry point
│   │   ├── components/        # React components
│   │   ├── styles/            # CSS files
│   │   ├── api/               # API calls
│   │   └── assets/            # Images, fonts, etc.
│   ├── vite.config.js         # Vite configuration
│   └── package.json           # Dependencies
│
├── TEAM_DISTRIBUTION.md       # 👈 Read this for task assignments
├── SUPABASE_SETUP_GUIDE.md    # 👈 Read this for database setup
├── CODE_REVIEW.md             # 👈 Read this for improvements made
└── QUICK_START.md             # 👈 You are here
```

---

## 🔐 Creating Supabase Project

### Quick Setup (5 minutes):

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub/Google
4. Click "New Project"
5. Fill in:
   - Project Name: `dairy-automation-system`
   - Database Password: Create a strong password (save it!)
   - Region: Choose closest to your location
6. Click "Create new project" and wait 2-3 minutes
7. Go to Settings → API → Copy:
   - Project URL → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
8. Paste into `Backend/.env`

### Create Database Tables:

Copy all SQL from `SUPABASE_SETUP_GUIDE.md` Step 3 and run in Supabase **SQL Editor**.

---

## 🧪 Testing the APIs

### Test Login Endpoint

```bash
curl -X POST http://localhost:4000/api/customer/login \
  -H "Content-Type: application/json" \
  -d '{
    "emailOrPhone": "test@example.com",
    "password": "password123"
  }'
```

### Test Registration Endpoint

```bash
curl -X POST http://localhost:4000/api/customer/addCustomer \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "customerName": "John Doe",
    "phoneNumber": "9876543210",
    "buildingName": "Skyline Apartments",
    "roomNo": "301"
  }'
```

---

## 📱 Using the Application

### Customer Registration
1. Go to http://localhost:5173/register
2. Fill Step 1: Account Information
3. Click "Next Step"
4. Fill Step 2: Address Information
5. Click "Create Account"
6. Redirected to login page

### Customer Login
1. Go to http://localhost:5173/
2. Enter email or phone number
3. Enter password
4. Click "Log In"
5. Redirected to dashboard

---

## 🐛 Troubleshooting

### Backend won't connect to Supabase
- ❌ **Problem**: "Connection refused"
- ✅ **Solution**: 
  1. Check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
  2. Ensure Supabase project is created and active
  3. Verify internet connection

### Frontend can't connect to backend
- ❌ **Problem**: "Failed to fetch from /api/customer/login"
- ✅ **Solution**:
  1. Make sure backend server is running (`npm start`)
  2. Check if port 4000 is available
  3. Verify `VITE_API_URL=http://localhost:4000` in Frontend `.env`
  4. Restart both servers

### Database tables not found
- ❌ **Problem**: "Relation does not exist"
- ✅ **Solution**:
  1. Go to Supabase SQL Editor
  2. Run all SQL commands from SUPABASE_SETUP_GUIDE.md Step 3
  3. Verify tables appear in Supabase → Database → Tables

### Port 4000 already in use
- ✅ **Solution**: Change port in Backend `app.js` or `.env`

---

## 📖 Important Documents

Read these in order:

1. **QUICK_START.md** (this file) - Setup and first run
2. **TEAM_DISTRIBUTION.md** - Your task assignments and APIs to build
3. **SUPABASE_SETUP_GUIDE.md** - Database configuration and schema
4. **CODE_REVIEW.md** - What was improved and code examples

---

## 🎯 Development Workflow

### For Each Developer:

```bash
# 1. Create your feature branch
git checkout -b dev/your-feature-name

# 2. Make changes and test locally
# Edit files in your assigned modules

# 3. Commit changes
git add .
git commit -m "Feature: Brief description"

# 4. Push to repository
git push origin dev/your-feature-name

# 5. Create Pull Request on GitHub
# Request review from teammates

# 6. After review and approval, merge to develop
```

### Available NPM Scripts:

**Backend**:
```bash
npm start          # Run production server
npm run dev        # Run with auto-reload (nodemon)
```

**Frontend**:
```bash
npm run dev        # Start dev server (http://localhost:5173)
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Check code quality
```

---

## 📞 Getting Help

### Resources:
- **Supabase Docs**: https://supabase.com/docs
- **Express.js Docs**: https://expressjs.com
- **React Docs**: https://react.dev
- **Bootstrap Docs**: https://getbootstrap.com/docs

### Team Communication:
- Daily standup: 10:00 AM
- Weekly sync: Friday 4:00 PM
- Report blockers immediately to lead

---

## ✅ Checklist Before Starting Development

- [ ] Node.js and npm installed
- [ ] Supabase account created
- [ ] Backend `.env` file filled with Supabase credentials
- [ ] Database tables created in Supabase
- [ ] Backend running (`npm start`)
- [ ] Frontend running (`npm run dev`)
- [ ] Can access http://localhost:5173/
- [ ] Can see "Connected to Supabase" in backend console
- [ ] You've read TEAM_DISTRIBUTION.md for your tasks

---

## 🚀 Next Steps

1. **Setup Complete?** → Go to TEAM_DISTRIBUTION.md
2. **Understand Your Tasks** → Check assigned modules
3. **Read Supabase Guide** → Understand database structure
4. **Start Coding** → Implement your assigned features
5. **Test Everything** → Use curl or Postman
6. **Review Code** → Get peer review before merging

---

**Happy Coding! 🎉**

If you face any issues, check the Troubleshooting section above or contact your team lead.

