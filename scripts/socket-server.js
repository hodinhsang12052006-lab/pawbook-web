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

// Bản đồ lưu trữ ID người dùng và Socket ID
const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log(`[Socket] New connection established: ${socket.id}`);

  // 1. ÉP KIỂU STRING KHI THÊM USER VÀO BẢN ĐỒ CHỐNG LỖI TYPE
  socket.on("add_user", (userId) => {
    if (userId) {
      const strUserId = String(userId);
      userSocketMap.set(strUserId, socket.id);
      socket.join(strUserId); // Join room bằng String
      console.log(`[Socket] User ${strUserId} mapped to socket.id ${socket.id}`);
    }
  });

  socket.on("join", (userId) => {
    if (userId) {
      const strUserId = String(userId);
      userSocketMap.set(strUserId, socket.id);
      socket.join(strUserId);
      console.log(`[Socket] User ${strUserId} joined and mapped to socket.id ${socket.id}`);
    }
  });

  // 2. LUỒNG CUỘC GỌI WEBRTC
  socket.on("call_user", (data) => {
    const targetId = String(data.userToCall);
    console.log(`[Socket] Call request from user ${data.from} to user ${targetId}`);

    const receiverSocketId = userSocketMap.get(targetId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming_call", {
        signal: data.signalData,
        from: String(data.from),
        callerName: data.name
      });
    } else {
      io.to(targetId).emit("incoming_call", {
        signal: data.signalData,
        from: String(data.from),
        callerName: data.name
      });
    }
  });

  socket.on("answer_call", (data) => {
    const targetId = String(data.to);
    const callerSocketId = userSocketMap.get(targetId);

    if (callerSocketId) {
      io.to(callerSocketId).emit("call_accepted", { signal: data.signal, from: String(socket.id) });
    } else {
      io.to(targetId).emit("call_accepted", { signal: data.signal, from: String(socket.id) });
    }
  });

  socket.on("answer", (data) => {
    const targetId = String(data.to);
    const callerSocketId = userSocketMap.get(targetId);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_accepted", { signal: data.signal, from: data.from });
    } else {
      io.to(targetId).emit("call_accepted", { signal: data.signal, from: data.from });
    }
  });

  // 3. LUỒNG TIN NHẮN REAL-TIME
  socket.on("send_message", (messageData) => {
    const recId = String(messageData.receiverId);
    console.log(`[Socket] Text message from ${messageData.senderId} to ${recId}`);

    const receiverSocketId = userSocketMap.get(recId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", messageData);
      console.log(`[Socket] -> Forwarded directly to socket ${receiverSocketId}`);
    } else {
      io.to(recId).emit("receive_message", messageData);
      console.log(`[Socket] -> Fallback forwarded to room ${recId}`);
    }
  });

  // 4. LUỒNG TYPING (DẤU BA CHẤM)
  socket.on("typing", (data) => {
    const recId = String(data.receiverId);
    const receiverSocketId = userSocketMap.get(recId);
    if (receiverSocketId) io.to(receiverSocketId).emit("user_typing", { senderId: String(data.senderId) });
    else io.to(recId).emit("user_typing", { senderId: String(data.senderId) });
  });

  socket.on("stop_typing", (data) => {
    const recId = String(data.receiverId);
    const receiverSocketId = userSocketMap.get(recId);
    if (receiverSocketId) io.to(receiverSocketId).emit("user_stopped_typing", { senderId: String(data.senderId) });
    else io.to(recId).emit("user_stopped_typing", { senderId: String(data.senderId) });
  });

  // 5. NGẮT KẾT NỐI
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