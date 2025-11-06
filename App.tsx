import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ConnectionStatus, LogEntry, LogType, MacroCommand, CommandType, ChangeLedCommand, BuzzCommand, ClearLedsCommand } from './types';
import ControlPanel from './components/ControlPanel';
import LogPanel from './components/LogPanel';
import SnifferPanel from './components/SnifferPanel';
import { WandIcon, BeakerIcon } from './components/Icons';

const WandGatt = {
    TARGET_NAME: "MCW",
    WRITE_UUID: "57420002-587e-48a0-974c-544d6163c577",
    NOTIFY_UUID: "57420003-587e-48a0-974c-544d6163c577",
    KEEPALIVE_INTERVAL: 5000,
    KEEPALIVE_COMMAND: new Uint8Array([0x01]),
    SPELL_DATA_HEADER_LEN: 4,
    SPELL_MIN_LEN: 7, // Header (4) + Spell (3)
    MTU_PAYLOAD_SIZE: 20,
};

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState('controller');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [opCodes, setOpCodes] = useState<{ [key in CommandType]: number }>({
        [CommandType.CLEAR_LEDS]: 0xAA,
        [CommandType.BUZZ]: 0xBB,
        [CommandType.CHANGE_LED]: 0xCC,
    });
    const [macroCommands, setMacroCommands] = useState<MacroCommand[]>([]);
    const [isOpCodeTestMode, setIsOpCodeTestMode] = useState(false);
    const [opcodeToTest, setOpcodeToTest] = useState(0x01);
    
    // FIX: Use `any` to avoid "Cannot find name 'BluetoothDevice'" error due to missing Web Bluetooth types.
    const deviceRef = useRef<any | null>(null);
    // FIX: Use `any` to avoid "Cannot find name 'BluetoothRemoteGATTCharacteristic'" error.
    const writeCharRef = useRef<any | null>(null);
    // FIX: Use `number` for setInterval return type in browser environments, not `NodeJS.Timeout`.
    const keepAliveIntervalRef = useRef<number | null>(null);

    const addLog = useCallback((type: LogType, message: string, data?: string) => {
        setLogs(prev => [...prev, {
            id: Date.now() + Math.random(),
            type,
            message,
            data,
            timestamp: new Date().toLocaleTimeString(),
        }]);
    }, []);

    const handleNotifications = useCallback((event: Event) => {
        // FIX: Cast target to `any` to access `value` property, avoiding "Cannot find name 'BluetoothRemoteGATTCharacteristic'" error.
        const value = (event.target as any).value;
        if (!value) return;

        const data = new Uint8Array(value.buffer);
        const rawHex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');

        if (data.length >= WandGatt.SPELL_MIN_LEN) {
            const spellBytes = data.slice(WandGatt.SPELL_DATA_HEADER_LEN);
            try {
                const spellName = new TextDecoder().decode(spellBytes).trim().replace(/\u0000/g, '');
                if (spellName) {
                    addLog(LogType.SPELL, `✨ Spell Detected: ${spellName.toUpperCase()}`, `RAW: ${rawHex}`);
                    return;
                }
            } catch (e) {
                // Ignore decode error, fall through to raw logging
            }
        }
        addLog(LogType.RAW, 'Raw Wand Data', rawHex);
    }, [addLog]);

    const startKeepAlive = useCallback(() => {
        if (keepAliveIntervalRef.current) clearInterval(keepAliveIntervalRef.current);
        keepAliveIntervalRef.current = setInterval(async () => {
            if (writeCharRef.current) {
                try {
                    await writeCharRef.current.writeValueWithoutResponse(WandGatt.KEEPALIVE_COMMAND.buffer);
                } catch (error) {
                    console.error("Keep-alive failed:", error);
                    disconnect();
                }
            }
        }, WandGatt.KEEPALIVE_INTERVAL);
    }, []);

    const stopKeepAlive = useCallback(() => {
        if (keepAliveIntervalRef.current) {
            clearInterval(keepAliveIntervalRef.current);
            keepAliveIntervalRef.current = null;
        }
    }, []);

    const disconnect = useCallback(async () => {
        stopKeepAlive();
        if (deviceRef.current) {
            deviceRef.current.removeEventListener('gattserverdisconnected', disconnect);
            if (deviceRef.current.gatt?.connected) {
                await deviceRef.current.gatt.disconnect();
            }
        }
        deviceRef.current = null;
        writeCharRef.current = null;
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
        addLog(LogType.INFO, 'Wand disconnected.');
    }, [addLog, stopKeepAlive]);
    
    const connect = useCallback(async () => {
        // FIX: Cast `navigator` to `any` to check for `bluetooth` property, avoiding "Property 'bluetooth' does not exist on type 'Navigator'" error.
        if (!(navigator as any).bluetooth) {
            addLog(LogType.ERROR, "Web Bluetooth API is not available on this browser.");
            return;
        }

        try {
            setConnectionStatus(ConnectionStatus.CONNECTING);
            addLog(LogType.INFO, `Scanning for wand "${WandGatt.TARGET_NAME}"...`);
            
            // FIX: Cast `navigator` to `any` to use `bluetooth.requestDevice`, avoiding "Property 'bluetooth' does not exist on type 'Navigator'" error.
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ namePrefix: WandGatt.TARGET_NAME }],
                optionalServices: [WandGatt.WRITE_UUID.split('-')[0]],
            });

            if (!device.gatt) {
                throw new Error("GATT server not available.");
            }
            
            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', disconnect);
            
            addLog(LogType.INFO, "Connecting to GATT server...");
            const server = await device.gatt.connect();

            addLog(LogType.INFO, "Getting Primary Service...");
            const service = await server.getPrimaryService(WandGatt.WRITE_UUID.split('-')[0]);

            addLog(LogType.INFO, "Getting Characteristics...");
            const writeChar = await service.getCharacteristic(WandGatt.WRITE_UUID);
            const notifyChar = await service.getCharacteristic(WandGatt.NOTIFY_UUID);
            writeCharRef.current = writeChar;

            addLog(LogType.INFO, "Starting notifications...");
            await notifyChar.startNotifications();
            notifyChar.addEventListener('characteristicvaluechanged', handleNotifications);
            
            startKeepAlive();
            setConnectionStatus(ConnectionStatus.CONNECTED);
            addLog(LogType.INFO, `Successfully connected to ${device.name}. Wand is active!`);
        } catch (error: any) {
            addLog(LogType.ERROR, `Connection failed: ${error.message}`);
            setConnectionStatus(ConnectionStatus.ERROR);
            setTimeout(() => setConnectionStatus(ConnectionStatus.DISCONNECTED), 3000);
        }
    }, [addLog, disconnect, handleNotifications, startKeepAlive]);

    const sendData = useCallback(async (data: Uint8Array) => {
        if (!writeCharRef.current) {
            addLog(LogType.ERROR, "Cannot send data. Write characteristic not available.");
            return;
        }
        try {
            await writeCharRef.current.writeValueWithoutResponse(data.buffer);
        } catch (error: any) {
            addLog(LogType.ERROR, `Failed to send data: ${error.message}`);
        }
    }, [addLog]);

    const sendMacro = useCallback(async () => {
        if (macroCommands.length === 0) return;

        let fullCommandBytes: number[] = [];
        for (const cmd of macroCommands) {
            switch(cmd.type) {
                case CommandType.CLEAR_LEDS:
                    fullCommandBytes.push(opCodes.ClearLeds);
                    break;
                case CommandType.BUZZ:
                    const buzzCmd = cmd as BuzzCommand;
                    const durationBuzz = Math.min(buzzCmd.duration, 32767);
                    fullCommandBytes.push(opCodes.Buzz, durationBuzz & 0xFF, (durationBuzz >> 8) & 0xFF);
                    break;
                case CommandType.CHANGE_LED:
                    const ledCmd = cmd as ChangeLedCommand;
                    const r = parseInt(ledCmd.hexColor.substring(0, 2), 16);
                    const g = parseInt(ledCmd.hexColor.substring(2, 4), 16);
                    const b = parseInt(ledCmd.hexColor.substring(4, 6), 16);
                    const durationLed = Math.min(ledCmd.duration, 32767);
                    fullCommandBytes.push(opCodes.ChangeLed, ledCmd.groupId, r, g, b, durationLed & 0xFF, (durationLed >> 8) & 0xFF);
                    break;
            }
        }

        addLog(LogType.COMMAND, "Sending VFX Macro...", `Bytes: ${fullCommandBytes.map(b => b.toString(16).padStart(2,'0')).join(' ')}`);

        for (let i = 0; i < fullCommandBytes.length; i += WandGatt.MTU_PAYLOAD_SIZE) {
            const chunk = new Uint8Array(fullCommandBytes.slice(i, i + WandGatt.MTU_PAYLOAD_SIZE));
            await sendData(chunk);
            await new Promise(resolve => setTimeout(resolve, 20)); // Small delay between chunks
        }
    }, [macroCommands, opCodes, sendData, addLog]);

    const testNextOpCode = useCallback(async () => {
      if (opcodeToTest > 0xFF) {
        addLog(LogType.INFO, "OpCode testing finished.");
        setOpcodeToTest(0x01);
        setIsOpCodeTestMode(false);
        return;
      }

      addLog(LogType.COMMAND, `Testing OpCode 0x${opcodeToTest.toString(16).toUpperCase().padStart(2, '0')}`);
      await sendData(new Uint8Array([opcodeToTest]));
      setOpcodeToTest(prev => prev + 1);
    }, [addLog, opcodeToTest, sendData]);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            if(connectionStatus === ConnectionStatus.CONNECTED) {
                disconnect();
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col">
            <header className="bg-gray-800/30 shadow-md p-4 flex items-center space-x-3">
                <WandIcon className="h-8 w-8 text-purple-400" />
                <h1 className="text-2xl font-bold tracking-wider text-gray-100">Web Wand Utility</h1>
            </header>

            <nav className="flex border-b border-gray-700">
                <button 
                    onClick={() => setActiveTab('controller')}
                    className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-colors duration-200 ${activeTab === 'controller' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:bg-gray-800/50'}`}
                >
                    <WandIcon className="h-5 w-5"/>
                    <span>Controller</span>
                </button>
                <button 
                    onClick={() => setActiveTab('sniffer')}
                    className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-colors duration-200 ${activeTab === 'sniffer' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-400 hover:bg-gray-800/50'}`}
                >
                    <BeakerIcon className="h-5 w-5"/>
                    <span>Sniffer</span>
                </button>
            </nav>

            <main className="p-4 flex-grow">
                {activeTab === 'controller' && (
                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                        <ControlPanel
                            connectionStatus={connectionStatus}
                            opCodes={opCodes}
                            setOpCodes={setOpCodes}
                            macroCommands={macroCommands}
                            setMacroCommands={setMacroCommands}
                            isOpCodeTestMode={isOpCodeTestMode}
                            setIsOpCodeTestMode={setIsOpCodeTestMode}
                            onConnect={connect}
                            onDisconnect={disconnect}
                            onSendMacro={sendMacro}
                            opcodeToTest={opcodeToTest}
                            onTestNextOpCode={testNextOpCode}
                        />
                        <LogPanel logs={logs} />
                    </div>
                )}
                {activeTab === 'sniffer' && <SnifferPanel />}
            </main>
        </div>
    );
};

export default App;
