type EventCallback = (payload: any) => void;

class DashboardBridge {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect() {
    this.socket = new WebSocket(`ws://localhost:1421/ws`);

    this.socket.onopen = () => {
      console.log('✅ Connected to Didi Bridge');
      this.isConnected = true;
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && this.listeners.has(data.type)) {
          this.listeners.get(data.type)?.forEach(cb => cb(data.payload));
        }
      } catch (e) {
        console.error('Failed to parse bridge message', e);
      }
    };

    this.socket.onclose = () => {
      console.log('❌ Disconnected from Didi Bridge. Retrying...');
      this.isConnected = false;
      setTimeout(() => this.connect(), 3000);
    };
  }

  public listen(eventName: string, callback: EventCallback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)?.add(callback);

    return () => {
      this.listeners.get(eventName)?.delete(callback);
    };
  }

  // Since it's a dashboard, we might want to "push" commands back too
  public async invoke(cmd: string, args: any = {}) {
    if (!this.isConnected) return;
    this.socket?.send(JSON.stringify({ type: 'invoke', cmd, args }));
  }
}

export const bridge = new DashboardBridge();
