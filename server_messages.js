module.exports = {
	// Standard messages
	welcome: "Welcome to the GungHo test chat server!",
	help: "Available commands:\n" +
		  "\t/rooms - List available chatrooms\n" +
		  "\t/create - Create new chatroom\n" +
		  "\t/join <chatroom> - Join chatroom\n" +
		  "\t/users <chatroom> - List users in chatroom\n" +
		  "\t/leave - Leave current chatroom\n" +
		  "\t/quit - Log off\n" +
		  "\t/help - Display help",
	bye: "BYE",
	windowTitle: "GH Chat - ",

	// Username messages
	welcomeUser: "Welcome, ",

	// Chatroom messages
	selectRoomTitle: "*** Choose a room ***",
	availableRooms: "Available rooms:\n",
	roomCreated: " has been created",
	userEnter: " has entered the room",
	userLeave: " has left the room",
	selfLeave: "You have left ",
	usersInRoom: " users currently in ",

	// Prompts
	usernamePrompt: "Username: ",
	roomNamePrompt: "Chatroom name: ",
	sysPrompt: "> ",

	// Error messages
	invalidCharsInName: "Only alphanumerics, dashes, underscores, and periods are allowed\n",
	blankNameEntry: "Please enter a valid name\n",
	nameEntryTooLong: "Names cannot be longer than 15 characters\n",
	usernameTaken: "Sorry, name taken\n",
	invalidChatroom: " is not a valid chatroom name",
	roomAlreadyExists: "Room already exists",
	invalidUsername: " is not a valid username",
	roomnameEmpty: "No chatroom name provided",
	alreadyInRoom: "You are already in ",
	notInRoom: "You are not currently in a room",
	invalidCommand: " is not a valid command",
};
