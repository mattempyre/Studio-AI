import React, { useState } from 'react';
import * as Icons from './Icons';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1000));

    // Mock successful login
    const mockUser: User = {
      id: 'u1',
      name: email.split('@')[0] || 'Creator',
      email: email,
      avatar: 'https://picsum.photos/seed/user/200/200'
    };

    setIsLoading(false);
    onLogin(mockUser);
  };

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center font-display p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="bg-panel-bg border border-border-color p-8 rounded-2xl w-full max-w-md shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary size-12 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
            <Icons.Film className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">VideoGen AI Studio</h1>
          <p className="text-text-muted text-sm mt-1">Create professional videos at the speed of thought.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-2">Email Address</label>
            <div className="relative">
              <Icons.User className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0d0b1a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-primary focus:outline-none transition-colors"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-2">Password</label>
            <div className="relative">
              <Icons.Settings className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0d0b1a] border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:border-primary focus:outline-none transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-2"
          >
            {isLoading && <Icons.RefreshCw className="animate-spin" size={16} />}
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5 text-center">
          <p className="text-text-muted text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="text-white font-bold hover:text-primary transition-colors"
            >
              {isLogin ? 'Sign Up' : 'Log In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;