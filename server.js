const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Load .env file if it exists
if (fs.existsSync('.env')) {
  require('dotenv').config();
}

const app = express();
const PORT = 3000;
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const SESSION_SECRET = process.env.SESSION_SECRET || 'eleos-dev-session-secret';

// In-memory user store (replace with database in production)
const users = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false // Set to true in production with HTTPS
  }
}));

// Serve static files
app.use(express.static(__dirname));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Not authenticated' });
};

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (users.has(email)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    users.set(email, { email, password: hash });
    req.session.userId = email;
    
    console.log(`User registered: ${email}`);
    res.json({ success: true, message: 'Registration successful' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = users.get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    req.session.userId = email;
    
    console.log(`User logged in: ${email}`);
    res.json({ success: true, message: 'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  const userId = req.session.userId;
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    console.log(`User logged out: ${userId}`);
    res.json({ success: true, message: 'Logout successful' });
  });
});

// Check auth status
app.get('/api/check-auth', (req, res) => {
  res.json({ 
    authenticated: !!req.session.userId,
    userId: req.session.userId || null
  });
});

// Chat proxy. Keeps the API key on the server instead of exposing it in browser JS.
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const { message, history = [], systemPrompt } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GROQ_API_KEY server environment variable' });
    }

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const safeHistory = Array.isArray(history)
      ? history
          .filter(item => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
          .slice(-20)
      : [];

    const messages = [
      { role: 'system', content: typeof systemPrompt === 'string' ? systemPrompt : 'You are Eleos, a warm emotional support companion.' },
      ...safeHistory,
      { role: 'user', content: message }
    ];

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.85,
        max_tokens: 512
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const upstreamError = data.error?.message || `Groq API error ${response.status}`;
      return res.status(response.status).json({ error: upstreamError });
    }

    const reply = data.choices?.[0]?.message?.content || '';
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat request failed' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\nEleos Server Running`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Session-based authentication enabled`);
  if (!process.env.GROQ_API_KEY) {
    console.log(`GROQ_API_KEY is not set. Chat replies will show a setup error.`);
  }
  console.log(`\nPress Ctrl+C to stop\n`);
});
