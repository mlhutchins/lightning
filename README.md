lightning
=========

A WWLLN (http://wwlln.net) visualization tool to show realtime lightning activity.

The map displays WWLLN data viewed in realtime or at other speeds.  The user can pause the display, return to the start of the loaded data, jump around by 30-seconds, resume playing, or return to real time data display (where available).  There are options to show a Google Map cloud layer (only shows current cloud conditions), a density map of all loaded strokes, place a selection box for more refined statistics, and an option to clear the loaded strokes in memory.

To run the visualization map locally add a lightning .json data file into the data/ folder with the name current.json and the format:

```
{
	"1" : {"unixTime" : 1371254400.1,
		"lat" : 29.66,
		"long" : -99.69},
	"2" : {"unixTime" : 1371254400.2,
		"lat" : 18.22,
		"long" : -101.12},
	"3" : {"unixTime" : 1371254400.6,
		"lat" : 13.66,
		"long" : -4.38}
}
```

These can be generated from a WWLLN .loc data file using the loc2json.m function: https://github.com/mlhutchins/functions/blob/master/loc2json.m (after import with a_import.m or ae_import.m, also available in that repository).  If the data file is not real time data the file is played from the beginning to the end.

The terminator code is taken from https://github.com/marmat/google-maps-api-addons.

For questions, concerns, or suggestions, contact Michael Hutchins: mlhutch @ uw.edu
