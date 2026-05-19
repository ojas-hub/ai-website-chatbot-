import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE = "http://127.0.0.1:8000/api";

function App() {
  const [activeTab, setActiveTab] = useState('simulator'); // 'simulator' or 'admin'
  const [adminSubTab, setAdminSubTab] = useState('faqs'); // 'faqs' or 'logs'
  
  // Database States
  const [faqs, setFaqs] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [selectedConvMessages, setSelectedConvMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Form States
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', category: 'General' });

  // Simulator / Chat Widget States
  const [chatOpen, setChatOpen] = useState(false);
  const [simConvId, setSimConvId] = useState(null);
  const [simMessages, setSimMessages] = useState([
    { sender: 'bot', text: 'Hi! I am your offline AI assistant. How can I help you today?', timestamp: new Date().toISOString() }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);

  const messagesEndRef = useRef(null);
  const adminMessagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [simMessages, isBotTyping]);

  useEffect(() => {
    adminMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConvMessages]);

  // Load FAQs and Conversations
  useEffect(() => {
    fetchFaqs();
    fetchConversations();
  }, []);

  // Poll conversations every 10 seconds if in admin logs
  useEffect(() => {
    let interval;
    if (activeTab === 'admin' && adminSubTab === 'logs') {
      interval = setInterval(() => {
        fetchConversations();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [activeTab, adminSubTab]);

  // Fetch FAQ list
  const fetchFaqs = async () => {
    try {
      const res = await fetch(`${API_BASE}/faqs`);
      if (!res.ok) throw new Error("Could not fetch FAQs");
      const data = await res.json();
      setFaqs(data);
      setApiError(null);
    } catch (err) {
      console.error(err);
      setApiError("Backend API is offline. Make sure the FastAPI backend is running on port 8000.");
      // Seed mock FAQs for offline representation
      setFaqs([
        { id: 1, question: "What is this service?", answer: "This is an offline AI chatbot assistant that helps answer customer questions instantly.", category: "General" },
        { id: 2, question: "Do you require an internet connection?", answer: "No, this chatbot runs completely offline. It uses local matching and local models for generating answers.", category: "Technical" }
      ]);
    }
  };

  // Fetch conversations list
  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`);
      if (!res.ok) throw new Error("Could not fetch conversations");
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error(err);
      setConversations([
        { id: 101, created_at: new Date().toISOString(), last_message: "Mock offline message history" }
      ]);
    }
  };

  // Fetch specific conversation messages
  const loadConversationMessages = async (convId) => {
    setIsLoadingMessages(true);
    setSelectedConv(convId);
    try {
      const res = await fetch(`${API_BASE}/conversations/${convId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = await res.json();
      setSelectedConvMessages(data);
    } catch (err) {
      console.error(err);
      setSelectedConvMessages([
        { id: 1, sender: 'user', text: "Hello! Is anyone there?", timestamp: new Date().toISOString() },
        { id: 2, sender: 'bot', text: "This is a mock message because the API is currently offline.", timestamp: new Date().toISOString() }
      ]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Add a new FAQ
  const handleAddFaq = async (e) => {
    e.preventDefault();
    if (!newFaq.question || !newFaq.answer) return;

    try {
      const res = await fetch(`${API_BASE}/faqs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFaq)
      });
      if (res.ok) {
        setNewFaq({ question: '', answer: '', category: 'General' });
        fetchFaqs();
      }
    } catch (err) {
      // Mock local addition
      const mockNew = { ...newFaq, id: Date.now() };
      setFaqs([...faqs, mockNew]);
      setNewFaq({ question: '', answer: '', category: 'General' });
      alert("Added to offline mockup. Note: Backend API is offline.");
    }
  };

  // Delete FAQ
  const handleDeleteFaq = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/faqs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchFaqs();
      }
    } catch (err) {
      setFaqs(faqs.filter(f => f.id !== id));
    }
  };

  // Create a new simulation session
  const startSimulationSession = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSimConvId(data.conversation_id);
        setSimMessages([
          { sender: 'bot', text: 'Conversation started. Ask me anything!', timestamp: new Date().toISOString() }
        ]);
      }
    } catch (err) {
      setSimConvId(999); // Mock ID
    }
  };

  // User sends message in widget simulator
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const userText = inputMessage;
    setInputMessage('');

    // Add user message to UI
    setSimMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: new Date().toISOString() }]);
    setIsBotTyping(true);

    let currentConvId = simConvId;
    if (!currentConvId) {
      try {
        const res = await fetch(`${API_BASE}/conversations`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          currentConvId = data.conversation_id;
          setSimConvId(currentConvId);
        }
      } catch (err) {
        currentConvId = 999;
        setSimConvId(999);
      }
    }

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: currentConvId, message: userText })
      });
      if (!res.ok) throw new Error();
      const botMsg = await res.json();
      
      setIsBotTyping(false);
      setSimMessages(prev => [...prev, { sender: 'bot', text: botMsg.text, timestamp: botMsg.timestamp }]);
    } catch (err) {
      // Offline fallback simulator
      setTimeout(() => {
        setIsBotTyping(false);
        // Simple local Jaccard similarity matcher fallback in JS so frontend works even without backend!
        const queryWords = userText.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(' ');
        let bestMatch = null;
        let bestScore = 0;

        faqs.forEach(faq => {
          const faqWords = faq.question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(' ');
          const intersection = queryWords.filter(w => faqWords.includes(w));
          const score = intersection.length / Math.max(queryWords.length, faqWords.length);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = faq;
          }
        });

        const reply = (bestMatch && bestScore > 0.15) 
          ? bestMatch.answer 
          : "I am currently in offline preview mode. Start the backend API server to use full AI generation and database logging!";

        setSimMessages(prev => [...prev, { sender: 'bot', text: reply, timestamp: new Date().toISOString() }]);
      }, 800);
    }
  };

  return (
    <div className="app-container">
      {/* Background Neon Glows */}
      <div className="glow-1"></div>
      <div className="glow-2"></div>

      {/* Main Header */}
      <header className="main-header">
        <div className="logo-section">
          <div className="logo-icon"></div>
          <h1>Ojas Chat <span className="badge">Offline AI</span></h1>
        </div>
        <nav className="tab-navigation">
          <button 
            className={`nav-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            Widget Simulator
          </button>
          <button 
            className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            Admin Control Center
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="content-body">
        {apiError && (
          <div className="warning-banner">
            <span className="warning-icon">⚠</span>
            <span className="warning-text">{apiError}</span>
          </div>
        )}

        {activeTab === 'simulator' ? (
          /* ========================================================
             SIMULATOR / PREVIEW WEBSITE
             ======================================================== */
          <div className="simulator-view">
            <div className="mock-website">
              <div className="mock-nav">
                <div className="mock-logo">▲ Zenith SaaS</div>
                <div className="mock-links">
                  <span>Product</span>
                  <span>Pricing</span>
                  <span>About</span>
                  <button className="mock-cta">Start Free</button>
                </div>
              </div>
              
              <div className="mock-hero">
                <h2>Supercharge customer support.</h2>
                <p>Deploy secure, local AI models directly into your workflow. No third-party API dependencies. 100% private.</p>
                <div className="hero-buttons">
                  <button className="primary-hero-btn">Get Started Now</button>
                  <button className="secondary-hero-btn" onClick={() => setChatOpen(true)}>Try Live Chat</button>
                </div>
              </div>

              <div className="mock-features">
                <div className="feat-card">
                  <h3>⚡ Instantly Active</h3>
                  <p>Resolves FAQs without delays or token costs.</p>
                </div>
                <div className="feat-card">
                  <h3>🔒 Fully Local</h3>
                  <p>Your client data never leaves your environment.</p>
                </div>
                <div className="feat-card">
                  <h3>🔧 Custom Dashboard</h3>
                  <p>Train FAQs and manage conversation logs on-the-fly.</p>
                </div>
              </div>

              <div className="mock-footer">
                © 2026 Zenith SaaS. Created for testing local AI Chatbot widgets.
              </div>

              {/* Floating Widget Bubble */}
              <button className={`chat-bubble-btn ${chatOpen ? 'active' : ''}`} onClick={() => {
                setChatOpen(!chatOpen);
                if (!chatOpen && !simConvId) {
                  startSimulationSession();
                }
              }}>
                {chatOpen ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                )}
              </button>

              {/* Chat Widget Window */}
              {chatOpen && (
                <div className="chat-widget-window">
                  <div className="widget-header">
                    <div className="widget-avatar"></div>
                    <div className="widget-status">
                      <h4>Zenith Assistant</h4>
                      <span className="status-indicator">Online</span>
                    </div>
                  </div>
                  
                  <div className="widget-messages">
                    {simMessages.map((msg, idx) => (
                      <div key={idx} className={`message-bubble-wrapper ${msg.sender}`}>
                        <div className="message-bubble">
                          <p>{msg.text}</p>
                        </div>
                      </div>
                    ))}
                    {isBotTyping && (
                      <div className="message-bubble-wrapper bot">
                        <div className="message-bubble typing-bubble">
                          <span className="dot"></span>
                          <span className="dot"></span>
                          <span className="dot"></span>
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form className="widget-input-form" onSubmit={handleSendMessage}>
                    <input 
                      type="text" 
                      placeholder="Type a message..." 
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                    />
                    <button type="submit">Send</button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================
             ADMIN CONTROL CENTER
             ======================================================== */
          <div className="admin-view">
            <div className="admin-sidebar">
              <button 
                className={`sidebar-btn ${adminSubTab === 'faqs' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('faqs')}
              >
                📁 FAQ Manager
              </button>
              <button 
                className={`sidebar-btn ${adminSubTab === 'logs' ? 'active' : ''}`}
                onClick={() => setAdminSubTab('logs')}
              >
                💬 Chat Logs
              </button>
            </div>

            <div className="admin-content">
              {adminSubTab === 'faqs' ? (
                <div className="faq-manager-layout">
                  <div className="faq-list-section">
                    <h2>Configured FAQ Corpus ({faqs.length})</h2>
                    <div className="faq-grid">
                      {faqs.map(faq => (
                        <div key={faq.id} className="faq-card">
                          <div className="faq-card-header">
                            <span className="faq-cat-badge">{faq.category}</span>
                            <button className="faq-del-btn" onClick={() => handleDeleteFaq(faq.id)}>Delete</button>
                          </div>
                          <h4>Q: {faq.question}</h4>
                          <p>A: {faq.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="faq-add-section">
                    <h2>Add FAQ Training Data</h2>
                    <form onSubmit={handleAddFaq} className="faq-form">
                      <div className="form-group">
                        <label>Question</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Do you support offline usage?"
                          value={newFaq.question}
                          onChange={(e) => setNewFaq({...newFaq, question: e.target.value})}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Answer Context</label>
                        <textarea 
                          placeholder="Provide the exact answer answer for the bot to use..."
                          value={newFaq.answer}
                          onChange={(e) => setNewFaq({...newFaq, answer: e.target.value})}
                          required
                          rows="4"
                        />
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <select 
                          value={newFaq.category}
                          onChange={(e) => setNewFaq({...newFaq, category: e.target.value})}
                        >
                          <option value="General">General</option>
                          <option value="Technical">Technical</option>
                          <option value="Integration">Integration</option>
                          <option value="Billing">Billing</option>
                        </select>
                      </div>
                      <button type="submit" className="add-faq-btn">Train Model Context</button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="chat-logs-layout">
                  <div className="conv-list-section">
                    <h2>All Active Sessions</h2>
                    <div className="conv-list">
                      {conversations.map(conv => (
                        <div 
                          key={conv.id} 
                          className={`conv-item ${selectedConv === conv.id ? 'active' : ''}`}
                          onClick={() => loadConversationMessages(conv.id)}
                        >
                          <div className="conv-header">
                            <span className="conv-id">Session #{conv.id}</span>
                            <span className="conv-time">{new Date(conv.created_at).toLocaleTimeString()}</span>
                          </div>
                          <p className="conv-preview">{conv.last_message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="conv-history-section">
                    {selectedConv ? (
                      <>
                        <h2>Session History #{selectedConv}</h2>
                        {isLoadingMessages ? (
                          <div className="admin-loading">Loading transcripts...</div>
                        ) : (
                          <div className="admin-chat-viewer">
                            {selectedConvMessages.map((msg, idx) => (
                              <div key={idx} className={`admin-msg-row ${msg.sender}`}>
                                <div className="admin-msg-bubble">
                                  <div className="msg-meta">
                                    <span className="msg-sender">{msg.sender === 'user' ? 'User' : 'OjasBot'}</span>
                                    <span className="msg-time">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                  </div>
                                  <p>{msg.text}</p>
                                </div>
                              </div>
                            ))}
                            <div ref={adminMessagesEndRef} />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="no-conv-selected">
                        <p>Select a chat session from the list to view the full support transcript.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
