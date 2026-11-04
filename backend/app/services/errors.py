"""Domain error classes for the ledger service layer."""


class LedgerError(Exception):
    """Base domain exception for all ledger business rule violations."""


class JobClosedError(LedgerError):
    """Raised when an operation requires an open job, but the job is closed."""


class InvalidEntryError(LedgerError):
    """Raised when entry parameters violate business validation rules (dates, HUID format, etc.)."""


class OverReturnError(LedgerError):
    """Raised when a receipt or void would cause returned gold to exceed issued gold for a job."""


class NotFoundError(LedgerError):
    """Raised when an entity (Job, Issue, Receipt, Karigar, etc.) is not found."""
