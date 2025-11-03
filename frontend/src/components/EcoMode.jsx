import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EcoMode({ userId }) {
  const [selectedTier, setSelectedTier] = useState('Standard');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  const tiers = [
    { name: 'Standard', icon: '🌱', description: 'Basic energy saving tips' },
    { name: 'Super', icon: '🌿', description: 'Advanced optimization strategies' },
    { name: 'Ultra', icon: '🌳', description: 'Maximum energy efficiency mode' }
  ];

  const handleTierSelect = async (tier) => {
    setSelectedTier(tier);
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/eco-mode/${userId}`, { tier });
      setRecommendations(response.data.recommendations);
      toast.success(`${tier} mode activated`);
    } catch (error) {
      toast.error('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eco-mode" data-testid="eco-mode">
      <h2>Eco Mode</h2>
      <p className="subtitle">Choose your energy saving tier and get personalized recommendations</p>

      <div className="tiers-grid">
        {tiers.map(tier => (
          <button
            key={tier.name}
            className={`tier-card glass ${selectedTier === tier.name ? 'active' : ''}`}
            onClick={() => handleTierSelect(tier.name)}
            data-testid={`eco-tier-${tier.name.toLowerCase()}`}
          >
            <div className="tier-icon">{tier.icon}</div>
            <div className="tier-name">{tier.name}</div>
            <div className="tier-description">{tier.description}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"></div>
      ) : recommendations.length > 0 && (
        <div className="recommendations glass" data-testid="recommendations">
          <h3>Recommendations for {selectedTier} Mode</h3>
          <ul className="recommendations-list">
            {recommendations.map((rec, index) => (
              <li key={index} className="recommendation-item">
                <span className="rec-icon">💡</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .eco-mode {
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

        .tiers-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
        }

        .tier-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s;
          background: rgba(255, 255, 255, 0.05);
        }

        .tier-card:hover {
          transform: translateY(-4px);
        }

        .tier-card.active {
          border: 2px solid rgba(52, 199, 89, 0.5);
          background: rgba(52, 199, 89, 0.1);
        }

        .tier-icon {
          font-size: 48px;
        }

        .tier-name {
          font-size: 20px;
          font-weight: 600;
        }

        .tier-description {
          text-align: center;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        .recommendations {
          padding: 24px;
        }

        .recommendations h3 {
          font-size: 20px;
          margin-bottom: 20px;
        }

        .recommendations-list {
          list-style: none;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .recommendation-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          line-height: 1.6;
        }

        .rec-icon {
          font-size: 20px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}