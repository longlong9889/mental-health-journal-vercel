import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Feather, Mail, Lock, User, ArrowRight, Loader } from 'lucide-react';

function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        displayName: ''
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isLogin) {
                // Login
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password
                });

                if (signInError) throw signInError;

            } else {
                // Sign up
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            display_name: formData.displayName
                        }
                    }
                });

                if (signUpError) throw signUpError;

                // Check if email confirmation is required
                if (data?.user?.identities?.length === 0) {
                    setError('An account with this email already exists.');
                } else if (data?.user && !data?.session) {
                    setMessage('Check your email for the confirmation link!');
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <style>
                {`
                    @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600&display=swap');
                    
                    * {
                        font-family: 'Source Sans 3', sans-serif;
                    }
                    
                    .font-serif {
                        font-family: 'Libre Baskerville', Georgia, serif;
                    }
                    
                    .auth-bg {
                        background-color: #faf9f7;
                        background-image: linear-gradient(to bottom, #faf9f7 0%, #f5f3f0 100%);
                    }
                    
                    .input-focus:focus {
                        outline: none;
                        border-color: #78716c;
                        background-color: white;
                    }
                    
                    .fade-in {
                        animation: fadeIn 0.4s ease;
                    }
                    
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(8px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}
            </style>

            <div className="min-h-screen auth-bg flex items-center justify-center p-4">
                <div className="w-full max-w-md">

                    {/* Header */}
                    <div className="text-center mb-8 fade-in">
                        <div className="inline-flex items-center gap-2 text-amber-700 mb-4">
                            <Feather size={24} />
                        </div>
                        <h1 className="font-serif text-3xl text-stone-800 mb-2">
                            {isLogin ? 'Welcome back' : 'Start your journey'}
                        </h1>
                        <p className="text-stone-500">
                            {isLogin
                                ? 'Sign in to continue your journal'
                                : 'Create an account to begin journaling'
                            }
                        </p>
                    </div>

                    {/* Auth Card */}
                    <div className="bg-white rounded-sm shadow-lg shadow-stone-200/50 border border-stone-200 p-8 fade-in">

                        {/* Error Message */}
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Success Message */}
                        {message && (
                            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-400 text-green-700 text-sm">
                                {message}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-5">

                            {/* Display Name (Sign up only) */}
                            {!isLogin && (
                                <div>
                                    <label className="block text-sm text-stone-600 mb-2">
                                        Display Name
                                    </label>
                                    <div className="relative">
                                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input
                                            type="text"
                                            name="displayName"
                                            value={formData.displayName}
                                            onChange={handleChange}
                                            placeholder="How should we call you?"
                                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-sm text-stone-700 input-focus transition-colors"
                                            required={!isLogin}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            <div>
                                <label className="block text-sm text-stone-600 mb-2">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="you@example.com"
                                        className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-sm text-stone-700 input-focus transition-colors"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm text-stone-600 mb-2">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder={isLogin ? "Your password" : "At least 6 characters"}
                                        className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-sm text-stone-700 input-focus transition-colors"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-stone-800 text-white rounded-sm hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                            >
                                {loading ? (
                                    <>
                                        <Loader size={18} className="animate-spin" />
                                        <span>Please wait...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Toggle Login/Signup */}
                        <div className="mt-6 text-center">
                            <p className="text-stone-500">
                                {isLogin ? "Don't have an account?" : "Already have an account?"}
                                <button
                                    onClick={() => {
                                        setIsLogin(!isLogin);
                                        setError(null);
                                        setMessage(null);
                                    }}
                                    className="ml-2 text-stone-800 font-medium hover:underline"
                                >
                                    {isLogin ? 'Sign up' : 'Sign in'}
                                </button>
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <p className="text-center text-xs text-stone-400 mt-6">
                        Your journal entries are private and secure.
                    </p>
                </div>
            </div>
        </>
    );
}

export default Auth;