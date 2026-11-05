import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("karigar_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem("karigar_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const userData = await api.getMe();
      setUser(userData);
      localStorage.setItem("karigar_user", JSON.stringify(userData));
    } catch {
      localStorage.removeItem("karigar_token");
      localStorage.removeItem("karigar_user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();

    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener("karigar-auth-expired", handleExpired);
    return () => window.removeEventListener("karigar-auth-expired", handleExpired);
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    await api.login(email, password);
    const me = await api.getMe();
    setUser(me);
    localStorage.setItem("karigar_user", JSON.stringify(me));
    return me;
  };

  const logout = () => {
    localStorage.removeItem("karigar_token");
    localStorage.removeItem("karigar_user");
    setUser(null);
  };

  const isFinanceHead = user?.role === "finance_head";
  const isIssueClerk = user?.role === "issue_clerk";
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated,
        isFinanceHead,
        isIssueClerk,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
