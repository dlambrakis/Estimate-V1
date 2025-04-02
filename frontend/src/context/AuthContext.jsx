import React, { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode'; // Correct import
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        // Optional: Check token expiration
        const currentTime = Date.now() / 1000;
        if (decodedToken.exp > currentTime) {
          setUser({
            id: decodedToken.sub, // User ID from Supabase Auth
            email: decodedToken.email,
            role: decodedToken.user_metadata?.role || 'unknown' // Get role from user_metadata
          });
          // Set token for future axios requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
          // Token expired
          logout();
        }
      } catch (error) {
        console.error("Error decoding token:", error);
        logout(); // Clear invalid token
      }
    }
    setLoading(false); // Set loading to false after checking token
  }, []);

  const login = (token) => {
    localStorage.setItem('token', token);
    try {
      const decodedToken = jwtDecode(token);
      setUser({
        id: decodedToken.sub,
        email: decodedToken.email,
        role: decodedToken.user_metadata?.role || 'unknown'
      });
      // Set token for future axios requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error("Error decoding token on login:", error);
      logout(); // Clear invalid token if decoding fails
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    // Remove token from axios defaults
    delete axios.defaults.headers.common['Authorization'];
    // Optionally redirect to login page or handle state update
    // window.location.href = '/login'; // Consider using useNavigate hook instead if inside Router context
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
