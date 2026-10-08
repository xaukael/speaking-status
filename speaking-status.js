let speakingSocket

function getPlayersRoot() {
  const el = ui.players?.element;
  if (!el) return null;
  // Foundry v10-v12 Players (AppV1) exposes `.element` as jQuery; v13+ (AppV2) exposes a plain HTMLElement.
  return el instanceof HTMLElement ? el : el[0];
}

function getPlayerRow(userId) {
  return getPlayersRoot()?.querySelector(`[data-user-id="${userId}"]`) ?? null;
}

function getPlayerNameElement(userId) {
  const row = getPlayerRow(userId);
  if (!row) return null;
  return row.querySelector('.player-name') ?? row;
}

Hooks.once("socketlib.ready", () => {
  function speak(userId, speaking) {
    let user = game.users.get(userId);
    let tokens = user.character?.getActiveTokens() ?? [];
    Hooks.call('changeSpeakingStatus', user, speaking)

    let nameEl = getPlayerNameElement(user.id);
    if (nameEl) nameEl.style.outline = speaking ? '5px solid #3BA53B' : 'unset';

    if (speaking) {
      if (game.settings.get('speaking-status', 'token'))
        tokens.forEach(t => {
          let marker = document.createElement('div');
          marker.className = `speaking-token-marker ${t.id}`;
          Object.assign(marker.style, {
            position: 'absolute',
            top: `${t.y}px`,
            left: `${t.x}px`,
            width: `${t.w}px`,
            height: `${t.h}px`,
            outline: `${canvas.grid.size / 20}px solid #3BA53B`,
            borderRadius: `${game.settings.get('speaking-status', 'round') ? (canvas.grid.size / 2) : (canvas.grid.size / 20)}px`
          });
          document.getElementById('hud')?.appendChild(marker);
          let actionBarEntry = document.querySelector(`#token-action-bar li[data-token-id="${t.id}"]`);
          if (actionBarEntry) actionBarEntry.style.outline = '3px solid #3BA53B';
        });
    }
    if (!speaking) {
      if (game.settings.get('speaking-status', 'token'))
        tokens.forEach(t => {
          document.querySelectorAll(`#hud div.speaking-token-marker.${t.id}`).forEach(el => el.remove());
          let actionBarEntry = document.querySelector(`#token-action-bar li[data-token-id="${t.id}"]`);
          if (actionBarEntry) actionBarEntry.style.outline = 'unset';
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
      let levelBar = document.getElementById('speaking-level');
      if (levelBar) levelBar.style.width = `${(db+140)/140*100}%`;
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
  getPlayersRoot()?.querySelectorAll('[data-user-id]').forEach(row => {
    let nameEl = row.querySelector('.player-name') ?? row;
    nameEl.style.outline = 'unset';
  });
  document.querySelectorAll('#hud div.speaking-token-marker').forEach(el => el.remove());
  document.querySelectorAll('#token-action-bar li').forEach(el => el.style.outline = 'unset');
}

Hooks.on('refreshToken', (t)=>{
	if (t.isPreview) return;
  let marker = document.querySelector(`#hud > div.speaking-token-marker.${t.id}`);
  if (marker) Object.assign(marker.style, { top: `${t.y}px`, left: `${t.x}px` });
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
  // v13 (ApplicationV2) passes a plain HTMLElement here; v10-v12 (AppV1) pass a jQuery object.
  let root = html instanceof HTMLElement ? html : html[0];
  let input = root.querySelector('input[name="speaking-status.threshold"]');
  if (!input) return;
  let hint = input.closest('.form-group')?.querySelector('.hint');
  if (!hint) return;

  hint.insertAdjacentHTML('afterbegin', `
  <div style="background: grey; height: 20px; width: 100%">
  <div id="speaking-level" style="background: white; height: 100%;"></div>
  </div>
  <input type="range" min="-120" max="0" value="0" class="slider" id="speaking-threshold">
  `)

  let slider = hint.querySelector('#speaking-threshold');
  slider.value = +input.value;
  slider.addEventListener('change', function(){
    input.value = this.value;
    game.user.speakingThreshold = this.value;
  })
})
