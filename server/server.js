/**
 * Global Location Insights Backend Server
 * OAuth 2.0 Authentication + MongoDB Storage
 * 
 * Setup:
 * 1. cd server && npm install
 * 2. Update .env with your credentials
 * 3. npm start
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Parse CORS origins from environment
const corsOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(url => url.trim());

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(' MongoDB Connected'))
  .catch(err => console.error(' MongoDB Connection Error:', err));

// MongoDB Schema & Model
const RecordSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  clientIp: String,
  location: {
    city: String,
    country: String,
    coordinates: {
      lat: Number,
      lon: Number
    }
  },
  demographics: {
    countryPopulation: Number,
    cityPopulation: Number,
    languages: [String],
    currency: String
  },
  metadata: {
    source: String,
    userAgent: String
  },
  authenticatedBy: {
    provider: { type: String, enum: ['google', 'github', 'api-key'] },
    email: String,
    userId: String,
    name: String
  }
}, { timestamps: true });

const Record = mongoose.model('LocationRecord', RecordSchema);


/**
 * Verify Google OAuth Token
 * Decodes and validates JWT from Google Sign-In
 */
const verifyGoogleToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    
    if (!decoded || !decoded.email) {
      throw new Error('Invalid Google token structure');
    }

    console.log(` Google token verified for: ${decoded.email}`);
    
    return {
      email: decoded.email,
      name: decoded.name,
      sub: decoded.sub
    };
  } catch (err) {
    throw new Error(`Google token verification failed: ${err.message}`);
  }
};

/**
 * Verify GitHub OAuth Token
 * Calls GitHub API to validate access token
 */
const verifyGitHubToken = async (token) => {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Accept': 'application/vnd.github+json'
      }
    });

    console.log(` GitHub token verified for: ${response.data.login}`);

    return {
      email: response.data.email,
      name: response.data.name || response.data.login,
      sub: response.data.id
    };
  } catch (err) {
    throw new Error(`GitHub token verification failed: ${err.message}`);
  }
};

/**
 * Main Authentication Middleware
 * Supports OAuth 2.0 (Google/GitHub) or API Key
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const apiKey = req.headers['x-api-key'];
    const userProvider = req.headers['x-user-provider'];
    const userEmail = req.headers['x-user-email'];

    // OAuth Authentication Path
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      if (!userProvider) {
        return res.status(400).json({ 
          error: 'Bad Request',
          message: 'Missing x-user-provider header' 
        });
      }

      let userInfo;

      if (userProvider === 'google') {
        userInfo = await verifyGoogleToken(token);
      } else if (userProvider === 'github') {
        userInfo = await verifyGitHubToken(token);
      } else {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Unknown provider'
        });
      }

      req.user = {
        email: userInfo.email,
        name: userInfo.name,
        id: userInfo.sub,
        provider: userProvider,
        token: token
      };

      return next();
    }

    // API Key Authentication Path (backward compatibility)
    if (apiKey) {
      if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Invalid API Key'
        });
      }

      req.user = {
        email: 'api-client',
        provider: 'api-key',
        token: apiKey
      };

      return next();
    }

    // No authentication provided
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing authentication credentials (OAuth token or API Key)',
      hint: 'Include Authorization: Bearer <token> or X-API-Key header'
    });

  } catch (err) {
    console.error('Authentication error:', err.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: err.message
    });
  }
};



// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Submit Location Data
app.post('/api/records', authenticate, async (req, res) => {
  try {
    const { location, demographics, clientIp, metadata } = req.body;

    if (!location || !demographics) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: location, demographics'
      });
    }

    const record = new Record({
      clientIp,
      location,
      demographics,
      metadata,
      authenticatedBy: {
        provider: req.user.provider,
        email: req.user.email,
        userId: req.user.id,
        name: req.user.name
      }
    });

    const savedRecord = await record.save();

    console.log(` Record saved for ${req.user.email} (${req.user.provider})`);

    res.status(201).json({
      success: true,
      message: 'Data validated and stored successfully',
      recordId: savedRecord._id,
      timestamp: savedRecord.timestamp,
      authenticatedBy: req.user.provider
    });

  } catch (error) {
    console.error('Error saving record:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Retrieve Records (authenticated users only)
app.get('/api/records', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    const records = await Record.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const total = await Record.countDocuments();

    res.json({
      success: true,
      count: records.length,
      total,
      records,
      authenticatedAs: req.user.email,
      provider: req.user.provider
    });

  } catch (error) {
    console.error('Error fetching records:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get User's Own Records
app.get('/api/records/my', authenticate, async (req, res) => {
  try {
    const records = await Record.find({
      'authenticatedBy.email': req.user.email
    })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    res.json({
      success: true,
      count: records.length,
      records,
      email: req.user.email
    });

  } catch (error) {
    console.error('Error fetching user records:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// GitHub OAuth Callback Handler (receives POST from frontend with authorization code)
app.post('/api/auth/github/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      console.error('GitHub callback: Missing authorization code');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing authorization code'
      });
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('GitHub OAuth credentials not configured');
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'GitHub OAuth not configured'
      });
    }

    console.log('🔐 GitHub OAuth: Exchanging code for access token...');

    // Exchange code for access token
    let tokenResponse;
    try {
      tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: clientId,
          client_secret: clientSecret,
          code: code
        },
        { 
          headers: { Accept: 'application/json' }
        }
      );
    } catch (axiosError) {
      console.error('GitHub token exchange failed:', axiosError.response?.data || axiosError.message);
      return res.status(500).json({
        error: 'Token Exchange Failed',
        message: 'Failed to exchange code for access token',
        details: axiosError.response?.data?.error_description || axiosError.message
      });
    }

    if (tokenResponse.data.error) {
      console.error('GitHub OAuth error response:', tokenResponse.data.error, tokenResponse.data.error_description);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'OAuth exchange failed',
        details: tokenResponse.data.error_description
      });
    }

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      console.error('GitHub OAuth: No access token in response');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No access token received from GitHub'
      });
    }

    console.log('✓ Access token received, fetching user info...');

    // Fetch user info from GitHub
    let userResponse;
    try {
      userResponse = await axios.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      });
    } catch (axiosError) {
      console.error('GitHub user info fetch failed:', axiosError.response?.status, axiosError.message);
      return res.status(500).json({
        error: 'User Info Fetch Failed',
        message: 'Failed to fetch user info from GitHub',
        details: axiosError.message
      });
    }

    console.log(` ✓ GitHub OAuth successful for: ${userResponse.data.login}`);

    res.json({
      success: true,
      access_token: accessToken,
      github_id: userResponse.data.id,
      login: userResponse.data.login,
      email: userResponse.data.email,
      avatar_url: userResponse.data.avatar_url,
      name: userResponse.data.name
    });

  } catch (error) {
    console.error('GitHub callback error:', error.message);
    res.status(500).json({
      error: 'Authentication Failed',
      message: error.message
    });
  }
});

// Stats Endpoint
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    const totalRecords = await Record.countDocuments();
    const userRecords = await Record.countDocuments({
      'authenticatedBy.email': req.user.email
    });

    res.json({
      success: true,
      stats: {
        totalRecords,
        userRecords,
        user: req.user.email,
        provider: req.user.provider
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableEndpoints: [
      'GET /health',
      'POST /api/records',
      'GET /api/records',
      'GET /api/records/my',
      'POST /api/auth/github/callback',
      'GET /api/stats'
    ]
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('\n═══════════════════════════════════════════════');
  console.log('  Global Location Insights - Backend Server');
  console.log('═══════════════════════════════════════════════');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ MongoDB: Connected`);
  console.log(`✓ OAuth 2.0: Enabled`);
  console.log(`✓ CORS: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log('─────────────────────────────────────────────');
  console.log('Endpoints:');
  console.log(`  GET  /health`);
  console.log(`  POST /api/records`);
  console.log(`  GET  /api/records`);
  console.log(`  GET  /api/records/my`);
  console.log(`  POST /api/auth/github/callback`);
  console.log(`  GET  /api/stats`);
  console.log('═══════════════════════════════════════════════\n');
});
