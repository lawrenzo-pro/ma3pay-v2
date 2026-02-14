import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CreditCard, 
  MapPin, 
  History, 
  User, 
  Plus, 
  Wifi, 
  ArrowRight,
  Wallet,
  Scan,
  Moon,
  Sun,
  Languages,
  LogOut,
  Bus,
  CheckCircle,
  AlertCircle,
  Star,
  Share2,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCcw
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ROUTES, MOCK_NFC_IDS, TRANSLATIONS } from './constants';
import { UserProfile, Transaction, TransactionType, PaymentStatus, Language } from './types';
import { TransactionHistory } from './components/TransactionHistory';
import { Assistant } from './components/Assistant';
import { PaymentPage } from './components/PaymentPage';
import { AuthPage } from './components/AuthPage';
import { RatingPage } from './components/RatingPage';
import { ShareTokensPage } from './components/ShareTokensPage';
import { wallet, tags } from './services/api';

enum View {
  HOME,
  TOPUP,
  PAYMENT,
  SCAN,
  HISTORY,
  AUTH,
  ENROLL,
  RATING,
  SHARE
}

export default function App() {
  const [view, setView] = useState<View>(View.AUTH);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);
  
  // Global Settings
  const [isDark, setIsDark] = useState(false);
  const [lang, setLang] = useState<Language>('en');
  const t = TRANSLATIONS[lang];
  
  // Top Up State
  const [selectedTopUpAmount, setSelectedTopUpAmount] = useState(0);

  // Scan/Redeem State
  const [scannedId, setScannedId] = useState('');
    const [scanStatus, setScanStatus] = useState<'idle' | 'matched'>('idle');
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
    const [scanError, setScanError] = useState('');
    const [farePhone, setFarePhone] = useState('');
    const [fareError, setFareError] = useState('');
    const [isFarePaying, setIsFarePaying] = useState(false);
    const [showTopUp, setShowTopUp] = useState(false);
    const [topUpAmount, setTopUpAmount] = useState(0);
    const [isSendingStk, setIsSendingStk] = useState(false);
    const [stkMessage, setStkMessage] = useState('');
  
  // Enrollment State
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'scanning' | 'success'>('idle');

  // Session Persistence: Check for stored user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('ma3pay_user');
    const storedToken = localStorage.getItem('ma3pay_token');
    
    if (storedUser && storedToken) {
        try {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
            setView(View.HOME);
        } catch (e) {
            console.error("Failed to load stored session", e);
            localStorage.removeItem('ma3pay_user');
        }
    }
  }, []);

  // Update stored user whenever user state changes
  useEffect(() => {
    if (user) {
        localStorage.setItem('ma3pay_user', JSON.stringify(user));
    }
  }, [user]);

    useEffect(() => {
        if (user?.phoneNumber) {
            setFarePhone(user.phoneNumber);
        }
    }, [user]);

  // Fetch latest data from backend
    const refreshData = useCallback(async () => {
    if (!user) return;
    try {
        const txs = await wallet.getActivity();
        setHistory(txs);
        
        // Also fetch the latest balance from backend to ensure accuracy
        const balanceData = await wallet.getBalance();
        setUser(prev => prev ? ({ ...prev, balance: balanceData.balance }) : null);
    } catch (e) {
        console.error("Failed to fetch history", e);
    }
  }, [user]);

    const resolveTagUid = (tag: any): string | null => {
        return tag?.tagUid || tag?.tag_uid || tag?.uid || tag?.serialNumber || null;
    };

    const refreshTags = useCallback(async () => {
        if (!user) return;
        try {
                const tagList = await tags.getAll();
                if (!Array.isArray(tagList)) {
                        console.error('Invalid tags response:', tagList);
                        return;
                }

                const resolvedTag = tagList.length > 0 ? resolveTagUid(tagList[0]) : null;

                if (resolvedTag && resolvedTag !== user.nfcTagId) {
                        setUser(prev => prev ? ({ ...prev, nfcTagId: resolvedTag }) : prev);
                }

                if (!resolvedTag && user.nfcTagId) {
                        setUser(prev => prev ? ({ ...prev, nfcTagId: null }) : prev);
                }
        } catch (e) {
                console.error('Failed to fetch tags', e);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
                refreshData();
                refreshTags();
        }
    }, [user, refreshData, refreshTags]);

    // Periodic refresh: update balance and history every 30 seconds
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(() => {
            refreshData();
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [user, refreshData]);

  // Calculate spending data dynamically from history
  const spendingData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    // Initialize with 0
    const dataMap = new Map(days.map(day => [day, 0]));

    // Sum up payments from the last 7 days
    const now = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(now.getDate() - 7);

    history.forEach(tx => {
      if (tx.type === TransactionType.PAYMENT && tx.status === PaymentStatus.SUCCESS) {
        const txDate = new Date(tx.date);
        if (txDate >= oneWeekAgo && txDate <= now) {
          const dayName = days[txDate.getDay()];
          dataMap.set(dayName, (dataMap.get(dayName) || 0) + tx.amount);
        }
      }
    });

    // Format for Recharts (Mon-Sun order)
    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return orderedDays.map(day => ({
      name: day,
      amount: dataMap.get(day) || 0
    }));
  }, [history]);

  const handleLogin = (newUser: UserProfile) => {
    setUser(newUser);
    setView(View.HOME);
  };

  const handleLogout = () => {
    localStorage.removeItem('ma3pay_token');
    localStorage.removeItem('ma3pay_user'); // Clear persisted session
    setUser(null);
    setView(View.AUTH);
  };

  const handleTopUpSuccess = (transaction: Transaction) => {
    if (user) {
      // Optimistically update balance locally so the user sees the effect immediately
      setUser(prev => prev ? ({ ...prev, balance: prev.balance + transaction.amount }) : null);
      refreshData(); // Fetch latest history
      setView(View.HOME);
    }
  };

    const enrollTag = async (tagUid: string) => {
        try {
            const response = await tags.enroll(tagUid);
            if (response?.msg !== 'Enrolled') {
                throw new Error(response?.error || 'Tag enrollment failed');
            }
            setUser(prev => prev ? ({ ...prev, nfcTagId: tagUid }) : prev);
            setEnrollStatus('success');
            setTimeout(() => {
                setView(View.HOME);
                setEnrollStatus('idle');
            }, 2000);
        } catch (error) {
            console.error('Tag enroll failed', error);
            setEnrollStatus('idle');
            alert('Failed to enroll tag. Please try again.');
        }
    };

  const handleEnrollScan = async () => {
    setEnrollStatus('scanning');

    // Try Real NFC (Chrome Android)
    if ('NDEFReader' in window) {
        try {
            const ndef = new (window as any).NDEFReader();
            await ndef.scan();
            
            // Set up one-time listener
            ndef.onreading = (event: any) => {
                const serialNumber = event.serialNumber; // e.g., "04:a3:..."
                if (serialNumber) {
                    enrollTag(serialNumber);
                }
            };
            return; // Wait for real tag
        } catch (error) {
            console.log("NFC Not enabled or permission denied, falling back to sim", error);
            // Proceed to simulation below
        }
    }

    // Fallback Simulation
    setTimeout(() => {
      const newTagId = MOCK_NFC_IDS[Math.floor(Math.random() * MOCK_NFC_IDS.length)];
            enrollTag(newTagId);
    }, 2000);
  }

    const handleTransferSuccess = (newBalance: number, _amount: number, _recipient: string) => {
      if (!user) return;
      setUser(prev => prev ? ({ ...prev, balance: newBalance }) : null);
      refreshData();
  }

    const resolveFarePrice = (route: (typeof ROUTES)[number]) => {
        return route.standardPrice;
    };

    const finalizeFarePayment = (route: (typeof ROUTES)[number], price: number) => {
    if (!user) return;

    const tx: Transaction = {
      id: `TR${Date.now()}`,
      type: TransactionType.PAYMENT,
      amount: price,
      date: new Date().toISOString(),
      description: `${t.trip} ${route.name.split('-')[1]}`,
      route: route.name,
      status: PaymentStatus.SUCCESS
    };

    // Optimistic update: Subtract fare locally
    setUser(prev => prev ? ({ ...prev, balance: prev.balance - price }) : null);
    setHistory(prev => [tx, ...prev]);
    
    setView(View.HOME);
    setScannedId('');
    setSelectedRouteId(null);
    setScanStatus('idle');
        setScanError('');
  };

    const handleFarePay = async () => {
        const route = ROUTES.find(r => r.id === selectedRouteId);
        if (!route || !user) return;

        setFareError('');
        setStkMessage('');
        setIsFarePaying(true);

        const price = resolveFarePrice(route);
        if (user.balance < price) {
            setTopUpAmount(Math.max(price - user.balance, 0));
            setShowTopUp(true);
            setFareError(t.insufficientFunds);
            setIsFarePaying(false);
            return;
        }

        finalizeFarePayment(route, price);
        setIsFarePaying(false);
    };

    const handleSendStkPush = async () => {
        const route = ROUTES.find(r => r.id === selectedRouteId);
        if (!route) return;

        const amount = topUpAmount > 0 ? topUpAmount : resolveFarePrice(route);
        if (!farePhone.trim()) {
            setFareError('Enter phone number to receive STK push.');
            return;
        }

        setIsSendingStk(true);
        setFareError('');
        setStkMessage('');

        try {
            await wallet.deposit(amount, farePhone.trim());
            setStkMessage('STK push sent. Complete it on your phone, then tap Pay.');
        } catch (error: any) {
            const msg = error.response?.data?.error
                || error.response?.data?.message
                || error.message
                || 'Failed to send STK push.';
            setFareError(msg);
        } finally {
            setIsSendingStk(false);
        }
    };

  // Only render auth page if no user
  if (!user || view === View.AUTH) {
    return <AuthPage onLogin={handleLogin} isDark={isDark} lang={lang} />;
  }

  const renderEnroll = () => (
    <div className="flex flex-col h-full p-6">
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setView(View.HOME)} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-black'}`}>
                <ArrowRight className="rotate-180" />
            </button>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.enrollTag}</h2>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
            {enrollStatus === 'idle' && (
                <>
                    <div className={`w-64 h-64 rounded-full border-4 border-dashed flex items-center justify-center animate-pulse ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                        <Wifi className={`w-24 h-24 rotate-90 ${isDark ? 'text-yellow-500' : 'text-yellow-600'}`} />
                    </div>
                    <div>
                        <h3 className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.enrollTag}</h3>
                        <p className="text-gray-500">{t.enrollDesc}</p>
                        <p className="text-xs text-gray-400 mt-2">Requires Chrome on Android for Real NFC</p>
                    </div>
                    <button 
                        onClick={handleEnrollScan}
                        className="bg-yellow-500 text-black px-8 py-4 rounded-xl font-bold shadow-lg hover:bg-yellow-400 transition-all w-full max-w-xs"
                    >
                        Scan NFC Tag
                    </button>
                </>
            )}

            {enrollStatus === 'scanning' && (
                 <div className="text-center">
                    <div className="w-24 h-24 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Scanning Tag...</p>
                    <p className="text-sm text-gray-500 mt-2">Tap your NFC card on the back of your phone</p>
                </div>
            )}

            {enrollStatus === 'success' && (
                <div className="text-center animate-in fade-in zoom-in duration-300">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <CheckCircle size={48} />
                    </div>
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.tagLinked}</h3>
                </div>
            )}
        </div>
    </div>
  );

  const renderHome = () => (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {lang === 'sw' ? 'Jambo' : 'Hi'}, {user.name} 👋
            </h1>
            <p className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t.ready}</p>
        </div>
        <div className="flex gap-2">
             <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full ${isDark ? 'bg-gray-800 text-yellow-500' : 'bg-white text-gray-600'}`}>
                {isDark ? <Sun size={20}/> : <Moon size={20}/>}
            </button>
            <button onClick={() => setLang(lang === 'en' ? 'sw' : 'en')} className={`p-2 rounded-full ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>
                <Languages size={20}/>
            </button>
        </div>
      </div>

      {/* Card/Balance */}
      <div className="bg-black text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full mix-blend-multiply filter blur-2xl opacity-20 -translate-y-10 translate-x-10"></div>
        
        <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{t.balance}</p>
                <h2 className="text-4xl font-bold">KES {Number(user.balance).toFixed(2)}</h2>
            </div>
            <div className="flex flex-col items-end">
                 <Wifi className={`rotate-90 mb-1 ${user.nfcTagId ? 'text-green-400' : 'text-gray-600'}`} />
                 <span className={`text-xs font-mono ${user.nfcTagId ? 'text-green-400' : 'text-gray-600'}`}>
                    {user.nfcTagId ? 'NFC Active' : 'No Tag'}
                 </span>
            </div>
        </div>

        <div className="flex justify-between items-end relative z-10">
            <div className="flex items-center gap-2">
                <div className="bg-white/10 backdrop-blur-md p-2 rounded-lg">
                    <CreditCard className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="text-sm text-gray-300 font-mono tracking-wider">
                    MA3 ••• {user.phoneNumber.slice(-4)}
                </div>
            </div>
            <button 
                onClick={() => setView(View.TOPUP)}
                className="bg-yellow-500 hover:bg-yellow-400 text-black px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1"
            >
                <Plus size={16} /> {t.topUp}
            </button>
        </div>
      </div>

      {/* Alert: Enroll Tag if missing */}
      {!user.nfcTagId && (
        <div 
            onClick={() => setView(View.ENROLL)}
            className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-red-500/20 transition-colors"
        >
            <div className="bg-red-500 p-2 rounded-full text-white">
                <AlertCircle size={20} />
            </div>
            <div className="flex-1">
                <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>Activate Travel Tag</h3>
                <p className="text-xs text-red-500">Link an NFC tag to start travelling.</p>
            </div>
            <ArrowRight className="text-red-500" size={18} />
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
            onClick={() => setView(View.SCAN)}
            className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center gap-2 transition-all group ${
                isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-100 hover:bg-gray-50'
            }`}
        >
            <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Scan className="w-6 h-6" />
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.tapToRide}</span>
        </button>
        <button 
            onClick={() => setView(View.SHARE)}
            className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center gap-2 transition-all group ${
                isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-100 hover:bg-gray-50'
            }`}
        >
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Share2 className="w-6 h-6" />
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.shareTokens}</span>
        </button>
        <button 
            onClick={() => setView(View.RATING)}
            className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center gap-2 transition-all group ${
                isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-100 hover:bg-gray-50'
            }`}
        >
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Star className="w-6 h-6" />
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.rateRide}</span>
        </button>
        <button 
            onClick={() => setView(View.HISTORY)}
            className={`p-4 rounded-2xl shadow-sm border flex flex-col items-center gap-2 transition-all group ${
                isDark ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' : 'bg-white border-gray-100 hover:bg-gray-50'
            }`}
        >
            <div className="w-12 h-12 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <History className="w-6 h-6" />
            </div>
            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.history}</span>
        </button>
      </div>

      {/* Spending Chart */}
      <div className={`p-6 rounded-2xl shadow-sm border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>{t.weeklySpending}</h3>
        <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingData}>
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fontSize: 12, fill: isDark ? '#9CA3AF' : '#6B7280'}} 
                        dy={10}
                    />
                    <Tooltip 
                        cursor={{fill: isDark ? '#374151' : '#F3F4F6'}} 
                        contentStyle={{
                            borderRadius: '12px', 
                            border: 'none', 
                            backgroundColor: isDark ? '#1F2937' : '#FFF',
                            color: isDark ? '#FFF' : '#000'
                        }}
                    />
                    <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
                        {spendingData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.amount > 100 ? '#EAB308' : (isDark ? '#4B5563' : '#000000')} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      <TransactionHistory history={history.slice(0, 3)} isDark={isDark} lang={lang} />
      
      <div className="pt-4">
          <button onClick={handleLogout} className="w-full py-3 text-red-500 font-medium flex justify-center items-center gap-2">
              <LogOut size={18} /> {t.logout}
          </button>
      </div>
    </div>
  );

  const renderTopUp = () => (
    <div className="space-y-6">
        <div className="flex items-center gap-4">
            <button onClick={() => setView(View.HOME)} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-black'}`}>
                <ArrowRight className="rotate-180" />
            </button>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.topUp}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
            {[50, 100, 200, 500, 1000, 2000].map(amt => (
                <button
                    key={amt}
                    onClick={() => {
                        setSelectedTopUpAmount(amt);
                        setView(View.PAYMENT);
                    }}
                    className={`p-6 rounded-2xl border-2 transition-all text-center group ${
                        isDark 
                        ? 'border-gray-700 bg-gray-800 hover:border-yellow-500' 
                        : 'border-gray-200 hover:border-yellow-500 hover:bg-yellow-50'
                    }`}
                >
                    <span className="block text-gray-500 text-sm mb-1">KES</span>
                    <span className={`block text-2xl font-bold group-hover:text-yellow-600 ${isDark ? 'text-white' : 'text-gray-900'}`}>{amt}</span>
                </button>
            ))}
        </div>

        <div className={`p-4 rounded-xl flex gap-3 text-sm ${isDark ? 'bg-blue-900/30 text-blue-200' : 'bg-blue-50 text-blue-800'}`}>
            <Wallet className="shrink-0 w-5 h-5" />
            <p>Use M-Pesa to add tokens. Valid for any route in Eldoret.</p>
        </div>
    </div>
  );

    const renderScan = () => {
        const selectedRoute = ROUTES.find(r => r.id === selectedRouteId) || null;
        const farePrice = selectedRoute ? resolveFarePrice(selectedRoute) : 0;

        return (
        <div className="space-y-6 h-full flex flex-col">
         <div className="flex items-center gap-4">
            <button onClick={() => {
                setView(View.HOME);
                setScanStatus('idle');
                setSelectedRouteId(null);
                setScanError('');
            }} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-black'}`}>
                <ArrowRight className="rotate-180" />
            </button>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.pay}</h2>
        </div>

        {/* Phase 1: Identify Matatu (Discovery) */}
        {scanStatus !== 'matched' && (
            <>
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                    <div className="w-full max-w-sm space-y-6">
                        <h3 className={`font-semibold text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.identifyRide}</h3>
                        
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t.numberplate}
                            </label>
                            <input
                                type="text"
                                placeholder="e.g., KBR 123A"
                                value={scannedId}
                                onChange={(e) => setScannedId(e.target.value.toUpperCase())}
                                className={`w-full px-4 py-3 rounded-xl border font-medium tracking-wider focus:ring-2 focus:ring-yellow-500 outline-none transition-all ${
                                    isDark
                                        ? 'bg-gray-800 border-gray-700 text-white'
                                        : 'bg-white border-gray-200 text-black'
                                }`}
                            />
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {t.selectRoute}
                            </label>
                            <select
                                value={selectedRouteId || ''}
                                onChange={(e) => e.target.value && setSelectedRouteId(e.target.value)}
                                className={`w-full px-4 py-3 rounded-xl border font-medium focus:ring-2 focus:ring-yellow-500 outline-none transition-all ${
                                    isDark
                                        ? 'bg-gray-800 border-gray-700 text-white'
                                        : 'bg-white border-gray-200 text-black'
                                }`}
                            >
                                <option value="">-- Select a Route --</option>
                                {ROUTES.map((route) => (
                                    <option key={route.id} value={route.id}>
                                        {route.name} (KES {route.standardPrice})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => {
                                if (scannedId && selectedRouteId) {
                                    setScanStatus('matched');
                                    setScanError('');
                                } else {
                                    setScanError('Please enter numberplate and select a route');
                                }
                            }}
                            disabled={!scannedId || !selectedRouteId}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl shadow-lg shadow-yellow-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue to Payment
                        </button>

                        {scanError && (
                            <div className={`text-xs rounded-xl p-3 border ${
                                isDark
                                    ? 'bg-red-900/30 border-red-700/40 text-red-200'
                                    : 'bg-red-50 border-red-200 text-red-600'
                            }`}>
                                {scanError}
                            </div>
                        )}
                    </div>
                </div>
            </>
        )}

        {/* Phase 2: Payment & Auth */}
        {scanStatus === 'matched' && selectedRouteId && (
             <div className="w-full flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-8">
                <div className={`p-6 rounded-2xl mb-6 ${isDark ? 'bg-gray-800' : 'bg-white border'}`}>
                     <div className="flex items-center gap-4 mb-4">
                         <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                            <Bus size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Route Selected</p>
                            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {selectedRoute?.name}
                            </h3>
                        </div>
                     </div>
                     
                     <div className="flex justify-between items-center p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                         <span className={`font-medium ${isDark ? 'text-yellow-500' : 'text-yellow-700'}`}>Standard Fare</span>
                         <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>KES {farePrice}</span>
                     </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                    <div className="w-full max-w-sm space-y-4">
                        <button
                            onClick={handleFarePay}
                            disabled={isFarePaying}
                            className="w-full bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isFarePaying ? 'Processing...' : `Pay KES ${farePrice}`}
                        </button>

                        {showTopUp && (
                            <div className={`space-y-3 rounded-2xl border p-4 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {t.phoneNumber}
                                </label>
                                <input
                                    type="tel"
                                    value={farePhone}
                                    onChange={(e) => setFarePhone(e.target.value)}
                                    placeholder="07XX XXX XXX"
                                    className={`w-full px-4 py-3 rounded-xl border font-medium focus:ring-2 focus:ring-yellow-500 outline-none transition-all ${
                                        isDark
                                            ? 'bg-gray-800 border-gray-700 text-white'
                                            : 'bg-white border-gray-200 text-black'
                                    }`}
                                />
                                <button
                                    onClick={handleSendStkPush}
                                    disabled={isSendingStk}
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl shadow-lg shadow-yellow-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {isSendingStk ? 'Sending STK Push...' : `Send STK Push for KES ${topUpAmount || farePrice}`}
                                </button>
                            </div>
                        )}

                        {fareError && (
                            <div className={`text-xs rounded-xl p-3 border ${
                                isDark
                                    ? 'bg-red-900/30 border-red-700/40 text-red-200'
                                    : 'bg-red-50 border-red-200 text-red-600'
                            }`}>
                                {fareError}
                            </div>
                        )}

                        {stkMessage && (
                            <div className={`text-xs rounded-xl p-3 border ${
                                isDark
                                    ? 'bg-green-900/30 border-green-700/40 text-green-200'
                                    : 'bg-green-50 border-green-200 text-green-700'
                            }`}>
                                {stkMessage}
                            </div>
                        )}
                    </div>
                </div>
             </div>
        )}
    </div>
  );
  };

  const renderHistory = () => (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
            <button onClick={() => setView(View.HOME)} className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-gray-800 text-white' : 'hover:bg-gray-200 text-black'}`}>
                <ArrowRight className="rotate-180" />
            </button>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{t.history}</h2>
        </div>
        <TransactionHistory history={history} isDark={isDark} lang={lang} />
      </div>
  );

  return (
    <div className={`min-h-screen max-w-md mx-auto shadow-2xl relative overflow-hidden flex flex-col transition-colors duration-300 ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-6">
        {view === View.HOME && renderHome()}
        {view === View.TOPUP && renderTopUp()}
        {view === View.PAYMENT && (
          <PaymentPage 
            amount={selectedTopUpAmount} 
            nfcTagId={user?.nfcTagId || null}
            userPhone={user?.phoneNumber || ''}
            onBack={() => setView(View.TOPUP)}
            onSuccess={handleTopUpSuccess}
            isDark={isDark}
            lang={lang}
          />
        )}
        {view === View.SCAN && renderScan()}
        {view === View.HISTORY && renderHistory()}
        {view === View.ENROLL && renderEnroll()}
        {view === View.RATING && <RatingPage onBack={() => setView(View.HOME)} isDark={isDark} lang={lang} />}
        {view === View.SHARE && (
            <ShareTokensPage 
                onBack={() => setView(View.HOME)} 
                onTransfer={handleTransferSuccess} 
                balance={user?.balance || 0}
                isDark={isDark}
                lang={lang}
            />
        )}
      </main>

      {/* Sticky Bottom Nav */}
      {view !== View.PAYMENT && view !== View.ENROLL && view !== View.RATING && view !== View.SHARE && (
        <nav className={`border-t px-6 py-4 flex justify-between items-center z-30 sticky bottom-0 ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'}`}>
            <button 
                onClick={() => setView(View.HOME)}
                className={`flex flex-col items-center gap-1 ${view === View.HOME ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-500'}`}
            >
                <MapPin size={24} />
                <span className="text-[10px] font-bold">{t.home}</span>
            </button>
            <button 
                onClick={() => setView(View.SCAN)}
                className={`flex flex-col items-center gap-1 ${view === View.SCAN ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-500'}`}
            >
                <div className={`p-3 rounded-full -mt-8 shadow-lg border-4 transition-all ${isDark ? 'bg-yellow-500 text-black border-gray-900' : 'bg-black text-white border-gray-50'} ${view === View.SCAN ? 'scale-110' : ''}`}>
                    <Scan size={24} />
                </div>
                <span className="text-[10px] font-bold">{t.pay}</span>
            </button>
            <button 
                onClick={() => setView(View.HISTORY)}
                className={`flex flex-col items-center gap-1 ${view === View.HISTORY ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-500'}`}
            >
                <History size={24} />
                <span className="text-[10px] font-bold">{t.history}</span>
            </button>
        </nav>
      )}

      <Assistant isDark={isDark} />
    </div>
  );
}