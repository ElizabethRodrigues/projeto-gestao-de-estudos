class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new AppError(400, msg, details);
const notFound = (msg = 'Recurso não encontrado') => new AppError(404, msg);
const conflict = (msg) => new AppError(409, msg);
const unprocessable = (msg, details) => new AppError(422, msg, details);

module.exports = { AppError, badRequest, notFound, conflict, unprocessable };
