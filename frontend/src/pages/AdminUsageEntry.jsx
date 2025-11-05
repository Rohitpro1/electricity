import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminUsageEntry() {
  const [userId, setUserId] = useState("");
  const [date, setDate] = useState("");
  const [consumption, setConsumption] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/admin/usage-entry`, {
        user_id: userId,
        date: date,
        consumption_kwh: parseFloat(consumption)
      });
      toast.success("Usage entry saved successfully");
      setConsumption("");
    } catch (error) {
      toast.error("Failed to add usage entry");
    }
  };

  return (
    <div className="admin-page">
      <h2>Admin Usage Entry</h2>
      <p className="subtitle">Add or update daily usage values manually</p>

      <form onSubmit={handleSubmit} className="usage-form glass">
        <input
          type="text"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <input
          type="number"
          placeholder="Consumption (kWh)"
          value={consumption}
          onChange={(e) => setConsumption(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-success">Save Entry</button>
      </form>

      <style jsx>{`
        .admin-page {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .usage-form {
          display: grid;
          gap: 16px;
          padding: 24px;
          max-width: 400px;
        }

        input {
          padding: 10px;
          border-radius: 8px;
          border: none;
        }

        button {
          padding: 10px;
        }
      `}</style>
    </div>
  );
}