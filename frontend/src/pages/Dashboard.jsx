import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Chatbot from '../components/Chatbot';
import ApplianceControl from '../components/ApplianceControl';
import BillCalculator from '../components/BillCalculator';
import CostPredictor from '../components/CostPredictor';
import EcoMode from '../components/EcoMode';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#ffffff', '#a0a0a0', '#707070', '#505050', '#303030'];

export default function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [period, setPeriod] = useState('today');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/${user.user_id}?period=${period}`);
      setDashboardData(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const renderChart = () => {
    if (!dashboardData?.hourly_data) return null;

    const chartData = Object.entries(dashboardData.hourly_data).map(([time, value]) => ({
      time: new Date(time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
      consumption: parseFloat(value.toFixed(2))
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="time" stroke="#fff" />
          <YAxis stroke="#fff" />
          <Tooltip 
            contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
          />
          <Line type="monotone" dataKey="consumption" stroke="#ffffff" strokeWidth={2} dot={{ fill: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderPieChart = () => {
    if (!dashboardData?.appliance_breakdown) return null;

    const pieData = Object.entries(dashboardData.appliance_breakdown).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2))
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return (
        <div className="dashboard-content">
          <div className="period-selector">
            {['yesterday', 'today', 'week', 'month', 'year'].map(p => (
              <button
                key={p}
                className={`btn ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriod(p)}
                data-testid={`period-${p}`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading-spinner"></div>
          ) : (
            <>
              <div className="stats-grid">
                <div className="stat-card glass">
                  <div className="stat-icon">⚡</div>
                  <div className="stat-info">
                    <div className="stat-label">Total Consumption</div>
                    <div className="stat-value" data-testid="total-consumption">
                      {dashboardData?.total_consumption || 0} kWh
                    </div>
                  </div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-card glass">
                  <h3>Usage Over Time</h3>
                  {renderChart()}
                </div>

                <div className="chart-card glass">
                  <h3>Appliance Breakdown</h3>
                  {renderPieChart()}
                </div>
              </div>
            </>
          )}
        </div>
      );
    } else if (activeTab === 'appliances') {
      return <ApplianceControl userId={user.user_id} />;
    } else if (activeTab === 'bill') {
      return <BillCalculator userId={user.user_id} />;
    } else if (activeTab === 'predictor') {
      return <CostPredictor userId={user.user_id} />;
    } else if (activeTab === 'eco') {
      return <EcoMode userId={user.user_id} />;
    } else if (activeTab === 'chat') {
      return <Chatbot userId={user.user_id} />;
    }
  };

  return (
    <div className="dashboard-page" data-testid="dashboard-page">
      <nav className="navbar glass">
        <div className="nav-brand">
          <span className="nav-icon">⚡</span>
          <span className="nav-title">E-WIZZ</span>
        </div>
        <div className="nav-user">
          <span className="user-name" data-testid="user-name">{user.username}</span>
          <button onClick={onLogout} className="btn btn-secondary" data-testid="logout-button">
            Logout
          </button>
        </div>
      </nav>

      <div className="dashboard-layout">
        <aside className="sidebar glass">
          <button
            className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            data-testid="tab-dashboard"
          >
            <span className="sidebar-icon">📊</span>
            <span>Dashboard</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'appliances' ? 'active' : ''}`}
            onClick={() => setActiveTab('appliances')}
            data-testid="tab-appliances"
          >
            <span className="sidebar-icon">🔌</span>
            <span>Appliances</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'bill' ? 'active' : ''}`}
            onClick={() => setActiveTab('bill')}
            data-testid="tab-bill"
          >
            <span className="sidebar-icon">💳</span>
            <span>Bill</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'predictor' ? 'active' : ''}`}
            onClick={() => setActiveTab('predictor')}
            data-testid="tab-predictor"
          >
            <span className="sidebar-icon">🔮</span>
            <span>Predictor</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'eco' ? 'active' : ''}`}
            onClick={() => setActiveTab('eco')}
            data-testid="tab-eco"
          >
            <span className="sidebar-icon">🌱</span>
            <span>Eco Mode</span>
          </button>
          <button
            className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
            data-testid="tab-chat"
          >
            <span className="sidebar-icon">💬</span>
            <span>AI Assistant</span>
          </button>
        </aside>

        <main className="main-content">
          {renderContent()}
        </main>
      </div>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          padding: 20px;
        }

        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 32px;
          margin-bottom: 24px;
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-icon {
          font-size: 28px;
        }

        .nav-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .user-name {
          font-weight: 500;
        }

        .dashboard-layout {
          display: grid;
          grid-template-columns: 250px 1fr;
          gap: 24px;
        }

        .sidebar {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          height: fit-content;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s, color 0.2s;
        }

        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #ffffff;
        }

        .sidebar-item.active {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          font-weight: 500;
        }

        .sidebar-icon {
          font-size: 20px;
        }

        .main-content {
          min-height: 600px;
        }

        .dashboard-content {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .period-selector {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .stat-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .stat-icon {
          font-size: 40px;
        }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 600;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
        }

        .chart-card {
          padding: 24px;
        }

        .chart-card h3 {
          margin-bottom: 20px;
          font-size: 18px;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .dashboard-layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            flex-direction: row;
            overflow-x: auto;
          }
        }
      `}</style>
    </div>
  );
}