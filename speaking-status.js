let speakingSocket

Hooks.once("socketlib.ready", () => {
  function speak(userId, speaking) {
    let user = game.users.get(userId);
    let tokens = user.character?.getActiveTokens();
    if (speaking) {
      $(`#player-list > li[data-user-id="${user.id}"] span:first-child`).css({outline: '5px solid #3BA53B'});
      tokens.forEach(t => {
        
        $('#hud').append($(`<div class="speaking-token-marker ${t.id}" style="position: absolute; top: ${t.y}px; left: ${t.x}px; width: ${t.w}px; height: ${t.h}px; outline: ${canvas.grid.size/20}px solid #3BA53B; border-radius: ${canvas.grid.size/20}px;"></div>`));
        $(`#token-action-bar li[data-token-id="${t.id}"]`).css({outline: '3px solid #3BA53B'});
      });
    }
    if (!speaking) {
      $(`#player-list > li[data-user-id="${user.id}"] span:first-child`).css({outline: 'unset'});
      tokens.forEach(t => { 
        $('#hud').find(`div.speaking-token-marker.${t.id}`).remove(); 
        $(`#token-action-bar li[data-token-id="${t.id}"]`).css({outline: 'unset'});
      });
    }
  }
  speakingSocket = socketlib.registerModule("speaking-status");
  speakingSocket.register("speak", speak);
  speakingSocket.emit = function(userId, speaking) { speakingSocket.executeForEveryone(speak, game.user.id, speaking); }
});

Hooks.on('ready',()=>{
  game.user.speaking = false;
  game.user.speakingThreshold = game.settings.get('speaking-status', 'threshold')
  navigator.mediaDevices.getUserMedia({audio:true, video:false}).then( function(stream){
    // audioContext = new webkitAudioContext(); deprecated  OLD!!
    audioContext = new AudioContext(); // NEW!!
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(stream);
    processor = audioContext.createScriptProcessor(2048, 1, 1);
    //processor = audioContext.AudioWorkletNode(2048, 1, 1);
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 1024;

    microphone.connect(analyser);
    analyser.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = function() {
        var array =  new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        var values = 0;

        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += array[i];
        }

        var average = values / length;
        //button.style.color = `rgba (0,${average},0,1)`
        let wasSpeaking = game.user.speaking
        if (average > game.user.speakingThreshold) game.user.speaking = true;
        else game.user.speaking = false;
        //console.log(wasSpeaking, game.user.speaking)
        if (wasSpeaking != game.user.speaking) speakingSocket.emit(game.user.id, game.user.speaking);
        

    }
  });
});

cleanSpeakingMarkers = function () {
  $(`#player-list > li span:first-child`).css({outline: 'unset'});
  $('#hud').find(`div.speaking-token-marker`).remove(); 
  $(`#token-action-bar li`).css({outline: 'unset'});
}

Hooks.on('refreshToken', (t)=>{
	if (t.isPreview) return;
  $(`#hud > div.speaking-token-marker.${t.id}`).css({ top: `${t.y}px`, left: `${t.x}px`});
});

Hooks.once("init", async () => {
  game.settings.register('speaking-status', 'threshold', {
    name: `Speaking Threshold`,
    hint: `Somewhere between 10 and 20 generally works best`,
    scope: "client",
    config: true,
    type: Number,
    default: 15,
    requiresReload: false,
    onChange: (value)=>{game.user.speakingThreshold = value}
  });
});

