
import React from 'react';
import { LogEntry, LogType } from '../types';
import { WandIcon, ZapIcon, TerminalIcon } from './Icons';

interface LogPanelProps {
  logs: LogEntry[];
}

const LogIcon: React.FC<{ type: LogType }> = ({ type }) => {
  switch (type) {
    case LogType.SPELL:
      return <ZapIcon className="h-5 w-5 text-yellow-400" />;
    case LogType.RAW:
      return <WandIcon className="h-5 w-5 text-purple-400" />;
    case LogType.COMMAND:
      return <TerminalIcon className="h-5 w-5 text-cyan-400" />;
    default:
      return <div className={`h-2.5 w-2.5 rounded-full ${type === LogType.ERROR ? 'bg-red-500' : 'bg-green-500'}`} />;
  }
};

const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-gray-800/50 rounded-lg shadow-lg h-full flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-gray-100">Wand Output Log</h2>
      </div>
      <div ref={logContainerRef} className="flex-grow p-4 space-y-3 overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start space-x-3 text-sm">
            <div className="flex-shrink-0 pt-1">
              <LogIcon type={log.type} />
            </div>
            <div className="flex-grow">
              <p className={`font-mono ${log.type === LogType.SPELL ? 'text-yellow-300 font-bold text-base' : 'text-gray-300'}`}>
                {log.message}
              </p>
              {log.data && <p className="text-xs text-gray-400 font-mono mt-1 break-all">{log.data}</p>}
              <p className="text-xs text-gray-500">{log.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LogPanel;
