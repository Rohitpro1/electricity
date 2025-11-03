import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BillCalculator({ userId }) {
  const [billData, setBillData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillData();
  }, []);

  const fetchBillData = async () => {
    try {
      const response = await axios.get(`${API}/bill/${userId}`);
      setBillData(response.data);
    } catch (error) {
      toast.error('Failed to load bill data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-spinner"></div>;
  }

  return (
    <div className="bill-calculator" data-testid="bill-calculator">
      <h2>Monthly Bill Calculator</h2>
      <p className="subtitle">Two-Part Tariff Calculation for {billData?.month}</p>

      <div className="bill-breakdown glass">
        <div className="breakdown-item">
          <span className="breakdown-label">Fixed Charge:</span>
          <span className="breakdown-value" data-testid="fixed-charge">₹{billData?.fixed_charge}</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Per Unit Charge:</span>
          <span className="breakdown-value">₹{billData?.per_unit_charge}/kWh</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Total Units Consumed:</span>
          <span className="breakdown-value" data-testid="total-units">{billData?.total_units} kWh</span>
        </div>
        <div className="breakdown-item">
          <span className="breakdown-label">Variable Charge:</span>
          <span className="breakdown-value" data-testid="variable-charge">₹{billData?.variable_charge}</span>
        </div>
        <div className="breakdown-separator"></div>
        <div className="breakdown-item total">
          <span className="breakdown-label">Total Bill:</span>
          <span className="breakdown-value" data-testid="total-bill">₹{billData?.total_bill}</span>
        </div>
      </div>

      <div className="bill-formula glass">
        <h3>Formula</h3>
        <p>Total Bill = Fixed Charge + (Units × Per Unit Charge)</p>
        <p className="formula-example">
          ₹{billData?.total_bill} = ₹{billData?.fixed_charge} + ({billData?.total_units} × ₹{billData?.per_unit_charge})
        </p>
      </div>

      <style jsx>{`
        .bill-calculator {
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

        .bill-breakdown {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 16px;
        }

        .breakdown-item.total {
          font-size: 24px;
          font-weight: 600;
        }

        .breakdown-label {
          color: rgba(255, 255, 255, 0.7);
        }

        .breakdown-value {
          font-weight: 500;
        }

        .breakdown-separator {
          height: 1px;
          background: rgba(255, 255, 255, 0.1);
          margin: 8px 0;
        }

        .bill-formula {
          padding: 24px;
        }

        .bill-formula h3 {
          font-size: 18px;
          margin-bottom: 12px;
        }

        .bill-formula p {
          margin: 8px 0;
          color: rgba(255, 255, 255, 0.8);
        }

        .formula-example {
          font-family: 'Courier New', monospace;
          background: rgba(255, 255, 255, 0.05);
          padding: 12px;
          border-radius: 8px;
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
}