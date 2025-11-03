import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPanel({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this user?')) return;
    
    try {
      await axios.delete(`${API}/admin/users/${userId}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  return (
    <div className="admin-panel" data-testid="admin-panel">
      <nav className="navbar glass">
        <div className="nav-brand">
          <span className="nav-icon">⚡</span>
          <span className="nav-title">E-WIZZ Admin</span>
        </div>
        <div className="nav-user">
          <span className="user-name">{user.username}</span>
          <button onClick={onLogout} className="btn btn-secondary">
            Logout
          </button>
        </div>
      </nav>

      <div className="admin-content">
        <h2>User Management</h2>
        
        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="users-table glass">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} data-testid="user-row">
                    <td>{u.username}</td>
                    <td>
                      <span className={`role-badge ${u.role}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      {u.role !== 'admin' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteUser(u.id)}
                          data-testid="delete-user-button"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .admin-panel {
          min-height: 100vh;
          padding: 20px;
        }

        .navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 32px;
          margin-bottom: 32px;
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
        }

        .nav-user {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .admin-content {
          max-width: 1200px;
          margin: 0 auto;
        }

        .admin-content h2 {
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 24px;
        }

        .users-table {
          padding: 24px;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 16px;
          text-align: left;
        }

        th {
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        tbody tr {
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .role-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-badge.admin {
          background: rgba(255, 59, 48, 0.2);
          color: #ff3b30;
        }

        .role-badge.user {
          background: rgba(52, 199, 89, 0.2);
          color: #34c759;
        }

        .btn-sm {
          padding: 8px 16px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}