import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../../config/supabaseClientFrontend'; // Adjusted path
import { jwtDecode } from 'jwt-decode'; // Correct import

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState(null); // Store the token

  useEffect(() => {
    const fetchSession = async () => {
      setLoading(true);
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          setUser(null);
          setRole(null);
          setSessionToken(null);
        } else if (session) {
          console.log("AuthContext: Session found", session);
          setUser(session.user);
          setSessionToken(session.access_token); // Store the token
          // Decode the JWT to get the role
          try {
            const decoded = jwtDecode(session.access_token);
            console.log("AuthContext: Decoded JWT", decoded);
            // Adjust based on your actual JWT structure for roles
            const userRole = decoded?.user_metadata?.role || decoded?.role || null;
             if (!userRole) {
               console.warn("AuthContext: Role not found in JWT token.");
             }
            setRole(userRole);
          } catch (e) {
            console.error("AuthContext: Error decoding JWT:", e);
            setRole(null);
          }
        } else {
          console.log("AuthContext: No active session found.");
          setUser(null);
          setRole(null);
          setSessionToken(null);
        }
      } catch (e) {
         console.error("AuthContext: Unexpected error fetching session:", e);
         setUser(null);
         setRole(null);
         setSessionToken(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession(); // Fetch session on initial load

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`AuthContext: Auth event - ${event}`, session);
        setLoading(true);
        if (session) {
          setUser(session.user);
          setSessionToken(session.access_token); // Update token on change
           try {
             const decoded = jwtDecode(session.access_token);
             const userRole = decoded?.user_metadata?.role || decoded?.role || null;
              if (!userRole) {
                 console.warn("AuthContext: Role not found in JWT token on auth change.");
              }
             setRole(userRole);
           } catch (e) {
             console.error("AuthContext: Error decoding JWT on auth change:", e);
             setRole(null);
           }
        } else {
          setUser(null);
          setRole(null);
          setSessionToken(null); // Clear token on sign out
        }
        setLoading(false);
      }
    );

    // Cleanup listener on component unmount
    return () => {
      if (authListener && typeof authListener.subscription?.unsubscribe === 'function') {
        authListener.subscription.unsubscribe();
      } else {
        console.warn("AuthContext: Could not unsubscribe from auth listener.");
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const logout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
      // Handle error appropriately, maybe show a notification
    }
    // State updates (user, role, token) are handled by the onAuthStateChange listener
    setLoading(false);
  };


  return (
    <AuthContext.Provider value={{ user, role, loading, sessionToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
