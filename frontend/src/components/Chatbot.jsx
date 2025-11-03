import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Chatbot({ userId }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Hello! I\'m your E-WIZZ assistant. I can help you with electricity consumption queries, bill calculations, energy saving tips, and appliance management. How can I assist you today?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionId = useRef(`session-${Date.now()}`).current;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const response = await axios.post(`${API}/chatbot`, {
        message: userMessage,
        session_id: sessionId
      });
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      toast.error('Failed to get response');
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I\'m having trouble responding right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot" data-testid="chatbot">
      <div className="chat-header">
        <h2>AI Assistant</h2>
        <p className="subtitle">Ask me anything about your electricity usage</p>
      </div>

      <div className="chat-container glass">
        <div className="messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role}`} data-testid={`chat-message-${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'assistant' ? '⚡' : '👤'}
              </div>
              <div className="message-content">
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="message-avatar">⚡</div>
              <div className="message-content typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="chat-input-form">
          <input
            type="text"
            className="input"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            data-testid="chat-input"
          />
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            data-testid="chat-send-button"
          >
            Send
          </button>
        </form>
      </div>

      <style jsx>{`
        .chatbot {
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: calc(100vh - 200px);
        }

        .chat-header h2 {
          font-size: 28px;
          font-weight: 600;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          margin-top: 4px;
        }

        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 24px;
          overflow: hidden;
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 20px;
        }

        .message {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .message.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .message-content {
          max-width: 70%;
          padding: 12px 16px;
          border-radius: 16px;
          line-height: 1.5;
        }

        .message.assistant .message-content {
          background: rgba(255, 255, 255, 0.05);
        }

        .message.user .message-content {
          background: rgba(255, 255, 255, 0.15);
        }

        .message-content.typing {
          display: flex;
          gap: 4px;
          padding: 16px;
        }

        .message-content.typing span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.5);
          animation: typing 1.4s infinite;
        }

        .message-content.typing span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .message-content.typing span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
        }

        .chat-input-form {
          display: flex;
          gap: 12px;
        }

        .chat-input-form .input {
          flex: 1;
        }
      `}</style>
    </div>
  );
}