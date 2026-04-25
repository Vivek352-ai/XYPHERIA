// Eleos - AI Emotional Support Companion

const CHAT_ENDPOINT = "/api/chat";

const SYSTEM_PROMPT = `You are Eleos - a warm, empathetic AI emotional support companion built specifically for users aged 15-25.

YOUR ROLE:
You are a supportive friend, NOT a therapist or authority figure. Your job is to make the user feel heard, validated, and less alone.

CORE RULES:
1. Always acknowledge feelings FIRST before any advice or questions
2. NEVER dismiss, minimize, or invalidate emotions
3. NEVER give medical or clinical diagnoses
4. Keep responses concise (2-4 sentences), warm, and genuinely human
5. Encourage healthy coping strategies naturally - not as a lecture
6. Ask ONE open-ended question per response to continue the conversation
7. Do NOT foster dependency - remind users that real people care about them too
8. Be genuine, not robotic or scripted

EMOTION MAPPING:
- Sad -> Comfort + reassurance + presence
- Anxious -> Grounding + calming suggestions
- Angry -> De-escalation + understanding
- Lonely -> Friendly + engaging warmth
- Overwhelmed -> Simplify + break it down
- Happy -> Celebrate + amplify positivity
- Neutral -> Reflective, curious conversation

CRISIS PROTOCOL:
If the user expresses suicidal thoughts, self-harm, severe distress, or danger:
- Respond with calm compassion, not alarm
- Gently encourage them to reach out to a trusted person or helpline
- Set EMOTION: Crisis

MANDATORY FORMAT - at the very end of EVERY response, on its own line:
EMOTION: <exactly one of: Sad, Anxious, Angry, Lonely, Overwhelmed, Happy, Neutral, Crisis>`;

// State
let history = [];
let isLoading = false;
let msgCount = 0;
let moodHistory = [];

// Voice state
let isListening = false;
let isSpeaking = false;
let voiceOutputEnabled = true;
let recognition = null;
let currentUtterance = null;

const EMOTION_MAP = {
  Sad:        { emoji: "\uD83D\uDE22", sub: "Feeling low",         color: "e-Sad" },
  Anxious:    { emoji: "\uD83D\uDE30", sub: "Feeling anxious",     color: "e-Anxious" },
  Angry:      { emoji: "\uD83D\uDE20", sub: "Feeling frustrated",  color: "e-Angry" },
  Lonely:     { emoji: "\uD83D\uDE14", sub: "Feeling lonely",      color: "e-Lonely" },
  Overwhelmed:{ emoji: "\uD83D\uDE35", sub: "Feeling overwhelmed", color: "e-Overwhelmed" },
  Happy:      { emoji: "\uD83D\uDE0A", sub: "Feeling positive",    color: "e-Happy" },
  Neutral:    { emoji: "\uD83D\uDE0C", sub: "Here with you",       color: "" },
  Crisis:     { emoji: "SOS", sub: "Needs support",       color: "e-Crisis" },
};

// Voice input - Web Speech API


function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "en-US";

  rec.onstart = () => {
    isListening = true;
    updateMicButton(true);
    showVoiceStatus("Listening... speak now");
  };

  rec.onresult = (event) => {
    let interim = "";
    let final = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) final += t;
      else interim += t;
    }
    // Show live transcript in input box
    const input = document.getElementById("msg-input");
    input.value = final || interim;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  };

  rec.onend = () => {
    isListening = false;
    updateMicButton(false);
    hideVoiceStatus();
    // Auto-send if there's transcribed text
    const input = document.getElementById("msg-input");
    if (input.value.trim()) {
      setTimeout(() => sendMessage(), 300);
    }
  };

  rec.onerror = (event) => {
    isListening = false;
    updateMicButton(false);
    hideVoiceStatus();
    if (event.error === "not-allowed") {
      showVoiceStatus("Microphone access denied", true);
    } else if (event.error !== "no-speech") {
      showVoiceStatus("Voice error: " + event.error, true);
    }
  };

  return rec;
}

function toggleVoiceInput() {
  if (!recognition) {
    recognition = initSpeechRecognition();
    if (!recognition) {
      showVoiceStatus("Voice input not supported in this browser", true);
      return;
    }
  }

  // Stop speaking if it's currently talking
  if (isSpeaking) stopSpeaking();

  if (isListening) {
    recognition.stop();
  } else {
    // Clear input before listening
    document.getElementById("msg-input").value = "";
    recognition.start();
  }
}

function updateMicButton(active) {
  const btn = document.getElementById("mic-btn");
  if (!btn) return;
  btn.classList.toggle("mic-active", active);
  btn.title = active ? "Stop listening" : "Voice input";
  btn.innerHTML = active
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M12 1a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" opacity="0.3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
}

function showVoiceStatus(msg, isError = false) {
  let el = document.getElementById("voice-status");
  if (!el) {
    const inputArea = document.querySelector(".input-area");
    if (!inputArea) return; // Exit if input area doesn't exist
    el = document.createElement("div");
    el.id = "voice-status";
    inputArea.prepend(el);
  }
  el.textContent = msg;
  el.className = "voice-status" + (isError ? " voice-status-error" : "");
  el.style.display = "block";
  if (isError) setTimeout(() => hideVoiceStatus(), 3000);
}

function hideVoiceStatus() {
  const el = document.getElementById("voice-status");
  if (el) el.style.display = "none";
}

// Voice output - Speech Synthesis


function speak(text) {
  if (!voiceOutputEnabled || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  stopSpeaking();

  // Clean text: remove emojis and markdown for cleaner TTS.
  const cleaned = text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u2600-\u27FF]/g, "")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return;

  currentUtterance = new SpeechSynthesisUtterance(cleaned);
  currentUtterance.rate = 0.92;
  currentUtterance.pitch = 1.05;   // Slightly warmer
  currentUtterance.volume = 1.0;

  // Pick the best available natural-sounding English voice.
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Samantha", "Karen", "Victoria", "Moira",   // macOS
    "Microsoft Aria", "Microsoft Jenny",          // Windows
    "Google UK English Female",                   // Chrome
    "en-GB", "en-US"                              // Fallback by lang
  ];
  let chosen = null;
  for (const name of preferred) {
    chosen = voices.find(v => v.name.includes(name) || v.lang === name);
    if (chosen) break;
  }
  if (!chosen) chosen = voices.find(v => v.lang.startsWith("en")) || voices[0];
  if (chosen) currentUtterance.voice = chosen;

  currentUtterance.onstart = () => {
    isSpeaking = true;
    updateSpeakerButton(true);
  };
  currentUtterance.onend = () => {
    isSpeaking = false;
    currentUtterance = null;
    updateSpeakerButton(false);
  };
  currentUtterance.onerror = () => {
    isSpeaking = false;
    currentUtterance = null;
    updateSpeakerButton(false);
  };

  // Chrome bugfix: voices may not load instantly
  if (voices.length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      const v2 = window.speechSynthesis.getVoices();
      const c2 = v2.find(v => preferred.some(p => v.name.includes(p))) || v2[0];
      if (c2) currentUtterance.voice = c2;
      window.speechSynthesis.speak(currentUtterance);
    };
  } else {
    window.speechSynthesis.speak(currentUtterance);
  }
}

function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  isSpeaking = false;
  currentUtterance = null;
  updateSpeakerButton(false);
}

function toggleVoiceOutput() {
  voiceOutputEnabled = !voiceOutputEnabled;
  if (!voiceOutputEnabled) stopSpeaking();
  updateVoiceToggleButton();
  showVoiceStatus(voiceOutputEnabled ? "Voice output on" : "Voice output off");
  setTimeout(() => hideVoiceStatus(), 2000);
}

function updateSpeakerButton(speaking) {
  const btn = document.getElementById("speaker-btn");
  if (!btn) return;
  btn.classList.toggle("speaking-active", speaking);
  btn.title = speaking ? "Stop speaking" : "Read last message";
  btn.innerHTML = speaking
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" opacity="0.9"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
}

function updateVoiceToggleButton() {
  const btn = document.getElementById("voice-toggle-btn");
  if (!btn) return;
  btn.title = voiceOutputEnabled ? "Mute voice output" : "Enable voice output";
  btn.classList.toggle("muted", !voiceOutputEnabled);
  btn.innerHTML = voiceOutputEnabled
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
}

// Keep last bot message text for replay.
let lastBotText = "";

function injectVoiceUI() {
  const sendBtn = document.getElementById("send-btn");
  if (!sendBtn) {
    console.warn('Send button not found, skipping voice UI injection');
    return;
  }
  
  const micBtn = document.createElement("button");
  micBtn.id = "mic-btn";
  micBtn.className = "mic-btn";
  micBtn.title = "Voice input";
  micBtn.onclick = toggleVoiceInput;
  micBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  sendBtn.parentNode.insertBefore(micBtn, sendBtn);

  const speakerBtn = document.createElement("button");
  speakerBtn.id = "speaker-btn";
  speakerBtn.className = "speaker-btn";
  speakerBtn.title = "Read last message";
  speakerBtn.onclick = () => {
    if (isSpeaking) stopSpeaking();
    else if (lastBotText) speak(lastBotText);
  };
  speakerBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
  micBtn.parentNode.insertBefore(speakerBtn, micBtn);

  const topRight = document.getElementById("msg-count");
  if (topRight) {
    const voiceToggle = document.createElement("button");
    voiceToggle.id = "voice-toggle-btn";
    voiceToggle.className = "voice-toggle-btn";
    voiceToggle.title = "Mute voice output";
    voiceToggle.onclick = toggleVoiceOutput;
    voiceToggle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    topRight.parentNode.insertBefore(voiceToggle, topRight);
  }
}

async function handleStartTalking() {
  try {
    const res = await fetch('/api/check-auth', {
      method: 'GET',
      credentials: 'same-origin'
    });
    
    if (!res.ok) {
      throw new Error('Auth check failed');
    }
    
    const data = await res.json();
    if (data.authenticated) {
      goToChat();
    } else {
      openLoginModal();
    }
  } catch (err) {
    console.error('Auth check error:', err);
    // If backend is down or not responding, show login modal
    openLoginModal();
  }
}

function openLoginModal() {
  document.getElementById("login-modal").style.display = "flex";
}

function closeLoginModal() {
  document.getElementById("login-modal").style.display = "none";
}

function goToChat() {
  document.getElementById("landing").classList.remove("active");
  document.getElementById("chat-page").classList.add("active");
  if (history.length === 0) {
    const intro = "Hey, I'm really glad you're here. This is your safe space - no judgment, ever. How are you feeling today?";
    addBotMessage(intro);
    lastBotText = intro;
    speak(intro);
  }
  setTimeout(() => document.getElementById("msg-input").focus(), 100);
}

function goToLanding() {
  stopSpeaking();
  if (isListening && recognition) recognition.stop();
  document.getElementById("chat-page").classList.remove("active");
  document.getElementById("landing").classList.add("active");
}

async function logout() {
  try {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'same-origin'
    });
  } catch (err) {
    console.error('Logout error:', err);
  }
  // Clear chat data
  history = [];
  msgCount = 0;
  moodHistory = [];
  lastBotText = "";
  const messagesEl = document.getElementById("messages");
  if (messagesEl) messagesEl.innerHTML = "";
  // Go back to landing
  goToLanding();
}

function addBotMessage(text) {
  const wrap = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.innerHTML = `<div class="avatar bot"></div><div class="bubble">${escapeHtml(text)}</div>`;
  wrap.appendChild(row);
  scrollBottom();
}

function addUserMessage(text) {
  const wrap = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "msg-row user";
  row.innerHTML = `<div class="bubble">${escapeHtml(text)}</div><div class="avatar user">YOU</div>`;
  wrap.appendChild(row);
  msgCount++;
  document.getElementById("msg-count").textContent = msgCount + " message" + (msgCount !== 1 ? "s" : "");
  scrollBottom();
}

function showTyping() {
  const wrap = document.getElementById("messages");
  const row = document.createElement("div");
  row.className = "msg-row bot";
  row.id = "typing-row";
  row.innerHTML = `<div class="avatar bot"></div><div class="bubble typing-bubble"><div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div></div>`;
  wrap.appendChild(row);
  scrollBottom();
}

function removeTyping() {
  const el = document.getElementById("typing-row");
  if (el) el.remove();
}

function scrollBottom() {
  const wrap = document.getElementById("messages");
  wrap.scrollTop = wrap.scrollHeight;
}

function escapeHtml(text) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n/g,"<br/>");
}

function updateEmotion(label) {
  const info = EMOTION_MAP[label] || EMOTION_MAP["Neutral"];
  document.getElementById("emotion-emoji").textContent = info.emoji;
  document.getElementById("emotion-name").textContent = label;
  document.getElementById("emotion-sub").textContent = info.sub;
  const display = document.querySelector(".emotion-display");
  Object.values(EMOTION_MAP).forEach(e => { if (e.color) display.classList.remove(e.color); });
  if (info.color) display.classList.add(info.color);
  document.getElementById("crisis-box").style.display = label === "Crisis" ? "block" : "none";
  moodHistory.push({ label, emoji: info.emoji });
  if (moodHistory.length > 10) moodHistory.shift();
  renderMoodTrack();
}

function renderMoodTrack() {
  document.getElementById("mood-track").innerHTML = moodHistory.map(m =>
    `<div class="mood-dot" title="${m.label}">${m.emoji}</div>`
  ).join("");
}

async function callGroq(userText) {
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({
      message: userText,
      history,
      systemPrompt: SYSTEM_PROMPT
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const message = err.error || err.message || "API error " + response.status;
    throw new Error(message);
  }

  const data = await response.json();
  const replyText = data.reply || "";

  history.push({ role: "user", content: userText });
  history.push({ role: "assistant", content: replyText });

  return replyText;
}

async function sendMessage() {
  const input = document.getElementById("msg-input");
  const btn = document.getElementById("send-btn");
  const text = input.value.trim();
  if (!text || isLoading) return;

  // Stop any ongoing speech before sending
  stopSpeaking();

  input.value = "";
  input.style.height = "auto";
  isLoading = true;
  btn.disabled = true;

  addUserMessage(text);
  showTyping();

  try {
    const fullReply = await callGroq(text);
    const emotionMatch = fullReply.match(/EMOTION:\s*(\w+)\s*$/im);
    const emotion = emotionMatch ? emotionMatch[1] : "Neutral";
    const reply = fullReply.replace(/EMOTION:\s*\w+\s*$/im, "").trim();
    removeTyping();
    addBotMessage(reply);
    updateEmotion(emotion);

    lastBotText = reply;
    speak(reply);

  } catch (err) {
    removeTyping();
    let errMsg = "I had a little trouble connecting. Take a breath - try again in a moment.";
    if (err.message === "NO_KEY" || err.message.includes("GROQ_API_KEY")) {
      errMsg = "No API key found. Add GROQ_API_KEY to your server environment and restart the app.";
    } else if (err.message.includes("401") || err.message.includes("invalid_api_key")) {
      errMsg = "The Groq API key looks invalid. Double-check it and restart the server.";
    }
    addBotMessage(errMsg);
    speak(errMsg);
  }

  isLoading = false;
  btn.disabled = false;
  input.focus();
}

function sendQuick(text) {
  document.getElementById("msg-input").value = text;
  sendMessage();
}

function clearChat() {
  if (!confirm("Clear this conversation?")) return;
  stopSpeaking();
  history = []; msgCount = 0; moodHistory = []; lastBotText = "";
  document.getElementById("messages").innerHTML = "";
  document.getElementById("msg-count").textContent = "0 messages";
  document.getElementById("emotion-emoji").textContent = "";
  document.getElementById("emotion-name").textContent = "Ready to listen";
  document.getElementById("emotion-sub").textContent = "Start a conversation";
  document.getElementById("mood-track").innerHTML = "";
  document.getElementById("crisis-box").style.display = "none";
  const fresh = "Hey, fresh start! How are you feeling? I'm all ears.";
  addBotMessage(fresh);
  lastBotText = fresh;
  speak(fresh);
}

document.addEventListener("DOMContentLoaded", () => {
  // Only inject voice UI if we're on the chat page
  const chatPage = document.getElementById("chat-page");
  if (chatPage) {
    injectVoiceUI();
  }

  const input = document.getElementById("msg-input");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 140) + "px";
    });
  }

  // Pre-load voices (Chrome requires this)
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
});
