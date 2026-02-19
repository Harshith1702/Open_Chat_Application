let onlineUsers = 0; // users

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Room management
const rooms = new Map(); // Store all rooms
const MAX_ROOMS = 101;

/* ================= SOCKET.IO SETUP ================= */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* ================= FRONTEND FILES ================= */
// Serve frontend files
app.use(express.static(path.join(__dirname, "uiLayer")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "uiLayer", "homeView.html"));
});

/* ================= SOCKET LOGIC ================= */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send current rooms list
  socket.emit("rooms-list", Array.from(rooms.values()));

  // Create room
  socket.on("create-room", ({ roomName, password, isPrivate, maxUsers, owner }) => {
    if (rooms.size >= MAX_ROOMS) {
      socket.emit("error", "Maximum 101 rooms reached");
      return;
    }

    if (rooms.has(roomName.toLowerCase())) {
      socket.emit("error", "Room name already exists");
      return;
    }

    const room = {
      id: roomName.toLowerCase(),
      name: roomName,
      owner,
      password: password || "",
      isPrivate,
      maxUsers,
      users: [],
      typingUsers: []
    };

    rooms.set(room.id, room);

    socket.emit("room-created", room);
    io.emit("rooms-list", Array.from(rooms.values()));
  });

  // Join room
  socket.on("join-room", ({ roomId, username, password }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    if (room.users.some(u => u.username === username)) {
      socket.emit("error", "Username already in this room");
      return;
    }

    if (room.users.length >= room.maxUsers) {
      socket.emit("error", "Room is full");
      return;
    }

    if (room.isPrivate && room.password !== password) {
      socket.emit("error", "Incorrect password");
      return;
    }

    // Add user to room
    socket.join(roomId);
    socket.currentRoom = roomId;
    socket.username = username;

    room.users.push({ id: socket.id, username });
    rooms.set(roomId, room);

    socket.emit("joined-room", room);

    io.to(roomId).emit("room-message", {
      type: "system",
      text: `${username} joined the room`,
      timestamp: new Date()
    });

    io.to(roomId).emit("room-updated", room);
    io.emit("rooms-list", Array.from(rooms.values()));
  });

  // Leave room
  socket.on("leave-room", () => {
    leaveRoom(socket);
  });

  // Send message
  socket.on("chat-message", (msg) => {
    if (!socket.currentRoom) return;

    io.to(socket.currentRoom).emit("room-message", {
      type: "user",
      username: socket.username,
      text: msg,
      timestamp: new Date()
    });

    // Clear typing indicator
    const room = rooms.get(socket.currentRoom);
    if (room) {
      room.typingUsers = room.typingUsers.filter(u => u !== socket.username);
      io.to(socket.currentRoom).emit("typing-users", room.typingUsers);
    }
  });

  // Typing indicator
  socket.on("typing", (isTyping) => {
    if (!socket.currentRoom) return;

    const room = rooms.get(socket.currentRoom);
    if (!room) return;

    if (isTyping && !room.typingUsers.includes(socket.username)) {
      room.typingUsers.push(socket.username);
    } else if (!isTyping) {
      room.typingUsers = room.typingUsers.filter(u => u !== socket.username);
    }

    io.to(socket.currentRoom).emit("typing-users", room.typingUsers);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    leaveRoom(socket);
  });
});

// Helper function to leave room
function leaveRoom(socket) {
  if (!socket.currentRoom) return;

  const roomId = socket.currentRoom;
  const room = rooms.get(roomId);
  if (!room) return;

  const isOwner = room.owner === socket.username;

  if (isOwner) {
    // Notify all non-owner users
    socket.to(roomId).emit("room-deleted", roomId);

    // Force all sockets to leave instantly
    io.in(roomId).socketsLeave(roomId);

    // Delete room
    rooms.delete(roomId);

  } else {
    // Normal user leaving
    room.users = room.users.filter(u => u.id !== socket.id);
    room.typingUsers = room.typingUsers.filter(u => u !== socket.username);

    io.to(roomId).emit("room-message", {
      type: "system",
      text: `${socket.username} left the room`,
      timestamp: new Date()
    });

    io.to(roomId).emit("room-updated", room);
  }

  socket.leave(roomId);
  socket.currentRoom = null;

  io.emit("rooms-list", Array.from(rooms.values()));
}

/* ================= SERVER START ================= */
const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`RTRP Server running on port ${PORT}`);
});
