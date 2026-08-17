class DatasetError(Exception):
    """Base exception for expected dataset failures."""


class DatasetNotFoundError(DatasetError):
    pass


class DatasetValidationError(DatasetError):
    pass


class ActionValidationError(DatasetError):
    pass

