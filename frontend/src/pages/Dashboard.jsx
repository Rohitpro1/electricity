import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Chatbot from '../components/Chatbot';
import ApplianceControl from '../components/ApplianceControl';
import BillCalculator from '../components/BillCalculator';
import CostPredictor from '../components/CostPredictor';
import EcoMode from '../components/EcoMode';
import AdminUsageEntry from '../pages/AdminUsageEntry'; // ✅ added import

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
          <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
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
          <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }} />
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
                    <div className="stat-value">
                      {dashboardData?.total_consumption?.toFixed(2) || 0} kWh
                    </div>
                  </div>
                </div>

                <div className="stat-card glass">
                  <div className="stat-icon">💰</div>
                  <div className="stat-info">
                    <div className="stat-label">Estimated Cost</div>
                    <div className="stat-value">
                      ₹{dashboardData?.total_cost?.toFixed(2) || 0}
                    </div>
                  </div>
                </div>

                <div className="stat-card glass">
                  <div className="stat-icon">📈</div>
                  <div className="stat-info">
                    <div className="stat-label">Average Daily Usage</div>
                    <div className="stat-value">
                      {dashboardData?.avg_daily_usage?.toFixed(2) || 0} kWh/day
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
    } else if (activeTab === 'admin') {
      return <AdminUsageEntry />; // ✅ renders admin page
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
          <button className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} data-testid="tab-dashboard">
            <span className="sidebar-icon">📊</span><span>Dashboard</span>
          </button>
          <button className={`sidebar-item ${activeTab === 'appliances' ? 'active' : ''}`} onClick={() => setActiveTab('appliances')} data-testid="tab-appliances">
            <span className="sidebar-icon">🔌</span><span>Appliances</span>
          </button>
          <button className={`sidebar-item ${activeTab === 'bill' ? 'active' : ''}`} onClick={() => setActiveTab('bill')} data-testid="tab-bill">
            <span className="sidebar-icon">💳</span><span>Bill</span>
          </button>
          <button className={`sidebar-item ${activeTab === 'predictor' ? 'active' : ''}`} onClick={() => setActiveTab('predictor')} data-testid="tab-predictor">
            <span className="sidebar-icon">🔮</span><span>Predictor</span>
          </button>
          <button className={`sidebar-item ${activeTab === 'eco' ? 'active' : ''}`} onClick={() => setActiveTab('eco')} data-testid="tab-eco">
            <span className="sidebar-icon">🌱</span><span>Eco Mode</span>
          </button>
          <button className={`sidebar-item ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')} data-testid="tab-chat">
            <span className="sidebar-icon">💬</span><span>AI Assistant</span>
          </button>
          <button className={`sidebar-item ${activeTab === 'admin' ? 'active' : ''}`} onClick={() => setActiveTab('admin')} data-testid="tab-admin">
            <span className="sidebar-icon">🧑‍💼</span><span>Admin</span>
          </button>
        </aside>

        <main className="main-content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}