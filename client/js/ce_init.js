
$(document).ready(function(){
    document.querySelector('#songSelect').onchange = function(e){
        $('#ce-title').html(e.currentTarget.value);
    };

    $('#bplay').on('click', function(){
        if( $(this).hasClass('fa-play') ){
            playAllTracks(0);
            $(this).removeClass('fa-play');
            $(this).addClass('fa-pause');
        }else{
            pauseAllTracks();
            $(this).removeClass('fa-pause');
            $(this).addClass('fa-play');
        }
    });

    $('#bstop').on('click', function(){
        stopAllTracks();
    });
});