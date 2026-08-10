export class HokmGameRoom {
  constructor(state: DurableObjectState, env: any) {
    console.log("✅ HokmGameRoom created");
  }

  async fetch(request: Request): Promise<Response> {
    console.log("✅ HokmGameRoom fetch called");
    
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();

    server.addEventListener('message', (event) => {
      try {
        const data = event.data;
        console.log("📩 Received message:", data);
        server.send(`Echo: ${data}`);
      } catch (error) {
        console.error("❌ Error handling message:", error);
        server.send(JSON.stringify({ type: "error", message: "Failed to process message" }));
      }
    });

    server.addEventListener('close', () => {
      console.log("🔌 WebSocket closed");
    });

    server.addEventListener('error', (error) => {
      console.error("❌ WebSocket error:", error);
      try {
        server.close();
      } catch {
        // Already closed
      }
    });

    const timeout = setTimeout(() => {
      try {
        console.log("⏰ WebSocket idle timeout, closing...");
        server.close();
      } catch {
        // Already closed
      }
    }, 300000);

    server.addEventListener('close', () => {
      clearTimeout(timeout);
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
