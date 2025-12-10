import { LogEntry } from '../types';

export const createLog = (
  source: LogEntry['source'],
  message: string,
  type: LogEntry['type'] = 'info'
): LogEntry => {
  return {
    id: Math.random().toString(36).substring(7),
    timestamp: new Date(),
    source,
    message,
    type,
  };
};