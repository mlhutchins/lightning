$(function(){

    // Initialize storage array for stroke data
    var locations = {};//A repository for markers (and the data from which they were contructed).

    // Internal map settings
    var startMag = 6; // Initial marker size
    var endMag = 2; // Final marker size
    var decayTime = 0.5; // Decay of marker (size / second)
    var markerLifetime = (startMag - endMag) / decayTime; // Marker lifetime
    var timeOffset = 720; // Delay between JSON data and current time
    var timeOffsetMin = timeOffset; // Minimum offset from real time
    var getDelay = 1; // interval between server fetches (s)
    var densityRadius = 25; // Radius of the heatmap (pixels)
    
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
    var auto_remove = false;//When true, markers for all unreported locs will be removed.
    var showBox = false; // Start with no subset box shown
    var showAll = false; // Don't show all loaded strokes on launch
    var removeMarkers = false; // Set removal of all markers to false
    var gradient = ['rgba(254,229,217,0)','rgba(254,229,217,1)', 'rgba(252,187,161,1)', 'rgba(252,146,114,1)', 'rgba(251,106,74,1)', 'rgba(222,45,38,1)', 'rgba(165,15,21,1)']; // Set Color Gradient for density
    var getStrokePoints = false; // Start off not accumulating strokes into a heatmap
    var runStart = false; // Return to start variable
    
    // Internal storage
    var currentStrokes = 0; // Index of total strokes displayed
    var currentBoxStrokes = 0; // Index of strokes in box
    var lastGet = 0; // holds time of last server fetch
    var strokePoints = []; // Array to hold stroke data
    var heatmap;
    // Cloud layer settings
    var cloudLayer = new google.maps.weather.CloudLayer();
    var showCloud = true; 
    
	var map = new google.maps.Map(document.getElementById('map-canvas'), {
		zoom: 3,
		maxZoom: 8,
		minZoom: 2,
		streetViewControl: false,
		center: new google.maps.LatLng(40, 0),
		mapTypeId: google.maps.MapTypeId.SATELLITE
	});
    
	var infowindow = new google.maps.InfoWindow();
    
    window.dno = new DayNightOverlay({
                    map: map,
                    fillColor: 'rgba(0,0,0,0.3)',
                    date: new Date(Date.UTC(2011,0,1))
                });

    window.dateField = document.getElementById('date');
    
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
	
    // Map Title
    var myTitle = document.createElement('div');
    myTitle.style.color = 'white';
    myTitle.innerHTML = '<h1>Real Time Lightning Locations</h1>';
    map.controls[google.maps.ControlPosition.BOTTOM_CENTER].push(myTitle);
    
    // WWLLN name / link
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
 
    // Add Name oject to map
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

    infowindow = new google.maps.InfoWindow(); 

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
    
    // Stroke marker style
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
            google.maps.event.addDomListener(setButtonUI, 'click', buttonAction());
            
        };
        
        var buttonControlDiv = document.createElement('div');
        var buttonControl = new ButtonData(buttonControlDiv, map);
        
        buttonControlDiv.index = buttonOptions.index;
        var position = new google.maps.ControlPosition

        buttonOptions.location;
        
        map.controls[google.maps.ControlPosition.position].push(buttonControlDiv);
        
    };
    
    
    
    // Clould Layer Display

    var cloudOptions = {
        location: 'TOP_LEFT',
        index: 1,
        mouseOver: 'Click to show cloud overlay.',
        htmlText: '<b>Cloud Overlay</b>'
    };
    
    button(cloudOptions, function cloudAction() { 
        if (showCloud){
            cloudLayer.setMap(map);
            showCloud = false;
        } else {
            cloudLayer.setMap(null);
            showCloud = true;
        };
    });
         
    
    
        
    // Show All Strokes Button
    // Define a property to hold the Show state
    ShowData.prototype.show_ = null;
    
    ShowData.prototype.setShow = function(show) {
        this.show_ = show;
    }
        
    function ShowData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setShow control border
        var setShowUI = document.createElement('div');
        setShowUI.style.backgroundColor = 'white';
        setShowUI.style.borderStyle = 'solid';
        setShowUI.style.borderWidth = '1px';
        setShowUI.style.cursor = 'pointer';
        setShowUI.style.textAlign = 'center';
        setShowUI.title = 'Click to show loaded stroke density';
        controlDiv.appendChild(setShowUI);
        
        // Set CSS for the control interior
        var setShowText = document.createElement('div');
        setShowText.style.fontFamily = 'Arial,sans-serif';
        setShowText.style.fontSize = '12px';
        setShowText.style.paddingLeft = '4px';
        setShowText.style.paddingRight = '4px';
        setShowText.innerHTML = '<b>Stroke Density</b>';
        setShowUI.appendChild(setShowText);
        
        // Setup the click event listener for Set Show:
        // Set the control's show to the current Map center.
        google.maps.event.addDomListener(setShowUI, 'click', function() {
            
            if (showAll){
                heatmap.setMap(null);
                showAll = false;
            } else {
                        
                showAll = true;
                getStrokePoints = true;
            };

        });
    };
    
    var showControlDiv = document.createElement('div');
    var showControl = new ShowData(showControlDiv, map);
    
    showControlDiv.index = 2;
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(showControlDiv);


        
    
    // Data flush button
    // Define a property to hold the Clear state
    ClearData.prototype.clear_ = null;
    
    ClearData.prototype.setClear = function(clear) {
        this.clear_ = clear;
    }
        
    function ClearData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setClear control border
        var setClearUI = document.createElement('div');
        setClearUI.style.backgroundColor = 'white';
        setClearUI.style.borderStyle = 'solid';
        setClearUI.style.borderWidth = '1px';
        setClearUI.style.cursor = 'pointer';
        setClearUI.style.textAlign = 'center';
        setClearUI.title = 'Click to clear current data.';
        controlDiv.appendChild(setClearUI);
        
        // Set CSS for the control interior
        var setClearText = document.createElement('div');
        setClearText.style.fontFamily = 'Arial,sans-serif';
        setClearText.style.fontSize = '12px';
        setClearText.style.paddingLeft = '4px';
        setClearText.style.paddingRight = '4px';
        setClearText.innerHTML = '<b>Clear Data</b>';
        setClearUI.appendChild(setClearText);
        
        // Setup the click event listener for Set Clear:
        // Set the control's clear to the current Map center.
        google.maps.event.addDomListener(setClearUI, 'click', function() {
            auto_remove = true;
            removeMarkers = true;
            heatmap.setMap(null);
            showAll = false;
            runPlay = true;
        });
    };
    
    var clearControlDiv = document.createElement('div');
    var clearControl = new ClearData(clearControlDiv, map);
    
    clearControlDiv.index = 2;
    map.controls[google.maps.ControlPosition.RIGHT_TOP].push(clearControlDiv);

    
    
    // Time Controls

    // Play data
    PlayData.prototype.clear_ = null;
    
    PlayData.prototype.setPlay = function(clear) {
        this.clear_ = clear;
    }
        
    function PlayData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setPlay control border
        var setPlayUI = document.createElement('div');
        setPlayUI.style.backgroundColor = 'white';
        setPlayUI.style.borderStyle = 'solid';
        setPlayUI.style.borderWidth = '1px';
        setPlayUI.style.cursor = 'pointer';
        setPlayUI.style.textAlign = 'center';
        setPlayUI.title = 'Click to resume.';
        controlDiv.appendChild(setPlayUI);
        
        // Set CSS for the control interior
        var setPlayText = document.createElement('div');
        setPlayText.style.fontFamily = 'Arial,sans-serif';
        setPlayText.style.fontSize = '12px';
        setPlayText.style.paddingLeft = '4px';
        setPlayText.style.paddingRight = '4px';
        setPlayText.innerHTML = '<b>Resume</b>';
        setPlayUI.appendChild(setPlayText);
        
        // Setup the click event listener for Set Play:
        // Set the control's play to the current Map center.
        google.maps.event.addDomListener(setPlayUI, 'click', function() {
            runPlay = true;
        });
    };
    
    var playControlDiv = document.createElement('div');
    var playControl = new PlayData(playControlDiv, map);
    
    playControlDiv.index = 3;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(playControlDiv);
    
    
    // Pause data
    PauseData.prototype.clear_ = null;
    
    PauseData.prototype.setPause = function(clear) {
        this.clear_ = clear;
    }
        
    function PauseData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setPause control border
        var setPauseUI = document.createElement('div');
        setPauseUI.style.backgroundColor = 'white';
        setPauseUI.style.borderStyle = 'solid';
        setPauseUI.style.borderWidth = '1px';
        setPauseUI.style.cursor = 'pointer';
        setPauseUI.style.textAlign = 'center';
        setPauseUI.title = 'Click to pause playback.';
        controlDiv.appendChild(setPauseUI);
        
        // Set CSS for the control interior
        var setPauseText = document.createElement('div');
        setPauseText.style.fontFamily = 'Arial,sans-serif';
        setPauseText.style.fontSize = '12px';
        setPauseText.style.paddingLeft = '4px';
        setPauseText.style.paddingRight = '4px';
        setPauseText.innerHTML = '<b>Pause</b>';
        setPauseUI.appendChild(setPauseText);
        
        // Setup the click event listener for Set Pause:
        // Set the control's pause to the current Map center.
        google.maps.event.addDomListener(setPauseUI, 'click', function() {
            pauseSet = true;
        });
    };
    
    var pauseControlDiv = document.createElement('div');
    var pauseControl = new PauseData(pauseControlDiv, map);
    
    pauseControlDiv.index = 2;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(pauseControlDiv);
    
    
    // Resume realtime data
    RealData.prototype.clear_ = null;
    
    RealData.prototype.setReal = function(clear) {
        this.clear_ = clear;
    }
        
    function RealData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setReal control border
        var setRealUI = document.createElement('div');
        setRealUI.style.backgroundColor = 'white';
        setRealUI.style.borderStyle = 'solid';
        setRealUI.style.borderWidth = '1px';
        setRealUI.style.cursor = 'pointer';
        setRealUI.style.textAlign = 'center';
        setRealUI.title = 'Click to reset to real-time playback.';
        controlDiv.appendChild(setRealUI);
        
        // Set CSS for the control interior
        var setRealText = document.createElement('div');
        setRealText.style.fontFamily = 'Arial,sans-serif';
        setRealText.style.fontSize = '12px';
        setRealText.style.paddingLeft = '4px';
        setRealText.style.paddingRight = '4px';
        setRealText.innerHTML = '<b>Real-Time</b>';
        setRealUI.appendChild(setRealText);
        
        // Setup the click event listener for Set Real:
        // Set the control's real to the current Map center.
        google.maps.event.addDomListener(setRealUI, 'click', function() {
            runReal = true;
            removeMarkers = true;
        });
    };
    
    var realControlDiv = document.createElement('div');
    var realControl = new RealData(realControlDiv, map);
    
    realControlDiv.index = 5;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(realControlDiv);
    
           
    // Set time forward 
    ForwardData.prototype.clear_ = null;
    
    ForwardData.prototype.setForward = function(clear) {
        this.clear_ = clear;
    };
        
    function ForwardData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setForward control border
        var setForwardUI = document.createElement('div');
        setForwardUI.style.backgroundColor = 'white';
        setForwardUI.style.borderStyle = 'solid';
        setForwardUI.style.borderWidth = '1px';
        setForwardUI.style.cursor = 'pointer';
        setForwardUI.style.textAlign = 'center';
        setForwardUI.title = 'Click to move forward 30 seconds.';
        controlDiv.appendChild(setForwardUI);
        
        // Set CSS for the control interior
        var setForwardText = document.createElement('div');
        setForwardText.style.fontFamily = 'Arial,sans-serif';
        setForwardText.style.fontSize = '12px';
        setForwardText.style.paddingLeft = '4px';
        setForwardText.style.paddingRight = '4px';
        setForwardText.innerHTML = '<b>+30 Seconds</b>';
        setForwardUI.appendChild(setForwardText);
        
        // Setup the click event listener for Set Forward:
        // Set the control's forward to the current Map center.
        google.maps.event.addDomListener(setForwardUI, 'click', function() {
            runForward = true;
        });
    };
    
    var forwardControlDiv = document.createElement('div');
    var forwardControl = new ForwardData(forwardControlDiv, map);
    
    forwardControlDiv.index = 4;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(forwardControlDiv);
    
    
    
    // Set time backward 
    BackwardData.prototype.clear_ = null;
    
    BackwardData.prototype.setBackward = function(clear) {
        this.clear_ = clear;
    };
        
    function BackwardData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setBackward control border
        var setBackwardUI = document.createElement('div');
        setBackwardUI.style.backgroundColor = 'white';
        setBackwardUI.style.borderStyle = 'solid';
        setBackwardUI.style.borderWidth = '1px';
        setBackwardUI.style.cursor = 'pointer';
        setBackwardUI.style.textAlign = 'center';
        setBackwardUI.title = 'Click to move back 30 seconds.';
        controlDiv.appendChild(setBackwardUI);
        
        // Set CSS for the control interior
        var setBackwardText = document.createElement('div');
        setBackwardText.style.fontFamily = 'Arial,sans-serif';
        setBackwardText.style.fontSize = '12px';
        setBackwardText.style.paddingLeft = '4px';
        setBackwardText.style.paddingRight = '4px';
        setBackwardText.innerHTML = '<b>-30 Seconds</b>';
        setBackwardUI.appendChild(setBackwardText);
        
        // Setup the click event listener for Set Backward:
        // Set the control's backward to the current Map center.
        google.maps.event.addDomListener(setBackwardUI, 'click', function() {
            runBackward = true;
        });
    }
    
    var backwardControlDiv = document.createElement('div');
    var backwardControl = new BackwardData(backwardControlDiv, map);
    
    backwardControlDiv.index = 1;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(backwardControlDiv);
    
    
    // Set time to start
    
    StartData.prototype.start_ = null;
    
    StartData.prototype.setStart = function(start) {
        this.start_ = start;
    };
        
    function StartData(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setStart control border
        var setStartUI = document.createElement('div');
        setStartUI.style.backgroundColor = 'white';
        setStartUI.style.borderStyle = 'solid';
        setStartUI.style.borderWidth = '1px';
        setStartUI.style.cursor = 'pointer';
        setStartUI.style.textAlign = 'center';
        setStartUI.title = 'Click to go to start of loaded strokes.';
        controlDiv.appendChild(setStartUI);
        
        // Set CSS for the control interior
        var setStartText = document.createElement('div');
        setStartText.style.fontFamily = 'Arial,sans-serif';
        setStartText.style.fontSize = '12px';
        setStartText.style.paddingLeft = '4px';
        setStartText.style.paddingRight = '4px';
        setStartText.innerHTML = '<b>Start</b>';
        setStartUI.appendChild(setStartText);
        
        // Setup the click event listener for Set Start:
        // Set the control's start to the current Map center.
        google.maps.event.addDomListener(setStartUI, 'click', function() {
            runStart = true
        });
    }
    
    var startControlDiv = document.createElement('div');
    var startControl = new StartData(startControlDiv, map);
    
    startControlDiv.index = 0;
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(startControlDiv);
    
    
    
    // Subset Box Activation Button
    // Define a property to hold the Show state
    ShowBox.prototype.show_ = null;
    
    ShowBox.prototype.setShow = function(show) {
        this.show_ = show;
    }
        
    function ShowBox(controlDiv, map) {
        
        // Set CSS styles for the DIV containing the control
        // Setting padding to 5 px will offset the control
        // from the edge of the map
        controlDiv.style.padding = '5px';
        
        // Set CSS for the setShow control border
        var setShowUI = document.createElement('div');
        setShowUI.style.backgroundColor = 'white';
        setShowUI.style.borderStyle = 'solid';
        setShowUI.style.borderWidth = '1px';
        setShowUI.style.cursor = 'pointer';
        setShowUI.style.textAlign = 'center';
        setShowUI.title = 'Click to show the selection box.';
        controlDiv.appendChild(setShowUI);
        
        // Set CSS for the control interior
        var setShowText = document.createElement('div');
        setShowText.style.fontFamily = 'Arial,sans-serif';
        setShowText.style.fontSize = '12px';
        setShowText.style.paddingLeft = '4px';
        setShowText.style.paddingRight = '4px';
        setShowText.innerHTML = '<b>Selection Box</b>';
        setShowUI.appendChild(setShowText);
        
        // Setup the click event listener for Set Show:
        // Set the control's show to the current Map center.
        google.maps.event.addDomListener(setShowUI, 'click', function() {
            if (showBox){
                showBox = false;
                rectangle.setMap(null);   

            } else {
                showBox = true;
                rectangle.setMap(map);

            };
        });
    };
    
    var showControlDiv = document.createElement('div');
    var showControl = new ShowBox(showControlDiv, map);
    
    showControlDiv.index = 1;
    map.controls[google.maps.ControlPosition.RIGHT_TOP].push(showControlDiv);

    
    
    
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
        };
        if (runReal){
            timeOffset = timeOffsetMin;
            runPlay = false;
            runPause = false;
            speedFactor = 1;
        }
        if (runPlay){
            runReal = false;
            runPause = false;
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
        };
        

        // Restart file if currentTime passes the last stroke by 2 minutes
        if ((realTime - timeOffset) > (lastTime + 120) && lastTime!==-1e12){
            timeOffset = realTime - firstTime;
            runReal = false;
            
        };
        
        // Pause at end of file
        if ((realTime - timeOffset) > (lastTime) && lastTime!==-1e12 && !runPause){
            pauseSet = true;
            timeOffset = timeOffset + 1;
            speedFactor = 1;
        };
  
        // Force timeOffset to stay below timeOffsetMin
        if (timeOffset < timeOffsetMin){
            timeOffset = timeOffsetMin;
        };

        // Return to the start of the file
        if (runStart){
            timeOffset = realTime - firstTime;
            runReal = false;
            runPause = false;
            runStart = false;
            speedFactor = 1;
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
        
        // Remove strokes if clear button pressed, and reset pause timing
		if(auto_remove) {
			//Remove markers for all unreported locs, and the corrsponding locations entry.
			$.each(locations, function(key) {
                if(locations[key].marker) {
                    locations[key].marker.setMap(null);
                }
                delete locations[key];
			});
            auto_remove = false;
            runReal = false
            firstTime = 1e12;
		}

        // Remove markers if removeMarkers triggered
		if(removeMarkers) {
			//Remove markers for all unreported locs, and the corrsponding locations entry.
			$.each(locations, function(key) {
                if(locations[key].marker) {
                    locations[key].marker.setMap(null);
                }
			});
            removeMarkers = false;
		}
        
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
        };
        
        if (getStrokePoints){
            strokePoints = [];
        };
        
        $.each(locations, function(key, loc) {
       
            if (getStrokePoints){
                // Add strokes to strokePoint array
                var stroke = new google.maps.LatLng(locations[key].lat,locations[key].long)
                strokePoints.push(stroke)
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

        
        // Create and set heatmap / stroke density
        
        if (getStrokePoints){
            
            var pointArray = new google.maps.MVCArray(strokePoints);
            heatmap = new google.maps.visualization.HeatmapLayer({
                data: pointArray
            });
        
            heatmap.setOptions({
                gradient : gradient,
                radius: densityRadius
            });
                        
            heatmap.setMap(map);
            getStrokePoints = false;
        }
        
        ajaxObj.errorCount = 0;
        
	}

	var ajaxObj = {//Object to save cluttering the namespace.
		options: {
			url: "data/current.json",//The resource that delivers loc data.
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
		$.ajax(ajaxObj.options)
		  .done(setMarkers) //fires when ajax returns successfully
		  .fail(ajaxObj.fail) //fires when an ajax error occurs
		  .always(ajaxObj.get); //fires after ajax success or ajax error
	}

	ajaxObj.get();//Start the get cycle.


}); 
