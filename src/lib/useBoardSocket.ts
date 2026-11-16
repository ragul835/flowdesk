"use client";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";

/**
 * Joins a project room over Socket.io. Calls `onRemoteChange` when ANOTHER
 * client in the same project mutates data, and returns `broadcast()` to notify
 * peers after a local mutation. Also exposes live presence (who's viewing).
 */
export function useBoardSocket(
  projectId: string,
  user: { id: string; name: string },
  onRemoteChange: () => void
) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState<{ id: string; name: string }[]>([]);
  const changeRef = useRef(onRemoteChange);
  changeRef.current = onRemoteChange;

  useEffect(() => {
    const socket = io(WS_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", { projectId, user });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("board:changed", () => changeRef.current());
    socket.on("presence", (list: { id: string; name: string }[]) => setViewers(list));

    return () => {
      socket.emit("leave", { projectId });
      socket.disconnect();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user.id]);

  const broadcast = () => {
    socketRef.current?.emit("board:change", { projectId });
  };

  return { connected, viewers, broadcast };
}
