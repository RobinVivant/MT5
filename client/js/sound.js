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

     View.frontCanvas.addEventListener("click", function (event) {
     if (!existsSelection()) {
            if (currentSong === undefined || _finishedLoading == false) return;
            var mousePos = getMousePos(window.View.frontCanvas, event);
            // will compute time from mouse pos and start playing from there...
            jumpTo(mousePos.x);
        }
        else {
            clearLoop()
        }
     });
     
    // Master volume slider
    masterVolumeSlider = $('.knob').val();

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

function setLoopStart() {
    if (!currentSong.paused) {
        loopOnOff();
        selectionForLoop.xStart = currentXTimeline;
        // Switch xStart and xEnd if necessary, compute width of selection
        adjustSelectionMarkers();
    }
}

function setLoopEnd() {
    if (!currentSong.paused) {
        selectionForLoop.xEnd = currentXTimeline;
        // Switch xStart and xEnd if necessary, compute width of selection
        adjustSelectionMarkers();
    }
}

function clearLoop() {
    resetSelection();
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
        isLooping = false;
        console.log($('.loopTitle'));
        $('.loopTitle').text('boucle');
        setLoopEnd();
    }
    else {
        resetSelection();
        isLooping = true;
        $('.loopTitle').text('Fin boucle');
        setLoopStart();
    }
}



function adjustSelectionMarkers() {
    if (existsSelection()) {
        // Adjust the different values of the selection
        var selectionWidth;
        var end;
        if (selectionForLoop.xEnd != -1) {
            selectionWidth = Math.abs(selectionForLoop.xEnd - selectionForLoop.xStart);
            if (isLooping)
                end = Math.max(selectionForLoop.xStart, currentXTimeline);
        } else {
            selectionWidth = Math.abs(currentSong.elapsedTimeSinceStart - selectionForLoop.xStart)
            if (isLooping)
                end = Math.max(selectionForLoop.xStart, selectionForLoop.xEnd);
        }

        var start = selectionForLoop.xStart;
        if (!isLooping) {
            end = selectionForLoop.xEnd;
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

    if (trackNumber > 0)
        return;
     
    var trackName = currentSong.tracks[trackNumber].name;
    trackName = trackName.slice(trackName.lastIndexOf("/")+1, trackName.length-4);

    waveformDrawer.init(decodedBuffer, View.masterCanvas, '#83E83E');
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

    // enable song select menu
    var s = document.querySelector("#songSelect");
    s.disabled = false;

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
                text: "Choose a song..."
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
        $(tb).css('background-color', '#525252');
        $(p).css('z-index', '0');
    } else {
        $(p).height($('#scroll').height());
        $(tb).css('background-color', '#A04646');
        $(p).css('z-index', '999');
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

            // Render HTMl
            var span = document.createElement('tr');
            span.innerHTML = '<td class="trackBox" id="trackBox' + trackNumber + '">' +
            "<progress class='pisteProgress' id='progress" + trackNumber + "' value='0' max='100'></progress>" +
            '<div class="instruName">'+instrument.name + '</div>'
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

function getMousePos(canvas, evt) {
    // get canvas position
    var obj = canvas;
    var top = 0;
    var left = 0;

    while (obj && obj.tagName != 'BODY') {
        top += obj.offsetTop;
        left += obj.offsetLeft;
        obj = obj.offsetParent;
    }
    // return relative mouse position
    var mouseX = evt.clientX - left + window.pageXOffset;
    var mouseY = evt.clientY - top + window.pageYOffset;
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
     if (existsSelection() && !isLooping) {
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
            //fraction = $("#masterVolume").val() / 100;
            fraction = 1;
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
        // Let's change the icon
        //s.innerHTML = "<img src='../img/noearphones.png' />";
    } else {
        // we were in solo mode, let's go to the "no solo" mode
        currentTrack.solo = false;
        // Let's change the icon
        //s.innerHTML = "<img src='../img/earphones.png' />";
    }

    // In all cases we remove the mute state of the curent track
    currentTrack.mute = false;
    $(m).removeClass("activated");
    // Let's change the icon
    //m.innerHTML = "<span class='glyphicon glyphicon-volume-up'></span>";

    // Adjust the volumes depending on all mute/solo states
    currentSong.setTrackVolumesDependingOnMuteSoloStatus();
}


function muteUnmuteTrack(trackNumber) {
    var m = document.querySelector("#mute" + trackNumber);
    var s = document.querySelector("#solo" + trackNumber);

    var currentTrack = currentSong.tracks[trackNumber];

    $(m).toggleClass("activated");

    if (!currentTrack.muted) {
        // Track was not muted, let's mute it!
        currentTrack.muted = true;
        // let's change the button's class
        //m.innerHTML = "<span class='glyphicon glyphicon-volume-off'></span>";
    } else {
        // track was muted, let's unmute it!
        currentTrack.muted = false;
        //m.innerHTML = "<span class='glyphicon glyphicon-volume-up'></span>";
    }

    // In all cases we must put the track on "no solo" mode
    currentTrack.solo = false;
    $(s).removeClass("activated");
    // Let's change the icon
    //s.innerHTML = "<img src='../img/earphones.png' />";

    // adjust track volumes dependinf on all mute/solo states
    currentSong.setTrackVolumesDependingOnMuteSoloStatus();
}

function masterMuteUnmute(btn) {
    if (currentSong === undefined) return;

    currentSong.toggleMute();

    $(btn).toggleClass("activated");
/*
    if (currentSong.muted) {
        btn.innerHTML = '<span class="glyphicon glyphicon-volume-off"></span>';
    } else {
        btn.innerHTML = '<span class="glyphicon glyphicon-volume-up"></span>';
    }
    */
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
