module.exports = {
	// Standard messages
	welcome: "Welcome to the GungHo test chat server!\n" +
					 "  Select a room to begin chatting\n" +
					 "  /h to display help",
	help: "Available commands:\n" +
		    "\t/rooms - List available chatrooms\n" +
		 	  "\t/create - Create new chatroom\n" +
		 	  "\t/join <chatroom> - Join chatroom\n" +
		 	  "\t/users <chatroom> - List users in chatroom\n" +
		 	  "\t/leave - Leave current chatroom\n" +
		 	  "\t/color <color> - Change username display color\n" +
		 	  "\t/whisper <user> <message> - PM another user\n" +
		 	  "\t/timestamp <on/off> - Toggle message timestamps\n" +
		 	  "\t/quit - Log off\n" +
		 	  "\t/help - Display help",
	bye: "BYE",
	windowTitle: "GH Chat - ",

	// Chatroom messages
	lobby: "*** Lobby ***",
	availableRooms: "Available rooms:\n",
	roomCreated: " has been created",
	selfEnter: "***** Entering chatroom: ",
	userEnter: " has entered the room",
	userLeave: " has left the room",
	selfLeave: "You have left ",
	usersInRoom: " user(s) currently in ",

	// Misc command messages
	validColors: "Valid colors: ",
	colorSet: "Color set to ",
	timestampsSet: "Timestamps turned ",

	// Prompts
	usernamePrompt: "Username: ",
	roomNamePrompt: "Chatroom name: ",
	sysPrompt: "> ",

	// Error messages
	invalidCharsInName: "Only alphanumerics, dashes, underscores, and periods are allowed",
	blankNameEntry: "Please enter a valid name",
	nameEntryTooLong: "Names cannot be longer than 15 characters",
	usernameTaken: "Sorry, username taken",
	invalidChatroom: " is not a valid chatroom name",
	roomAlreadyExists: "Room already exists",
	invalidUsername: " is not a valid username",
	userDNE: "User does not exist",
	roomnameEmpty: "No chatroom name provided",
	alreadyInRoom: "You are already in ",
	notInRoom: "You are not currently in a room",
	invalidCommand: " is not a valid command",
	invalidBroadcast: "Invalid broadcast type: "
};
