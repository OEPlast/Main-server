import morgan from 'morgan';

// Build the morgan middleware
export const morganMiddleware = morgan(':method :url :status :res[content-length] - :response-time ms');
