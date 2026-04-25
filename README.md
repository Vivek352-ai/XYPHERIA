# Eleos - AI Emotional Support Companion

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key
```bash
# Edit .env file and add your Groq API key:
GROQ_API_KEY="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"
```

Get a free API key at: https://console.groq.com/keys

### 3. Start the Server
```bash
# Windows (Easy):
start.bat

# OR manually:
npm start
```

### 4. Access the App
Open your browser: **http://localhost:3000**

⚠️ **Important:** Don't open index.html directly - always use the server URL!

--- Features

- **Authentication System**
- Session-based login/signup
- Password hashing with bcrypt
- Protected routes

- **Voice Features**
- Voice input (speech-to-text)
- Voice output (text-to-speech)
- Mute/unmute controls

- **Emotion Tracking**
- Real-time emotion detection
- Mood history tracker with emoji indicators
- Crisis detection with helpline resources

- **AI Chat**
- Powered by Groq API (Llama 3.3)
- Empathetic responses
- Context-aware conversations

## Configuration

**Required:** Set your Groq API key in the `.env` file:
```
GROQ_API_KEY=your_actual_key_here
```

Get a free API key at: https://console.groq.com/keys

## Troubleshooting

If the webpage is not responding:
1. ✅ Make sure the server is running (`npm start`)
2. ✅ Access via http://localhost:3000 (not file://)
3. ✅ Check that your API key is set in `.env`
4. ✅ See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for detailed help

## Tech Stack
- **Backend**: Node.js + Express
- **Auth**: express-session + bcrypt
- **Frontend**: Vanilla JavaScript
- **AI**: Groq API (Llama 3.3)
- **Voice**: Web Speech API

## Notes
- User data is stored in-memory (replace with database for production)
- Sessions expire after 24 hours
- Voice features require HTTPS in production
