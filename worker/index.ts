export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle WebSocket requests directly in the main Worker
    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      
      server.addEventListener('message', (event) => {
        server.send(`Echo: ${event.data}`);
      });

      server.addEventListener('close', () => {
        console.log("WebSocket closed");
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    // Health check
    if (url.pathname === "/") {
      return new Response(JSON.stringify({ status: "ok", message: "Worker is running" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404 });
  }
}

// Stub export to satisfy existing Durable Object binding
export class HokmGameRoom {
  constructor(state: DurableObjectState, env: any) {}
  async fetch(request: Request): Promise<Response> {
    return new Response("Durable Object is disabled", { status: 503 });
  }
}