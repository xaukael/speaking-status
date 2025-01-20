let speakingSocket

Hooks.once("socketlib.ready", () => {
  function speak(userId, speaking) {
    let user = game.users.get(userId);
    let tokens = user.character?.getActiveTokens();
    Hooks.call('changeSpeakingStatus', user, speaking)
    if (speaking) {
      $(`#player-list > li[data-user-id="${user.id}"] span:first-child`).css({outline: '5px solid #3BA53B'});
      if (game.settings.get('speaking-status', 'token'))
        tokens.forEach(t => {
          $('#hud').append($(`<div class="speaking-token-marker ${t.id}" style="position: absolute; top: ${t.y}px; left: ${t.x}px; width: ${t.w}px; height: ${t.h}px; outline: ${(canvas.grid.size/20)}px solid #3BA53B; border-radius: ${game.settings.get('speaking-status', 'round')?(canvas.grid.size/2):canvas.grid.size/20}px;"></div>`));
          $(`#token-action-bar li[data-token-id="${t.id}"]`).css({outline: '3px solid #3BA53B'});
        });
    }
    if (!speaking) {
      $(`#player-list > li[data-user-id="${user.id}"] span:first-child`).css({outline: 'unset'});
      if (game.settings.get('speaking-status', 'token'))
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
  startMicrophoneMonitor()
});

startMicrophoneMonitor = function() {
  navigator.mediaDevices.getUserMedia({audio:true, video:false}).then( function(stream){
    game.audio.startLevelReports("speaking-status", stream, (db)=>{
      let wasSpeaking = game.user.speaking
      $('#speaking-level').css('width', `${(db+140)/140*100}%`)
      if (db > game.user.speakingThreshold) game.user.speaking = true;
      else game.user.speaking = false;
      if (wasSpeaking != game.user.speaking) speakingSocket.emit(game.user.id, game.user.speaking);
    }, 50)
  });
}

stopMicrophoneMonitor = function() {
  speakingSocket.emit(game.user.id, false);
  game.audio.stopLevelReports("speaking-status")
} 

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
    hint: `In dB. Somewhere between -50 and -60 generally works best.`,
    scope: "client",
    config: true,
    type: Number,
    default: -55,
    requiresReload: false,
    onChange: (value)=>{game.user.speakingThreshold = value}
  });
  game.settings.register('speaking-status', 'token', {
    name: `Show Token Indicator`,
    hint: `Tokens for the speaking user's assigned actor will have border shown when speaking`,
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
    onChange: (value)=>{}
  });
  game.settings.register('speaking-status', 'round', {
    name: `Round Token Indicator`,
    hint: `Border around token will be round if checked`,
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
    onChange: (value)=>{}
  });
});

Hooks.on('renderSettingsConfig', (app, html, options)=>{
  let input = html.find('input[name="speaking-status.threshold"]')
  input.parent().next().prepend(`
  <input type="range" min="-120" max="0" value="0" class="slider" id="speaking-threshold">
  `)

  input.parent().next().prepend(`
  <div style="background: grey; height: 20px; width: 100%">
  <div id="speaking-level" style="background: white; height: 100%;"></div>
  </div>
  `)

  html.find('#speaking-threshold').val(+input.val())
  html.find('#speaking-threshold').change(function(){
    input.val(this.value)
    game.user.speakingThreshold = this.value;
  })
})