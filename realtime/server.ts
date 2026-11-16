/**
 * FlowDesk realtime server (Node + Socket.io).
 *
 * Clients join a room per project. When one client mutates the board, it emits
 * `board:change`; the server relays `board:changed` to everyone else in the room
 * so their Kanban reloads instantly. Also tracks live presence (who's viewing).
 *
 * Run standalone:  npm run dev:ws   (or `npm run dev` for web + ws together)
 */
import { createServer } from "http";
import { Server } from "socket.io";

const PORT = Number(process.env.WS_PORT || 4000);

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "flowdesk-realtime" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});

type Viewer = { id: string; name: string };
// projectId -> socketId -> viewer
const presence = new Map<string, Map<string, Viewer>>();

function roomViewers(projectId: string): Viewer[] {
  const map = presence.get(projectId);
  if (!map) return [];
  // De-duplicate by user id (a user may have multiple tabs open).
  const seen = new Map<string, Viewer>();
  for (const v of map.values()) seen.set(v.id, v);
  return [...seen.values()];
}

io.on("connection", (socket) => {
  let joinedProject: string | null = null;

  socket.on("join", ({ projectId, user }: { projectId: string; user: Viewer }) => {
    joinedProject = projectId;
    socket.join(projectId);
    if (!presence.has(projectId)) presence.set(projectId, new Map());
    presence.get(projectId)!.set(socket.id, user);
    io.to(projectId).emit("presence", roomViewers(projectId));
  });

  socket.on("board:change", ({ projectId }: { projectId: string }) => {
    // Notify everyone in the room except the sender.
    socket.to(projectId).emit("board:changed");
  });

  socket.on("leave", ({ projectId }: { projectId: string }) => {
    socket.leave(projectId);
    presence.get(projectId)?.delete(socket.id);
    io.to(projectId).emit("presence", roomViewers(projectId));
  });

  socket.on("disconnect", () => {
    if (joinedProject) {
      presence.get(joinedProject)?.delete(socket.id);
      io.to(joinedProject).emit("presence", roomViewers(joinedProject));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`⚡ FlowDesk realtime server on http://localhost:${PORT}`);
});
