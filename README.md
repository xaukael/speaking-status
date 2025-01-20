# speaking-status

Monitors your microphone and displays that you are speaking when the set threshold is reached.

This module uses access to the microphone to determine when the user is speaking and broadcasts that to all clients. All clients will show an indicator in the Player list showing that user as speaking and a green box will be shown around the token for that user's assigned character.

A hook 'changeSpeakingStatus' is also called on speaking status change to allow custom behavior to be defined.
