
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
        $('#bplay').removeClass('fa-pause');
        $('#bplay').addClass('fa-play');
    });

    $('#ce-backward').on('click', function(){
        console.log('pourquoi ?');
        minusTenSeconds();
    });

    $('#ce-forward').on('click', function(){
        console.log('pourquoi ?');
        plusTenSeconds();
    });
});