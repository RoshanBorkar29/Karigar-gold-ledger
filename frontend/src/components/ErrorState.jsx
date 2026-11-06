import React from "react";
import Button from "./ui/Button";

/**
 * Standard ErrorState component with friendly error mapping and Retry action.
 */
export default function ErrorState({
  error,
  title = "Unable to complete request",
  message = null,
  onRetry = null,
  className = "",
}) {
  let friendlyMessage = message;
  let suggestion = "Please review the details and try again.";

  const errStr = String(error?.message || error || "").toLowerCase();

  if (errStr.includes("403") || errStr.includes("forbidden") || errStr.includes("permission")) {
    title = "Access restricted";
    friendlyMessage = "This action requires Finance Head permissions.";
    suggestion = "Sign in with a Finance Head account to access this screen.";
  } else if (errStr.includes("404") || errStr.includes("not found")) {
    title = "Record not found";
    friendlyMessage = "The requested record, job, or karigar could not be found.";
    suggestion = "Check that the identifier is correct or return to the list.";
  } else if (errStr.includes("422") || errStr.includes("validation") || errStr.includes("mismatch")) {
    title = "Invalid entry details";
    friendlyMessage = error?.message || "One or more entered values did not pass validation rules.";
    suggestion = "Ensure weights are positive grams with at most 3 decimal places.";
  } else if (errStr.includes("400") || errStr.includes("closed") || errStr.includes("over-return") || errStr.includes("overreturn")) {
    title = "Operation not permitted";
    friendlyMessage = error?.message || "The request could not be processed due to ledger rules.";
    suggestion = "Check that the job order is open and returned gold does not exceed issued gold.";
  } else if (errStr.includes("network") || errStr.includes("failed to fetch") || errStr.includes("connection")) {
    title = "Network connection failed";
    friendlyMessage = "Unable to connect to the backend server.";
    suggestion = "Verify that the backend server is running on port 8000 and your connection is active.";
  } else if (!friendlyMessage) {
    friendlyMessage = error?.message || "An unexpected error occurred while communicating with the server.";
  }

  return (
    <div
      role="alert"
      className={`p-4 rounded border border-status-problem/20 bg-status-problem-tint text-status-problem my-4 ${className}`}
    >
      <h4 className="text-sm font-semibold text-status-problem m-0">
        {title}
      </h4>
      <p className="text-xs text-status-problem/90 mt-1 m-0">
        {friendlyMessage}
      </p>
      {suggestion && (
        <p className="text-xs text-muted mt-1 m-0">
          {suggestion}
        </p>
      )}
      {onRetry && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
