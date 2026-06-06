import { Server } from "socket.io";

export function registerChatSocket(io: Server) {
  io.on("connection", (socket) => {
    socket.on("chat:join", (conversationId: string) => {
      socket.join(conversationId);
    });

    socket.on("chat:message", (payload) => {
      io.to(payload.conversationId).emit("chat:message", payload);
    });

    socket.on("chat:typing", (payload) => {
      socket.to(payload.conversationId).emit("chat:typing", payload);
    });

    socket.on("chat:stop-typing", (payload) => {
      socket.to(payload.conversationId).emit("chat:stop-typing", payload);
    });
  });
}
