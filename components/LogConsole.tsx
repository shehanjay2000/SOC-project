import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogConsoleProps {
  logs: LogEntry[];
}

export const LogConsole: React.FC<LogConsoleProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-blue-300';
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden flex flex-col h-64 md:h-96 border border-gray-700">
      <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
        <span className="text-gray-300 text-xs font-mono font-bold uppercase tracking-wider">System Logs</span>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
        </div>
      </div>
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs md:text-sm scrollbar-thin">
        {logs.length === 0 && <span className="text-gray-500 italic">Waiting for activity...</span>}
        {logs.map((log) => (
          <div key={log.id} className="mb-1.5 break-words">
            <span className="text-gray-500">[{log.timestamp.toLocaleTimeString()}]</span>
            <span className="text-purple-400 mx-2 font-bold">[{log.source}]</span>
            <span className={getColor(log.type)}>{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};