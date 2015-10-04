# Outline of work

## Fake WWLLN

Create a R function to generate fake WWLLN data to allow offline
prototyping without touching the WWLLN data or servers

- Output: Minute A-files

## WWLLN ETL

Routinely move the WWLLN A-file data into a database.
If not database exists create a new one, also purge old elements from the datbase.

- Input: Minute A-files
- Output: SQLite database of WWLLN data (local access only)

## WWLLN API

Create a public API call that provides that last X WWLLN strokes delayed by Y seconds.
Should return a JSON object containing the stroke data.
The lightning map should call this instead of accessing the .JSON file from the HTTP site.
If hosting an API is too cumbersome of a requirement have the API program write out a new current.json file.

- Input: Database access
- Output: API or updated JSON file

## Lightning Map Storage

Improve how the stroke data is stored and updated on the client side.
Currently it is an array that is checked every update, maybe a hash-map or local database would be faster and easier to work with.
We will still have the same 30k stroke limits from the mapping itself.

## Switch from Google Maps to Leaflet

Leaflet seems like a better and more robust platform for mapping than Google maps, especially since one of the main feature that was nice, the cloud layer, is now gone.

## Reduce feature set

A lot of added features can be removed or simplified, especially the janky state machine that controls playback.
Surerly some extra libraries can be substitued in for the current implementation.
