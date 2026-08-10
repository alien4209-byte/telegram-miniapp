export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket upgrade", { 
          status: 426,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      
      server.addEventListener('message', (event) => {
        try {
          const data = event.data;
          console.log("Received message:", data);
          server.send(`Echo: ${data}`);
        } catch (error) {
          console.error("Error handling message:", error);
          server.send(JSON.stringify({ type: "error", message: "Failed to process message" }));
        }
      });

      server.addEventListener('close', () => {
        console.log("WebSocket closed");
      });

      server.addEventListener('error', (error) => {
        console.error("WebSocket error:", error);
        try {
          server.close();
        } catch {
          // Already closed
        }
      });

      const timeout = setTimeout(() => {
        try {
          console.log("WebSocket idle timeout, closing...");
          server.close();
        } catch {
          // Already closed
        }
      }, 300000);

      server.addEventListener('close', () => {
        clearTimeout(timeout);
      });

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
      });
    }

    if (url.pathname === "/") {
      return new Response(JSON.stringify({ 
        status: "ok", 
        message: "Worker is running",
        timestamp: new Date().toISOString()
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { 
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};

export class HokmGameRoom {
  constructor(state: DurableObjectState, env: any) {}
  
  async fetch(request: Request): Promise<Response> {
    return new Response(JSON.stringify({ 
      error: "Durable Object is disabled", 
      message: "Game logic is running in the main Worker" 
    }), { 
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}