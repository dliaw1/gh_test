const fs = require('fs');
const ssh2 = require('ssh2');
const blessed = require('blessed');

const sm = require('./server_messages.js');
var rooms = require('./default_rooms.js');

// Chat users
var streams = [];
var usernames = [];

var MAX_NAME_LENGTH = 15;

var server = 
new ssh2.Server({
  hostKeys: [fs.readFileSync('host.key')]
}, (client) => {
  console.log('connection');

  client.on('authentication', (ctx) => {
    // Force keyboard auth to do custom checks
    if (ctx.method !== 'keyboard-interactive') {
      return ctx.reject(['keyboard-interactive']);
    }

    var username;

    // Prompt for username until satisfied
    // namePrompt calls back to itself to loop
    namePrompt([ctx.username]);

    function namePrompt(input) {
      try {
        var name = input[0];
      }
      catch(e) {
        console.log(e);
        ctx.reject();
        return;
      }
      var validation = verifyName(name, false);
      if (!validation.isValidName) {
        ctx.prompt(validation.err + sm.usernamePrompt, namePrompt);
      }
      else {
        console.log('accept');
        console.log(name + '->' + usernames);
        usernames.push(name);
        client.username = name;
        ctx.accept();
      }
    }
  });

  // Begin session
  client.once('ready', () => {
    console.log('ready');
    client.once('session', (accept, reject) => {
      var ttyInfo;

      console.log('session');
      var session = accept();
      var stream;
      
      // Get initial ptty info
      session.once('pty', (accept, reject, info) => {
        console.log('pty - ', info);
        ttyInfo = info;
        if (accept) {
          accept();
        }
      });

      // Update ptty info on client window resize
      session.on('window-change', (accept, reject, info) => {
        console.log('window-change - ', info);
        for (var k in info) {
          ttyInfo[k] = info[k];
        }
        if (stream !== undefined) {
          stream.rows = ttyInfo.rows;
          stream.cols = ttyInfo.cols;
          stream.term = ttyInfo.term;
        }
        if (accept) {
          accept();
        }
      });

      session.on('x11', (accept, reject, info) => {
        console.log('x11');
      });

      session.on('env', (accept, reject, info) => {
        console.log('env - ', info);
      });

      session.on('signal', (accept, reject, info) => {
        console.log('signal');
      });

      session.on('auth-agent', (accept, reject, info) => {
        console.log('auth-agent');
      });

      session.on('shell', (accept, reject) => {
        console.log('shell');
        stream = accept();
        stream.username = client.username;
        stream.columns = ttyInfo.cols;
        stream.rows = ttyInfo.rows;
        stream.isTTY = true;
        streams.push(stream);

        var screen = new blessed.screen({
          autoPadding: true,
          smartCSR: true,
          title: 'GH Chat',
          input: stream,
          output: stream,
          terminal: ttyInfo.term,
          cursor: {
            artificial: true,
            color: 'black',
            shape: 'line',
            blink: true
          }
        });

        var roomTitle = new blessed.box({
          top: 0,
          height: 1,
          width: '100%',
          bg: 'blue',
          fg: 'white',
          content: sm.selectRoomTitle,
          align: 'center'
        });

        var chatlog = new blessed.log({
          top: 1,
          left: 0,
          bottom: 1,
          width: '100%',
          border: {
            type: 'line',
            fg: 'white'
          },
          //scrollOnInput: true,
          scrollable: true,
          alwaysScroll: true,
          scrollbar: {
            fg: 'blue'
          },
          mouse: true
        });

        var chatInput = new blessed.textbox({
          bottom: 0,
          height: 1,
          width: '100%',
          padding: 0,
          bg: 'white',
          fg: 'black',
          inputOnFocus: true
        });

        screen.append(roomTitle);
        screen.append(chatlog);
        screen.append(chatInput);
        chatInput.focus();
        screen.render();

        chatInput.on('submit', (line) => {
          chatInput.clearValue();
          chatInput.focus();
          line = line.trim().replace(/\s+/g, ' ');
          if (!line || line.length === 0) {
            return;
          }  
          chatlog.add(line);
          
          return;
          if (line[0] === '/') {
            handleChatCommand(line);
            return;
          }

          if (stream.room === undefined) {
            //sysMessage()
          }
          else {
            //broadcast(socket.username + ": " + Buffer.from(dataStr) + "\n", socket, socket.roomname);
          }
        });

        stream.on('close', () => {
          screen.destroy();
        });

        //function listRooms()

        // Handle chat commands
        // Returns -1 if quitting
        /*
        function chatCommandHandler(text) {
          var wordTokens = text.split(' ');
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
        */
      });

      session.on('exec', (accept, reject, info) => {
        console.log('exec');
      });

      session.on('stfp', (accept, reject, info) => {
        console.log('stfp');
      });

      session.on('subsystem', (accept, reject, info) => {
        console.log('subsystem');
      });

      session.on('close', (accept, reject, info) => {
        console.log('close');
        screen.destroy();
      });
    });
  });

  // Check that user/chatroom name is valid
  // Pass in true to chatroom parameter if checking chatroom name
  function verifyName(name, chatroom) {
    console.log('verifyName: ' + name);
    var isValidName = true;
    var message;
    console.log(name + '->?' + usernames);
    if (name.length < 1) {
      message = sm.blankNameEntry;
      isValidName = false;
    }
    else if (name.length > MAX_NAME_LENGTH) {
      message = sm.nameEntryTooLong;
      isValidName = false;
    }
    else if (name.match(/^[\w\-\.]+$/) === null) {
      message = sm.invalidCharsInName;
      isValidName = false;
    }
    else if (chatroom && rooms.hasOwnProperty(chatroom)) {
      message = sm.roomAlreadyExists;
      isValidName = false;
    }
    else if (!chatroom && usernames.indexOf(name) !== -1) {
      message = sm.usernameTaken;
      isValidName = false;
    }

    return { 'isValidName': isValidName, 'err': message };
  }

});

server.listen(9001, () => {
  console.log('listening on port 9001');
});

/*
var server = net.createServer(socket => {
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
*/


console.log("Chat server running on port 9001\n");
