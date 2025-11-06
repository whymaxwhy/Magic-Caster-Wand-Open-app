import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RssIcon, PowerIcon, BeakerIcon } from './Icons';

const TARGET_NAME = "MCW";
const PROBLEMATIC_UUIDS = new Set([
    "00002a05-0000-1000-8000-00805f9b34fb", // Service Changed
]);
const WAND_SERVICE_UUID = "57420000-587e-48a0-974c-544d6163c577";


type SnifferStatus = 'Disconnected' | 'Scanning' | 'Connecting' | 'Listening' | 'Error';
interface SnifferLog {
    id: number;
    uuid: string;
    data: string;
    timestamp: string;
}

const SnifferPanel: React.FC = () => {
    const [status, setStatus] = useState<SnifferStatus>('Disconnected');
    const [logs, setLogs] = useState<SnifferLog[]>([]);
    
    // FIX: Using `any` for Web Bluetooth types to avoid build errors
    const deviceRef = useRef<any | null>(null);
    const subscribedCharsRef = useRef<any[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    const addLog = useCallback((uuid: string, data: string) => {
        setLogs(prev => [...prev.slice(-200), { // Keep log history manageable
            id: Date.now() + Math.random(),
            uuid,
            data,
            timestamp: new Date().toLocaleTimeString(),
        }]);
    }, []);
    
    const notificationHandler = useCallback((event: Event) => {
        const characteristic = event.target as any;
        const value = characteristic.value;
        if (!value) return;

        const data = new Uint8Array(value.buffer);
        const rawHex = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
        
        addLog(characteristic.uuid, rawHex);
    }, [addLog]);

    const stopSniffing = useCallback(async () => {
        if (deviceRef.current) {
            deviceRef.current.removeEventListener('gattserverdisconnected', stopSniffing);
        }

        for (const char of subscribedCharsRef.current) {
            try {
                if (deviceRef.current?.gatt?.connected) {
                    await char.stopNotifications();
                    char.removeEventListener('characteristicvaluechanged', notificationHandler);
                }
            } catch (error) {
                console.warn(`Could not stop notifications for ${char.uuid}:`, error);
            }
        }
        subscribedCharsRef.current = [];
        
        if (deviceRef.current?.gatt?.connected) {
            await deviceRef.current.gatt.disconnect();
        }
        
        deviceRef.current = null;
        setStatus('Disconnected');
        console.log("Sniffer disconnected.");
    }, [notificationHandler]);

    const startSniffing = useCallback(async () => {
        if (!(navigator as any).bluetooth) {
            alert("Web Bluetooth API is not available on this browser.");
            setStatus('Error');
            return;
        }

        try {
            setStatus('Scanning');
            const device = await (navigator as any).bluetooth.requestDevice({
                filters: [{ namePrefix: TARGET_NAME }],
                optionalServices: [
                    '00001800-0000-1000-8000-00805f9b34fb', // generic_access
                    '00001801-0000-1000-8000-00805f9b34fb', // generic_attribute
                    '0000180a-0000-1000-8000-00805f9b34fb', // device_information
                    '0000180f-0000-1000-8000-00805f9b34fb', // battery_service
                    WAND_SERVICE_UUID
                ],
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', stopSniffing);

            setStatus('Connecting');
            const server = await device.gatt.connect();

            const services = await server.getPrimaryServices();
            let notifyCharsCount = 0;
            
            for (const service of services) {
                const characteristics = await service.getCharacteristics();
                for (const char of characteristics) {
                    const props = char.properties;
                    if ((props.notify || props.indicate) && !PROBLEMATIC_UUIDS.has(char.uuid)) {
                        try {
                            await char.startNotifications();
                            char.addEventListener('characteristicvaluechanged', notificationHandler);
                            subscribedCharsRef.current.push(char);
                            notifyCharsCount++;
                        } catch(e) {
                            console.error(`Failed to subscribe to ${char.uuid}`, e);
                        }
                    }
                }
            }
            
            if (notifyCharsCount > 0) {
                setStatus('Listening');
            } else {
                setStatus('Error');
                alert("No notifiable characteristics found on this device.");
                await stopSniffing();
            }

        } catch (error: any) {
            console.error("Sniffer failed:", error);
            if (error.name !== 'NotFoundError') {
                setStatus('Error');
                setTimeout(() => setStatus('Disconnected'), 3000);
            } else {
                setStatus('Disconnected');
            }
        }
    }, [stopSniffing, notificationHandler]);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);
    
    useEffect(() => {
        return () => { // Cleanup on component unmount
            if(status !== 'Disconnected' && status !== 'Error') {
                stopSniffing();
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isBusy = status === 'Connecting' || status === 'Scanning';
    const isConnected = status === 'Listening';

    return (
        <div className="bg-gray-800/50 rounded-lg shadow-lg h-full flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        <BeakerIcon className="w-6 h-6 text-teal-400"/>
                        BLE Characteristic Sniffer
                    </h2>
                    <p className="text-sm text-gray-400">Subscribes to all NOTIFY/INDICATE characteristics on the wand.</p>
                </div>
                <div className="flex items-center space-x-4">
                     <button
                        onClick={isConnected ? stopSniffing : startSniffing}
                        disabled={isBusy}
                        className={`px-4 py-2 rounded-md font-semibold text-white flex items-center space-x-2 transition-all duration-200 ${
                            isConnected ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
                        } ${isBusy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <PowerIcon className="h-5 w-5"/>
                        <span>{isBusy ? 'Connecting...' : (isConnected ? 'Stop Sniffing' : 'Start Sniffing')}</span>
                    </button>
                    <div className="flex items-center space-x-2">
                         <div className={`h-3 w-3 rounded-full ${
                            { 'Listening': 'bg-green-500 animate-pulse', 
                              'Connecting': 'bg-yellow-500 animate-spin',
                              'Scanning': 'bg-yellow-500 animate-spin',
                              'Disconnected': 'bg-gray-500', 
                              'Error': 'bg-red-500'
                            }[status]
                        }`}></div>
                        <span className="text-gray-400">{status}</span>
                    </div>
                </div>
            </div>
            <div ref={logContainerRef} className="flex-grow p-4 space-y-3 overflow-y-auto font-mono text-sm">
                {logs.length === 0 && (
                    <div className="text-center text-gray-500 pt-10">
                        <p>Waiting for data...</p>
                        <p className="text-xs mt-2">Connect and move the wand to see notifications.</p>
                    </div>
                )}
                {logs.map(log => (
                    <div key={log.id} className="flex items-start space-x-3">
                        <RssIcon className="h-4 w-4 text-teal-400 flex-shrink-0 mt-0.5"/>
                        <div className="flex-grow">
                            <p className="text-gray-400">
                                <span className="font-semibold text-gray-200">{log.uuid}</span>
                                <span className="text-gray-500 ml-2">({log.timestamp})</span>
                            </p>
                            <p className="text-cyan-300 break-all">{log.data}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SnifferPanel;
