export interface DeviceInfo {
  device_id: string;
  name: string;
  type: string;
  status: string;
}

export interface PlaybackProgress {
  scenario_name: string;
  current_cycle: number;
  total_cycles: number;
  current_step: number;
  total_steps: number;
  status: string; // idle, running, paused, stopped
  passed: number;
  failed: number;
  warning: number;
  error: number;
}

export interface ClientInfo {
  client_id: string;
  name: string;
  version: string;
  connected_at: string;
  last_seen: string;
  activity: string; // idle, recording, playing
  devices: DeviceInfo[];
  playback: PlaybackProgress | null;
  scenarios: string[];
}

export interface WsMessage {
  type: string;
  [key: string]: any;
}
