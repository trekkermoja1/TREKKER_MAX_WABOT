import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const BACKEND_URL = `https://${window.location.host.replace('5000', '8000')}`;

// Trekker Logo Component
const TrekkerLogo = () => (
  <div className="flex items-center gap-3">
    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
      <span className="text-2xl">🚀</span>
    </div>
    <div>
      <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
        TREKKER MAX
      </h1>
      <p className="text-xs text-gray-400">WABOT Platform</p>
    </div>
  </div>
);

// Status Badge Component
const StatusBadge = ({ status }) => {
  const statusConfig = {
    connected: { color: 'bg-emerald-500', text: 'Connected', pulse: true },
    running: { color: 'bg-emerald-500', text: 'Running', pulse: true },
    pairing: { color: 'bg-yellow-500', text: 'Pairing', pulse: true },
    waiting_for_pairing: { color: 'bg-yellow-500', text: 'Waiting for Pairing', pulse: true },
    connecting: { color: 'bg-blue-500', text: 'Connecting', pulse: true },
    starting: { color: 'bg-blue-500', text: 'Starting', pulse: true },
    stopped: { color: 'bg-gray-500', text: 'Stopped', pulse: false },
    disconnected: { color: 'bg-red-500', text: 'Disconnected', pulse: false },
    error: { color: 'bg-red-500', text: 'Error', pulse: false },
    logged_out: { color: 'bg-orange-500', text: 'Logged Out', pulse: false },
  };

  const config = statusConfig[status] || { color: 'bg-gray-500', text: status, pulse: false };

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-white ${config.color}`}>
      {config.pulse && <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>}
      {config.text}
    </span>
  );
};

// Countdown Timer Component
const CountdownTimer = ({ expiresAt, onExpire }) => {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(remaining);
      
      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpire]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const getTimerColor = () => {
    if (remainingSeconds > 120) return 'text-emerald-400';
    if (remainingSeconds > 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={`text-center ${getTimerColor()}`}>
      <div className="text-3xl font-mono font-bold">
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </div>
      <p className="text-xs text-gray-400 mt-1">Time remaining</p>
    </div>
  );
};

// Create Instance Modal
const CreateInstanceModal = ({ isOpen, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate phone number
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid phone number with country code');
      setLoading(false);
      return;
    }

    try {
      await onSubmit({ name, phone_number: cleanPhone });
      setName('');
      setPhoneNumber('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create instance');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🤖</span> New Bot Instance
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Bot Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My WhatsApp Bot"
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">WhatsApp Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="254750433158"
              required
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            <p className="text-xs text-gray-400 mt-1">Enter with country code, no + or spaces</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </>
              ) : (
                'Create & Pair'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Pairing Code Modal with Timer
const PairingModal = ({ instance, onClose, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pairingData, setPairingData] = useState(null);
  const [expired, setExpired] = useState(false);

  const fetchPairingCode = useCallback(async () => {
    if (!instance) return;
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/instances/${instance.id}/pairing-code`);
      const data = await response.json();
      setPairingData(data);
      setExpired(!data.pairing_code_valid && data.pairing_code_remaining_seconds === 0);
    } catch (err) {
      console.error('Error fetching pairing code:', err);
    } finally {
      setLoading(false);
    }
  }, [instance]);

  const regenerateCode = async () => {
    if (!instance) return;
    setRegenerating(true);
    setExpired(false);
    try {
      const response = await fetch(`${BACKEND_URL}/api/instances/${instance.id}/regenerate-code`, {
        method: 'POST'
      });
      const data = await response.json();
      setPairingData(data);
    } catch (err) {
      console.error('Error regenerating pairing code:', err);
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    fetchPairingCode();
    const interval = setInterval(fetchPairingCode, 3000);
    return () => clearInterval(interval);
  }, [fetchPairingCode]);

  if (!instance) return null;

  const pairingCode = pairingData?.pairing_code;
  const status = pairingData?.status || instance.status;
  const expiresAt = pairingData?.pairing_code_expires_at;
  const isValid = pairingData?.pairing_code_valid;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🔗</span> Link WhatsApp
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="text-center space-y-4">
          <div className="p-4 bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-400 mb-2">Bot: {instance.name}</p>
            <p className="text-sm text-gray-400">Phone: {instance.phone_number}</p>
          </div>

          {status === 'connected' ? (
            <div className="p-6 bg-emerald-500/20 border border-emerald-500/50 rounded-xl">
              <span className="text-5xl mb-4 block">✅</span>
              <p className="text-emerald-400 font-medium text-lg">Successfully Connected!</p>
              <p className="text-gray-400 text-sm mt-2">Your bot is now active</p>
            </div>
          ) : pairingCode && isValid ? (
            <>
              <div className="p-6 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl">
                <p className="text-sm text-gray-400 mb-3">Your Pairing Code</p>
                <p className="text-4xl font-mono font-bold text-white tracking-wider mb-4">
                  {pairingCode}
                </p>
                {expiresAt && (
                  <CountdownTimer 
                    expiresAt={expiresAt} 
                    onExpire={() => setExpired(true)}
                  />
                )}
              </div>

              <div className="text-left space-y-3 p-4 bg-gray-700/30 rounded-xl">
                <p className="text-sm font-medium text-gray-300">How to connect:</p>
                <ol className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                    Open WhatsApp on your phone
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                    Go to Settings → Linked Devices
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                    Tap "Link a Device"
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                    Select "Link with phone number instead"
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-emerald-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                    Enter the code shown above
                  </li>
                </ol>
              </div>
            </>
          ) : expired || (!pairingCode && !loading) ? (
            <div className="p-6 bg-orange-500/20 border border-orange-500/50 rounded-xl">
              <span className="text-5xl mb-4 block">⏰</span>
              <p className="text-orange-400 font-medium text-lg">Pairing Code Expired</p>
              <p className="text-gray-400 text-sm mt-2 mb-4">Click below to generate a new code</p>
              <button
                onClick={regenerateCode}
                disabled={regenerating}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
              >
                {regenerating ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Generate New Code
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-6">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-10 w-10 text-emerald-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-400">Generating pairing code...</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {pairingCode && isValid && (
              <button
                onClick={regenerateCode}
                disabled={regenerating}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {regenerating ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                New Code
              </button>
            )}
            <button
              onClick={() => { onRefresh(); onClose(); }}
              className="flex-1 px-4 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Instance Card Component
const InstanceCard = ({ instance, onStart, onStop, onDelete, onPair }) => {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action, fn) => {
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  };

  const isRunning = ['running', 'connected', 'pairing', 'connecting', 'waiting_for_pairing'].includes(instance.status);

  return (
    <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-5 hover:border-emerald-500/50 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-2xl">
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-white">{instance.name}</h3>
            <p className="text-sm text-gray-400">{instance.phone_number}</p>
          </div>
        </div>
        <StatusBadge status={instance.status} />
      </div>

      {instance.connected_user && (
        <div className="mb-4 p-3 bg-gray-700/30 rounded-xl">
          <p className="text-xs text-gray-400">Connected as</p>
          <p className="text-sm text-white truncate">{instance.connected_user.name || instance.connected_user.id}</p>
        </div>
      )}

      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={() => handleAction('start', () => onStart(instance.id))}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            </svg>
            Start
          </button>
        ) : (
          <button
            onClick={() => handleAction('stop', () => onStop(instance.id))}
            disabled={loading}
            className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop
          </button>
        )}

        <button
          onClick={() => onPair(instance)}
          disabled={loading || !isRunning}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Pair
        </button>

        <button
          onClick={() => handleAction('delete', () => onDelete(instance.id))}
          disabled={loading}
          className="px-3 py-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  const [error, setError] = useState('');

  const fetchInstances = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/instances`);
      const data = await response.json();
      setInstances(data.instances || []);
      setError('');
    } catch (err) {
      console.error('Error fetching instances:', err);
      setError('Failed to connect to backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 5000);
    return () => clearInterval(interval);
  }, [fetchInstances]);

  const createInstance = async (data) => {
    const response = await fetch(`${BACKEND_URL}/api/instances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create instance');
    }
    const instance = await response.json();
    await fetchInstances();
    setSelectedInstance(instance);
  };

  const startInstance = async (id) => {
    await fetch(`${BACKEND_URL}/api/instances/${id}/start`, { method: 'POST' });
    await fetchInstances();
  };

  const stopInstance = async (id) => {
    await fetch(`${BACKEND_URL}/api/instances/${id}/stop`, { method: 'POST' });
    await fetchInstances();
  };

  const deleteInstance = async (id) => {
    if (!window.confirm('Are you sure you want to delete this bot instance?')) return;
    await fetch(`${BACKEND_URL}/api/instances/${id}`, { method: 'DELETE' });
    await fetchInstances();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700/50 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <TrekkerLogo />
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {instances.length} Bot{instances.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/25"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Bot
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            Multi-Instance WhatsApp Bot Platform
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Create and manage multiple WhatsApp bots, each running in its own isolated environment.
            Powered by <span className="text-emerald-400 font-semibold">Trekker</span>.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{instances.length}</p>
                <p className="text-sm text-gray-400">Total Bots</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">✅</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {instances.filter(i => ['running', 'connected'].includes(i.status)).length}
                </p>
                <p className="text-sm text-gray-400">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
                <span className="text-xl">🔗</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {instances.filter(i => ['pairing', 'waiting_for_pairing'].includes(i.status)).length}
                </p>
                <p className="text-sm text-gray-400">Pairing</p>
              </div>
            </div>
          </div>
        </div>

        {/* Instances Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-10 w-10 text-emerald-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : instances.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Bot Instances Yet</h3>
            <p className="text-gray-400 mb-6">Create your first WhatsApp bot instance to get started.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition font-medium inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Bot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                onStart={startInstance}
                onStop={stopInstance}
                onDelete={deleteInstance}
                onPair={setSelectedInstance}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              © 2025 TREKKER MAX WABOT. Powered by Trekker.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">v1.0.0</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreateInstanceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={createInstance}
      />

      <PairingModal
        instance={selectedInstance}
        onClose={() => setSelectedInstance(null)}
        onRefresh={fetchInstances}
      />
    </div>
  );
}

export default App;
