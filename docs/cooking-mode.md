# Cooking mode: voice control and screen on

Cooking mode shows one step at a time. Two things help when your hands are busy: the screen stays
on, and you can control it by voice.

## Voice commands

Turn on the "Voice control" switch in cooking mode. Say one of these on its own:

| Command | What it does |
| --- | --- |
| next | Goes to the next step |
| back | Goes to the previous step |
| repeat | Scrolls the current step back to the top |
| start timer | Starts the first timer of the step that is not running |
| stop timer | Stops the running (or ringing) timers of the step |

The words depend on the app language (en, de, es, fr, it). For example in German: "weiter",
"zurück", "wiederholen", "Timer starten", "Timer stoppen". The lists live in
`apps/app/lib/voice-commands.ts`. Only a short, whole phrase counts, so talking in the kitchen
("pass me the next bowl") does nothing. Accents and punctuation are ignored.

If a step has several timers ("simmer 10 minutes, then rest 5 minutes"), "start timer" starts the
first one that is not running. Say it again for the next one.

Recognition restarts by itself when the system stops it (it often does after a short silence). It
stops when you turn the switch off, leave cooking mode, or the app goes to the background.

## Screen stays on

While cooking mode is open the screen does not turn off. This uses `expo-keep-awake` on iOS and
Android and the Screen Wake Lock API in the browser. The browser releases the lock when the tab is
hidden, so it is asked for again when the tab is back. If the browser has no wake lock, cooking
mode shows a short hint.

## Where it works

| Platform | Screen on | Voice control |
| --- | --- | --- |
| iOS and Android app | Yes | Yes, the phone's own speech recognition (on-device where the phone offers it) |
| Chrome, Edge, Safari | Yes | Yes, the browser's Web Speech API |
| Firefox | Depends on version | No. The switch is disabled and says why |

The app needs our own builds (`expo-speech-recognition` is native code), not Expo Go. The
microphone permission (and on iOS speech recognition) is asked only when you turn voice control on.
If it is denied, a message says so and the buttons keep working.

## Privacy and battery

- No audio goes to the idkjustfood API, and no AI provider is used. Matching the words is plain
  code on your device. It works the same for self-hosted installs.
- On the phone, recognition runs on the device where the phone offers it. Otherwise the phone's
  speech service (Apple or Google) handles it.
- In the browser, Chrome and Edge send the audio to their own speech service, and there is no
  offline mode. That is the browser's choice, not ours.
- Keeping the screen on and listening uses more battery. Turn voice control off when you do not
  need it.
- Listening in the background or on a locked phone is not supported.
