const BACKGROUND_MUSIC_VOLUME = 0.25;

export function startBackgroundMusic(restart: boolean = false) {
  setTimeout(() => {
    const bgMusicElement = document.getElementById("backgroundMusic") as HTMLAudioElement;

    if (bgMusicElement.volume != BACKGROUND_MUSIC_VOLUME)
      bgMusicElement.volume = BACKGROUND_MUSIC_VOLUME;

    if (restart) bgMusicElement.currentTime = 0;

    if (restart || bgMusicElement.paused) {
      bgMusicElement.play();
      console.log("Started background music!", {
        restart,
        paused: bgMusicElement.paused,
        src: bgMusicElement.src,
      });
    } else {
      console.log("Ignored request to start background music!", {
        restart,
        paused: bgMusicElement.paused,
        src: bgMusicElement.src,
      });
    }
  }, 1);
}

export function stopBackgroundMusic() {
  setTimeout(() => {
    const bgMusicElement = document.getElementById("backgroundMusic") as HTMLAudioElement;
    bgMusicElement.pause();
  }, 1);
}
