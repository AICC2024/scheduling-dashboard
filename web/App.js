import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  useEffect(() => {
    const tenant = localStorage.getItem('tenant_id');
    if (!tenant) {
      navigate('/login');
    }
  }, [navigate]);
  return children;

};

function App() {
  const baseUrl = process.env.REACT_APP_API_BASE_URL || 'https://scheduling-dashboard-backend.onrender.com';
  console.log("Using API base URL:", baseUrl);
  const [summary, setSummary] = useState([]);
  const [bookedData, setBookedData] = useState([]);
  const [totalBooked, setTotalBooked] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [loadingDate, setLoadingDate] = useState(true);
  const [totalSent, setTotalSent] = useState(0);
  const [percentBooked, setPercentBooked] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [details, setDetails] = useState([]);
  const [dateMode, setDateMode] = useState('single');
  const [rangeStart, setRangeStart] = useState(selectedDate);
  const [rangeEnd, setRangeEnd] = useState(selectedDate);
  const [presetRange, setPresetRange] = useState('last7');
  const [languageStats, setLanguageStats] = useState([]);
  const [methodStats, setMethodStats] = useState([]);
  // Inactivity logout (30 minutes) and auto-logout on browser close
  const timeoutRef = useRef(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem('tenant_id');
    window.location.href = '/login';
  }, []);

  const resetTimeout = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (window.confirm('Logged out due to inactivity. Click OK to remain logged in.')) {
        resetTimeout();
      } else {
        logout();
      }
    }, 30 * 60 * 1000); // 30 minutes
  }, [logout]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'click', 'scroll', 'keypress'];
    events.forEach(e => window.addEventListener(e, resetTimeout));
    window.addEventListener('beforeunload', () => sessionStorage.removeItem('tenant_id'));
    // Start the inactivity timer
    resetTimeout();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimeout));
      window.removeEventListener('beforeunload', () => sessionStorage.removeItem('tenant_id'));
    };
  }, [resetTimeout]);
  // New collapsible state variables for details sections
  const [statusDetailsCollapsed, setStatusDetailsCollapsed] = useState(false);
  const [providerDetailsCollapsed, setProviderDetailsCollapsed] = useState(false);
  useEffect(() => {
    const checkRecentDates = async () => {
      const today = new Date();
      const format = (d) => d.toISOString().split('T')[0];

      for (let i = 1; i <= 7; i++) {
        const testDate = new Date(today);
        testDate.setDate(today.getDate() - i);
        const dateStr = format(testDate);

        const start = `${dateStr} 00:00:00`;
        const end = `${dateStr} 23:59:59`;

        try {
          const res = await axios.get(`${baseUrl}/live-details`, {
            params: { start, end }
          });

          if (res.data && Array.isArray(res.data.records) && res.data.records.length > 0) {
            setSelectedDate(dateStr);
            break;
          }
        } catch (err) {
          console.error(`Error checking date ${dateStr}`, err);
        }
      }

      setLoadingDate(false);
    };

    checkRecentDates();
  }, [baseUrl]);

  const handleStatusClick = (data) => {
    if (selectedStatus === data.Status) {
      setStatusDetailsCollapsed(!statusDetailsCollapsed);
    } else {
      setSelectedStatus(data.Status);
      setSelectedProvider(null);
      setStatusDetailsCollapsed(false);
    }
  };

const handleProviderClick = (data) => {
    if (selectedProvider === data['Provider Name']) {
      setProviderDetailsCollapsed(!providerDetailsCollapsed);
    } else {
      setSelectedProvider(data['Provider Name']);
      setSelectedStatus(null);
      setProviderDetailsCollapsed(false);
    }
  };

  return (
    <div>
      <h1>Loading...</h1>
    </div>
  );
}

export default App;

