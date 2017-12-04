process.env.LANG = 'en_US.UTF-8';

const fs = require('fs');
const ssh2 = require('ssh2');
const blessed = require('blessed');

const sm = require('./server_messages.js');
const emotes = require('./emotes.js');
var rooms = require('./default_rooms.js');

// Yellow is because the hex code keeps displaying as gray for some reason
var colors = {aqua: "#000fff", blue: "#0084ff", fuchsia: "#ff00ff",
              green: "#008000", lime: "#00ff00", maroon: "#800000",
              olive: "#808000", purple: "#800080", red: "#ff0000",
              teal: "#008080", white: "#fff", yellow: "yellow"};
var invertColors = ["white", "blue", "lime", "yellow"]
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
    // Force keyboard auth to do custom checks.
    // This may require users to enter name twice if client
    // terminal automatically gives them a login prompt
    if (ctx.method !== 'keyboard-interactive') {
      return ctx.reject(['keyboard-interactive']);
    }

    var username;

    // Don't use ctx.username in case client automatically
    // passes in local system username
    ctx.prompt(sm.usernamePrompt, namePrompt);

    function namePrompt(input) {
      var name = input[0];
      var validation = verifyName(name, false);
      if (!validation.isValidName) {
        ctx.prompt(validation.err + "\n" + sm.usernamePrompt, namePrompt);
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
        console.log('session close');
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

    // Send message to all clients in a room, or to individual user
    // type - 'room' or 'user'
    // name - chatroom or username
    // system - true if system broadcast
    function broadcast(message, type, name, system) {
      try {
        if (type === 'room') {
          if (message === undefined || message.length < 1) {
            return;
          }
          if (name === undefined || !rooms.hasOwnProperty(name)) {
            stream.chatlog.add(stream.pName + ": " + message);
            return;
          }

          // Push message to all streams in room
          var roomStreams = rooms[name].streams;
          for (var i in roomStreams) {
            var userStream = roomStreams[i];
            if (system) {
              userStream.chatlog.add(sm.sysPrompt + message);
            }
            else {
              userStream.chatlog.add(name + "-" + stream.pName + ": " + message);
            }
          }
        }
        // Whisper to single user
        else if (type === 'user') {
          if (name === undefined) {
            systemMessage(sm.blankNameEntry);
            return;
          }
          else if (usernames.indexOf(name) === -1) {
            systemMessage(sm.userDNE);
            return;
          }
          if (message === undefined || message.length < 1) {
            return;
          }
          // Whisper to self
          else if (name === stream.username) {
            stream.chatlog.add(stream.pName + ": " + message);
            return;
          }
          // Get target stream and push message
          for (var s in streams) {
            if (streams[s].username === name) {
              streams[s].chatlog.add("/w from " + stream.pName + ": " + message);
              stream.chatlog.add("/w to " + streams[s].pName + ": " + message);
              break;
            }
          }
        }
        else {
          throw sm.invalidBroadcast + type;
        }
      }
      catch(e) {
        console.log("broadcast", e);
      }
    }

    // List all existing rooms, plus number of users in each
    function listRooms() {
      var outstr = sm.availableRooms;
      for (var roomname in rooms) {
        outstr = outstr + "\t" + roomname + 
                 " (" + rooms[roomname].streams.length + ")\n";
      }
      systemMessage(outstr);
    }

    // Create a new empty chatroom
    function createRoom(roomname) {
      if (roomname === undefined) {
        systemMessage(sm.roomnameEmpty);
      }
      else if (rooms.hasOwnProperty(roomname)) {
        systemMessage(sm.roomAlreadyExists);
      }
      else {
        var validation = verifyName(roomname, true);
        if (validation.isValidName) {
          rooms[roomname] = {
            streams: [],
            usernames: [],
          };
          systemMessage(roomname + sm.roomCreated);
        }
        else {
          systemMessage(validation.message);
        }
      }
    }

    // Join existing chatroom
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
        // If already in a room, leave before joining new one
        if (stream.roomname !== undefined) {
          leaveRoom();
        }
        stream.roomname = roomname;
        stream.chatlog.add(sm.selfEnter + roomname + " *****");
        broadcast(stream.pName + sm.userEnter, 'room', roomname, true);
        rooms[roomname].streams.push(stream);
        rooms[roomname].usernames.push(stream.username);
        listUsers(roomname);
        roomTitle.setContent('~' + roomname + '~');
      }
    }

    // Leave current chatroom
    function leaveRoom() {
      if (stream.roomname === undefined) {
        systemMessage(sm.notInRoom);
        return;
      }
      var room = rooms[stream.roomname];
      var roomStreams = room.streams;
      roomStreams.splice(roomStreams.indexOf(stream), 1);
      var roomUsers = room.usernames;
      roomUsers.splice(roomUsers.indexOf(stream.username), 1);

      systemMessage(sm.selfLeave + stream.roomname + "\n");
      broadcast(stream.pName + sm.userLeave, 'room', stream.roomname, true);
      stream.roomname = undefined;
      roomTitle.setContent(sm.lobby);
    }

    // List all users in specified chatroom
    // If no room passed in, list users in current chatroom
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
        var userList = rooms[roomname].streams.map(s => s.pName).join(", ");
        systemMessage(numUsers + sm.usersInRoom + roomname +
          (userList.length ? ("\n\t" + userList) : ''));
      }
    }

    // Handle chat commands
    function handleChatCommand(text) {
      var wordTokens = text.split(" ");
      if (wordTokens[0].match(/^\/(h|help)$/)) {
        systemMessage(sm.help);
      }
      else if (wordTokens[0].match(/^\/(q|quit)$/)) {
        if (stream.roomname) {
          leaveRoom();
        }
        systemMessage(sm.bye);
        stream.end();
      }
      else if (wordTokens[0].match(/^\/(rooms)$/)) {
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
      else if (wordTokens[0].match(/^\/(color)$/)) {
        setUserColor(wordTokens[1]);
      }
      else if (wordTokens[0].match(/^\/(w|whisper)$/)) {
        broadcast(wordTokens.slice(2).join(" "), "user", wordTokens[1]);
      }
      else if (wordTokens[0].match(/^\/(l|leave)$/)) {
        leaveRoom();
      }
      else {
        systemMessage(wordTokens[0] + sm.invalidCommand);
      }
    }

    // Display an emote
    function handleEmote(text) {
      var wordTokens = text.split(" ");
      var emoteCmd = wordTokens[0].substring(1); // Assume first char is '!'
      if (emotes.hasOwnProperty(emoteCmd)) {
        broadcast("\n" + emotes[emoteCmd], "room", stream.roomname);
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
          bg: 'black',
          fg: 'white'
        });

        roomTitle = new blessed.box({
          screen: screen,
          top: 0,
          height: 1,
          width: '100%',
          bg: 'blue',
          fg: 'white',
          content: sm.lobby,
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
          tags: true,
          fg: 'white'
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

        stream.chatlog = chatlog;
        stream.screen = screen;
        screen.append(roomTitle);
        screen.append(chatlog);
        screen.append(chatInput);
        setupKeyEvents()
        chatInput.focus();
        systemMessage(sm.welcome);

        // Randomly assign user a color
        var randColor = colorNames[Math.floor(Math.random() * colorNames.length)];
        setUserColor(randColor);

        listRooms();
    }

    // Keyboard event listeners
    function setupKeyEvents() {
      // Chat scrolling
      chatInput.key(["pagedown", "pageup", "home", "end", "C-c"], (ch, key) => {
        switch(key.name) {
          case "pageup":
            chatlog.scroll(-10);
            break;
          case "pagedown":
            chatlog.scroll(10);
            break;
          case "home":
            chatlog.setScrollPerc(0);
            break;
          case "end":
            chatlog.setScrollPerc(100);
            break;
          default:
            //console.log("wrongkey");
        }
      });

      // Autocompleting room/usernames
      chatInput.key("tab", (ch, key) => {
        autoComplete();
      });

      // Quit on Ctrl-C
      chatInput.key("C-c", (ch, key) => {
        if (stream.roomname) { 
          leaveRoom(); 
        } 
        systemMessage(sm.bye); 
        stream.end(); 
      });
      
      // Handle submitted input
      chatInput.on("submit", (line) => {
        chatInput.clearValue();
        chatInput.focus();
        line = line.trim().replace(/\s+/g, " ");
        if (!line || line.length === 0) {
          return;
        }  
        if (line[0] === "/") {
          handleChatCommand(line);
          return;
        }
        else if (line[0] === "!") {
          handleEmote(line);
          return;
        }
        else {
          if (stream.roomname !== undefined) {
            broadcast(line, 'room', stream.roomname);
          } 
          else {
            stream.chatlog.add(stream.pName + ": " + line);
          }
        }
      });

      // Maintain focus on textbox at all times
      chatInput.on("cancel", () => {
        chatInput.focus();
      });

      // Autocomplete room/usernames and emotes
      function autoComplete() {
        var line = chatInput.getValue();
        line = line.trim().replace(/\s+/g, " ");
        var wordTokens = line.split(" ");
        var completedLine;
        var nameCandidate;
        
        // Command autocomplete
        if (line[0] === "/") {
          if (wordTokens.length !== 2) {
            return;
          }

          // Match roomname for /join and /users
          if (wordTokens[0].match(/^\/(j|join)$/) ||
              wordTokens[0].match(/^\/(u|users)$/)) {
            nameCandidate = completeWord(wordTokens[1], "room");
          }
          // Match username for /whisper
          else if (wordTokens[0].match(/^\/(w|whisper)$/)) {
            nameCandidate = completeWord(wordTokens[1], "user")
          }

          if (nameCandidate) {
            completedLine = wordTokens[0] + " " + nameCandidate;
          }
        }
        // Emote autocomplete
        else if (line[0] === "!") {
          if (wordTokens.length === 1 && wordTokens[0].length > 1) {
            nameCandidate = completeWord(wordTokens[0], "emote");
          }

          if (nameCandidate) {
            completedLine = "!" + nameCandidate;
          }
        }

        if (completedLine) {
          chatInput.setValue(completedLine + " ");
        }
      }

      // Find closest matching non-identical room/username or emote
      // type - "room", "user", or "emote"
      function completeWord(nameFragment, type) {
        var nameCandidate;
        var nameList;

        switch(type) {
          case "room":
            nameList = Object.keys(rooms);
            break;
          case "user":
            nameList = usernames;
            break;
          case "emote":
            nameList = Object.keys(emotes);
            nameFragment = nameFragment.substring(1);
            break;
          default:
            return;
        }

        try {
          for (var i in nameList) {
            if (nameList[i].indexOf(nameFragment) === 0 &&
              nameList[i] > nameFragment) {
              if (!nameCandidate) {
                nameCandidate = nameList[i];
              }
              else if (nameCandidate > nameList[i]) {
                nameCandidate = nameList[i];
              }
            }
          }
        }
        catch(e) {
          console.log('completeWord', e);
        }

        return nameCandidate;
      }
    }

    // Basic stream setup
    function setupStream() {
      if (stream !== undefined) {
        stream.username = client.username;

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
          console.log('cleanupStream', e);
        }
      }
    }

    // Set username color
    // Print list of valid colors if no/invalid color passed in
    function setUserColor(colorName) {
      if (colorName === undefined ||
          colorName.length < 1 ||
          colorNames.indexOf(colorName.toLowerCase()) === -1) {
        var colorList = colorNames.map(c => "{" + colors[c] + "-fg}" + c + "{/}")
                                  .join(", "); 
        systemMessage(sm.validColors + colorList);
        return;
      }
      colorName = colorName.toLowerCase()

      stream.color = colors[colorName];
      stream.pName = wrapColorText(stream.color, stream.username);
      roomTitle.style.bg = stream.color;
      roomTitle.style.fg = (invertColors.indexOf(colorName) === -1 ? "white" : "black");
      systemMessage(sm.colorSet + wrapColorText(stream.color, colorName));
    }
  });

  // Wrap text in tags to render in color
  // color = actual color value, not the color name
  function wrapColorText(color, text) {
    if (color === undefined || color.length < 1) {
      return text ? text : '';
    }
    return "{" + color + "-fg}" + text + "{/}";
  }

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
