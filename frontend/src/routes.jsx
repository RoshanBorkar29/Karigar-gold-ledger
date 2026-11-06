import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth";

import Login from "./pages/Login";
import IssueEntry from "./pages/IssueEntry";
import ReceiptEntry from "./pages/ReceiptEntry";
import KarigarBalances from "./pages/KarigarBalances";
import KarigarMaster from "./pages/KarigarMaster";
import LossAlerts from "./pages/LossAlerts";
import DailyStock from "./pages/DailyStock";
import OldGoldDesk from "./pages/OldGoldDesk";
import LoadingState from "./components/LoadingState";
import ErrorBoundary from "./components/ErrorBoundary";

function ProtectedRoute({ children, financeOnly = false }) {
  const { isAuthenticated, isFinanceHead, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <LoadingState count={3} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (financeOnly && !isFinanceHead) {
    return <Navigate to="/balances" replace />;
  }

  return children;
}

export default function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/balances" replace /> : <Login />
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to="/balances" replace />
            </ProtectedRoute>
          }
        />

        <Route
          path="/issues"
          element={
            <ProtectedRoute>
              <IssueEntry />
            </ProtectedRoute>
          }
        />

        <Route
          path="/receipts"
          element={
            <ProtectedRoute>
              <ReceiptEntry />
            </ProtectedRoute>
          }
        />

        <Route
          path="/balances"
          element={
            <ProtectedRoute>
              <KarigarBalances />
            </ProtectedRoute>
          }
        />

        <Route
          path="/karigars"
          element={
            <ProtectedRoute>
              <KarigarMaster />
            </ProtectedRoute>
          }
        />

        <Route
          path="/old-gold"
          element={
            <ProtectedRoute>
              <OldGoldDesk />
            </ProtectedRoute>
          }
        />

        {/* Finance Head Role Restricted Routes */}
        <Route
          path="/alerts"
          element={
            <ProtectedRoute financeOnly={true}>
              <LossAlerts />
            </ProtectedRoute>
          }
        />

        <Route
          path="/stock"
          element={
            <ProtectedRoute financeOnly={true}>
              <DailyStock />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/balances" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
