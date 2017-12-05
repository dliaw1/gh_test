# gh_test
simple chat server
## Summary
This chat server is built in node.js and uses ssh as its connection protocol. It's primarily targeted towards usage on Mac, but has also been tested on Windows with Putty and cygwin (though some terminals will render better than others).
This package also includes a simple telnet server (which was basically my first stab at this project) which fulfills the basic requirements, but is not running/accessible on the test server. It can be built and run locally, but it's not very interesting to use.
## Setup
### Connection Instructions
The test app is running on an Amazon EC2 instance at ghtest-env.us-west-1.elasticbeanstalk.com on port 9001.
Running `ssh -p 9001 ghtest-env.us-west-1.elasticbeanstalk.com` in terminal is probably the easiest way on mac/unix, but any ssh method will do.
### Build Instructions
This server requires node and npm to be installed in order to run. 
1. Clone the repository at https://github.com/dliaw1/gh_test.
2. Navigate to the cloned repository and run `npm install`, which should pull in the dependencies. If not, you can manually install  the required libraries, [blessed](https://www.npmjs.com/package/blessed) and [ssh2](https://www.npmjs.com/package/ssh2).
3. Run `node app.js`. You should get a message saying "listening on port 9001", which indicates that the server is now running.
4. To connect, ssh to localhost on port 9001.

To run the telnet server:
1. Checkout the develop branch of the repo with `git checkout develop`. There is a identical file on the master branch but due to some message changes it is currently broken.
2. Run `node index.js`; again, you should get a message saying that the server is running. No additional libraries are required.
3. To connect, telnet to localhost on port 9001.
## Features
In addition to the basic features outlined in the project specification, this server also supports:
- ssh
- timestamps
- custom user colors
- emotes
- private messaging
- name/emote autocompletion

Most features are described in the in-client help menu. Below are a few selected features which require a little more elucidation.
### Emotes
To insert an emote image into chat, type an exclamation point directly followed by the name of the emote. For example, `!emote`. Below is a list of emotes to get you started; to discover the rest, try using the auto-complete function, described next.
- pikachu
- doge
- ddr
- megashoot
- megapose
- itsame
- yoshi
- star
### Auto-complete
When typing out the name of a user or roomname for use in a command, you can press tab after typing the first few letters of the name to find the next closest match. For example, typing `/join gen` then pressing tab will auto-complete the roomname to "general", assuming there are no other roomnames in between "gen" and "general". This also works with emote names.
### Page Scrolling
Use page-up, page-down, home, and end to scroll the chat.
