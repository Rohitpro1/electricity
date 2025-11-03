import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CostPredictor({ userId }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrediction();
  }, []);

  const fetchPrediction = async () => {
    try {
      const response = await axios.get(`${API}/predict/${userId}`);
      setPrediction(response.data);
    } catch (error) {
      toast.error('Failed to load prediction');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div className="cost-predictor" data-testid="cost-predictor">
      <h2>Cost Predictor</h2>
      <p className="subtitle">AI-powered electricity cost prediction based on your usage patterns</p>

      <div className="prediction-cards">
        <div className="prediction-card glass">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <div className="card-label">Predicted Monthly Cost</div>
            <div className="card-value" data-testid="predicted-cost">₹{prediction?.predicted_monthly_cost}</div>
          </div>
        </div>

        <div className="prediction-card glass">
          <div className="card-icon">⚡</div>
          <div className="card-content">
            <div className="card-label">Predicted Units</div>
            <div className="card-value" data-testid="predicted-units">{prediction?.predicted_units} kWh</div>
          </div>
        </div>

        <div className="prediction-card glass">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <div className="card-label">Average Daily Usage</div>
            <div className="card-value">{prediction?.average_daily_units} kWh</div>
          </div>
        </div>
      </div>

      <div className="prediction-info glass">
        <h3>How it works</h3>
        <p>Our AI analyzes your electricity consumption patterns from the last 30 days to predict your monthly bill. The prediction considers:</p>
        <ul>
          <li>Historical consumption data</li>
          <li>Seasonal variations</li>
          <li>Appliance usage patterns</li>
          <li>Current tariff rates</li>
        </ul>
      </div>

      <style jsx>{`
        .cost-predictor {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        h2 {
          font-size: 28px;
          font-weight: 600;
        }

        .subtitle {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
        }

        .prediction-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .prediction-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .card-icon {
          font-size: 48px;
        }

        .card-content {
          flex: 1;
        }

        .card-label {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 8px;
        }

        .card-value {
          font-size: 28px;
          font-weight: 600;
        }

        .prediction-info {
          padding: 24px;
        }

        .prediction-info h3 {
          font-size: 18px;
          margin-bottom: 16px;
        }

        .prediction-info p {
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 16px;
          line-height: 1.6;
        }

        .prediction-info ul {
          list-style: none;
          padding: 0;
        }

        .prediction-info li {
          padding: 8px 0;
          padding-left: 24px;
          position: relative;
          color: rgba(255, 255, 255, 0.8);
        }

        .prediction-info li::before {
          content: '✓';
          position: absolute;
          left: 0;
          color: #34c759;
        }
      `}</style>
    </div>
  );
}