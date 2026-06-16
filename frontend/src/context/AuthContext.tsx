import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../utils/api';

interface User {
  id: string;
  name: string;
  email: string;
  subscriptionStatus: 'free' | 'premium';
  avatar?: string;
  tutorPersonality?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  forgotPassword: (email: string, newPassword: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('study_assistant_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on app initialization
  const refreshUser = async () => {
    const activeToken = localStorage.getItem('study_assistant_token');
    if (!activeToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser({
        id: response.data.user.id || response.data.user._id,
        name: response.data.user.name,
        email: response.data.user.email,
        subscriptionStatus: response.data.user.subscriptionStatus,
        avatar: response.data.user.avatar,
        tutorPersonality: response.data.user.tutorPersonality,
      });
    } catch (error) {
      console.error('Session validation failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: receivedToken, user: receivedUser } = response.data;
      
      localStorage.setItem('study_assistant_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error: any) {
      setIsLoading(false);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/register', { name, email, password });
      const { token: receivedToken, user: receivedUser } = response.data;

      localStorage.setItem('study_assistant_token', receivedToken);
      setToken(receivedToken);
      setUser(receivedUser);
    } catch (error: any) {
      setIsLoading(false);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  };

  const forgotPassword = async (email: string, newPassword: string) => {
    try {
      await api.post('/auth/forgot-password', { email, newPassword });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Password reset request failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('study_assistant_token');
    setToken(null);
    setUser(null);
    setIsLoading(false);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!user,
    isLoading,
    login,
    register,
    forgotPassword,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
