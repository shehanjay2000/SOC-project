# Complete Setup & Run Instructions

## Prerequisites
- Node.js 16+ installed
- MongoDB account (Atlas or local)
- Google OAuth credentials
- GitHub OAuth credentials

---

## STEP 1: Frontend Setup

### 1.1 Install Frontend Dependencies
```bash
cd C:\Users\sheha\Downloads\global-location-insights
npm install
```

### 1.2 Create `.env.local` (Frontend)
Update the file at the project root:
```
# Google OAuth
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com

# GitHub OAuth
VITE_GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
VITE_GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET
```

**Where to get credentials:**
- **Google:** https://console.cloud.google.com/
- **GitHub:** https://github.com/settings/developers

### 1.3 Run Frontend Dev Server
```bash
npm run dev
```
Frontend will run on: `http://localhost:3000`

---

## STEP 2: Backend Setup

### 2.1 Navigate to Server Folder
```bash
cd C:\Users\sheha\Downloads\global-location-insights\server
```

### 2.2 Install Backend Dependencies
```bash
npm install
```

### 2.3 Create `.env` (Backend)
Update the file at `server/.env`:
```
# MongoDB Connection
MONGODB_URI=mongodb+srv://shehanjay2000_db_user:admin123@service-oriented-projec.4ty0eta.mongodb.net/?appName=service-oriented-project

# Server Port
PORT=5000

# OAuth Credentials (from step 1.2)
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# API Key
API_KEY=secure-app-key-12345
```

### 2.4 Start Backend Server
```bash
npm start
```
Backend will run on: `http://localhost:5000`

You should see:
```
═══════════════════════════════════════════════
  Global Location Insights - Backend Server
═══════════════════════════════════════════════
✓ Server running on port 5000
✓ MongoDB: Connected
✓ OAuth 2.0: Enabled
✓ CORS: http://localhost:3000
...
```

---

## STEP 3: Test the Application

### 3.1 Open Frontend
Go to: `http://localhost:3000`

### 3.2 Sign In
1. Click **"Sign In with OAuth"** button
2. Choose **Google** or **GitHub**
3. Complete authentication
4. User info should appear in header

### 3.3 Gather Location Data
1. Click **"Refresh Data"** button
2. Wait for IP geolocation, country, and city data to load
3. View in the console on the right

### 3.4 Submit to Backend
1. Toggle **"Simulate Backend"** to OFF (to use real backend)
2. Click **"Secure Submit to Backend"** button
3. Data should be sent to your backend and stored in MongoDB

### 3.5 View Success Message
You should see:
```
✓ Data successfully validated and stored in MongoDB
Record ID: 65f2a9b...
```

---

## COMPLETE TERMINAL SETUP (Quick Copy-Paste)

### Terminal 1: Backend
```bash
cd C:\Users\sheha\Downloads\global-location-insights\server
npm install
npm start
```

### Terminal 2: Frontend
```bash
cd C:\Users\sheha\Downloads\global-location-insights
npm install
npm run dev
```

---

## Troubleshooting

### Frontend won't start
```bash
# Clear cache and reinstall
rm -r node_modules package-lock.json
npm install
npm run dev
```

### Backend won't connect to MongoDB
- Check MongoDB URI in `server/.env`
- Ensure IP is whitelisted in MongoDB Atlas
- Test connection: https://www.mongodb.com/docs/manual/reference/connection-string/

### OAuth login fails
- Check Client IDs in `.env.local` and `server/.env`
- Ensure redirect URIs match in OAuth provider settings
- For Google: Add `http://localhost:3000` as authorized origin
- For GitHub: Add `http://localhost:3000` as callback URL (or use `http://localhost:3000/` if redirected)

### "Cannot connect to backend"
- Ensure backend is running on port 5000
- Check backend server output for errors
- Verify CORS is enabled (should show in backend console)

### Port already in use
Change port in `server/.env`:
```
PORT=5001
```
Then restart backend.

---

## File Locations Reference

```
global-location-insights/
├── .env.local                    ← Frontend config
├── src/                          ← Frontend source
├── package.json                  ← Frontend deps
├── server/
│   ├── .env                      ← Backend config
│   ├── server.js                 ← Backend code
│   ├── package.json              ← Backend deps
│   └── node_modules/
├── constants.ts                  ← API URLs
├── services/
│   ├── apiService.ts             ← IP/Country APIs
│   ├── authService.ts            ← OAuth logic
│   └── backendMockService.ts      ← Backend calls
└── context/
    └── AuthContext.tsx           ← Auth state
```

---

## Next Steps

1. **Test locally** ✓ (You are here)
2. **Deploy frontend** (Vercel, Netlify)
3. **Deploy backend** (Render, Railway, Heroku)
4. **Update OAuth URLs** in Google/GitHub settings
5. **Update BACKEND_URL** in `constants.ts` to production domain

---

## Support

- **Frontend error?** Check browser console (`F12`)
- **Backend error?** Check server terminal output
- **OAuth issue?** Check OAuth provider credentials
- **Database issue?** Check MongoDB connection string

Good luck! 🚀
