import React, { Component } from "react";
import ErrorState from "./ErrorState";

/**
 * Standard React Error Boundary component.
 * Catches unhandled render errors in child components.
 * Renders the shared ErrorState with a Retry action while keeping the app shell / sidebar visible.
 * Logs error details to console only in development mode.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV) {
      console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="py-8 px-4 w-full">
          <ErrorState
            error={this.state.error}
            title="Screen encounter an unexpected error"
            message={this.state.error?.message || "An unexpected rendering error occurred on this screen."}
            onRetry={this.handleRetry}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

