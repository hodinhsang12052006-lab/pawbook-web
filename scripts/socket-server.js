const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bitpaw WebRTC Signaling Server is running...\n");
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log(`[Socket] New connection established: ${socket.id}`);

  // Map userId to socket.id
  socket.on("add_user", (userId) => {
    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`[Socket] User ${userId} mapped to socket.id ${socket.id}`);
      socket.join(userId);
    }
  });

  socket.on("join", (userId) => {
    if (userId) {
      userSocketMap.set(userId, socket.id);
      console.log(`[Socket] User ${userId} joined and mapped to socket.id ${socket.id}`);
      socket.join(userId);
    }
  });

  // Listener for incoming call triggers
  socket.on("call_user", (data) => {
    console.log(`[Socket] Call request from user ${data.from} (${data.name}) to user ${data.userToCall}`);
    
    const receiverSocketId = userSocketMap.get(data.userToCall);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming_call", {
        signal: data.signalData,
        from: data.from,
        callerName: data.name
      });
      console.log(`[Socket] Signalled call to mapped socket ${receiverSocketId}`);
    } else {
      // Fallback to room routing
      io.to(data.userToCall).emit("incoming_call", {
        signal: data.signalData,
        from: data.from,
        callerName: data.name
      });
      console.log(`[Socket] Receiver ${data.userToCall} fallback to room routing`);
    }
  });

  // Listener for accept/answer signaling responses
  socket.on("answer", (data) => {
    console.log(`[Socket] Call answer from user ${data.from} to caller ${data.to}`);
    
    const callerSocketId = userSocketMap.get(data.to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_accepted", {
        signal: data.signal,
        from: data.from
      });
    } else {
      io.to(data.to).emit("call_accepted", {
        signal: data.signal,
        from: data.from
      });
    }
  });

  socket.on("answer_call", (data) => {
    console.log(`[Socket] Call answer_call to caller socket: ${data.to}`);
    
    // Broadcast answer to the caller
    io.to(data.to).emit("call_accepted", {
      signal: data.signal,
      from: socket.id // or map back user ID
    });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Connection closed: ${socket.id}`);
    for (const [uid, sid] of userSocketMap.entries()) {
      if (sid === socket.id) {
        userSocketMap.delete(uid);
        console.log(`[Socket] Deleted socket mapping for user: ${uid}`);
        break;
      }
    }
  });
});

const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`=== SIGNALLING SOCKET SERVER RUNNING ON PORT ${PORT} ===`);
});
