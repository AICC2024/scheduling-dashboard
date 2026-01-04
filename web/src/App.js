import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Button, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { MonthCalendar } from '@mui/x-date-pickers';

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
  // AI Show Rate state and month selector
  const [aiShowRate, setAiShowRate] = useState(null);
  const [selectedMonths, setSelectedMonths] = useState(() => {
    const now = new Date();
    return [`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`];
  });
  // Explicit year selection for AI Show Rate Single Month
  const [selectedYear, setSelectedYear] = useState(() => {
    return parseInt(new Date().getFullYear(), 10);
  });
  // For AI Show Rate Month Picker dialog
  const [monthDialogOpen, setMonthDialogOpen] = useState(false);
  const [tempMonth, setTempMonth] = useState(new Date(`${selectedMonths[0]}-01T00:00:00`));
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

          if (res.data && res.data.length > 0) {
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

useEffect(() => {
  let startTime, endTime;
  if (dateMode === 'single' && !selectedDate) return;
  const today = new Date();
  // Reset detail view when date mode or dates change
  setSelectedStatus(null);
  setSelectedProvider(null);
  setStatusDetailsCollapsed(false);
  setProviderDetailsCollapsed(false);
    if (dateMode === 'single') {
      startTime = `${selectedDate} 00:00:00`;
      endTime = `${selectedDate} 23:59:59`;
    } else if (dateMode === 'range') {
      startTime = `${rangeStart} 00:00:00`;
      endTime = `${rangeEnd} 23:59:59`;
    } else {
      const formatDate = (d) => d.toISOString().split('T')[0];
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      if (presetRange === 'last7') {
        const start = new Date();
        start.setDate(today.getDate() - 6);
        startTime = `${formatDate(start)} 00:00:00`;
        endTime = `${formatDate(today)} 23:59:59`;
      } else if (presetRange === 'lastMonth') {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        startTime = `${formatDate(start)} 00:00:00`;
        endTime = `${formatDate(end)} 23:59:59`;
      } else if (presetRange === 'ytd') {
        startTime = `${formatDate(firstDayOfYear)} 00:00:00`;
        endTime = `${formatDate(today)} 23:59:59`;
      }
    }
    if (!startTime.includes('null') && !endTime.includes('null')) {
      axios.get(`${baseUrl}/live-details`, {
        params: { start: startTime, end: endTime }
      })
        .then(res => {
          console.log("Live details response:", res.data);

          const filteredData = res.data;

          setDetails(filteredData);

          const summaryMap = {};
          let sentCount = 0;
          filteredData.forEach(row => {
            const status = row.Status || 'Unknown';
            summaryMap[status] = (summaryMap[status] || 0) + 1;
            sentCount += 1;
          });

          const summaryArray = Object.keys(summaryMap).map(status => ({
            Status: status,
            Count: summaryMap[status],
            Percent: sentCount ? ((summaryMap[status] / sentCount) * 100).toFixed(1) : '0'
          }));

          setSummary(summaryArray);
          setTotalSent(sentCount);

          const bookedRows = filteredData.filter(row => row.Status === 'Booked');

          // Deduplicate booked rows by patient/date/time/status (same logic as before)
          const uniqueKeys = new Set();
          let bookedCount = 0;

          // Revenue by effective date: before 2025-07-01 -> 154; on/after 2025-07-01 -> 175
          const RATE_CHANGE_DATE = '2025-07-01';
          const OLD_RATE = 154;
          const NEW_RATE = 175;
          let revenueSum = 0;

          bookedRows.forEach(row => {
            const key = `${row['Patient ID']}_${row['Date']}_${row['Time']}_${row['Status']}`;
            if (!uniqueKeys.has(key)) {
              uniqueKeys.add(key);
              bookedCount += 1;

              // row['Date'] is expected in 'YYYY-MM-DD' format; string compare works for ISO dates
              const rate = (row['Date'] && row['Date'] >= RATE_CHANGE_DATE) ? NEW_RATE : OLD_RATE;
              revenueSum += rate;
            }
          });

          setTotalBooked(bookedCount);
          setPercentBooked(sentCount ? ((bookedCount / sentCount) * 100).toFixed(1) : 0);
          setTotalRevenue(revenueSum);

          const langCounts = {};
          const mediumCounts = {};
          filteredData.forEach(row => {
            const lang = row['pt_language'] || 'Unknown';
            const medium = row['reach_out_medium'] || 'Unknown';
            langCounts[lang] = (langCounts[lang] || 0) + 1;
            mediumCounts[medium] = (mediumCounts[medium] || 0) + 1;
          });

          const totalLang = Object.values(langCounts).reduce((a, b) => a + b, 0);
          setLanguageStats(Object.entries(langCounts).map(([label, count]) => ({
            label,
            count,
            percent: totalLang ? ((count / totalLang) * 100).toFixed(1) : '0'
          })));

          const totalMedium = Object.values(mediumCounts).reduce((a, b) => a + b, 0);
          setMethodStats(Object.entries(mediumCounts).map(([label, count]) => ({
            label,
            count,
            percent: totalMedium ? ((count / totalMedium) * 100).toFixed(1) : '0'
          })));
        });
    }

    if (
      startTime &&
      endTime &&
      !startTime.includes('null') &&
      !endTime.includes('null')
    ) {
      axios
        .get(
          `${baseUrl}/booked-by-provider?start=${startTime.split(' ')[0]}&end=${endTime.split(' ')[0]}`
        )
        .then((res) => {
          setBookedData(res.data);
        })
        .catch((err) => {
          console.error("Error fetching booked-by-provider:", err);
        });
    }
    // Fetch AI Show Rate for selected months
    axios
      .get(`${baseUrl}/ai-show-rate`, {
        params: new URLSearchParams(selectedMonths.map(m => ['months', m]))
      })
      .then((res) => {
        setAiShowRate({
  months: res.data.months,
  total_booked: res.data.booked,
  total_kept: res.data.kept,
  show_up_rate: res.data.show_rate
});
      })
      .catch((err) => {
        console.error("Error fetching AI show rate:", err);
      });
  // eslint-disable-next-line
}, [baseUrl, selectedDate, dateMode, rangeStart, rangeEnd, presetRange, selectedMonths]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={
          <ProtectedRoute>
            {loadingDate || !selectedDate ? (
              <div style={{ padding: 40 }}>Loading recent data...</div>
            ) : (
            <div style={{ padding: 40 }}>
              <div style={{ textAlign: 'right', marginBottom: 20 }}>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('tenant_id');
                    window.location.href = '/login';
                  }}
                  style={{
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Logout
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 30 }}>
                <img src="/OH_color-logomark_transparent.png" alt="Open Health Care Clinic Logo" style={{ height: 90, marginRight: 20 }} />
                <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Open Health Care Clinic</h1>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ marginRight: 60 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 6 }}>Date Mode:</label>
                    <select value={dateMode} onChange={e => setDateMode(e.target.value)} style={{ marginBottom: 10 }}>
                      <option value="single">Single Day</option>
                      <option value="range">Date Range</option>
                      <option value="preset">Preset</option>
                    </select>
                    {dateMode === 'single' && (
                      <div>
                        <label style={{ marginRight: 10 }}>Select Date:</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={e => setSelectedDate(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginRight: 60 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: 6 }}>AI Show Rate Mode:</label>
                    <select
                      value={selectedMonths.length === 1 ? 'single' : 'ytd'}
                      onChange={(e) => {
                        if (e.target.value === 'ytd') {
                          const now = new Date();
                          const year = now.getFullYear();
                          const months = [];
                          for (let m = 0; m <= now.getMonth(); m++) {
                            const monthStr = `${year}-${(m + 1).toString().padStart(2, '0')}`;
                            months.push(monthStr);
                          }
                          setSelectedMonths(months);
                        } else {
                          const now = new Date();
                          const monthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
                          setSelectedMonths([monthStr]);
                        }
                      }}
                      style={{ marginBottom: 10 }}
                    >
                      <option value="single">Single Month</option>
                      <option value="ytd">Year to Date</option>
                    </select>
                    <div>
                      {/* Year dropdown for explicit year selection in Single Month mode */}
                      {selectedMonths.length === 1 && (
                        <div style={{ marginBottom: 8 }}>
                          <label style={{ marginRight: 10 }}>Select Year:</label>
                          <select
                            value={selectedYear}
                            onChange={(e) => {
                              const year = e.target.value;
                              setSelectedYear(year);

                              // Preserve current month while switching year
                              const month = selectedMonths[0].split('-')[1];
                              setSelectedMonths([`${year}-${month}`]);
                            }}
                          >
                            {/* Limit year range visibly */}
                            {(() => {
                              const currentYear = new Date().getFullYear();
                              const years = [];
                              for (let y = currentYear - 1; y <= currentYear; y++) {
                                years.push(y);
                              }
                              // Also always include 2025 for explicit 2025 support
                              if (!years.includes(2025)) years.unshift(2025);
                              return years.map((year) => (
                                <option key={year} value={year}>
                                  {year}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}
                      <label style={{ marginRight: 10 }}>
                        {selectedMonths.length === 1 ? 'Select Month:' : 'Select Year:'}
                      </label>
                      {selectedMonths.length === 1 ? (
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setTempMonth(new Date(`${selectedYear}-${selectedMonths[0].split('-')[1]}-01T00:00:00`));
                            setMonthDialogOpen(true);
                          }}
                          style={{ textTransform: 'none' }}
                        >
                          {new Date(`${selectedMonths[0]}-01T00:00:00`).toLocaleString('default', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </Button>
                      ) : (
                        <select
                          value={selectedMonths[0].split('-')[0]}
                          onChange={(e) => {
                            const selectedYear = e.target.value;
                            const months = [];
                            for (let m = 1; m <= 12; m++) {
                              months.push(`${selectedYear}-${m.toString().padStart(2, '0')}`);
                            }
                            setSelectedMonths(months);
                          }}
                        >
                          {Array.from({ length: 6 }, (_, i) => {
                            const year = 2025 + i;
                            return (
                              <option key={year} value={year}>
                                {year}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {dateMode === 'preset' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ marginRight: 10 }}>Select Preset:</label>
                  <select value={presetRange} onChange={e => setPresetRange(e.target.value)}>
                    <option value="last7">Last 7 Days</option>
                    <option value="lastMonth">Last Month</option>
                    <option value="ytd">Year to Date</option>
                  </select>
                </div>
              )}


              {dateMode === 'range' && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ marginRight: 10 }}>Start:</label>
                  <input
                    type="date"
                    value={rangeStart}
                    onChange={e => setRangeStart(e.target.value)}
                  />
                  <label style={{ margin: '0 10px' }}>End:</label>
                  <input
                    type="date"
                    value={rangeEnd}
                    onChange={e => setRangeEnd(e.target.value)}
                  />
                </div>
              )}
              {/* Top-level KPI summary cards */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <div style={{
                  flex: 1,
                  backgroundColor: '#f5f5f5',
                  padding: '20px',
                  margin: '0 10px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: 0 }}>Total Sent</h3>
                  <p style={{ fontSize: '1.5rem', margin: '8px 0 0' }}>{totalSent}</p>
                </div>
                <div style={{
                  flex: 1,
                  backgroundColor: '#f5f5f5',
                  padding: '20px',
                  margin: '0 10px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: 0 }}>Total Booked</h3>
                  <p style={{ fontSize: '1.5rem', margin: '8px 0 0' }}>{totalBooked}</p>
                </div>
                <div style={{
                  flex: 1,
                  backgroundColor: '#f5f5f5',
                  padding: '20px',
                  margin: '0 10px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: 0 }}>Percent Booked</h3>
                  <p style={{ fontSize: '1.5rem', margin: '8px 0 0' }}>{percentBooked}%</p>
                </div>
                <div style={{
                  flex: 1,
                  backgroundColor: '#f5f5f5',
                  padding: '20px',
                  margin: '0 10px',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <h3 style={{ margin: 0 }}>Estimated Revenue</h3>
                  <p style={{ fontSize: '1.5rem', margin: '8px 0 0' }}>${totalRevenue.toLocaleString()}</p>
                </div>
                <div style={{
                  flex: 1,
                  backgroundColor: '#e8f5e9',
                  padding: '20px',
                  margin: '0 10px',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: '2px solid #4caf50'
                }}>
                  <h3 style={{ margin: 0 }}>AI Show Rate</h3>
                  <p style={{ fontSize: '1.5rem', margin: '8px 0 0' }}>
                    {aiShowRate?.show_up_rate?.toFixed(1) || 0}%
                  </p>
                  <p style={{ marginTop: '6px', fontSize: '0.9rem' }}>
                    {aiShowRate?.total_booked} booked / {aiShowRate?.total_kept} kept
                  </p>
                </div>
              </div>
              {/* AI Show Rate Month Dialog */}
              <Dialog open={monthDialogOpen} onClose={() => setMonthDialogOpen(false)}>
                <DialogTitle>Select Month</DialogTitle>
                <DialogContent>
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <MonthCalendar
                      value={tempMonth}
                      onChange={(newValue) => {
                        const month = (newValue.getMonth() + 1).toString().padStart(2, '0');
                        setSelectedMonths([`${selectedYear}-${month}`]);
                        setMonthDialogOpen(false);
                      }}
                    />
                  </LocalizationProvider>
                </DialogContent>
              </Dialog>
              {/* AI Show Rate KPI Card removed (now included in KPI row above) */}
              <h2>% of Bookings by Status</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={summary} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="Status" type="category" width={200} />
                  <Tooltip />
                  <Bar dataKey="Count" fill="#82ca9d" onClick={handleStatusClick}>
                    <LabelList dataKey="Percent" position="right" formatter={(v) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Status Details Section */}
              {selectedStatus && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Details for Status: {selectedStatus}</h3>
                    <button onClick={() => setStatusDetailsCollapsed(!statusDetailsCollapsed)}>
                      {statusDetailsCollapsed ? '▾ Expand' : '▴ Collapse'}
                    </button>
                  </div>
                  {!statusDetailsCollapsed && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Patient ID</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Date</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Time</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Department</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Provider</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Status</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Duplicate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details
                          .filter(row => row.Status === selectedStatus)
                          .map((row, index) => (
                            <tr key={index}>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Patient ID']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Date']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Time']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Department']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Provider Name']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Status']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Duplicate'] === '✅' ? '❗' : ''}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <h2>Booked Volume by Provider</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bookedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="Provider Name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Booked" fill="#8884d8" onClick={handleProviderClick} />
                </BarChart>
              </ResponsiveContainer>

              {/* Provider Details Section */}
              {selectedProvider && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>Details for Provider: {selectedProvider}</h3>
                    <button onClick={() => setProviderDetailsCollapsed(!providerDetailsCollapsed)}>
                      {providerDetailsCollapsed ? '▾ Expand' : '▴ Collapse'}
                    </button>
                  </div>
                  {!providerDetailsCollapsed && (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Patient ID</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Date</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Time</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Department</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Provider</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Status</th>
                          <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left', padding: '8px' }}>Duplicate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details
                          .filter(row => row['Provider Name'] === selectedProvider && row.Status === 'Booked')
                          .map((row, index) => (
                            <tr key={index}>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Patient ID']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Date']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Time']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Department']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Provider Name']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Status']}</td>
                              <td style={{ padding: '8px', textAlign: 'left' }}>{row['Duplicate'] === '✅' ? '❗' : ''}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <h2>Patient Language Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={languageStats} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
                  <XAxis type="number" domain={[0, 'dataMax + 5']} />
                  <YAxis dataKey="label" type="category" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8884d8">
                    <LabelList dataKey="percent" position="right" formatter={(v) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <h2>Outreach Method Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={methodStats} layout="vertical" margin={{ top: 10, right: 30, left: 100, bottom: 10 }}>
                  <XAxis type="number" />
                  <YAxis dataKey="label" type="category" />
                  <Tooltip />
                  <Bar dataKey="count" fill="#82ca9d">
                    <LabelList dataKey="percent" position="right" formatter={(v) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

            </div>
            )}
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;