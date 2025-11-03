import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/login`, {
        username,
        password
      });
      
      toast.success('Login successful!');
      onLogin(response.data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const useDemoAccount = () => {
    setUsername('demo_user_123');
    setPassword('ElecDemo@2023');
  };

  return (
    <div className="login-container" data-testid="login-page">
      <div className="login-bg"></div>
      
      <div className="login-content">
        <div className="login-box glass-strong">
          <div className="logo-section">
            <div className="logo-icon">⚡</div>
            <h1 className="logo-text" data-testid="app-title">E-WIZZ</h1>
            <p className="logo-subtitle">Domestic Electricity Monitoring</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                className="input"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                data-testid="username-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="password-input"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary w-full"
              disabled={loading}
              data-testid="login-button"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="demo-section">
            <div className="divider">
              <span>or</span>
            </div>
            <button 
              onClick={useDemoAccount} 
              className="btn btn-secondary w-full"
              data-testid="demo-account-button"
            >
              Use Demo Account
            </button>
            <p className="demo-info">
              Demo: <strong>demo_user_123</strong> / <strong>ElecDemo@2023</strong>
            </p>
          </div>
        </div>

        <div className="features-section">
          <div className="feature-item glass">
            <span className="feature-icon">📊</span>
            <span>Real-time Monitoring</span>
          </div>
          <div className="feature-item glass">
            <span className="feature-icon">💰</span>
            <span>Bill Prediction</span>
          </div>
          <div className="feature-item glass">
            <span className="feature-icon">🌱</span>
            <span>Eco Mode</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 20px;
        }

        .login-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.03) 0%, transparent 50%),
                      radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.02) 0%, transparent 50%);
          z-index: 0;
        }

        .login-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
        }

        .login-box {
          padding: 48px;
        }

        .logo-section {
          text-align: center;
          margin-bottom: 40px;
        }

        .logo-icon {
          font-size: 48px;
          margin-bottom: 16px;
          filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.3));
        }

        .logo-text {
          font-size: 42px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }

        .logo-subtitle {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }

        .login-form {
          margin-bottom: 32px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
        }

        .w-full {
          width: 100%;
        }

        .demo-section {
          margin-top: 32px;
        }

        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 24px 0;
          color: rgba(255, 255, 255, 0.4);
          font-size: 12px;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .divider span {
          padding: 0 16px;
        }

        .demo-info {
          margin-top: 12px;
          text-align: center;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .features-section {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .feature-item {
          flex: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          text-align: center;
        }

        .feature-icon {
          font-size: 24px;
        }
      `}</style>
    </div>
  );
}