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

  //---LOBBY FUNCTIONS 

  function displayRooms(rooms) {
    allRooms = rooms;
    const filtered = searchRooms.value 
      ? rooms.filter(r => r.name.toLowerCase().includes(searchRooms.value.toLowerCase()))
      : rooms;

    roomsList.replaceChildren();

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "rooms-empty";
      empty.textContent = "No rooms available. Create one!";
      roomsList.appendChild(empty);
      return;
    }

    filtered.forEach(room => {
      const isFull = room.users.length >= room.maxUsers;
      const card = document.createElement("div");
      card.className = "room-card" + (isFull ? " room-full" : "");
      card.dataset.roomId = room.id;

      if (!isFull) {
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-label", "Join room " + room.name);
        card.addEventListener("click", () => handleRoomClick(room.id));
        card.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleRoomClick(room.id);
          }
        });
      }

      const header = document.createElement("div");
      header.className = "room-card-header";

      const titleWrap = document.createElement("div");
      const name = document.createElement("div");
      name.className = "room-name";
      name.textContent = room.name;
      const owner = document.createElement("div");
      owner.className = "room-owner";
      owner.textContent = "Owner: " + room.owner;
      titleWrap.append(name, owner);

      const privacy = document.createElement("div");
      privacy.className = "room-privacy";
      privacy.textContent = room.isPrivate ? "Private" : "Public";

      header.append(titleWrap, privacy);

      const stats = document.createElement("div");
      stats.className = "room-stats";

      const count = document.createElement("div");
      count.className = "room-stat";
      count.textContent = room.users.length + " / " + room.maxUsers + " users";

      const type = document.createElement("div");
      type.className = "room-stat";
      type.textContent = room.isPrivate ? "Password protected" : "Open to anyone";

      stats.append(count, type);

      if (isFull) {
        const full = document.createElement("div");
        full.className = "room-stat room-full-label";
        full.textContent = "FULL";
        stats.appendChild(full);
      }

      card.append(header, stats);
      roomsList.appendChild(card);
    });
  }

  function handleRoomClick(roomId) {
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

  confirmCreateRoom.addEventListener("click", () => {
    const owner = document.getElementById("createUsername").value.trim();
    const name = newRoomName.value.trim();
    const max = parseInt(maxUsers.value);

    if (!owner || owner.length < 2) {
      alert("Username must be at least 2 characters!");
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
    currentUsername = owner;

    // Store password for auto-join BEFORE emitting
    const pendingPassword = password;
    socket.emit("create-room", { roomName: name, password, isPrivate: isPrivate.checked, maxUsers: max, owner });
    createRoomModal.classList.remove('active');
    resetCreateForm();

    // Use a flag instead of stacking once() listeners
    socket.once("room-created", (createdRoom) => {
      socket.emit("join-room", {
        roomId: createdRoom.id,
        username: currentUsername,
        password: pendingPassword
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

  //---CHAT FUNCTIONS 

  // Send message
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    socket.emit("chat-message", text);
    input.value = "";

    // Clear typing timeout on send
    clearTimeout(typingTimeout);
    socket.emit("typing", false);
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
        chat.replaceChildren();
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
    lobbyView.style.display = "block";
    chatView.style.display = "none";
    currentRoom = null;
    chat.replaceChildren();
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

  //---SOCKET EVENTS

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

      const meta = document.createElement("div");
      meta.className = "message-meta";
      const who = document.createElement("span");
      who.textContent = isMine ? "You" : msg.username;
      const timeEl = document.createElement("span");
      timeEl.className = "message-time";
      timeEl.textContent = time;
      meta.append(who, timeEl);

      const body = document.createElement("div");
      body.textContent = msg.text;

      div.append(meta, body);
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
    if(currentRoom && currentRoom.id === roomId) {
     const div = document.createElement("div");
     div.className = "system";
     div.textContent = "Room was deleted by the owner.";
     chat.appendChild(div);
      
     setTimeout(() => {
       lobbyView.style.display = "block";
       chatView.style.display = "none";
       currentRoom = null;
       chat.replaceChildren();
     }, 2000);
   }
 });

  //---HELPER FUNCTIONS

  function updateRoomSubtitle(room) {
    roomSubtitle.textContent = `${room.users.length} / ${room.maxUsers} users`;
  }

  function updateRoomInfo(room) {
    roomInfo.replaceChildren();

    const rows = [
      ["Room:", room.name],
      ["Owner:", room.owner],
      ["Users:", `${room.users.length} / ${room.maxUsers}`],
      ["Type:", room.isPrivate ? "Private" : "Public"]
    ];

    rows.forEach(([label, value]) => {
      const p = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label + " ";
      p.append(strong, document.createTextNode(value));
      roomInfo.appendChild(p);
    });

    const hr = document.createElement("hr");
    hr.className = "info-separator";

    const foot = document.createElement("p");
    foot.className = "room-info-foot";
    foot.textContent = "Real-time Socket.IO chat";

    roomInfo.append(hr, foot);
  }

  function resetCreateForm() {
    document.getElementById("createUsername").value = "";
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

  console.log("Realtime chat initialized");
});
