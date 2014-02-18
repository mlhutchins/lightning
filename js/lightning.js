$(function(){

    // Data file location
    var defaultFile = 'data/current.json';
    var dataFile = defaultFile;
    
    // Initialize storage array for stroke data
    var locations = {};//A repository for markers (and the data from which they were contructed).

    // Map Display settings
    var startMag = 6; // Initial marker size
    var endMag = 2; // Final marker size
    var decayTime = 0.5; // Decay of marker (size / second)
    var markerLifetime = (startMag - endMag) / decayTime; // Marker lifetime
    var timeOffset = 720; // Initial Delay between display data and current time
    var timeOffsetMin = timeOffset; // Minimum offset from real time
    var getDelay = 1; // interval between server fetches (s)
    var densityRadius = 25; // Radius of the heatmap (pixels)
    var gradient = ['rgba(254,229,217,0)','rgba(254,229,217,1)', 'rgba(252,187,161,1)', 'rgba(252,146,114,1)', 'rgba(251,106,74,1)', 'rgba(222,45,38,1)', 'rgba(165,15,21,1)']; // Set Color Gradient for density
    var maxFileSize = 25000; // Forced maximum size for loading .loc files

    // Initial states and values for the buttons
    var runPause = false; // flag to pause playback
    var runPlay = false; // flag to resume playback
    var runReal = false; // flag to run in realtime, or reset to realtime
    var runBackward = false; // flag to move back 30 seconds
    var runForward = false; // flag to move forward 30 seconds
    var pauseSet = false; // flag to pause playback
    var pauseTime = 0; // Initial pause values
    var firstTime = 1e12; // Initial first stroke time
    var lastTime = -1e12; // initial last stroke timed
    var speedFactor = 1; // Initial speed factor of 1
    var showBox = false; // Start with no subset box shown
    var showAll = false; // Don't show all loaded strokes on launch
    var runStart = false; // Return to start variable
    var loadLocal = false;
    var loadFile = [];
    var update_firstTime = false;
    var updateCountDensity = 10;
    
    // Internal storage
    var currentStrokes = 0; // Index of total strokes displayed
    var currentBoxStrokes = 0; // Index of strokes in box
    var lastGet = 0; // holds time of last server fetch
    var strokePoints = []; // Array to hold stroke data
    var heatmap;
    
    // Cloud layer settings
    var cloudLayer = new google.maps.weather.CloudLayer();
    var showCloud = true; 
    
    
    // Create Google Map
	var map = new google.maps.Map(document.getElementById('map-canvas'), {
		zoom: 3,
		maxZoom: 8,
		minZoom: 2,
		streetViewControl: false,
		center: new google.maps.LatLng(40, 0),
		mapTypeId: google.maps.MapTypeId.SATELLITE
	});
    
    // Google Map color and style
    var styles = [
      {
        "elementType": "geometry",
        "stylers": [
          { "lightness": -62 },
          { "gamma": 1.37 },
          { "saturation": -29 },
          { "weight": 0.5 },
          { "visibility": "on" }
        ]
      },{
        "featureType": "road",
        "stylers": [
          { "visibility": "off" }
        ]
      },{
        "featureType": "administrative",
        "stylers": [
          { "visibility": "off" }
        ]
      },{
        "featureType": "administrative.country",
        "stylers": [
          { "visibility": "on" }
        ]
      },{
      }
    ];

    map.setOptions({styles:styles});

    // Initialize day/night terminator
    window.dno = new DayNightOverlay({
                    map: map,
                    fillColor: 'rgba(0,0,0,0.3)',
                    date: new Date(Date.UTC(2011,0,1))
                });
    window.dateField = document.getElementById('date');
    
    
    // Map Title
    var myTitle = document.createElement('div');
    myTitle.style.color = 'white';
    myTitle.innerHTML = '<h1>Real Time Lightning Locations</h1>';
    map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(myTitle);
    
    // WWLLN clickable link in title
    function WWLLNText(controlDiv) {
        controlDiv.style.padding = '0px';
        var logo = document.createElement('h1');
        logo.innerHTML = 'WWLLN&nbsp;';
        logo.style.color = myTitle.style.color;
        logo.style.cursor = 'pointer';
        controlDiv.appendChild(logo);
    
        google.maps.event.addDomListener(logo, 'click', function() {
            window.location = 'http://wwlln.net'; 
    });
    };
 
    // Add WWLLN link to map title
    var logoControlDiv = document.createElement('DIV');
    var logoControl = new WWLLNText(logoControlDiv);
    logoControlDiv.index = 0; // used for ordering
    map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(logoControlDiv);
    
    
    // UW Copyright
    function UWCopyright(controlDiv) {
        controlDiv.style.padding = '5px';
        var logo = document.createElement('IMG');
        logo.src = 'images/uw.gif';
        logo.style.cursor = 'pointer';
        controlDiv.appendChild(logo);
    
        google.maps.event.addDomListener(logo, 'click', function() {
            window.location = 'http://www.washington.edu'; 
    });
    };
 
    // Add copyright to map
    var logoControlDiv = document.createElement('DIV');
    var logoControl = new UWCopyright(logoControlDiv);
    logoControlDiv.index = 0; // used for ordering
    map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(logoControlDiv);
    
    // Load WWLLN Stations
    var stations = (function() {
            var json = null;
            $.ajax({
                'async': false,
                'global': false,
                'url': "data/stations.json",
                'dataType': "json",
                'success': function (data) {
                    json = data;
                }
            });
            return json;
        })();

    // Create Station markers 
    var infowindow = new google.maps.InfoWindow(); 

    for (var key in stations) {
        var latlng = new google.maps.LatLng(stations[key].lat,stations[key].long)
        var myMarkerOptions = {
            position: latlng,
            map: map,
            title: stations[key].name,
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 2
            }
        };
        var marker = new google.maps.Marker(myMarkerOptions)

          google.maps.event.addListener(marker, 'click', (function(marker, key) {
            return function() {
              infowindow.setContent(stations[key].name);
              infowindow.open(map, marker);
            }
          })(marker, key));
    };
    
    
    // Marker style for strokes
    function getCircle(magnitude) {
        return {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: 'red',
            fillOpacity: .2,
            scale: Math.pow(2, magnitude) / Math.PI,
            strokeColor: 'white',
            strokeWeight: .5
        };
    };
    
    
    // Function to find the stroke size based on the time difference
    function timeSize(current, stroke) {
        
        size = startMag + ((stroke - current) * decayTime);
        
        if(size > startMag){
            size = 0;
        } else if (size <= endMag){
            size = -1;
        };
            
        return size;
    }
    
    // Function to check if a value is a number
    function isNumber(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }
    
    // function to clear all stroke markers
    
    function clearMarkers(){
        //Remove markers for all unreported locs, and the corrsponding locations entry.
        $.each(locations, function(key) {
            if(locations[key].marker) {
                locations[key].marker.setMap(null);
            }
        });
    };
    
    // function to remove all stroke data
    function clearStrokes(){

        clearMarkers();
        locations = {};
        
        runReal = false
        firstTime = 1e12;
        lastTime = -1e12;
    }
        
    // WWLLN .loc to JSOn format converter
    
    function loc2json(locFile){
        
        locFile = locFile.split("\n");

        var loadLength = locFile.length - 1;

        if (loadLength > maxFileSize){
            alert("File too large for playing (" + loadLength + " strokes), file must be less than " + maxFileSize + " strokes. Loading first " + maxFileSize + " strokes only.")
            loadLength = maxFileSize;
        };
                  
        
        var jsonFile = "{";
        
        
        for(var i = 0; i < loadLength; i++) {
            
            var stroke = locFile[i].split(',');
            
            var strokeJSON = "";
                        
            // Set random stroke ID
            var strokeID = Math.random() * Math.pow(10,7);
            strokeID= Math.round(strokeID);  
            
            // Get unixTime
            var strokeDate = stroke[0].split('/');
            var strokeTime = stroke[1].split(':');
            
            var d = new Date(Date.UTC(strokeDate[0], strokeDate[1] - 1, strokeDate[2],
                                      strokeTime[0], strokeTime[1], Math.round(strokeTime[2]),
                                      1000*(strokeTime[2])%1));
            var strokeUnixTime = d.getTime() / 1000.0;
            
            // Get lat/long
            var strokeLat = stroke[2];
            var strokeLong = stroke[3];

            strokeJSON += '"' + strokeID + '" : {';
            strokeJSON += '"unixTime" : ' + strokeUnixTime + ', ';
            strokeJSON += '"lat" : ' + parseFloat(strokeLat) + ', ';
            strokeJSON += '"long" : ' + parseFloat(strokeLong) + '}, ';
            
            jsonFile += strokeJSON;
                        
        }
        
        jsonFile = jsonFile.slice(0, -2);
        jsonFile += "}";
                
        return jsonFile
    };
    
               
    // Make a heatmap from a set of points
    function setDensityMap(){
        
        strokePoints = [];
        
        $.each(locations, function(key, loc) {
       
            // Add strokes to strokePoint array
            var stroke = new google.maps.LatLng(locations[key].lat,locations[key].long)
            strokePoints.push(stroke)
            
        });
               
        var pointArray = new google.maps.MVCArray(strokePoints);
        heatmap = new google.maps.visualization.HeatmapLayer({
            data: pointArray
        });
    
        heatmap.setOptions({
            gradient : gradient,
            radius: densityRadius
        });
                    
        heatmap.setMap(null);
        heatmap.setMap(map);
    }
    
    // General function for making on screen buttons
    function button(buttonOptions, buttonAction) {
   
        function ButtonData(controlDiv, map) {
            
            // Set CSS styles for the DIV containing the control
            // Setting padding to 5 px will offset the control
            // from the edge of the map
            controlDiv.style.padding = '5px';
            
            // Set CSS for the setButton control border
            var setButtonUI = document.createElement('div');
            setButtonUI.style.backgroundColor = 'white';
            setButtonUI.style.borderStyle = 'solid';
            setButtonUI.style.borderWidth = '1px';
            setButtonUI.style.cursor = 'pointer';
            setButtonUI.style.textAlign = 'center';
            setButtonUI.title = buttonOptions.mouseOver;
            controlDiv.appendChild(setButtonUI);
            
            // Set CSS for the control interior
            var setButtonText = document.createElement('div');
            setButtonText.style.fontFamily = 'Arial,sans-serif';
            setButtonText.style.fontSize = '12px';
            setButtonText.style.paddingLeft = '4px';
            setButtonText.style.paddingRight = '4px';
            setButtonText.innerHTML = buttonOptions.htmlText;
            setButtonUI.appendChild(setButtonText);
            
            // Setup the click event listener for Set Button:
            // Set the control's button to the current Map center.
            google.maps.event.addDomListener(setButtonUI, 'click', buttonAction);
            
        };
        
        var buttonControlDiv = document.createElement('div');
        var buttonControl = new ButtonData(buttonControlDiv, map);
        
        buttonControlDiv.index = buttonOptions.index;
        var position = buttonOptions.location;
        map.controls[buttonOptions.location].push(buttonControlDiv);
        
    };
    
    /*
        Create the on screen buttons and controls
    */
    
    // Clould Layer Display

    var cloudOptions = {
        location: google.maps.ControlPosition.TOP_LEFT,
        index: 1,
        mouseOver: 'Click to show cloud overlay.',
        htmlText: '<b>Cloud Overlay</b>'
    };
    
    function cloudAction() { 
        if (showCloud){
            cloudLayer.setMap(map);
            showCloud = false;
        } else {
            cloudLayer.setMap(null);
            showCloud = true;
        };
    };
         
    button(cloudOptions, cloudAction);
    
        
    // Show All Strokes Button
    
    var showAllOptions = {
        location: google.maps.ControlPosition.TOP_LEFT,
        index: 2,
        mouseOver: 'Click to show loaded stroke density.',
        htmlText: '<b>Stroke Density</b>'
    };
    
    function showAllAction() { 
        if (showAll){
            heatmap.setMap(null);
            showAll = false;
            updateCountDensity = 10;
        } else {
            showAll = true;
            updateCountDensity = 10;
            setDensityMap();
        };
    };
         
    button(showAllOptions, showAllAction);
    
    
    // Data Flush Button
    
    var dataClearOptions = {
        location: google.maps.ControlPosition.RIGHT_TOP,
        index: 2,
        mouseOver: 'Click to clear current data.',
        htmlText: '<b>Clear Data</b>'
    };
    
    function dataClearAction() { 
        clearStrokes();

        if (heatmap!==undefined){
            heatmap.setMap(null);
            showAll = false;
        }
        
        runReal = true;
        
        loadLocal = false;
        
        ajaxObj.options.url = defaultFile;
        console.log('Reset to default file:' + defaultFile)
        
    };
         
    button(dataClearOptions, dataClearAction);
   
    
    // Time Controls
      
    // Play Data
    
    var dataPlayOptions = {
        location: google.maps.ControlPosition.TOP_CENTER,
        index: 3,
        mouseOver: 'Click to play.',
        htmlText: '<b>Play</b>'
    };
    
    function dataPlayAction() { 
        runPlay = true;
    };
         
    button(dataPlayOptions, dataPlayAction);
   
    
    // Pause Data
    
    var dataPauseOptions = {
        location: google.maps.ControlPosition.TOP_CENTER,
        index: 2,
        mouseOver: 'Click to pause.',
        htmlText: '<b>Pause</b>'
    };
    
    function dataPauseAction() { 
        pauseSet = true;
    };
         
    button(dataPauseOptions, dataPauseAction);

        
    
    // Resume Realtime

    var dataRealOptions = {
        location: google.maps.ControlPosition.TOP_CENTER,
        index: 5,
        mouseOver: 'Click to reset to real-time playback.',
        htmlText: '<b>Real-Time</b>'
    };
    
    function dataRealAction() { 
        runReal = true;
        clearMarkers();
    };
         
    button(dataRealOptions, dataRealAction);

        

    // Jump Forward
           
    var dataForwardOptions = {
        location: google.maps.ControlPosition.TOP_CENTER,
        index: 4,
        mouseOver: 'Click to move forward 30 seconds.',
        htmlText: '<b>+30 Seconds</b>'
    };
    
    function dataForwardAction() { 
        runForward = true;
    };
         
    button(dataForwardOptions, dataForwardAction);
    
    

    // Jump Backward
           
    var dataBackwardOptions = {
        location: google.maps.ControlPosition.TOP_CENTER,
        index: 1,
        mouseOver: 'Click to move backwards 30 seconds.',
        htmlText: '<b>-30 Seconds</b>'
    };
    
    function dataBackwardAction() { 
        runBackward = true;
    };
         
    button(dataBackwardOptions, dataBackwardAction);

    
    // Jump To Start
           
    var dataStartOptions = {
        location: google.maps.ControlPosition.TOP_CENTER,
        index: 0,
        mouseOver: 'Click to go to start of loaded strokes.',
        htmlText: '<b>Start</b>'
    };
    
    function dataStartAction() { 
        clearMarkers();
        runStart = true;
    };
         
    button(dataStartOptions, dataStartAction);
    
    
    // Subset Box Activation Button
           
    var boxOptions = {
        location: google.maps.ControlPosition.RIGHT_TOP,
        index: 1,
        mouseOver: 'Click to show the selection box.',
        htmlText: '<b>Selection Box</b>'
    };
    
    function boxAction() { 
        if (showBox){
            showBox = false;
            rectangle.setMap(null);   

        } else {
            showBox = true;
            rectangle.setMap(map);

        };
    };
         
    button(boxOptions, boxAction);

    
    // Time Playback Speed Control
    // Create a div to hold everything else
    var controlDiv = document.createElement('DIV');
    controlDiv.id = "controls";
    controlDiv.style.backgroundColor = 'white';
    controlDiv.style.borderStyle = 'solid';
    controlDiv.style.borderWidth = '1px';
    controlDiv.style.cursor = 'pointer';
    controlDiv.style.textAlign = 'center';
    controlDiv.style.padding = '1px';

    // Set CSS for the control interior
    var setShowText = document.createElement('b');
    setShowText.style.fontFamily = 'Arial,sans-serif';
    setShowText.style.fontSize = '12px';
    setShowText.style.paddingLeft = '4px';
    setShowText.style.paddingRight = '4px';
    setShowText.innerHTML = 'Speed:';
        
    // Create an input field
    var controlInput = document.createElement('input');
    controlInput.id = "speed-control";
    controlInput.name = "speed-control";
    controlInput.value = "1";
    controlInput.size = 3;
   
    // Create a button to send the information
    var setButton = document.createElement('b');
    setButton.style.fontFamily = 'Arial,sans-serif';
    setButton.style.fontSize = '12px';
    setButton.style.paddingLeft = '4px';
    setButton.style.paddingRight = '4px';
    setButton.style.cursor = 'pointer';
    setButton.innerHTML = 'Set';

    // Append everything to the wrapper div
    controlDiv.appendChild(setShowText);
    controlDiv.appendChild(controlInput);
    controlDiv.appendChild(setButton);
    
    var onClick = function() {
        
        var speed = $("#speed-control").val();

        if (isNumber(speed)){
            speedFactor = speed;
        };
    };
    google.maps.event.addDomListener(setButton, 'click', onClick);
    controlDiv.index = 7
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(controlDiv);
    
    
    
    
    // File Upload
    
    // Create a div to hold everything else
    var controlDiv = document.createElement('DIV');
    controlDiv.id = "controls";
    controlDiv.style.backgroundColor = 'white';
    controlDiv.style.borderStyle = 'solid';
    controlDiv.style.borderWidth = '1px';
    controlDiv.style.cursor = 'pointer';
    controlDiv.style.textAlign = 'center';
    controlDiv.style.padding = '1px';
        
    // Create an input field
    var fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.id = "files";
    fileInput.name = "files";
    fileInput.size = 3;
   
    // Create a button to send the information
    var resetButton = document.createElement('b');
    resetButton.style.fontFamily = 'Arial,sans-serif';
    resetButton.style.fontSize = '12px';
    resetButton.style.paddingLeft = '4px';
    resetButton.style.paddingRight = '4px';
    resetButton.style.cursor = 'pointer';
    resetButton.innerHTML = 'Reset';

    // Append everything to the wrapper div
    controlDiv.appendChild(fileInput);
    controlDiv.appendChild(resetButton);
    
    var JsonObj = null;
    
    var importData = function(evt) {
        
        // Check if file APIs are present
        if (window.File && window.FileReader && window.FileList && window.Blob){
            console.log('Begin File Load')
        } else {
                alert('The File Load APIs are not fully supported in this browser.')
        };
        
        //Retrieve the first (and only!) File from the FileList object
        var files = evt.target.files; 
    
        var f = files[0];
        
        if (f){
        
            var reader = new FileReader();
            
            var fileType = f.name.split('.');
            fileType = fileType[fileType.length - 1];

            // Closure to capture the file information.
            reader.onload = (function (theFile) {
                return function (e) { 
                    
                    JsonObj = e.target.result
            
                    if (fileType == "loc"){

                        JsonObj = loc2json(JsonObj);

                    }
                                        
                    // Clear previous stroke data
                    clearStrokes();

                    loadLocal = true;
                    runReal = true;
                    
                    loadFile = $.parseJSON(JsonObj);
					console.log('Load Finished')
                                
                };
            })(f);
            
            // Additional clearing and resetting
            
            clearStrokes();

            loadLocal = true;
            runReal = true;
                
           //  Read in JSON as a data URL.
            reader.readAsText(f, 'UTF-8');
                                                    
        } else { 
          alert("Failed to load file.");
            loadLocal = false;
        }
    }

    google.maps.event.addDomListener(fileInput, 'change', importData, false);
    google.maps.event.addDomListener(resetButton, 'click', dataClearAction);
    controlDiv.index = 1
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);

    
    
    // Create the selection box rectable
    
    // Create the selection box rectangle with listener for bounds change
    // Draw and set the rectangle 
    var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(-10, -110),
        new google.maps.LatLng(25, -60)
    );
    
    // Define the rectangle and set its editable property to true.
    rectangle = new google.maps.Rectangle({
        bounds: bounds,
        editable: true,
        draggable: true,
        fillOpacity: .1,
        strokeColor: '#FFFFFF'
    });

    
    // Function to check if a stroke is within the rectangle bounds
    function strokeInBounds(lat,lng){
        var ne = rectangle.getBounds().getNorthEast();
        var sw = rectangle.getBounds().getSouthWest();
        return lat >= sw.lat() && lat <= ne.lat() && lng >= sw.lng() && lng <= ne.lng();
    };

    
    /*
    This starts the function that updates the markers and is called at delay frequency
    */

    // Function to set and update markers, called through AJAX
	function setMarkers(locObj) {
        
        // Get current time
        var realTime = (new Date()).getTime()/1000;

        // Offset time by data offset
        var currentTime = realTime - timeOffset;
        
        // Set states, delays, and run status from time control buttons
        if (pauseSet){
            pauseTime = realTime - timeOffset;
            runPause = true;
            runReal = false;
            runPlay = false;
            pauseSet = false;
            console.log('Pausing playback.')
        };
        if (runReal){
            timeOffset = timeOffsetMin;
            runPlay = false;
            runPause = false;
            speedFactor = 1;
            runReal = false;
            console.log('Returning to real time playback.')
        }
        if (runPlay){
            runReal = false;
            runPause = false;
            runPlay = false;
            console.log('Resuming playback.')
        }
        if (runPause){
            timeOffset = realTime - pauseTime;
            runPlay = false;
            runReal = false;
        } 
        if (runForward){
            timeOffset = timeOffset - 30;
            pauseTime = pauseTime + 30;
            if ((realTime - timeOffset) > lastTime && lastTime!==-1e12){
                timeOffset = realTime - lastTime;
            };
            if (pauseTime > lastTime && lastTime !== -1e12){
                pauseTime = lastTime;
            };
            runForward = false;
            console.log('Moving forwards 30 seconds.')

        } else if (runBackward){
            timeOffset = timeOffset + 30;
            pauseTime = pauseTime - 30;
            if ((realTime - timeOffset) < firstTime && firstTime!==1e12){
                timeOffset = realTime - firstTime;
            };
            if (pauseTime < firstTime && firstTime !== 1e12){
                pauseTime = firstTime;
            };
            runBackward = false;
            console.log('Moving backwards 30 seconds.')
        };
        

        // Restart file if currentTime passes the last stroke by 2 minutes
        if ((realTime - timeOffset) > (lastTime + 120) && lastTime!==-1e12){
            timeOffset = realTime - firstTime;
            runReal = false;
            console.log('End of data file: Restarting playback')
        };
        
        // Pause at end of file
        if ((realTime - timeOffset) > (lastTime) && lastTime!==-1e12 && !runPause){
            pauseSet = true;
            timeOffset = timeOffset + 1;
            speedFactor = 1;
            console.log('End of data file: Pausing')
        };
  
        // Force timeOffset to stay below timeOffsetMin
        if (timeOffset < timeOffsetMin){
            timeOffset = timeOffsetMin;
            console.log('Cannot exceed ' + timeOffsetMin + ' seconds of current time.')
        };

        // Return to the start of the file
        if (runStart){
            timeOffset = realTime - firstTime;
            runReal = false;
            runPause = false;
            runStart = false;
            speedFactor = 1;
            console.log('Moving to start of the data file.')
        };
        
        // Increase playback speed by speedFactor
        timeOffset = timeOffset -  ajaxObj.delay * (speedFactor  - 1) / 1000;
        
        // Offset time by new time offset
        currentTime = realTime - timeOffset;
                
        // Set terminator time
        var currentUTC = new Date(currentTime*1000);
        dno.setDate(currentUTC);
 
        // Display time in info div
        if (document.getElementById('time')){
            var info = document.getElementById('time');
            info.innerHTML = 'Current Time Shown: ' + currentUTC;
        };
        
        // Display total number of strokes
        if (document.getElementById('stats')){
            var info = document.getElementById('stats');
            if (showBox){
                info.innerHTML = 'Global stroke rate: ' + currentStrokes / markerLifetime + ' (strokes/second), Strokes rate in selection: ' + currentBoxStrokes / markerLifetime + ' (strokes/second)';
            } else {
                info.innerHTML = 'Global stroke rate: ' + currentStrokes / markerLifetime + ' (strokes/second)';
            };
        }
        
        currentStrokes = 0; 
        currentBoxStrokes = 0;
        
        // Display total strokes held in memory
        if (document.getElementById('memory')){
            var strokeMemory = document.getElementById('memory');
            var strokeCount = Object.keys(locations).length
            strokeMemory.innerHTML = strokeCount + ' strokes held in memory.';
        };
        
        // Display earliest time in info div
        if (document.getElementById('firstTime')){
            var firstInfo = document.getElementById('firstTime');
            var firstUTC = new Date(firstTime*1000);
            if (firstTime !== 1e12){
                firstInfo.innerHTML = 'Earliest Time Available: ' + firstUTC;
            };
        };

        // Only get new data if it has been at least getDelay since the last fetch
        if (realTime > (lastGet + getDelay)){
            $.each(locObj, function(key, loc) {
                
                // Create stroke location object for each JSON entry
                if(!locations[key] && loc.lat!==undefined && loc.long!==undefined) {
    
                    // Define initial lightning time difference, if occurs after currenTime set size to 0
                    // If not in JSON data default to currentTime
                    if(loc.unixTime==undefined){
                        loc.unixTime = currentTime;
                    };
                    
                    loc.mag = timeSize(currentTime, loc.unixTime);
                    
                    // Set firstTime to the earliest time in the record
                    if (loc.unixTime < firstTime) {
                        firstTime = loc.unixTime
                    };
                    
                    
                    // Set lastTime to the lastest time in the record
                    if (loc.unixTime > lastTime) {
                        lastTime = loc.unixTime
                    };
                    
    //				//Attach click listener to marker
    //				google.maps.event.addListener(loc.marker, 'click', (function(key) {
    //					return function() {
    //						if(locations[key]) {
    //							infowindow.setContent(locations[key].info);
    //							infowindow.open(map, locations[key].marker);
    //						}
    //					}
    //				})(key));
    
                    //Remember loc in the `locations` so its info can be displayed and so its marker can be deleted.
                    locations[key] = loc;
                }
                
            });
            
            lastGet = realTime
            
            // Update density map on each new fetch
            if (showAll && updateCountDensity == 0){
              setDensityMap(); 
              updateCountDensity = 10;
            } else if (showAll && updateCountDensity != 0){
              updateCountDensity--;   
            };
            
        };
    
     
		// If strokes were removed increment firstTime by 60 seconds 
		if (update_firstTime){
			firstTime = firstTime + 59;
			update_firstTime = false;
		} 
 
        $.each(locations, function(key, loc) {
 
            // Keep locations below maxFileSize by dropping oldest markers
            if( strokeCount > maxFileSize && locations[key].unixTime < (firstTime + 60)){
                
				//Remove marker from map
				if(locations[key].marker !== undefined) {
					locations[key].marker.setMap(null);
					locations[key].marker = undefined
				}
                
                delete locations[key];

				update_firstTime = true;
                return; 
            }
    
			// Update first time to oldest stroke in record
            if ( strokeCount < maxFileSize && firstTime > locations[key].unixTime) {
                firstTime = locations[key].unixTime;
             };
        
            // Only create a marker for the current time window
            if(locations[key].marker == undefined && loc.mag > 0){
             
                //Create marker
				loc.marker = new google.maps.Marker({
					position: new google.maps.LatLng(loc.lat, loc.long),
					map: map,
                    icon: getCircle(loc.mag)
				});
                
                currentStrokes = currentStrokes + 1;
                currentBoxStrokes = currentBoxStrokes + strokeInBounds(loc.lat,loc.long)
                
            };
            
			if(locations[key] && loc.remove && locations[key].marker!==undefined) {
				//Remove marker from map
				if(locations[key].marker) {
					locations[key].marker.setMap(null);
					locations[key].marker = undefined
				}
                
				//Remove element from `locations`
				//delete locations[key];

			}
			else if(locations[key]) {
				//Update the previous data object with the latest data.
				$.extend(locations[key], loc);
                
                // Update the stroke size                
                
                if(loc.mag!==undefined) {
                    
                    // Update stroke size
                    loc.mag = timeSize(currentTime, loc.unixTime);
                    
                    // If there is a marker, update marker size
                    if (locations[key].marker!==undefined){
                        // Update markers
                        locations[key].marker.setIcon(
                           getCircle(loc.mag)
                        )
						currentStrokes = currentStrokes + 1;
                        currentBoxStrokes = currentBoxStrokes + strokeInBounds(loc.lat,loc.long)

                    };
                    
                    // Remove marker outside of the time window
                    if(loc.mag <= 0) {
                        loc.remove = true;                        
                    } else {
                        loc.remove = false
                    };
                    
                }
                
                //locations[key].info looks after itself.
			}
                        
            
		});
        
        ajaxObj.errorCount = 0;
        
	}

	var ajaxObj = {//Object to save cluttering the namespace.
		options: {
			url: dataFile,//The resource that delivers loc data.
			dataType: "json"//The type of data tp be returned by the server.
		},
		delay: 100,//(milliseconds) the interval between loops
		errorCount: 0,//running total of ajax errors.
		errorThreshold: 10,//the number of ajax errors beyond which the get cycle should cease.
		ticker: null,//setTimeout reference - allows the get cycle to be cancelled with clearTimeout(ajaxObj.ticker);
		get: function() { //a function which initiates 
			if(ajaxObj.errorCount < ajaxObj.errorThreshold) {
				ajaxObj.ticker = setTimeout(getMarkerData, ajaxObj.delay);
			}
		},
		fail: function(jqXHR, textStatus, errorThrown) {
			console.log('Error Count: ' + ajaxObj.errorCount + ', ' + errorThrown);
			ajaxObj.errorCount++;
		}
	};
	
	//Ajax master routine
	function getMarkerData() {
        
        if (loadLocal){
            setMarkers(loadFile);
            setTimeout(getMarkerData, ajaxObj.delay);
        } else {
            $.ajax(ajaxObj.options)
              .done(setMarkers) //fires when ajax returns successfully
              .fail(ajaxObj.fail) //fires when an ajax error occurs
              .always(ajaxObj.get); //fires after ajax success or ajax error
        }
	}

	ajaxObj.get();//Start the get cycle.


}); 
