class ServiceError extends Error {
  constructor(status, code, message, options = {}) {
    super(message, options);
    this.name = "ServiceError";
    this.status = status;
    this.code = code;
  }
}

function publicError(error) {
  if (error instanceof ServiceError) return error;
  return new ServiceError(500, "internal_error", "The Forge AI service could not complete the request.", { cause: error });
}

export { ServiceError, publicError };
