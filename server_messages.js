module.exports = {
	// Standard messages
	welcome: "*** Welcome to the GungHo test chat server ***\n",
	help: "Available commands:\n" +
		  "  /rooms - List available chatrooms\n" +
		  "  /create - Create new chatroom\n" +
		  "  /join <chatroom> - Join chatroom\n" +
		  "  /list <chatroom> - List users in chatroom\n" +
		  "  /leave - Leave current chatroom\n" +
		  "  /quit - Log off\n" +
		  "  /help - Display help\n",
	bye: "BYE\n",

	// Username messages
	welcomeUser: "Welcome, ",
	usernameChange: "  Your username has been changed to ",

	// Chatroom messages
	chooseRoom: "Join a room to begin chatting\n",
	availableRooms: "Available rooms:\n",
	roomCreated: " has been created\n",
	userEnter: " has entered the room\n",
	userLeave: " has left the room\n",
	selfLeave: "You have left ",
	usersInRoom: " users currently in ",

	// Prompts
	usernamePrompt: "Username: ",
	roomNamePrompt: "Chatroom name: ",
	readyPrompt: "> ",

	// Error messages
	invalidCharsInName: "Only alphanumerics, dashes, underscores, and periods are allowed\n",
	blankNameEntry: "Please enter a valid name\n",
	nameEntryTooLong: "Names cannot be longer than 31 characters\n",
	usernameTaken: "Sorry, name taken\n",
	invalidChatroom: " is not a valid chatroom name\n",
	roomAlreadyExists: "Room already exists\n",
	invalidUsername: " is not a valid username\n",
	roomnameEmpty: "No chatroom name provided\n",
	alreadyInRoom: "You are already in the room\n",
	notInRoom: "You are not currently in a room\n",
	invalidCommand: " is not a valid command\n",
};
