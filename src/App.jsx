import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';
import { BarChart3, BookOpen, Brain, Loader, Feather, Sun, Moon, LogOut, User } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function App() {
    // Auth state
    const [session, setSession] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [userProfile, setUserProfile] = useState(null);

    // App state
    const [activeTab, setActiveTab] = useState('checkin');
    const [currentMood, setCurrentMood] = useState(null);
    const [selectedActivities, setSelectedActivities] = useState([]);
    const [journalText, setJournalText] = useState('');
    const [entries, setEntries] = useState([]);
    const [aiResponse, setAiResponse] = useState('');
    const [loadingAI, setLoadingAI] = useState(false);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [savingEntry, setSavingEntry] = useState(false);

    // Mood options
    const moods = [
        { value: 1, label: 'Terrible', emoji: '😢', color: '#e57373' },
        { value: 2, label: 'Bad', emoji: '😔', color: '#ffb74d' },
        { value: 3, label: 'Okay', emoji: '😐', color: '#dce775' },
        { value: 4, label: 'Good', emoji: '🙂', color: '#81c784' },
        { value: 5, label: 'Amazing', emoji: '😄', color: '#64b5f6' }
    ];

    // Activity options
    const activities = [
        { id: 'sleep', label: 'Good Sleep', icon: '🌙' },
        { id: 'exercise', label: 'Exercise', icon: '🚶' },
        { id: 'social', label: 'Socialized', icon: '💬' },
        { id: 'work', label: 'Productive', icon: '✏️' },
        { id: 'relax', label: 'Relaxed', icon: '🍵' },
        { id: 'creative', label: 'Creative', icon: '🎨' }
    ];

    // Daily prompts
    const dailyPrompts = [
        "What's one thing you're grateful for today?",
        "What made you smile today?",
        "How are you really feeling right now?",
        "What challenge did you overcome today?",
        "What would make tomorrow better?",
        "What's something you learned about yourself today?",
        "Who or what supported you today?",
        "What emotion are you sitting with right now?"
    ];

    const [currentPrompt] = useState(
        dailyPrompts[Math.floor(Math.random() * dailyPrompts.length)]
    );

    // Get current time greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return { text: 'Good morning', icon: Sun };
        if (hour < 18) return { text: 'Good afternoon', icon: Sun };
        return { text: 'Good evening', icon: Moon };
    };

    const greeting = getGreeting();

    // Fetch user profile
    const fetchUserProfile = useCallback(async () => {
        if (!session?.user) return;
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
            }

            setUserProfile(data || {
                display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0]
            });
        } catch (error) {
            console.error('Error:', error);
        }
    }, [session]);

    // Fetch journal entries from Supabase
    const fetchEntries = useCallback(async () => {
        if (!session?.user) return;
        setLoadingEntries(true);
        try {
            const { data, error } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to match our frontend format
            const transformedEntries = data.map(entry => ({
                id: entry.id,
                timestamp: entry.created_at,
                mood: entry.mood,
                activities: entry.activities || [],
                journalText: entry.journal_text || '',
                prompt: entry.prompt || '',
                aiInsights: entry.ai_insights || null
            }));

            setEntries(transformedEntries);
        } catch (error) {
            console.error('Error fetching entries:', error);
        } finally {
            setLoadingEntries(false);
        }
    }, [session]);

    // Check for existing session on mount
    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            setSession(currentSession);
            setLoadingAuth(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
            setSession(currentSession);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch user profile and entries when session changes
    useEffect(() => {
        if (session?.user) {
            fetchUserProfile();
            fetchEntries();
        } else {
            setEntries([]);
            setUserProfile(null);
        }
    }, [session, fetchUserProfile, fetchEntries]);

    // Toggle activity selection
    const toggleActivity = (activityId) => {
        if (selectedActivities.includes(activityId)) {
            setSelectedActivities(selectedActivities.filter(a => a !== activityId));
        } else {
            setSelectedActivities([...selectedActivities, activityId]);
        }
    };

    // Get AI Insights
    const getAIInsights = async () => {
        if (!journalText.trim()) {
            alert('Please write a journal entry to get AI insights!');
            return;
        }

        setLoadingAI(true);
        setAiResponse('');

        try {
            const moodLabel = moods.find(m => m.value === currentMood)?.label || 'Not specified';
            const activitiesText = selectedActivities
                .map(id => activities.find(a => a.id === id)?.label)
                .join(', ') || 'None';

            const recentEntries = entries.slice(0, 3).map(e => ({
                mood: moods.find(m => m.value === e.mood)?.label,
                activities: e.activities.map(id => activities.find(a => a.id === id)?.label).join(', '),
                text: e.journalText.substring(0, 100)
            }));

            const response = await fetch(`${process.env.REACT_APP_API_URL}/api/ai-insights`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mood: moodLabel,
                    activities: activitiesText,
                    journalText: journalText,
                    recentEntries: recentEntries
                })
            });

            if (!response.ok) throw new Error(`Backend error: ${response.status}`);

            const data = await response.json();
            if (data.insight) {
                setAiResponse(data.insight);
            } else {
                setAiResponse('Thank you for sharing. Remember, it\'s okay to have ups and downs.');
            }
        } catch (error) {
            console.error('Error:', error);
            setAiResponse('I\'m having trouble connecting right now, but what you\'re feeling is valid. Keep journaling.');
        } finally {
            setLoadingAI(false);
        }
    };

    // Save entry to Supabase
    const saveEntry = async () => {
        if (!currentMood) {
            alert('Please select a mood first!');
            return;
        }

        setSavingEntry(true);

        // Get AI insights if journal text exists but no response yet
        let finalAiResponse = aiResponse;
        if (journalText.trim() && !aiResponse) {
            setLoadingAI(true);
            try {
                const moodLabel = moods.find(m => m.value === currentMood)?.label || 'Not specified';
                const activitiesText = selectedActivities
                    .map(id => activities.find(a => a.id === id)?.label)
                    .join(', ') || 'None';

                const response = await fetch(`${process.env.REACT_APP_API_URL}/api/ai-insights`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        mood: moodLabel,
                        activities: activitiesText,
                        journalText: journalText,
                        recentEntries: []
                    })
                });

                const data = await response.json();
                if (data.insight) finalAiResponse = data.insight;
            } catch (error) {
                console.error('AI Error:', error);
            } finally {
                setLoadingAI(false);
            }
        }

        try {
            const { data, error } = await supabase
                .from('journal_entries')
                .insert({
                    user_id: session.user.id,
                    mood: currentMood,
                    activities: selectedActivities,
                    journal_text: journalText,
                    prompt: currentPrompt,
                    ai_insights: finalAiResponse || null
                })
                .select()
                .single();

            if (error) throw error;

            // Add to local state
            const newEntry = {
                id: data.id,
                timestamp: data.created_at,
                mood: data.mood,
                activities: data.activities || [],
                journalText: data.journal_text || '',
                prompt: data.prompt || '',
                aiInsights: data.ai_insights || null
            };

            setEntries([newEntry, ...entries]);

            // Reset form
            setCurrentMood(null);
            setSelectedActivities([]);
            setJournalText('');
            setAiResponse('');
            setActiveTab('journal');

        } catch (error) {
            console.error('Error saving entry:', error);
            alert('Failed to save entry. Please try again.');
        } finally {
            setSavingEntry(false);
        }
    };

    // Delete entry
    const deleteEntry = async (entryId) => {
        const userConfirmed = window.confirm('Are you sure you want to delete this entry?');
        if (!userConfirmed) return;

        try {
            const { error } = await supabase
                .from('journal_entries')
                .delete()
                .eq('id', entryId)
                .eq('user_id', session.user.id);

            if (error) throw error;

            setEntries(entries.filter(e => e.id !== entryId));
        } catch (error) {
            console.error('Error deleting entry:', error);
            alert('Failed to delete entry.');
        }
    };

    // Sign out
    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    // Analytics functions
    const getChartData = () => {
        return entries.slice(0, 14).reverse().map(e => ({
            date: new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            mood: e.mood
        }));
    };

    const getAverageMood = () => {
        if (entries.length === 0) return 0;
        return (entries.reduce((total, e) => total + e.mood, 0) / entries.length).toFixed(1);
    };

    const getGoodDays = () => entries.filter(e => e.mood >= 4).length;

    const getActivityMoodCorrelation = () => {
        const activityMoods = {};
        activities.forEach(activity => {
            const entriesWithActivity = entries.filter(e => e.activities.includes(activity.id));
            if (entriesWithActivity.length > 0) {
                const avgMood = entriesWithActivity.reduce((sum, e) => sum + e.mood, 0) / entriesWithActivity.length;
                activityMoods[activity.label] = {
                    avgMood: avgMood.toFixed(1),
                    count: entriesWithActivity.length,
                    icon: activity.icon
                };
            }
        });
        return Object.entries(activityMoods).sort((a, b) => b[1].avgMood - a[1].avgMood);
    };

    const formatDate = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatTime = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    // Show loading while checking auth
    if (loadingAuth) {
        return (
            <div className="min-h-screen bg-stone-50 flex items-center justify-center">
                <Loader className="animate-spin text-stone-400" size={32} />
            </div>
        );
    }

    // Show auth screen if not logged in
    if (!session) {
        return <Auth />;
    }

    // Main app
    return (
        <>
            {/* Styles */}
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600&display=swap');
                    
                    * {
                        font-family: 'Source Sans 3', sans-serif;
                    }
                    
                    .font-serif {
                        font-family: 'Libre Baskerville', Georgia, serif;
                    }
                    
                    .paper-texture {
                        background-color: #faf9f7;
                        background-image: linear-gradient(to bottom, #faf9f7 0%, #f5f3f0 100%);
                    }
                    
                    .journal-lines {
                        background-image: repeating-linear-gradient(
                            transparent,
                            transparent 31px,
                            #e8e4dc 31px,
                            #e8e4dc 32px
                        );
                        line-height: 32px;
                    }
                    
                    .tab-active {
                        position: relative;
                    }
                    
                    .tab-active::after {
                        content: '';
                        position: absolute;
                        bottom: -1px;
                        left: 0;
                        right: 0;
                        height: 2px;
                        background-color: #5c4b3a;
                    }
                    
                    .mood-btn {
                        transition: all 0.2s ease;
                    }
                    
                    .mood-btn:hover {
                        transform: translateY(-2px);
                    }
                    
                    .mood-btn.selected {
                        transform: scale(1.05);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    }
                    
                    .entry-card {
                        transition: all 0.2s ease;
                    }
                    
                    .entry-card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 24px rgba(0,0,0,0.08);
                    }
                    
                    .fade-in {
                        animation: fadeIn 0.4s ease;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    
                    textarea::placeholder {
                        color: #a89f91;
                        font-style: italic;
                    }
                    
                    ::-webkit-scrollbar {
                        width: 8px;
                    }
                    
                    ::-webkit-scrollbar-track {
                        background: #f5f3f0;
                    }
                    
                    ::-webkit-scrollbar-thumb {
                        background: #d4cfc6;
                        border-radius: 4px;
                    }
                    
                    ::-webkit-scrollbar-thumb:hover {
                        background: #b8b1a5;
                    }
                `}
            </style>

            <div className="min-h-screen paper-texture">
                {/* Top accent */}
                <div className="h-1 bg-gradient-to-r from-amber-200 via-orange-200 to-amber-200"></div>

                <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">

                    {/* Header */}
                    <header className="mb-10">
                        <div className="flex items-center justify-between mb-4">
                            <div className="inline-flex items-center gap-2 text-amber-700">
                                <Feather size={20} />
                                <span className="text-sm tracking-widest uppercase">Personal Journal</span>
                            </div>

                            {/* User menu */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 text-stone-600">
                                    <User size={16} />
                                    <span className="text-sm">
                                        {userProfile?.display_name || session.user.email?.split('@')[0]}
                                    </span>
                                </div>
                                <button
                                    onClick={handleSignOut}
                                    className="flex items-center gap-1 text-sm text-stone-400 hover:text-stone-600 transition-colors"
                                >
                                    <LogOut size={16} />
                                    <span>Sign out</span>
                                </button>
                            </div>
                        </div>

                        <div className="text-center">
                            <h1 className="font-serif text-3xl md:text-4xl text-stone-800 mb-2">
                                {greeting.text}, {userProfile?.display_name?.split(' ')[0] || 'there'}
                            </h1>
                            <p className="text-stone-500">
                                {new Date().toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                        </div>
                    </header>

                    {/* Main Card */}
                    <main className="bg-white rounded-sm shadow-lg shadow-stone-200/50 border border-stone-200">

                        {/* Navigation */}
                        <nav className="flex border-b border-stone-200">
                            {[
                                { id: 'checkin', label: 'Check-In', icon: Feather },
                                { id: 'journal', label: 'Entries', icon: BookOpen },
                                { id: 'analytics', label: 'Insights', icon: BarChart3 }
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm tracking-wide transition-colors ${
                                            isActive
                                                ? 'tab-active text-stone-800 font-medium'
                                                : 'text-stone-400 hover:text-stone-600'
                                        }`}
                                    >
                                        <Icon size={18} />
                                        <span>{tab.label}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        {/* Content */}
                        <div className="p-6 md:p-10">

                            {/* CHECK-IN TAB */}
                            {activeTab === 'checkin' && (
                                <div className="space-y-10 fade-in">

                                    {/* Daily Prompt */}
                                    <div className="text-center pb-8 border-b border-stone-100">
                                        <p className="font-serif text-xl md:text-2xl text-stone-700 italic leading-relaxed">
                                            "{currentPrompt}"
                                        </p>
                                    </div>

                                    {/* Mood Selection */}
                                    <div>
                                        <h2 className="text-sm tracking-widest uppercase text-stone-400 mb-6 text-center">
                                            How are you feeling?
                                        </h2>
                                        <div className="flex justify-center gap-3 md:gap-4">
                                            {moods.map(mood => (
                                                <button
                                                    key={mood.value}
                                                    onClick={() => setCurrentMood(mood.value)}
                                                    className={`mood-btn flex flex-col items-center p-3 md:p-4 rounded-lg border-2 transition-all ${
                                                        currentMood === mood.value
                                                            ? 'selected border-stone-400 bg-stone-50'
                                                            : 'border-transparent hover:bg-stone-50'
                                                    }`}
                                                >
                                                    <span className="text-3xl md:text-4xl mb-2">{mood.emoji}</span>
                                                    <span className="text-xs text-stone-500">{mood.label}</span>
                                                    {currentMood === mood.value && (
                                                        <div
                                                            className="w-2 h-2 rounded-full mt-2"
                                                            style={{ backgroundColor: mood.color }}
                                                        />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Activities */}
                                    <div>
                                        <h2 className="text-sm tracking-widest uppercase text-stone-400 mb-6 text-center">
                                            What did you do today?
                                        </h2>
                                        <div className="flex flex-wrap justify-center gap-2">
                                            {activities.map(activity => {
                                                const isSelected = selectedActivities.includes(activity.id);
                                                return (
                                                    <button
                                                        key={activity.id}
                                                        onClick={() => toggleActivity(activity.id)}
                                                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                                                            isSelected
                                                                ? 'border-stone-400 bg-stone-100 text-stone-700'
                                                                : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50'
                                                        }`}
                                                    >
                                                        <span>{activity.icon}</span>
                                                        <span className="text-sm">{activity.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Journal Entry */}
                                    <div>
                                        <h2 className="text-sm tracking-widest uppercase text-stone-400 mb-4 text-center">
                                            Write your thoughts
                                        </h2>
                                        <textarea
                                            value={journalText}
                                            onChange={(e) => setJournalText(e.target.value)}
                                            placeholder="What's on your mind today? Write freely..."
                                            className="w-full h-48 p-6 bg-stone-50 border border-stone-200 rounded-sm text-stone-700 leading-relaxed focus:outline-none focus:border-stone-400 focus:bg-white transition-colors resize-none journal-lines"
                                        />
                                        <p className="text-xs text-stone-400 mt-2 text-right">
                                            {journalText.length} characters
                                        </p>
                                    </div>

                                    {/* Get Insights Button */}
                                    {journalText.trim() && !aiResponse && (
                                        <div className="text-center">
                                            <button
                                                onClick={getAIInsights}
                                                disabled={loadingAI}
                                                className="inline-flex items-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-sm hover:bg-stone-700 disabled:opacity-50 transition-colors"
                                            >
                                                {loadingAI ? (
                                                    <>
                                                        <Loader className="animate-spin" size={18} />
                                                        <span>Reflecting...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Brain size={18} />
                                                        <span>Get Insights</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* AI Response */}
                                    {aiResponse && (
                                        <div className="fade-in bg-amber-50/50 border-l-4 border-amber-300 p-6 rounded-r-sm">
                                            <div className="flex items-start gap-4">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                                    <Brain size={16} className="text-amber-700" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-stone-700 mb-2">Reflection</h3>
                                                    <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">
                                                        {aiResponse}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Save Button */}
                                    <div className="pt-6 border-t border-stone-100">
                                        <button
                                            onClick={saveEntry}
                                            disabled={!currentMood || loadingAI || savingEntry}
                                            className="w-full py-4 bg-stone-800 text-white rounded-sm hover:bg-stone-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all font-medium tracking-wide flex items-center justify-center gap-2"
                                        >
                                            {savingEntry ? (
                                                <>
                                                    <Loader size={18} className="animate-spin" />
                                                    <span>Saving...</span>
                                                </>
                                            ) : loadingAI ? (
                                                'Getting insights...'
                                            ) : (
                                                'Save Entry'
                                            )}
                                        </button>
                                        <p className="text-xs text-stone-400 text-center mt-3">
                                            Your entries are stored securely in the cloud
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* JOURNAL TAB */}
                            {activeTab === 'journal' && (
                                <div className="fade-in">
                                    {loadingEntries ? (
                                        <div className="text-center py-16">
                                            <Loader className="animate-spin mx-auto mb-4 text-stone-400" size={32} />
                                            <p className="text-stone-500">Loading your entries...</p>
                                        </div>
                                    ) : entries.length === 0 ? (
                                        <div className="text-center py-16">
                                            <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
                                            <p className="text-stone-500 mb-1">No entries yet</p>
                                            <p className="text-sm text-stone-400">
                                                Start your first check-in to begin your journal
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                                                <h2 className="font-serif text-xl text-stone-800">
                                                    Your Entries
                                                </h2>
                                                <span className="text-sm text-stone-400">
                                                    {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                                                </span>
                                            </div>

                                            {entries.map((entry, index) => {
                                                const mood = moods.find(m => m.value === entry.mood);
                                                const showDate = index === 0 ||
                                                    formatDate(entry.timestamp) !== formatDate(entries[index - 1].timestamp);

                                                return (
                                                    <div key={entry.id}>
                                                        {showDate && (
                                                            <p className="text-xs tracking-widest uppercase text-stone-400 mb-3 mt-6 first:mt-0">
                                                                {formatDate(entry.timestamp)}
                                                            </p>
                                                        )}
                                                        <div className="entry-card bg-stone-50 rounded-sm p-5 border border-stone-100 relative group">
                                                            {/* Delete button */}
                                                            <button
                                                                onClick={() => deleteEntry(entry.id)}
                                                                className="absolute top-3 right-3 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                                                            >
                                                                Delete
                                                            </button>

                                                            {/* Header */}
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-2xl">{mood?.emoji}</span>
                                                                    <div>
                                                                        <span className="font-medium text-stone-700">{mood?.label}</span>
                                                                        <span className="text-stone-400 text-sm ml-2">
                                                                            {formatTime(entry.timestamp)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div
                                                                    className="w-3 h-3 rounded-full"
                                                                    style={{ backgroundColor: mood?.color }}
                                                                />
                                                            </div>

                                                            {/* Activities */}
                                                            {entry.activities.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mb-4">
                                                                    {entry.activities.map(actId => {
                                                                        const activity = activities.find(a => a.id === actId);
                                                                        return activity ? (
                                                                            <span
                                                                                key={actId}
                                                                                className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-stone-200 rounded text-xs text-stone-600"
                                                                            >
                                                                                <span>{activity.icon}</span>
                                                                                {activity.label}
                                                                            </span>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                            )}

                                                            {/* Journal Text */}
                                                            {entry.journalText && (
                                                                <p className="text-stone-600 leading-relaxed mb-4 font-serif italic">
                                                                    "{entry.journalText}"
                                                                </p>
                                                            )}

                                                            {/* AI Insights */}
                                                            {entry.aiInsights && (
                                                                <div className="bg-white border-l-2 border-amber-300 p-4 mt-4">
                                                                    <div className="flex items-start gap-3">
                                                                        <Brain size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                                                        <p className="text-sm text-stone-600 leading-relaxed">
                                                                            {entry.aiInsights}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ANALYTICS TAB */}
                            {activeTab === 'analytics' && (
                                <div className="fade-in">
                                    {entries.length === 0 ? (
                                        <div className="text-center py-16">
                                            <BarChart3 size={48} className="mx-auto mb-4 text-stone-300" />
                                            <p className="text-stone-500">Add entries to see your patterns</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-10">

                                            {/* Stats */}
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="text-center p-6 bg-stone-50 rounded-sm">
                                                    <p className="font-serif text-3xl text-stone-800 mb-1">
                                                        {getAverageMood()}
                                                    </p>
                                                    <p className="text-xs tracking-widest uppercase text-stone-400">
                                                        Avg Mood
                                                    </p>
                                                </div>
                                                <div className="text-center p-6 bg-stone-50 rounded-sm">
                                                    <p className="font-serif text-3xl text-stone-800 mb-1">
                                                        {entries.length}
                                                    </p>
                                                    <p className="text-xs tracking-widest uppercase text-stone-400">
                                                        Entries
                                                    </p>
                                                </div>
                                                <div className="text-center p-6 bg-stone-50 rounded-sm">
                                                    <p className="font-serif text-3xl text-stone-800 mb-1">
                                                        {getGoodDays()}
                                                    </p>
                                                    <p className="text-xs tracking-widest uppercase text-stone-400">
                                                        Good Days
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Chart */}
                                            {entries.length > 1 && (
                                                <div>
                                                    <h3 className="text-sm tracking-widest uppercase text-stone-400 mb-6">
                                                        Mood Over Time
                                                    </h3>
                                                    <div className="bg-stone-50 p-6 rounded-sm">
                                                        <ResponsiveContainer width="100%" height={200}>
                                                            <LineChart data={getChartData()}>
                                                                <XAxis
                                                                    dataKey="date"
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    tick={{ fill: '#a1998c', fontSize: 12 }}
                                                                />
                                                                <YAxis
                                                                    domain={[1, 5]}
                                                                    axisLine={false}
                                                                    tickLine={false}
                                                                    tick={{ fill: '#a1998c', fontSize: 12 }}
                                                                    ticks={[1, 2, 3, 4, 5]}
                                                                />
                                                                <Tooltip
                                                                    contentStyle={{
                                                                        backgroundColor: '#faf8f5',
                                                                        border: '1px solid #e8e4dc',
                                                                        borderRadius: '2px',
                                                                        boxShadow: 'none'
                                                                    }}
                                                                />
                                                                <Line
                                                                    type="monotone"
                                                                    dataKey="mood"
                                                                    stroke="#78716c"
                                                                    strokeWidth={2}
                                                                    dot={{ fill: '#78716c', r: 4 }}
                                                                    activeDot={{ fill: '#57534e', r: 6 }}
                                                                />
                                                            </LineChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Activity Correlation */}
                                            {getActivityMoodCorrelation().length > 0 && (
                                                <div>
                                                    <h3 className="text-sm tracking-widest uppercase text-stone-400 mb-6">
                                                        Activities & Mood
                                                    </h3>
                                                    <div className="space-y-3">
                                                        {getActivityMoodCorrelation().map(([activity, data]) => (
                                                            <div key={activity} className="flex items-center gap-4">
                                                                <span className="text-xl w-8">{data.icon}</span>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="text-sm text-stone-600">{activity}</span>
                                                                        <span className="text-xs text-stone-400">
                                                                            {data.count}× · avg {data.avgMood}
                                                                        </span>
                                                                    </div>
                                                                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-stone-400 rounded-full transition-all"
                                                                            style={{ width: `${(data.avgMood / 5) * 100}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </main>

                    {/* Footer */}
                    <footer className="mt-8 text-center">
                        <p className="text-xs text-stone-400">
                            Your entries are private and stored securely.
                            <br />
                            This is not a substitute for professional mental health support.
                        </p>
                    </footer>

                </div>
            </div>
        </>
    );
}

export default App;