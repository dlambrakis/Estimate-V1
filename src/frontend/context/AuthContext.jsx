import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../../config/supabaseClientFrontend'; // Adjusted path
import { jwtDecode } from 'jwt-decode'; // Correct import

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // Initialize explicitly as null
  const [loading, setLoading] = useState(true); // Start loading
  const [sessionToken, setSessionToken] = useState(null); // Store the token

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component

    const processSession = (session) => {
      if (!isMounted) {
        console.log("AuthContext: processSession called on unmounted component. Skipping state updates.");
        return;
      }

      if (session) {
        console.log("AuthContext: Processing session", session);
        setUser(session.user);
        setSessionToken(session.access_token);
        let finalRole = null; // Variable to hold the role before setting state
        try {
          const decoded = jwtDecode(session.access_token);
          console.log("AuthContext: Full Decoded JWT:", decoded);

          // *** FIX: Explicitly check for user_metadata.role ***
          finalRole = decoded?.user_metadata?.role || null; // Only check user_metadata.role

          console.log("AuthContext: Extracted userRole:", finalRole); // Log extracted role
          if (!finalRole) {
             console.warn("AuthContext: Role not found in JWT token's user_metadata.");
          }
          setRole(finalRole); // Set the specific role (or null if not found)
          console.log("AuthContext: setRole called with:", finalRole); // Log after setRole
        } catch (e) {
          console.error("AuthContext: Error decoding JWT:", e);
          setRole(null); // Set role to null on error
          console.log("AuthContext: setRole called with null due to error"); // Log after setRole (error)
        } finally {
          console.log("AuthContext: Calling setLoading(false) in finally block (session exists)"); // Log before setLoading
          setLoading(false);
        }
      } else {
        console.log("AuthContext: No active session found or session ended.");
        setUser(null);
        setRole(null);
        setSessionToken(null);
        console.log("AuthContext: Calling setLoading(false) in else block (no session)"); // Log before setLoading
        setLoading(false); // Set loading false if no session
      }
    };

    const fetchSession = async () => {
      console.log("AuthContext: fetchSession called");
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("AuthContext: getSession completed", { session, error });

        if (error) {
          console.error("Error getting session:", error);
          processSession(null); // Process null session on error
        } else {
          processSession(session); // Process the found session
        }
      } catch (e) {
         console.error("AuthContext: Unexpected error fetching session:", e);
         processSession(null); // Process null session on unexpected error
      }
    };

    fetchSession(); // Fetch session on initial load

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log(`AuthContext: Auth event received - ${event}`, session);
        processSession(session); // Process the session from the event
      }
    );

    // Cleanup listener on component unmount
    return () => {
      console.log("AuthContext: Unmounting. Cleaning up listener.");
      isMounted = false; // Set flag on unmount
      if (authListener && typeof authListener.subscription?.unsubscribe === 'function') {
        authListener.subscription.unsubscribe();
        console.log("AuthContext: Unsubscribed from auth listener.");
      } else {
        console.warn("AuthContext: Could not unsubscribe from auth listener.");
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  const logout = async () => {
    console.log("AuthContext: logout called");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
    } else {
       console.log("AuthContext: signOut successful");
    }
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
