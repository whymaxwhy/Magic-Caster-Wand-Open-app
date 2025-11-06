
export enum ConnectionStatus {
  DISCONNECTED = 'Disconnected',
  CONNECTING = 'Connecting...',
  CONNECTED = 'Connected',
  ERROR = 'Error',
}

export enum LogType {
  INFO = 'info',
  SPELL = 'spell',
  RAW = 'raw',
  COMMAND = 'command',
  ERROR = 'error',
}

export interface LogEntry {
  id: number;
  type: LogType;
  message: string;
  timestamp: string;
  data?: string;
}

export enum CommandType {
  CLEAR_LEDS = 'ClearLeds',
  BUZZ = 'Buzz',
  CHANGE_LED = 'ChangeLed',
}

export interface BaseCommand {
  id: string;
  type: CommandType;
}

export interface ClearLedsCommand extends BaseCommand {
  type: CommandType.CLEAR_LEDS;
}

export interface BuzzCommand extends BaseCommand {
  type: CommandType.BUZZ;
  duration: number; // in ms
}

export interface ChangeLedCommand extends BaseCommand {
  type: CommandType.CHANGE_LED;
  groupId: number;
  hexColor: string;
  duration: number; // in ms
}

export type MacroCommand = ClearLedsCommand | BuzzCommand | ChangeLedCommand;
