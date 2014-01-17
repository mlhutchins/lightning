WWLLN Lightning Map
=========

A WWLLN (http://wwlln.net) visualization tool to show realtime lightning activity.

The map displays WWLLN data viewed in realtime or at other speeds.  The user can pause the display, return to the start of the loaded data, jump around by 30-seconds, resume playing, or return to real time data display (where available).  There are options to show a Google Map cloud layer (only shows current cloud conditions), a density map of all loaded strokes, place a selection box for more refined statistics, and an option to clear the loaded strokes in memory.

Users can also load their own WWLLN .loc files for playback and viewing.  There is a load limit of 50,000 strokes to prevent slow playback due to too many strokes.  Loading a file larger than 50,000 will only load the first 50,000 strokes and ignore the rest.  Loaded data files play from the beginning of the file.


The terminator code is taken from https://github.com/marmat/google-maps-api-addons.

Login in controlled by the .htpasswd file specified in .htaccess.  An .htpasswd file is created with:

htpasswd -c .htpasswd [new_user]

And ammended with:

htpasswd .htpasswd [new_user]

For questions, concerns, or suggestions, contact Michael Hutchins: mlhutch @ uw.edu
