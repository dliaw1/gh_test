const fs = require('fs');
const ssh2 = require('ssh2');
const blessed = require('blessed');

const sm = require('./server_messages.js');
const emotes = require('./emotes.js');
var rooms = require('./default_rooms.js');

var colors = {aqua: "#000fff", blue: "#0000ff", fuchsia: "#ff00ff",
              green: "#008000", lime: "#00ff00", maroon: "#800000", navy: "#000080",
              olive: "#808000", purple: "#800080", red: "#ff0000", silver: "#c0c0c0",
              teal: "#008080", white: "#fff", yellow: "yellow"};
var colorNames = Object.keys(colors);

// Chat users
var streams = [];
var usernames = [];

var MAX_NAME_LENGTH = 15;

var server = 
new ssh2.Server({
  hostKeys: [fs.readFileSync('host.key')]
}, (client) => {
  var stream;

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
        usernames.push(name);
        client.username = name;
        ctx.accept();
      }
    }
  });

  // Begin session
  client.once('ready', () => {
    var ttyInfo;
    var screen;
    var roomTitle;
    var chatlog;
    var chatInput;

    client.once('session', (accept, reject) => {
      var session = accept();
      
      // Get initial ptty info
      session.once('pty', (accept, reject, info) => {
        ttyInfo = info;
        if (accept) {
          accept();
        }
      });

      // Handle window resize
      session.on('window-change', (accept, reject, info) => {
        for (var k in info) {
          ttyInfo[k] = info[k];
        }
        if (stream !== undefined) {
          stream.rows = ttyInfo.rows;
          stream.columns = ttyInfo.cols;
          stream.term = ttyInfo.term;
          stream.emit('resize');
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
        stream = accept();
        setupStream();
        setupScreen();

        stream.on('close', () => {
          console.log('stream close');
        }); 
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
        console.log('close session');
      });

    });

    client.on('end', () => {
      console.log('client end');
      cleanupStream();
    });

    // Display message only to user
    function systemMessage(text) {
      stream.chatlog.add(sm.sysPrompt + text);
    }

    // Send message to all clients in same room
    // Pass true into system param if system broadcast
    function broadcast(message, roomname, system) {
      try {
        if (roomname === undefined) {
          stream.chatlog.add(stream.pName + ": " + message);
          screen.render();
          return;
        }
        var roomStreams = rooms[roomname].streams;
        for (var i in roomStreams) {
          var userStream = roomStreams[i];
          if (system) {
            userStream.chatlog.add(sm.sysPrompt + message);
          }
          else {
            userStream.chatlog.add(stream.pName + ": " + message);
          }
          userStream.screen.render();
        }
      }
      catch(e) {
        console.log(e);
      }
    }

    function listRooms() {
      var outstr = sm.availableRooms;
        for (var roomname in rooms) {
          outstr = outstr + "\t" + roomname + " (" + rooms[roomname].streams.length + ")\n";
        }
        systemMessage(outstr);
    }

    function createRoom(roomname) {
      if (roomname === undefined) {
        systemMessage(sm.roomnameEmpty);
      }
      else if (rooms.hasOwnProperty(roomname)) {
        systemMessage(sm.roomAlreadyExists);
      }
      else if (verifyName(roomname, true)) {
        rooms[roomname] = {
          streams: [],
          usernames: [],
        };
        systemMessage(roomname + sm.roomCreated);
      }
    }

    function joinRoom(roomname) {
      if (roomname === undefined) {
        systemMessage(sm.roomnameEmpty);
      }
      else if (!rooms.hasOwnProperty(roomname)) {
        systemMessage(roomname + sm.invalidChatroom);
      }
      else if (stream.roomname === roomname) {
        systemMessage(sm.alreadyInRoom + roomname);
      }
      else {
        if (stream.roomname !== undefined) {
          leaveRoom();
        }
        stream.roomname = roomname;
        rooms[roomname].streams.push(stream);
        rooms[roomname].usernames.push(stream.username);
        broadcast(stream.pName + sm.userEnter, roomname, true);
        listUsers(roomname);
        roomTitle.setContent('~' + roomname + '~');
      }
    }

    function leaveRoom() {
      if (stream.roomname === undefined) {
        systemMessage(sm.notInRoom);
        return;
      }
      var room = rooms[stream.roomname];
      var roomStreams = room.streams;
      roomStreams.splice(roomStreams.indexOf(stream), 1);
      var roomUsers = room.usernames;
      roomUsers.splice(roomUsers.indexOf(stream.username));

      systemMessage(sm.selfLeave + stream.roomname + "\n");
      broadcast(stream.pName + sm.userLeave, stream.roomname, true);
      stream.roomname = undefined;
      roomTitle.setContent(sm.selectRoomTitle);
    }

    function listUsers(roomname) {
      if (roomname === undefined || roomname.length < 1) {
        if (stream.roomname !== undefined) {
          roomname = stream.roomname;
        }
        else {
          systemMessage(sm.roomnameEmpty);
          return;
        }
      }
      if (!rooms.hasOwnProperty(roomname)) {
        systemMessage(roomname + sm.invalidChatroom);
      }
      else {
        var numUsers = rooms[roomname].usernames.length;
        var userList = rooms[roomname].usernames.join(", ");
        systemMessage(numUsers + sm.usersInRoom + roomname +
          (userList.length ? ("\n\t" + userList) : ''));
      }
    }

    // Handle chat commands
    function handleChatCommand(text) {
      var wordTokens = text.split(' ');
      if (wordTokens[0].match(/^\/(h|help)$/)) {
        systemMessage(sm.help);
      }
      else if (wordTokens[0].match(/^\/(q|quit)$/)) {
        if (stream.roomname) {
          leaveRoom();
        }
        systemMessage(sm.bye);
        screen.render();
        stream.end();
      }
      else if (wordTokens[0].match(/^\/(r|rooms)$/)) {
        listRooms();
      }
      else if (wordTokens[0].match(/^\/(c|create)$/)) {
        createRoom(wordTokens[1]);
      }
      else if (wordTokens[0].match(/^\/(j|join)$/)) {
        joinRoom(wordTokens[1]);
      }
      else if (wordTokens[0].match(/^\/(u|users)$/)) {
        listUsers(wordTokens[1]);
      }
      else if (wordTokens[0].match(/^\/(l|leave)$/)) {
        leaveRoom();
      }
      else {
        systemMessage(wordTokens[0] + sm.invalidCommand);
      }
    }

    function handleEmote(text) {
      var wordTokens = text.split(' ');
      var emoteCmd = wordTokens[0].substring(1) // Assume first char is '!'
      if (emotes.hasOwnProperty(emoteCmd)) {
        broadcast('\n' + emotes[emoteCmd], stream.roomname);
      }
    }

    // Build screen elements and initial display
    function setupScreen() {
      screen = new blessed.screen({
          autoPadding: true,
          smartCSR: true,
          title: sm.windowTitle + stream.username,
          input: stream,
          output: stream,
          terminal: ttyInfo.term,
          cursor: {
            artificial: true,
            color: 'black',
            shape: 'line',
            blink: true
          },
          bg: 'black'
        });

        roomTitle = new blessed.box({
          screen: screen,
          top: 0,
          height: 1,
          width: '100%',
          bg: 'blue',
          fg: 'white',
          content: sm.selectRoomTitle,
          align: 'center'
        });

        chatlog = new blessed.log({
          screen: screen,
          top: 1,
          left: 0,
          bottom: 1,
          width: '100%',
          border: {
            type: 'line',
            fg: 'white'
          },
          scrollable: true,
          alwaysScroll: true,
          scrollOnInput: true,
          tags: true
        });

        chatInput = new blessed.textbox({
          screen: screen,
          bottom: 0,
          height: 1,
          width: '100%',
          padding: 0,
          bg: 'white',
          fg: 'black',
          inputOnFocus: true
        });

        var emoteBackground = new blessed.image({
          screen: screen,
          parent: screen,
          top: 1,
          left: 0,
          bottom: 1,
          type: 'ansi',
          height: '100%',
          width: '100%',
          file: __dirname + '/my-program-icon.png'
        });

        stream.chatlog = chatlog;
        stream.screen = screen;
        screen.append(roomTitle);
        screen.append(chatlog);
        screen.append(chatInput);
        setupKeyEvents()
        chatInput.focus();
        systemMessage(sm.welcome);
        listRooms();
        screen.render();
    }

    // Keyboard event listeners
    function setupKeyEvents() {
      chatInput.key(['pagedown', 'pageup', 'C-c'], (ch, key) => {
          if (key.name === 'pageup') {
            chatlog.scroll(-1);
          }
          else if (key.name === 'pagedown') {
            chatlog.scroll(1);
          }
          else {
            if (stream.roomname) {
              leaveRoom();
            }
            systemMessage(sm.bye);
            screen.render();
            stream.end();
          }
        });

        chatInput.on('submit', (line) => {
          chatInput.clearValue();
          chatInput.focus();
          line = line.trim().replace(/\s+/g, ' ');
          if (!line || line.length === 0) {
            return;
          }  
          if (line[0] === '/') {
            handleChatCommand(line);
            return;
          }
          else if (line[0] === '!') {
            handleEmote(line);
            return;
          }
          else {
            broadcast(line, stream.roomname);
          }
          screen.render();
        });
    }

    function setupStream() {
      if (stream !== undefined) {
        stream.username = client.username;

        // Randomly assign user a color
        var randColor = colorNames[Math.floor(Math.random() * colorNames.length)];
        setUserColor(randColor);

        // PTTY things
        stream.columns = ttyInfo.cols;
        stream.rows = ttyInfo.rows;
        stream.isTTY = true;

        streams.push(stream);
      }
    }

    // Handle stream end, especially for non-standard exits
    function cleanupStream() {
      if (stream !== undefined) {
        try {
          if (stream.roomname) {
            leaveRoom();
          }
          streams.splice(streams.indexOf(stream), 1);
          usernames.splice(usernames.indexOf(stream.username), 1);
          if (stream.screen) {
            stream.screen.destroy();
          }
          stream.end();
        }
        catch(e) {
          console.log('cleanup error', e);
        }
      }
    }

    function setUserColor(color) {
      if (color === undefined ||
          color.length < 1 ||
          colorNames.indexOf(color) === -1) {
        return;
      }

      stream.color = colors[color];
      stream.pName = "{" + stream.color + "-fg}" +
                     stream.username +
                     "{/}";
    }
  });

  // Check that user/chatroom name is valid
  // Pass in true to chatroom parameter if checking chatroom name
  function verifyName(name, chatroom) {
    var isValidName = true;
    var message;
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