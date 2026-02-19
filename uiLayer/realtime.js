document.addEventListener("DOMContentLoaded", () => {
  console.log("Realtime JS loaded");

  const socket = io();

  // Views
  const lobbyView = document.getElementById("lobby-view");
  const chatView = document.getElementById("chat-view");

  // Lobby elements
  const roomsList = document.getElementById("roomsList");
  const createRoomBtn = document.getElementById("createRoomBtn");
  const searchRooms = document.getElementById("searchRooms");

  // Modals
  const createRoomModal = document.getElementById("createRoomModal");
  const joinRoomModal = document.getElementById("joinRoomModal");
  const closeCreateModal = document.getElementById("closeCreateModal");
  const closeJoinModal = document.getElementById("closeJoinModal");

  // Create room form
  const newRoomName = document.getElementById("newRoomName");
  const maxUsers = document.getElementById("maxUsers");
  const isPrivate = document.getElementById("isPrivate");
  const passwordGroup = document.getElementById("passwordGroup");
  const roomPassword = document.getElementById("roomPassword");
  const confirmCreateRoom = document.getElementById("confirmCreateRoom");

  // Join room form
  const joinUsername = document.getElementById("joinUsername");
  const joinPassword = document.getElementById("joinPassword");
  const joinPasswordGroup = document.getElementById("joinPasswordGroup");
  const confirmJoinRoom = document.getElementById("confirmJoinRoom");

  // Chat elements
  const chat = document.getElementById("chat-box");
  const input = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const roomTitle = document.getElementById("roomTitle");
  const roomSubtitle = document.getElementById("roomSubtitle");
  const leaveRoomBtn = document.getElementById("leaveRoomBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const typingIndicator = document.getElementById("typingIndicator");
  const emojiBtn = document.getElementById("emojiBtn");
  const infoBtn = document.getElementById("infoBtn");
  const infoPanel = document.getElementById("infoPanel");
  const closeInfo = document.getElementById("closeInfo");
  const roomInfo = document.getElementById("roomInfo");

  // State
  let currentRoom = null;
  let currentUsername = "";
  let selectedRoomForJoin = null;
  let allRooms = [];
  let typingTimeout = null;

  // ===== LOBBY FUNCTIONS =====

  // Display rooms
  function displayRooms(rooms) {
    allRooms = rooms;
    const filtered = searchRooms.value 
      ? rooms.filter(r => r.name.toLowerCase().includes(searchRooms.value.toLowerCase()))
      : rooms;

    if (filtered.length === 0) {
      roomsList.innerHTML = '<p style="text-align:center;color:#666;padding:40px;">No rooms available. Create one!</p>';
      return;
    }

    roomsList.innerHTML = filtered.map(room => {
      const isFull = room.users.length >= room.maxUsers;
      return `
        <div class="room-card ${isFull ? 'room-full' : ''}" data-room-id="${room.id}" ${!isFull ? 'onclick="handleRoomClick(\'' + room.id + '\')"' : ''}>
          <div class="room-card-header">
            <div>
              <div class="room-name">${escapeHtml(room.name)}</div>
              <div class="room-owner">Owner: ${escapeHtml(room.owner)}</div>
            </div>
            <div class="room-privacy">${room.isPrivate ? '🔒' : '🔓'}</div>
          </div>
          <div class="room-stats">
            <div class="room-stat">👥 ${room.users.length} / ${room.maxUsers}</div>
            <div class="room-stat">${room.isPrivate ? 'Private' : 'Public'}</div>
            ${isFull ? '<div class="room-stat" style="color:#f44336;">FULL</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Handle room click
  window.handleRoomClick = function(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    selectedRoomForJoin = room;
    
    // Show password field if private
    if (room.isPrivate) {
      joinPasswordGroup.style.display = 'block';
    } else {
      joinPasswordGroup.style.display = 'none';
    }

    joinRoomModal.classList.add('active');
    joinUsername.focus();
  };

  // Create room modal
  createRoomBtn.addEventListener("click", () => {
    createRoomModal.classList.add('active');
    newRoomName.focus();
  });

  closeCreateModal.addEventListener("click", () => {
    createRoomModal.classList.remove('active');
    resetCreateForm();
  });

  closeJoinModal.addEventListener("click", () => {
    joinRoomModal.classList.remove('active');
    resetJoinForm();
  });

  // Toggle password field
  isPrivate.addEventListener("change", () => {
    passwordGroup.style.display = isPrivate.checked ? 'block' : 'none';
  });

// Create room
confirmCreateRoom.addEventListener("click", () => {
  const name = newRoomName.value.trim();
  const max = parseInt(maxUsers.value);
  const owner = prompt("Enter your username to create this room:");

  if (!owner || !owner.trim()) {
    alert("Username is required!");
    return;
  }

  if (!name || name.length < 2) {
    alert("Room name must be at least 2 characters!");
    return;
  }

  if (max < 2 || max > 100) {
    alert("Max users must be between 2 and 100!");
    return;
  }

  const password = isPrivate.checked ? roomPassword.value : "";

  if (isPrivate.checked && !password) {
    alert("Password required for private rooms!");
    return;
  }

  // Store data for auto-join
  const roomData = {
    roomName: name,
    password,
    isPrivate: isPrivate.checked,
    maxUsers: max,
    owner: owner.trim()
  };

  currentUsername = owner.trim();

  socket.emit("create-room", roomData);

  createRoomModal.classList.remove('active');
  resetCreateForm();

  // Set flag to auto-join after room is created
  socket.once("room-created", (createdRoom) => {
    socket.emit("join-room", {
      roomId: createdRoom.id,
      username: currentUsername,
      password: password
    });
  });
});

  // Join room
  confirmJoinRoom.addEventListener("click", () => {
    const username = joinUsername.value.trim();
    const password = joinPassword.value;

    if (!username || username.length < 2) {
      alert("Username must be at least 2 characters!");
      return;
    }

    if (!selectedRoomForJoin) return;

    currentUsername = username;

    socket.emit("join-room", {
      roomId: selectedRoomForJoin.id,
      username,
      password
    });

    joinRoomModal.classList.remove('active');
    resetJoinForm();
  });

  // Search rooms
  searchRooms.addEventListener("input", () => {
    displayRooms(allRooms);
  });

  // ===== CHAT FUNCTIONS =====

  // Send message
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    socket.emit("chat-message", text);
    input.value = "";
  }

  sendBtn.addEventListener("click", sendMessage);
  
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Typing indicator
  input.addEventListener("input", () => {
    socket.emit("typing", true);

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing", false);
    }, 1000);
  });

  // Emoji
  if (emojiBtn) {
    emojiBtn.addEventListener("click", () => {
      input.value += "😀";
      input.focus();
    });
  }

  // Clear chat
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      if (confirm("Clear all messages in this chat?")) {
        chat.innerHTML = "";
      }
    });
  }

  // Leave room with confirmation
leaveRoomBtn.addEventListener("click", () => {
  const isOwner = currentRoom && currentRoom.owner === currentUsername;
  const message = isOwner 
    ? "Do you want to exit and delete this room?" 
    : "Do you want to leave this room?";
  
  if (confirm(message)) {
    leaveRoom();
  }
});

  function leaveRoom() {
  socket.emit("leave-room");
 /* setTimeout(() => {
    location.reload();
  }, 300); */
}

  // Info panel
  if (infoBtn) {
    infoBtn.addEventListener("click", () => {
      infoPanel.classList.add("open");
    });
  }

  if (closeInfo) {
    closeInfo.addEventListener("click", () => {
      infoPanel.classList.remove("open");
    });
  }

  // ===== SOCKET EVENTS =====

  // Rooms list
  socket.on("rooms-list", (rooms) => {
    displayRooms(rooms);
  });

  // Joined room
  socket.on("joined-room", (room) => {
    currentRoom = room;
    lobbyView.style.display = "none";
    chatView.style.display = "flex";

    roomTitle.textContent = room.name;
    updateRoomSubtitle(room);
    updateRoomInfo(room);
  });

  // Room updated (user count changed)
  socket.on("room-updated", (room) => {
  if (currentRoom && currentRoom.id === room.id) {
    currentRoom = room;
    updateRoomSubtitle(room);
    updateRoomInfo(room);
  }
  });

  // Room message with timestamps
  socket.on("room-message", (msg) => {
    const div = document.createElement("div");

    if (msg.type === "system") {
      div.className = "system";
      const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      div.textContent = `${msg.text} • ${time}`;
    } else {
      const isMine = msg.username === currentUsername;
      div.className = "message " + (isMine ? "my" : "other");

      const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      div.innerHTML = `
        <div style="font-size:12px;opacity:0.7;margin-bottom:4px;">
          ${isMine ? "You" : escapeHtml(msg.username)}
          <span style="margin-left:8px;font-size:10px;opacity:0.6;">${time}</span>
        </div>
        <div>${escapeHtml(msg.text)}</div>
      `;
    }

    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  });

  // Typing users
  socket.on("typing-users", (users) => {
    const others = users.filter(u => u !== currentUsername);
    
    if (others.length === 0) {
      typingIndicator.textContent = "";
    } else if (others.length === 1) {
      typingIndicator.textContent = `${others[0]} is typing...`;
    } else {
      typingIndicator.textContent = `${others.length} people are typing...`;
    }
  });

  // Error
  socket.on("error", (msg) => {
    alert(msg);
  });
  // When owner deletes the room
  socket.on("room-deleted", (roomId) => {
   if (currentRoom && currentRoom.id === roomId) {
     alert("Room was deleted by the owner");

     // Go back to lobby view
     lobbyView.style.display = "block";
     chatView.style.display = "none";
 
     currentRoom = null;
     chat.innerHTML = "";
   }
 });

  // ===== HELPER FUNCTIONS =====

  function updateRoomSubtitle(room) {
    roomSubtitle.textContent = `👥 ${room.users.length} / ${room.maxUsers} users`;
  }

  function updateRoomInfo(room) {
    roomInfo.innerHTML = `
      <p><strong>Room:</strong> ${escapeHtml(room.name)}</p>
      <p><strong>Owner:</strong> 👑 ${escapeHtml(room.owner)}</p>
      <p><strong>Users:</strong> ${room.users.length} / ${room.maxUsers}</p>
      <p><strong>Type:</strong> ${room.isPrivate ? '🔒 Private' : '🔓 Public'}</p>
      <hr style="margin:16px 0;border-color:#333;">
      <p style="font-size:12px;color:#999;">Real-time Socket.IO chat</p>
    `;
  }

  function resetCreateForm() {
    newRoomName.value = "";
    maxUsers.value = "10";
    isPrivate.checked = false;
    roomPassword.value = "";
    passwordGroup.style.display = "none";
  }

  function resetJoinForm() {
    joinUsername.value = "";
    joinPassword.value = "";
    joinPasswordGroup.style.display = "none";
    selectedRoomForJoin = null;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  console.log("Realtime chat initialized");
});
