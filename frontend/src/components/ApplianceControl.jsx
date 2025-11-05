import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ApplianceControl({ userId }) {
  const [appliances, setAppliances] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAppliance, setNewAppliance] = useState({
    name: '',
    power_rating: '',
    location: ''
  });

  useEffect(() => {
    fetchAppliances();
  }, []);

  const fetchAppliances = async () => {
    try {
      const response = await axios.get(`${API}/appliances/${userId}`);
      setAppliances(response.data.appliances || []);
    } catch (error) {
      toast.error('Failed to load appliances');
    }
  };

  const handleAdd = async (e) => {
  e.preventDefault();
  try {
    await axios.post(`${API}/appliances/${userId}`, {
      name: newAppliance.name,
      power_rating: parseFloat(newAppliance.power_rating),
      location: newAppliance.location
    });

    toast.success('Appliance added successfully');
    
    setNewAppliance({ name: '', power_rating: '', location: '' });
    setShowAddForm(false);
    
    // ✅ Wait for server insert, then re-fetch the updated list
    await fetchAppliances();  
  } catch (error) {
    toast.error('Failed to add appliance');
  }
};

  const handleControl = async (applianceId, currentStatus) => {
    const newStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
    try {
      await axios.put(`${API}/appliances/${applianceId}/control`, { status: newStatus });
      toast.success(`Appliance turned ${newStatus}`);
      fetchAppliances();
    } catch (error) {
      toast.error('Failed to control appliance');
    }
  };

  const handleDelete = async (applianceId) => {
    if (!window.confirm('Delete this appliance?')) return;
    try {
      await axios.delete(`${API}/appliances/${applianceId}`);
      toast.success('Appliance deleted');
      fetchAppliances();
    } catch (error) {
      toast.error('Failed to delete appliance');
    }
  };

  return (
    <div className="appliance-control" data-testid="appliance-control">
      <div className="control-header">
        <h2>Appliance Control</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddForm(!showAddForm)}
          data-testid="add-appliance-button"
        >
          {showAddForm ? 'Cancel' : '+ Add Appliance'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="add-form glass">
          <input
            type="text"
            className="input"
            placeholder="Appliance name"
            value={newAppliance.name}
            onChange={(e) => setNewAppliance({...newAppliance, name: e.target.value})}
            required
            data-testid="appliance-name-input"
          />
          <input
            type="number"
            className="input"
            placeholder="Power rating (Watts)"
            value={newAppliance.power_rating}
            onChange={(e) => setNewAppliance({...newAppliance, power_rating: e.target.value})}
            required
            data-testid="appliance-power-input"
          />
          <input
            type="text"
            className="input"
            placeholder="Location"
            value={newAppliance.location}
            onChange={(e) => setNewAppliance({...newAppliance, location: e.target.value})}
            required
            data-testid="appliance-location-input"
          />
          <button type="submit" className="btn btn-success" data-testid="submit-appliance-button">
            Add Appliance
          </button>
        </form>
      )}

      <div className="appliances-grid">
        {appliances.map(appliance => (
          <div key={appliance.id} className="appliance-card glass" data-testid="appliance-card">
            <div className="appliance-header">
              <h3>{appliance.name}</h3>
              <span className={`status-badge ${appliance.status.toLowerCase()}`}>
                {appliance.status}
              </span>
            </div>
            <div className="appliance-details">
              <div className="detail-item">
                <span className="detail-label">Power:</span>
                <span className="detail-value">{appliance.power_rating}W</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Location:</span>
                <span className="detail-value">{appliance.location}</span>
              </div>
            </div>
            <div className="appliance-actions">
              <button
                className={`btn ${appliance.status === 'ON' ? 'btn-danger' : 'btn-success'}`}
                onClick={() => handleControl(appliance.id, appliance.status)}
                data-testid="toggle-appliance-button"
              >
                Turn {appliance.status === 'ON' ? 'OFF' : 'ON'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleDelete(appliance.id)}
                data-testid="delete-appliance-button"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .appliance-control {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .control-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .control-header h2 {
          font-size: 28px;
          font-weight: 600;
        }

        .add-form {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          padding: 24px;
        }

        .appliances-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .appliance-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .appliance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .appliance-header h3 {
          font-size: 18px;
          font-weight: 600;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.on {
          background: rgba(52, 199, 89, 0.2);
          color: #34c759;
        }

        .status-badge.off {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
        }

        .appliance-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
        }

        .detail-label {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }

        .detail-value {
          font-weight: 500;
        }

        .appliance-actions {
          display: flex;
          gap: 12px;
        }

        .appliance-actions button {
          flex: 1;
        }
      `}</style>
    </div>
  );
}