module.exports = {
	// Standard messages
	welcome: "*** Welcome to the GungHo test chat server ***\n",
	help: "Available commands:\n" +
		  "  /rooms - List available chatrooms\n" +
		  "  /join <chatroom> - Join chatroom\n" +
		  "  /leave - Leave current chatroom\n" +
		  "  /quit - Log off\n" +
		  "  /help - Display help\n",

	// Username messages
	welcomeUser: "Welcome, ",
	usernameChange: "  Your username has been changed to ",

	// Chatroom messages
	chooseRoom: "Join a room to begin chatting\n",
	availableRooms: "Available rooms:\n",
	roomnameEmpty: "Please enter a valid chatroom name\n",
	roomnameInvalid: " is not a valid chatroom\n",
	alreadyInRoom: "You are already in the room\n",
	userEnter: " has entered the room\n",
	otherUserLeave: " has left the room\n",

	// Prompts
	usernamePrompt: "Username: ",
	roomNamePrompt: "Chatroom name: ",
	readyPrompt: "> ",

	// Error messages
	invalidCharsInName: "Only alphanumerics, dashes, underscores, and periods are allowed\n",
	invalidChatroom: " is not a valid chatroom name\n",
	blankNameEntry: "Please enter a valid name\n",
	nameEntryTooLong: "Names cannot be longer than 31 characters\n",
	nameTaken: "Sorry, name taken\n",
	invalidCommand: " is not a valid command\n",
	bye: "BYE\n"
};
