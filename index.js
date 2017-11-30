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
      if (chatCommandHandler(socket, dataStr, isUsernameSet) === -1) {
        return;
      }
    }
    // New user - verify username
    else if (!isUsernameSet) {
      if (verifyUsername(dataStr)) {
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
    //broadcast(socket.name + " left the chat.\n");
  });

  // Send message to all clients in same room
  function broadcast(message, sender, roomname) {
    try {
      if (roomname === undefined) {
        return;
      }
      var roomClients = rooms[roomname].clients;
      for (var i in roomClients) {
        var client = roomClients[i]
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
  function chatCommandHandler(socket, dataStr, isUsernameSet) {
    var wordTokens = dataStr.split(' ');
    if (wordTokens[0].match(/^\/(h|help)$/)) {
      socket.write(sm.help);
    }
    else if (wordTokens[0].match(/^\/(q|quit)$/)) {
      socket.end(sm.bye);
      return -1;
    }
    // Only allow help and quit commands while username has not been set
    else if (wordTokens[0].match(/^\/(r|rooms)$/) && isUsernameSet) {
      socket.write(sm.availableRooms);
      for (roomname in rooms) {
        socket.write("\t" + roomname + " (" + rooms[roomname].clients.length + ")\n");
      }
    }
    else if (wordTokens[0].match(/^\/(j|join)$/) && isUsernameSet) {
      joinRoom(socket, wordTokens[1]);
    }
    else if (wordTokens[0].match(/^\/(l|leave)$/) && isUsernameSet) {
      // TO_DO: Leave chatroom handler
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
  function verifyUsername(username) {
    var isValidUsername = true;
    if (username.length < 1) {
      socket.write(sm.blankNameEntry);
      isValidUsername = false;
    }
    else if (username.match(/^[\w\-\.]+$/) === null) {
      socket.write(sm.invalidCharsInName);
      isValidUsername = false;
    }
    else if (usernames.indexOf(username) !== -1) {
      socket.write(sm.nameTaken);
      isValidUsername = false;
    }

    return isValidUsername;
  }

  function joinRoom(socket, roomname) {
    if (roomname === undefined) {
      socket.write(sm.roomnameEmpty);
    }
    else if (!rooms.hasOwnProperty(roomname)) {
      socket.write(sm.invalidRoomname);
    }
    else if (socket.roomname === roomname) {
      socket.write(sm.alreadyInRoom);
    }
    else {
      socket.roomname = roomname;
      rooms[roomname].clients.push(socket);
      rooms[roomname].usernames.push(socket.username);
      broadcast(socket.username + sm.userEnter, socket, roomname);
    }
  }

});
server.listen(9001);


console.log("Chat server running on port 9001\n");
