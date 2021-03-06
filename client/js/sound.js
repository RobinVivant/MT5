// Amine Hallili
//hooking the interface object to the window
window.View = new View();

var isLooping;
// The current song
var currentSong;

var _finishedLoading;
var partocheOpened = false;

// The audio context
var context;

var buttonPlay, buttonStop, buttonRecordMix;
// List of tracks and mute buttons
var divTrack;
//The div where we display messages
var divConsole;

// Object that draws a sample waveform in a canvas
var waveformDrawer;

// zone selected for loop
var selectionForLoop = {
    xStart: -1,
    xEnd: -1,
    width: 0
};

var isMousedown = false;

// Sample size in pixels
var SAMPLE_HEIGHT = 75;

// Useful for memorizing when we paused the song
var lastTime = 0;
var currentTime;
var delta;
// The x position in pixels of the timeline
var currentXTimeline;

// requestAnim shim layer by Paul Irish, like that canvas animation works
// in all browsers
window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function ( /* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();


function init() {

    View.init();

    // Get handles on buttons
    buttonPlay = document.querySelector("#bplay");
    buttonStop = document.querySelector("#bstop");
    buttonRecordMix = document.querySelector("#brecordMix");

    divTrack = document.getElementById("tracks");
    divConsole = document.querySelector("#messages");

    
     // The waveform drawer
     waveformDrawer = new WaveformDrawer();

     View.frontCanvas.addEventListener("touchstart", function (event) {
        if (currentSong === undefined || _finishedLoading == false) return;
        var mousePos = getMousePos(window.View.frontCanvas, event, true);

        if (isLooping) {
            resetSelection();
            setLoopStart(mousePos);
        }
        else {
            // will compute time from mouse pos and start playing from there...
            jumpTo(mousePos.x);

            if ($("#bplay").hasClass('fa-play')) {
                $("#bplay").removeClass('fa-play');
                $("#bplay").addClass('fa-pause');
            }
        }
    });

     View.frontCanvas.addEventListener("mousedown", function (event) {
        if (currentSong === undefined || _finishedLoading == false) return;
        var mousePos = getMousePos(window.View.frontCanvas, event, false);
        isMousedown = true;
        if (isLooping) {
            resetSelection();
            setLoopStart(mousePos);
        }
        else {
            // will compute time from mouse pos and start playing from there...
            jumpTo(mousePos.x);

            if ($("#bplay").hasClass('fa-play')) {
                $("#bplay").removeClass('fa-play');
                $("#bplay").addClass('fa-pause');
            }
        }
    });

     View.frontCanvas.addEventListener("touchmove", function(event) {
         if (currentSong === undefined || _finishedLoading == false) return;
         if (isLooping) {
            var mousePos = getMousePos(window.View.frontCanvas, event, true);
            setLoopEnd(mousePos);
         }
     });

     View.frontCanvas.addEventListener("mousemove", function(event) {
         if (currentSong === undefined || _finishedLoading == false) return;
         if (isMousedown) {
            if (isLooping) {
               var mousePos = getMousePos(window.View.frontCanvas, event, false);
               setLoopEnd(mousePos);
            }
        }
     });

     View.frontCanvas.addEventListener("touchend", function(event) {
        if (isLooping) {
            stopAllTracks();
            var totalTime = currentSong.getDuration();
            var startTime = (selectionForLoop.xStart * totalTime) / window.View.frontCanvas.width;
            currentSong.elapsedTimeSinceStart = startTime;
            lastTime = context.currentTime;
            playAllTracks(startTime);
        }
     });

     View.frontCanvas.addEventListener("mouseup", function(event) {
        if (isLooping) {
            isMousedown = false;
            stopAllTracks();
            var totalTime = currentSong.getDuration();
            var startTime = (selectionForLoop.xStart * totalTime) / window.View.frontCanvas.width;
            currentSong.elapsedTimeSinceStart = startTime;
            lastTime = context.currentTime;
            playAllTracks(startTime);
        }
     });
     
    // Master volume slider
    masterVolumeSlider = $('#masterVolume').val();

    // Init audio context
    context = initAudioContext();

    // Get the list of the songs available on the server and build a
    // drop down menu
    loadSongList();

    animateTime();
}

function log(message) {
    // Be sure that the console is visible
    View.activeConsoleTab();
    $('#messages').append(message + "<br/>");
    $('#messages').animate({
        scrollTop: $('#messages').prop("scrollHeight")
    }, 500);
}

function clearLog() {
    $('#messages').empty();
}

function existsSelection() {
    return (isLooping) ? (selectionForLoop.xStart !== -1) : ((selectionForLoop.xStart !== -1) && (selectionForLoop.xEnd !== -1));
}

function loopOnOff() {
    currentSong.toggleLoopMode();
    console.log("LoopMode : " + currentSong.loopMode);
}

function setLoopStart(mousePos) {
    if (!currentSong.paused) {
        selectionForLoop.xStart = mousePos.x;
        // Switch xStart and xEnd if necessary, compute width of selection
        adjustSelectionMarkers();
    }
}

function setLoopEnd(mousePos) {
    if (!currentSong.paused) {
        selectionForLoop.xEnd = mousePos.x;
        if (selectionForLoop.xEnd < selectionForLoop.xStart) {
            selectionForLoop.xStart = selectionForLoop.xEnd;
            selectionForLoop.xEnd = selectionForLoop.xStart;
        }
        // Switch xStart and xEnd if necessary, compute width of selection
        adjustSelectionMarkers();
    }
}

function resetSelection() {
    selectionForLoop = {
        xStart: -1,
        xEnd: -1,
        width: 0
    };
}

function handleClickLoop() {
    if (currentSong === undefined || _finishedLoading == false) return;
    if (isLooping) {
        resetSelection();
        isLooping = false;
        loopOnOff();
        $('.fa-refresh').css('color', 'black');
    }
    else {
        resetSelection();
        isLooping = true;
        loopOnOff();
        $('.fa-refresh').css('color', '#00F0F0');
    }
}



function adjustSelectionMarkers() {
    if (existsSelection()) {
        // Adjust the different values of the selection
        var selectionWidth;
        var start = selectionForLoop.xStart;
        var end;
        if (selectionForLoop.xEnd != -1) {
            end = selectionForLoop.xEnd;
            selectionWidth = Math.abs(end - start);
        }

        selectionForLoop = {
            xStart: start,
            xEnd: end,
            width: selectionWidth
        };
    }
}

function initAudioContext() {
    // Initialise the Audio Context
    // There can be only one!
    var context;

    if (typeof AudioContext == "function") {
        context = new AudioContext();
    } else if ((typeof webkitAudioContext == "function") || (typeof webkitAudioContext == "object")) {
        context = new webkitAudioContext()
    } else {
        throw new Error('AudioContext is not supported. :(');
    }
    return context;
}
// SOUNDS AUDIO ETC.


function resetAllBeforeLoadingANewSong() {

    // disable the menu for selecting song: avoid downloading more than one song
    // at the same time
    var s = document.querySelector("#songSelect");
    s.disabled = true;

    // reset the selection
    resetSelection();

    // Stop the song
    stopAllTracks();

    buttonPlay.disabled = true;
    divTrack.innerHTML = "";


    buttonRecordMix.disabled = true;
}

var bufferLoader;

function loadAllSoundSamples() {
    bufferLoader = new BufferLoader(
        context,
        currentSong.getUrlsOfTracks(),
        finishedLoading,
        drawTrack
    );
    bufferLoader.load();
}

function drawTrack(decodedBuffer, trackNumber) {

    if (trackNumber != currentSong.tracks.length - 2)
        return;
     
    var trackName = currentSong.tracks[trackNumber].name;
    trackName = trackName.slice(trackName.lastIndexOf("/")+1, trackName.length-4);

    waveformDrawer.init(decodedBuffer, View.masterCanvas, '#E7865C');
    var x = 0;
    var y = 0;
    // First parameter = Y position (top left corner)
    // second = height of the sample drawing
    waveformDrawer.drawWave(y, window.View.masterCanvas.height);
    
     View.masterCanvasContext.strokeStyle = "white";
     View.masterCanvasContext.strokeRect(x, y, window.View.masterCanvas.width, window.View.masterCanvas.height);
}

function finishedLoading(bufferList) {
    _finishedLoading = true;
    log("Finished loading all tracks, press Start button above!");

    // set the decoded buffer in the song object
    currentSong.setDecodedAudioBuffers(bufferList);

    buttonPlay.disabled = false;
    buttonRecordMix.disabled = false;

    //enabling the loop buttons
    $('#loopBox > button').each(function (key, item) {
        item.disabled = false;
    });

    // enable all mute/solo buttons
    $(".mute").attr("disabled", false);
    $(".solo").attr("disabled", false);

    $("#ce-playbackControls i").css('color', 'black');

    // enable song select menu
    var s = document.querySelector("#songSelect");
    s.disabled = false;

    $('#loadingTracks').text('');

    // Set each track volume slider to max
    for (i = 0; i < currentSong.getNbTracks(); i++) {
        // set volume gain of track i to max (1)
        //currentSong.setVolumeOfTrack(1, i);
        $(".volumeSlider").each(function (obj, value) {
            obj.value = 100;
        });
    }
}


// ######### SONGS
function loadSongList() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', "track", true);

    // Menu for song selection
    var s = $("<select id='songSelect'/>");
    s.appendTo("#songs");

    s.change(function (e) {
        var songName = $(this).val();

        if (songName !== "nochoice") {
            // We load if there is no current song or if the current song is
            // different than the one chosen
            if ((currentSong === undefined) || ((currentSong !== undefined) && (songName !== currentSong.name))) {
                loadSong(songName);
                View.activeConsoleTab();
            }
        }
    });

    xhr.onload = function (e) {
        var songList = JSON.parse(this.response);

        if (songList[0]) {
            $("<option />", {
                value: "nochoice",
                text: "Choisir un morceau..."
            }).appendTo(s);
        }

        songList.forEach(function (songName) {

            $("<option />", {
                value: songName,
                text: songName
            }).appendTo(s);
        });
    };
    xhr.send();
}

function openPartoche(trackNumber) {

    var p = document.querySelector("#partoche" + trackNumber);
    var tb = document.querySelector("#trackBox" + trackNumber);

    if (partocheOpened) {
        $(p).height(120);
        $(tb).height(120);
        $(tb).css('background-color', '#525252');
        $(p).css('z-index', '0');
        $(p).css('border', '0px solid #525252');
        $(p).css('transform', 'scale(1, 1)');
        $(p).css('margin-left', '2px');
    } else {
        $(p).height($('#scroll').height());
        $(tb).height($('#scroll').height());
        $(tb).css('background-color', '#A04646');
        $(p).css('z-index', '10');
        $(p).css('border', '5px solid #A04646');
        $(p).css('transform', 'scale(0.95, 1)');
        $(p).css('margin-left', '-18px');
    }

    partocheOpened = !partocheOpened;
}

// ##### TRACKS #####

function loadSong(songName) {
    resetAllBeforeLoadingANewSong();

    // This function builds the current
    // song and resets all states to default (zero muted and zero solo lists, all
    // volumes set to 1, start at 0 second, etc.)
    currentSong = new Song(songName, context);


    var xhr = new XMLHttpRequest();
    xhr.open('GET', currentSong.url, true);

    xhr.onload = function (e) {
        _finishedLoading = false;
        // get a JSON description of the song
        var song = JSON.parse(this.response);

        // resize canvas depending on number of samples
        resizeSampleCanvas(song.instruments.length);

        // for eah instrument/track in the song
        song.instruments.forEach(function (instrument, trackNumber) {
            // Let's add a new track to the current song for this instrument
            currentSong.addTrack(instrument);

            var instruName = instrument.name.charAt(0).toUpperCase() + instrument.name.substr(1).toLowerCase();
            // Render HTMl
            var span = document.createElement('tr');
            span.className = 'trackBoxContainer';
            span.id = 'trackBoxContainer-' + trackNumber;

            span.innerHTML = '<td class="trackBox" id="trackBox' + trackNumber + '">' +
            "<progress class='pisteProgress' id='progress" + trackNumber + "' value='0' max='100'></progress>" +
            '<div class="instruName">'+ instruName + '</div>'
            +"<span id='volspan'><input type='range' class = 'volumeSlider custom' id='volume" + trackNumber + "' min='0' max = '100' value='100' oninput='setVolumeOfTrackDependingOnSliderValue(" + trackNumber + ");'/></span>"
            +'<div class="trakCtrlsCont">' +
            "<button class='mute' id='mute" + trackNumber + "' onclick='muteUnmuteTrack(" + trackNumber + ");'>Mute</button> " +
            "<button class='solo' id='solo" + trackNumber + "' onclick='soloNosoloTrack(" + trackNumber + ");'>Solo</button></div>"
            +"</td>"+
            "<td class='partoche' id='partoche" + trackNumber + "' onclick='openPartoche(" + trackNumber + ");'></td>";

            divTrack.appendChild(span);

        });

        // Add range listeners, from range-input.js
        addRangeListeners();


        // disable all mute/solo buttons
        $(".mute").attr("disabled", true);
        $(".solo").attr("disabled", true);

        // Loads all samples for the currentSong
        loadAllSoundSamples();
    };
    xhr.send();
}

function getMousePos(canvas, evt, touch) {
    // get canvas position
    var obj = canvas;
    var top = 0;
    var left = 0;

    while (obj && obj.tagName != 'BODY') {
        top += obj.offsetTop;
        left += obj.offsetLeft;
        obj = obj.offsetParent;
    }
    var mouseX;
    var mouseY;
    if (touch) {
        mouseX = evt.touches[0].clientX;
        mouseY = evt.touches[0].clientY;
    }
    else {
        mouseX = evt.clientX;
        mouseY = evt.clientY;   
    }
    mouseX -= (left + window.pageXOffset);
    mouseY -= (top + window.pageYOffset);

    // return relative mouse position
    return {
        x: mouseX,
        y: mouseY
    };
}

function plusTenSeconds() {

    if (currentSong === undefined || _finishedLoading == false) return;

    var savedTime = currentSong.elapsedTimeSinceStart;
    stopAllTracks();
    savedTime += 10;
    playAllTracks(savedTime);
}

function minusTenSeconds() {
    if (currentSong === undefined || _finishedLoading == false) return;

    var savedTime = currentSong.elapsedTimeSinceStart;
    stopAllTracks();
    savedTime -= 10;
    playAllTracks(savedTime);
}

// Michel Buffa : x is in pixels, should be in seconds, and this function should
// be moved into song.js, and elapsedTimeSinceStart be an attribute...
function jumpTo(x) {
    // is there a song loaded ?
    if (currentSong === undefined) return;

    // width - totalTime
    // x - ?
    stopAllTracks();
    var totalTime = currentSong.getDuration();
    var startTime = (x * totalTime) / window.View.frontCanvas.width;
    currentSong.elapsedTimeSinceStart = startTime;

    lastTime = context.currentTime;
    playAllTracks(startTime);
}

// A better function for displaying float numbers with a given number
// of digits after the int part
function toFixed(value, precision) {
    var power = Math.pow(10, precision || 0);
    return String(Math.round(value * power) / power);
}

function animateTime() {
    
     // clear canvas
     View.frontCanvasContext.clearRect(0, 0, window.View.masterCanvas.width, window.View.masterCanvas.height);

     // Draw something only if a song has been loaded
     if (currentSong !== undefined) {


         // Draw selection for loop
         drawSelection();

         if (!currentSong.paused) {
             // Draw the time on the front canvas
             currentTime = context.currentTime;
             var delta = currentTime - lastTime;


             var totalTime;

             View.frontCanvasContext.fillStyle = 'white';
             View.frontCanvasContext.font = '14pt Arial';
             //View.frontCanvasContext.fillText(toFixed(currentSong.elapsedTimeSinceStart, 1) + "s", 180, 20);
             View.frontCanvasContext.fillText((currentSong.elapsedTimeSinceStart + "").toFormattedTime() + "s", currentXTimeline + 5.3, 20);

             // at least one track has been loaded
             if (currentSong.decodedAudioBuffers[0] !== undefined) {

                 totalTime = currentSong.getDuration();
                 currentXTimeline = currentSong.elapsedTimeSinceStart * window.View.masterCanvas.width / totalTime;

                 // Draw time bar
                 View.frontCanvasContext.strokeStyle = "white";
                 View.frontCanvasContext.lineWidth = 3;
                 View.frontCanvasContext.beginPath();
                 View.frontCanvasContext.moveTo(currentXTimeline, 0);
                 View.frontCanvasContext.lineTo(currentXTimeline, window.View.masterCanvas.height);
                 View.frontCanvasContext.stroke();

                 currentSong.elapsedTimeSinceStart += delta;
                 lastTime = currentTime;

                 // Did we reach the end of the loop
                 if (existsSelection() && isLooping) {
                     if (currentXTimeline > selectionForLoop.xEnd) {
                        jumpTo(selectionForLoop.xStart);
                    }
                 }

                 // Did we reach the end of the song ?
                 if (currentSong.elapsedTimeSinceStart > currentSong.getDuration()) {
                     // Clear the console log and display it
                     clearLog();
                     log("Song's finished, press Start again,");
                     log("or click in the middle of the song,");
                     log("or load another song...");

                     // Stop the current song
                     stopAllTracks();
                 }
            }
        }
     }
     requestAnimFrame(animateTime);
     
}

function drawSelection() {
    View.frontCanvasContext.save();
    if (existsSelection()) {

        adjustSelectionMarkers();
        // draw selection
        View.frontCanvasContext.fillStyle = "rgba(0, 240, 240, 0.8)";
        View.frontCanvasContext.fillRect(selectionForLoop.xStart, 0, selectionForLoop.width, window.View.frontCanvas.height);
    }
    View.frontCanvasContext.restore();
}

function drawSampleImage(imageURL, trackNumber, trackName) {
    var image = new Image();

    image.onload = function () {
        if (trackNumber > 0)
            return;
        // SAMPLE_HEIGHT pixels height
        var x = 0;
        var y = 0;
        View.masterCanvasContext.drawImage(image, x, y, window.View.masterCanvas.width, window.View.masterCanvas.height);

        View.masterCanvasContext.strokeStyle = "white";
        View.masterCanvasContext.strokeRect(x, y, window.View.masterCanvas.width, window.View.masterCanvas.height);
    };
    image.src = imageURL;
}

function resizeSampleCanvas(numTracks) {
    window.View.masterCanvas.height = 150;
    window.View.frontCanvas.height = window.View.masterCanvas.height;
}

function clearAllSampleDrawings() {
    View.masterCanvasContext.clearRect(0,0, canvas.width, canvas.height);
}


function playAllTracks(startTime) {

    if (currentSong === undefined || _finishedLoading == false) return;
    // First : build the web audio graph
    //currentSong.buildGraph();

    // Read current master volume slider position and set the volume
    setMasterVolume();

    // Starts playing
    currentSong.play(startTime);

    // Set each track volume depending on slider value
    for (i = 0; i < currentSong.getNbTracks(); i++) {
        // set volume gain of track i the value indicated by the slider
        setVolumeOfTrackDependingOnSliderValue(i);
    }

    // Adjust the volumes depending on all mute/solo states
    currentSong.setTrackVolumesDependingOnMuteSoloStatus();


    // enable all mute/solo buttons
    //$(".mute").attr("disabled", false);
    //$(".solo").attr("disabled", false);

    // Set play/stop/pause buttons' states
    buttonPlay.disabled = true;
    buttonStop.disabled = false;
    //buttonPause.disabled = false;

    // Note : we memorise the current time, context.currentTime always
    // goes forward, it's a high precision timer
    lastTime = context.currentTime;

    View.activeWaveTab();
}

function setVolumeOfTrackDependingOnSliderValue(nbTrack) {
    var fraction = $("#volume" + nbTrack).val() / 100;
    currentSong.setVolumeOfTrack(fraction * fraction, nbTrack);
}

function stopAllTracks() {
    if (currentSong === undefined || _finishedLoading == false) return;

    // Stop the song
    currentSong.stop();

    // update gui's state
    buttonStop.disabled = true;
    //buttonPause.disabled = true;
    buttonPlay.disabled = false;

    // reset the elapsed time
    currentSong.elapsedTimeSinceStart = 0;
}

function pauseAllTracks() {
    currentSong.pause();
    lastTime = context.currentTime;
}

// The next function can be called two ways :
// 1 - when we click or drag the master volume widget. In that case the val
// parameter is passed.
// 2 - without parameters, this is the case when we jump to another place in
// the song or when a new song is loaded. We need to keep the same volume as
// before
function setMasterVolume(val) {
    if (currentSong !== undefined) {
        // If we are here, then we need to reset the mute all button
        //document.querySelector("#bsound").innerHTML = '<span class="glyphicon glyphicon-volume-up"></span>';
        var fraction;

        // set its volume to the current value of the master volume knob
        if (val === undefined) {
            fraction = $("#masterVolume").val() / 100;
        } else {
            fraction = val / 100;
        }

        // Let's use an x*x curve (x-squared) since simple linear (x) does not
        // sound as good.
        currentSong.setVolume(fraction * fraction);

    }
}

function soloNosoloTrack(trackNumber) {
    var s = document.querySelector("#solo" + trackNumber);
    var m = document.querySelector("#mute" + trackNumber);

    var currentTrack = currentSong.tracks[trackNumber];

    $(s).toggleClass("activated");

    // Is the current track in solo mode ?
    if (!currentTrack.solo) {
        // we were not in solo mode, let's go in solo mode
        currentTrack.solo = true;
        for (var i = 0; i < currentSong.tracks.length; i++) {
            if (i == trackNumber)
                continue;

            currentSong.tracks[i].solo = false;
            var anotherTrackSolo = document.querySelector("#solo" + i);
            $(anotherTrackSolo).removeClass("activated");

            if (!currentSong.tracks[i].muted) {
                currentSong.tracks[i].muted = true;
                var anotherTrack = document.querySelector("#mute" + i);
                $(anotherTrack).toggleClass("activatedMute");
            }
        }
    } else {
        // we were in solo mode, let's go to the "no solo" mode
        currentTrack.solo = false;
        for (var i = 0; i < currentSong.tracks.length; i++) {
            if (i == trackNumber)
                continue;
            currentSong.tracks[i].muted = false;
            var anotherTrack = document.querySelector("#mute" + i);
            $(anotherTrack).removeClass("activatedMute");
        }
    }

    // In all cases we remove the mute state of the curent track
    currentTrack.muted = false;
    $(m).removeClass("activatedMute");

    // Adjust the volumes depending on all mute/solo states
    currentSong.setTrackVolumesDependingOnMuteSoloStatus();
}


function muteUnmuteTrack(trackNumber) {
    var m = document.querySelector("#mute" + trackNumber);
    var s = document.querySelector("#solo" + trackNumber);

    var currentTrack = currentSong.tracks[trackNumber];
    for (var i = 0; i < currentSong.tracks.length; i++) {
        if (currentSong.tracks[i].solo) return;
    }

    $(m).toggleClass("activatedMute");

    if (!currentTrack.muted) {
        // Track was not muted, let's mute it!
        currentTrack.muted = true;
    } else {
        // track was muted, let's unmute it!
        currentTrack.muted = false;
    }

    // In all cases we must put the track on "no solo" mode
    currentTrack.solo = false;
    $(s).removeClass("activated");

    // adjust track volumes dependinf on all mute/solo states
    currentSong.setTrackVolumesDependingOnMuteSoloStatus();
}

function masterMuteUnmute(btn) {
    if (currentSong === undefined) return;
    currentSong.toggleMute();
    $(btn).toggleClass("activated");
}

function toggleRecordMix() {
    currentSong.toggRecordMixMode();
    $("#brecordMix").toggleClass("activated");

    clearLog();
    log("Record mix mode : " + currentSong.recordMixMode);
    if (currentSong.recordMixMode) {
        log("Play to start recording,");
        log("Stop to save the mix as .wav");
    }
}
