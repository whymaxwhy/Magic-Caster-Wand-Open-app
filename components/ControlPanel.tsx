
import React, { useState } from 'react';
import { ConnectionStatus, MacroCommand, CommandType } from '../types';
import { PowerIcon, PlusIcon, TrashIcon, ZapIcon } from './Icons';

interface ControlPanelProps {
  connectionStatus: ConnectionStatus;
  opCodes: { [key in CommandType]: number };
  setOpCodes: React.Dispatch<React.SetStateAction<{ [key in CommandType]: number }>>;
  macroCommands: MacroCommand[];
  setMacroCommands: React.Dispatch<React.SetStateAction<MacroCommand[]>>;
  isOpCodeTestMode: boolean;
  setIsOpCodeTestMode: (isTesting: boolean) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendMacro: () => void;
  opcodeToTest: number;
  onTestNextOpCode: () => void;
}

const OpCodeInput: React.FC<{ label: string; value: number; onChange: (val: number) => void; }> = ({ label, value, onChange }) => (
    <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-gray-400 w-24">{label}</label>
        <input
            type="text"
            value={`0x${value.toString(16).toUpperCase().padStart(2, '0')}`}
            onChange={(e) => {
                const hexVal = e.target.value.startsWith('0x') ? e.target.value.substring(2) : e.target.value;
                const intVal = parseInt(hexVal, 16);
                if (!isNaN(intVal) && intVal >= 0 && intVal <= 255) {
                    onChange(intVal);
                }
            }}
            className="w-24 bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-center font-mono focus:ring-purple-500 focus:border-purple-500"
        />
    </div>
);


const ControlPanel: React.FC<ControlPanelProps> = ({
  connectionStatus, opCodes, setOpCodes, macroCommands, setMacroCommands,
  isOpCodeTestMode, setIsOpCodeTestMode, onConnect, onDisconnect, onSendMacro,
  opcodeToTest, onTestNextOpCode
}) => {
    const isConnected = connectionStatus === ConnectionStatus.CONNECTED;
    const isConnecting = connectionStatus === ConnectionStatus.CONNECTING;

    const addCommand = (type: CommandType) => {
        let newCommand: MacroCommand;
        const id = new Date().toISOString();
        switch (type) {
            case CommandType.CLEAR_LEDS:
                newCommand = { id, type };
                break;
            case CommandType.BUZZ:
                newCommand = { id, type, duration: 250 };
                break;
            case CommandType.CHANGE_LED:
                newCommand = { id, type, groupId: 0, hexColor: '0000FF', duration: 500 };
                break;
        }
        setMacroCommands(prev => [...prev, newCommand]);
    };

    const removeCommand = (id: string) => {
        setMacroCommands(prev => prev.filter(cmd => cmd.id !== id));
    };

    const updateCommand = (id: string, updates: Partial<MacroCommand>) => {
        setMacroCommands(prev => prev.map(cmd => cmd.id === id ? { ...cmd, ...updates } : cmd));
    };
    
    return (
        <div className="bg-gray-800/50 rounded-lg shadow-lg h-full flex flex-col p-4 space-y-4 overflow-y-auto">
            {/* Connection Section */}
            <div>
                <h2 className="text-xl font-bold text-gray-100 mb-3">Wand Control</h2>
                <div className="flex items-center space-x-4">
                    <button
                        onClick={isConnected ? onDisconnect : onConnect}
                        disabled={isConnecting}
                        className={`px-4 py-2 rounded-md font-semibold text-white flex items-center space-x-2 transition-all duration-200 ${
                            isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
                        } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <PowerIcon className="h-5 w-5"/>
                        <span>{isConnecting ? 'Connecting...' : (isConnected ? 'Disconnect' : 'Connect Wand')}</span>
                    </button>
                    <div className="flex items-center space-x-2">
                        <div className={`h-3 w-3 rounded-full ${
                            { [ConnectionStatus.CONNECTED]: 'bg-green-500 animate-pulse', 
                              [ConnectionStatus.CONNECTING]: 'bg-yellow-500 animate-spin',
                              [ConnectionStatus.DISCONNECTED]: 'bg-gray-500', 
                              [ConnectionStatus.ERROR]: 'bg-red-500'
                            }[connectionStatus]
                        }`}></div>
                        <span className="text-gray-400">{connectionStatus}</span>
                    </div>
                </div>
            </div>

            {/* OpCode Discovery Section */}
            <div className="bg-gray-900/50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-200">OpCode Discovery Mode</h3>
                    <button
                        onClick={() => setIsOpCodeTestMode(!isOpCodeTestMode)}
                        disabled={!isConnected}
                        className={`px-3 py-1 text-sm rounded-md ${isOpCodeTestMode ? 'bg-yellow-500 text-black' : 'bg-gray-700 text-white'} ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600'}`}
                    >
                        {isOpCodeTestMode ? 'Active' : 'Activate'}
                    </button>
                </div>
                {isOpCodeTestMode && (
                    <div className="mt-4 text-center">
                        <p className="text-gray-400 mb-2">Testing OpCode:</p>
                        <p className="text-4xl font-mono text-yellow-400 mb-3">
                            0x{opcodeToTest.toString(16).toUpperCase().padStart(2, '0')}
                        </p>
                        <button onClick={onTestNextOpCode} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">
                            Send & Test Next OpCode
                        </button>
                        <p className="text-xs text-gray-500 mt-2">Observe wand for any reaction (light, buzz).</p>
                    </div>
                )}
            </div>
            
            {/* OpCodes & Macro Builder Section */}
            <div className="flex-grow flex flex-col space-y-4">
                {/* OpCode Config */}
                <div className="bg-gray-900/50 p-3 rounded-lg space-y-2">
                    <h3 className="font-semibold text-gray-200 mb-2">Command OpCodes</h3>
                    <OpCodeInput label="Clear LEDs" value={opCodes.ClearLeds} onChange={v => setOpCodes(o => ({...o, ClearLeds: v}))}/>
                    <OpCodeInput label="Buzz" value={opCodes.Buzz} onChange={v => setOpCodes(o => ({...o, Buzz: v}))}/>
                    <OpCodeInput label="Change LED" value={opCodes.ChangeLed} onChange={v => setOpCodes(o => ({...o, ChangeLed: v}))}/>
                </div>

                {/* Macro Builder */}
                <div className="bg-gray-900/50 p-3 rounded-lg flex-grow flex flex-col">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-200">VFX Macro Builder</h3>
                        <div className="relative group">
                            <button className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-md flex items-center space-x-1">
                                <PlusIcon className="h-5 w-5"/>
                                <span>Add</span>
                            </button>
                            <div className="absolute right-0 mt-2 w-40 bg-gray-800 border border-gray-700 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 invisible group-hover:visible z-10">
                                <a onClick={() => addCommand(CommandType.CHANGE_LED)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer">Change LED</a>
                                <a onClick={() => addCommand(CommandType.BUZZ)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer">Buzz</a>
                                <a onClick={() => addCommand(CommandType.CLEAR_LEDS)} className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer">Clear LEDs</a>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-grow space-y-2 overflow-y-auto pr-2">
                        {macroCommands.length === 0 && <p className="text-center text-gray-500 text-sm mt-4">No commands in macro.</p>}
                        {macroCommands.map((cmd) => (
                            <div key={cmd.id} className="bg-gray-700/50 p-2 rounded-md">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold text-sm">{cmd.type.replace(/([A-Z])/g, ' $1').trim()}</p>
                                    <button onClick={() => removeCommand(cmd.id)} className="text-gray-500 hover:text-red-500"><TrashIcon className="h-4 w-4"/></button>
                                </div>
                                {cmd.type === CommandType.CHANGE_LED && (
                                    <div className="mt-2 flex items-center space-x-2 text-sm">
                                        <input type="color" value={`#${cmd.hexColor}`} onChange={e => updateCommand(cmd.id, { hexColor: e.target.value.substring(1) })} className="bg-transparent border-none p-0 h-6 w-8 cursor-pointer"/>
                                        <input type="number" value={cmd.duration} onChange={e => updateCommand(cmd.id, { duration: parseInt(e.target.value) || 0 })} className="w-20 bg-gray-800 border border-gray-600 rounded px-1 py-0.5"/>
                                        <span className="text-gray-400">ms</span>
                                    </div>
                                )}
                                {cmd.type === CommandType.BUZZ && (
                                     <div className="mt-2 flex items-center space-x-2 text-sm">
                                        <input type="number" value={cmd.duration} onChange={e => updateCommand(cmd.id, { duration: parseInt(e.target.value) || 0 })} className="w-20 bg-gray-800 border border-gray-600 rounded px-1 py-0.5"/>
                                        <span className="text-gray-400">ms</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Send Macro Button */}
            <div>
                <button
                    onClick={onSendMacro}
                    disabled={!isConnected || isOpCodeTestMode || macroCommands.length === 0}
                    className="w-full bg-cyan-600 text-white font-bold py-3 px-4 rounded-md flex items-center justify-center space-x-2 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-700 transition-colors"
                >
                    <ZapIcon className="h-5 w-5"/>
                    <span>Cast Macro</span>
                </button>
            </div>
        </div>
    );
};

export default ControlPanel;
