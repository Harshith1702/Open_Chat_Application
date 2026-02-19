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
/* (CORS added for ngrok / multi-network access) */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/* ================= FRONTEND FILES ================= */
// Serve frontend files
app.use(express.static(path.join(__dirname, "uiLayer")));

// Serve main UI page
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
    
    // Notify creator that room is ready
    socket.emit("room-created", room);
    
    // Update rooms list for everyone
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

    // Notify user
    socket.emit("joined-room", room);

    // Notify room with timestamp
    io.to(roomId).emit("room-message", {
      type: "system",
      text: `${username} joined the room`,
      timestamp: new Date()
    });

    // Update room info for all users in the room
    io.to(roomId).emit("room-updated", room);

    // Update rooms list for everyone
    io.emit("rooms-list", Array.from(rooms.values()));
  });

  // Leave room
  socket.on("leave-room", () => {
    console.log("🔔 LEAVE-ROOM EVENT RECEIVED for socket:", socket.id);
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
  console.log("\n=== LEAVE ROOM START ===");
  console.log("Socket ID:", socket.id);
  console.log("Username:", socket.username);
  console.log("Current Room:", socket.currentRoom);
  
  if (!socket.currentRoom) {
    console.log("❌ No current room - EXITING");
    console.log("=== LEAVE ROOM END ===\n");
    return;
  }

  const room = rooms.get(socket.currentRoom);
  if (!room) {
    console.log("❌ Room not found in map - EXITING");
    console.log("=== LEAVE ROOM END ===\n");
    return;
  }

  console.log("✅ Room found:", room.name);
  console.log("Users BEFORE leave:", room.users.map(u => u.username));
  console.log("User count BEFORE:", room.users.length);

  const roomName = socket.currentRoom;
  const username = socket.username;

  socket.leave(roomName);
  console.log("✅ Socket left Socket.IO room");

  room.users = room.users.filter(u => u.id !== socket.id);
  room.typingUsers = room.typingUsers.filter(u => u !== username);

  console.log("Users AFTER leave:", room.users.map(u => u.username));
  console.log("User count AFTER:", room.users.length);

  if (room.users.length > 0) {
    console.log("✅ Room still has users - KEEPING room");
    io.to(roomName).emit("room-message", {
      type: "system",
      text: `${username} left the room`,
      timestamp: new Date()
    });
    rooms.set(roomName, room);
    io.to(roomName).emit("room-updated", room);
  }

  if (room.users.length === 0) {
    console.log("🗑️ DELETING ROOM:", roomName);
    rooms.delete(roomName);
    console.log("✅ Room deleted successfully");
    console.log("Total rooms remaining:", rooms.size);
    console.log("Remaining room IDs:", Array.from(rooms.keys()));
  }

  socket.currentRoom = null;
  console.log("✅ Socket.currentRoom set to null");

  console.log("📢 Broadcasting rooms-list to ALL clients");
  io.emit("rooms-list", Array.from(rooms.values()));
  console.log("✅ Rooms-list broadcasted");
  console.log("=== LEAVE ROOM END ===\n");
}

/* ================= SERVER START ================= */
const PORT = process.env.PORT || 4000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`RTRP Server running on port ${PORT}`);
});
