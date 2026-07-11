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

io.on("connection", (socket) => {
  console.log(`[Socket] New connection established: ${socket.id}`);

  // Allow user to join their private channel room by their User ID
  socket.on("join", (userId) => {
    if (userId) {
      socket.join(userId);
      console.log(`[Socket] User ${userId} joined room ${userId} (socket.id: ${socket.id})`);
    }
  });

  // Listener for incoming call triggers
  socket.on("call_user", (data) => {
    console.log(`[Socket] Call request from user ${data.from} (${data.name}) to user ${data.userToCall}`);
    
    // Broadcast incoming_call to the receiver's private room
    io.to(data.userToCall).emit("incoming_call", {
      signal: data.signalData,
      from: data.from,
      callerName: data.name
    });
  });

  // Listener for accept/answer signaling responses
  socket.on("answer", (data) => {
    console.log(`[Socket] Call answer from user ${data.from} to caller ${data.to}`);
    
    // Broadcast answer to the caller's private room
    io.to(data.to).emit("call_accepted", {
      signal: data.signal,
      from: data.from
    });
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Connection closed: ${socket.id}`);
  });
});

const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`=== SIGNALLING SOCKET SERVER RUNNING ON PORT ${PORT} ===`);
});
