const net = require('net');
const sm = require('./server_messages.js');
var rooms = require('./default_rooms.js');

// Chat users
var clients = [];
var usernames = [];


var server = net.createServer(socket => {
  // Add new client to list
  clients.push(socket);

  socket.write(sm.welcome);
  socket.write(sm.usernamePrompt);

  // Incoming message handler
  socket.on('data', data => {
    var dataStr = data.toString('utf8').trim();
    var isUsernameSet = (socket.username !== undefined);

    // Chat commands
    if (dataStr[0] === '/') {
      if (chatCommandHandler(dataStr, isUsernameSet) === -1) {
        return;
      }
    }
    // New user - verify username
    else if (!isUsernameSet) {
      if (verifyName(dataStr)) {
        usernames.push(dataStr);
        socket.username = dataStr;
        socket.write(sm.welcomeUser + dataStr + "\n");
        socket.write(sm.chooseRoom);
        socket.write(sm.readyPrompt);

      }
      else {
        socket.write(sm.usernamePrompt);
      }
      return;
    }
    else if (dataStr.length < 1) {
      socket.write(sm.readyPrompt);
      return;
    }
    else {
      broadcast(socket.username + ": " + Buffer.from(dataStr) + "\n", socket, socket.roomname);
    }
    socket.write(sm.readyPrompt);
  });

  // Remove the client from the list when it leaves
  socket.on('end', () => {
    clients.splice(clients.indexOf(socket), 1);
    usernames.splice(usernames.indexOf(socket.username), 1);
  });

  // Send message to all clients in same room
  function broadcast(message, sender, roomname) {
    try {
      if (roomname === undefined) {
        return;
      }
      var roomClients = rooms[roomname].clients;
      for (var i in roomClients) {
        var client = roomClients[i];
        client.write(message);
        if (client !== sender) {
          client.write(sm.readyPrompt);
        }
      }
      console.log(message);
    }
    catch(e) {
      console.log(e);
    }
  }

  // Handle chat commands
  // Returns -1 if quitting
  function chatCommandHandler(dataStr, isUsernameSet) {
    var wordTokens = dataStr.split(' ');
    if (wordTokens[0].match(/^\/(h|help)$/)) {
      socket.write(sm.help);
    }
    else if (wordTokens[0].match(/^\/(q|quit)$/)) {
      if (socket.roomname !== undefined) {
        leaveRoom();
      }
      socket.end(sm.bye);
      return -1;
    }
    // Only allow help and quit commands while username has not been set
    else if (wordTokens[0].match(/^\/(r|rooms)$/) && isUsernameSet) {
      socket.write(sm.availableRooms);
      for (var roomname in rooms) {
        socket.write("\t" + roomname + " (" + rooms[roomname].clients.length + ")\n");
      }
    }
    else if (wordTokens[0].match(/^\/(c|create)$/) && isUsernameSet) {
      createRoom(wordTokens[1]);
    }
    else if (wordTokens[0].match(/^\/(j|join)$/) && isUsernameSet) {
      joinRoom(wordTokens[1]);
    }
    else if (wordTokens[0].match(/^\/(ul|list)$/) && isUsernameSet) {
      listUsers(wordTokens[1]);
    }
    else if (wordTokens[0].match(/^\/(l|leave)$/) && isUsernameSet) {
      leaveRoom();
    }
    else {
      socket.write(wordTokens[0] + sm.invalidCommand);
    }

    if (!isUsernameSet) {
      socket.write(sm.usernamePrompt);
      return;
    }
  }

  // Check that user/chatroom name is valid
  // Pass in true to chatroom if checking chatroom name
  function verifyName(name, chatroom) {
    var isValidName = true;
    if (name.length < 1) {
      socket.write(sm.blankNameEntry);
      isValidName = false;
    }
    else if (name.length > 31) {
      socket.write(sm.nameEntryTooLong);
      isValidName = false;
    }
    else if (name.match(/^[\w\-\.]+$/) === null) {
      socket.write(sm.invalidCharsInName);
      isValidName = false;
    }
    else if (chatroom && rooms.hasOwnProperty(chatroom)) {
      socket.write(sm.roomAlreadyExists);
      isValidName = false;
    }
    else if (!chatroom && usernames.indexOf(name) !== -1) {
      socket.write(sm.usernameTaken);
      isValidName = false;
    }

    return isValidName;
  }

  function createRoom(roomname) {
    if (roomname === undefined) {
      socket.write(sm.roomnameEmpty);
    }
    else if (rooms.hasOwnProperty(roomname)) {
      socket.write(sm.roomAlreadyExists);
    }
    else if (verifyName(roomname, true)) {
      rooms[roomname] = {
        clients: [],
        usernames: [],
      };
      socket.write(roomname + sm.roomCreated);
    }
  }

  function joinRoom(roomname) {
    if (roomname === undefined) {
      socket.write(sm.roomnameEmpty);
    }
    else if (!rooms.hasOwnProperty(roomname)) {
      socket.write(roomname + sm.invalidChatroom);
    }
    else if (socket.roomname === roomname) {
      socket.write(sm.alreadyInRoom);
    }
    else {
      socket.roomname = roomname;
      rooms[roomname].clients.push(socket);
      rooms[roomname].usernames.push(socket.username);
      broadcast(socket.username + sm.userEnter, socket, roomname);
      listUsers(roomname);
    }
  }

  function leaveRoom() {
    if (socket.roomname === undefined) {
      socket.write(sm.notInRoom);
      return;
    }
    var room = rooms[socket.roomname];
    var roomClients = room.clients;
    roomClients.splice(roomClients.indexOf(socket), 1);
    var roomUsers = room.usernames;
    roomUsers.splice(roomUsers.indexOf(socket.username));

    socket.write(sm.selfLeave + socket.roomname + "\n");
    broadcast(socket.username + sm.userLeave, socket, socket.roomname);
    socket.roomname = undefined;
  }

  function listUsers(roomname) {
    if (roomname === undefined || roomname.length < 1) {
      socket.write(sm.roomnameEmpty);
    }
    else if (!rooms.hasOwnProperty(roomname)) {
      socket.write(roomname + sm.invalidChatroom);
    }
    else {
      var numUsers = rooms[roomname].usernames.length;
      var userList = rooms[roomname].usernames.join(", ");
      socket.write(numUsers + sm.usersInRoom + roomname + "\n");
      if (userList.length) {
        socket.write(userList + "\n");
      }
    }
  }

});
server.listen(9001);


console.log("Chat server running on port 9001\n");
