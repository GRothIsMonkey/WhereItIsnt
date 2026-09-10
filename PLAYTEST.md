# WHERE IT ISN'T — HUMAN PLAYTEST CHECKLIST
## Phase 36, the playable-alpha gate

---

## BEFORE YOU START — READ THIS PART, IT IS THE SHORTEST AND THE MOST IMPORTANT

**SERVE THE GAME. DO NOT OPEN THE FILE.**

```
cd /path/to/WhereItIsnt
python3 -m http.server 8000
```

then open **http://localhost:8000/game.html**

Opening `game.html` by double-clicking it — a `file://` address — plays **no recorded
sound at all**. A browser refuses to fetch a local file into Web Audio, so all 274
recordings fail and you hear only the handful of sounds the game can synthesise. That
mistake produced three consecutive "the game is silent" playtest reports before anyone
worked out what was happening. If the address bar does not begin with `http://` or
`https://`, stop and start again.

If it goes wrong anyway, the start screen and the settings panel will both tell you so in
plain words. There is no other message like it in the game.

**PLAY IT LIKE A PLAYER.**

- Do not open the browser console.
- Do not use `debugTeleportTo...` or any other developer command.
- Do not edit the save.
- If you get stuck, stay stuck for a while and write down what you tried. Being stuck is
  the single most useful thing you can report; "I could not work out where to go" is a
  finding, not a failure on your part.

**KEEP A NOTE OF THE TIME.** Roughly how long each chapter took you matters as much as
whether it worked. Pacing is the thing no test in this repository can measure.

**WHAT TO WRITE DOWN, EVERYWHERE.** For every stage below the same six questions apply,
and they are not repeated under each heading:

1. Could I make progress, and did I know what to try?
2. Did anything break, freeze, disappear, or put me somewhere I could not get out of?
3. Did the world behave as though somebody meant it to?
4. **Could I hear it?** Not "was there sound" — was there sound *of that place*.
5. Was the HUD right: the objective line, the two readouts bottom-left, the hotbar?
6. Was the transition into the next place clean?

---

## 1. START SCREEN

- The title reads **WHERE IT ISN'T**.
- There is a landscape behind it, not a card. Watch it for a minute or two before you
  press anything. Three things are scheduled to happen out there and all three are meant
  to be easy to doubt. Note whether you saw any of them, and whether you were sure.
- **NEW GAME**, **SETTINGS**, and — only if you have played before — **CONTINUE**.
- Clicking makes a small sound. The **first** click of a session is synthesised and the
  ones after it are recorded; they will not sound identical and that is expected.
  **Listen to it particularly.** That recording used to be clipped and Phase 36 brought it
  under the ceiling, which also made it a few decibels quieter. Say whether it still reads
  as a click or has become too faint to notice.
- Open **SETTINGS**. It has four volume sliders (**MASTER**, **MUSIC**, **SOUND EFFECTS**,
  **AMBIENCE**), **MOUSE SENSITIVITY**, **GRAPHICS**, **FULLSCREEN**, and the save
  controls. Move each of them; take MASTER to zero and back and confirm the sound follows.
  Close it with Escape. Nothing should be left behind on the screen.
- If a line under the volume sliders is telling you the audio files could not load, you
  are on `file://`. Go back to the top of this document.

## 2. THE OPENING

- **NEW GAME** plays a sixty-eight second film in the real world at the real spawn.
  **CONTINUE** never plays it.
- You can look around. You cannot walk. That is deliberate.
- Try leaning on the keyboard during it — E, I, the movement keys, both mouse buttons.
  Nothing should open and nothing should end the film.
- Press **O** during it: the settings panel should open **over** it and pause it. Press
  **Escape** once: the panel should close and the film should still be running.
- There is a **SKIP** control. Using it should leave you in exactly the same place as
  watching to the end.
- It finishes on one instruction. Write it down before it fades — you will want it later.

## 3. THE OVERWORLD (dimension 1)

> Known and accepted: this dimension is slow and thin, and Era 2 replaces it wholesale.
> Report anything **broken**; do not report that it is boring, that is already recorded.

- The first objective is **"Gather wood."** Follow the line and see how far it carries you
  without any other help.
- Three prompts will appear above the hotbar, each naming one key, each only once:
  `LMB · CHOP`, `E · CRAFT`, `RMB · PLACE`. Did you notice them? Did they arrive at a
  moment when they were useful?
- Open an **Ancient Chest**. The first one you open here gives you a **compass**, which
  appears at the top of the screen. Walk in a circle and check that the letters agree
  with the direction you are actually facing.
- Craft your way to an **Anchor Monument** (four planks) and place it before dark.
- **NIGHT.** Things spawn. Stay inside the Anchor's glow and see whether it protects you.
- Survive to the **third night**. Something very large arrives.
  - Note where it comes from and whether you heard it arrive before you saw it.
  - It is slow. You can run from it. **Try running from it and coming back** — it should
    still be there.
  - Kill it. It drops a **Core Disk** on the ground; walk over the Disk to pick it up.
- A screen appears saying **THE HOLLOWED BEHEMOTH FALLS**. It has one button.
  - The world should be **stopped** behind it. Nothing should be able to hurt you while
    it is up.
  - Press the button. You should be standing **exactly where you were**, on the same
    night, with the same Anchor.
- **SAVE AND RELOAD HERE.** Open settings, press SAVE, refresh the browser, press
  CONTINUE. Everything should come back. (If you save *before* killing it and reload,
  another one should turn up on the next night — that is deliberate.)
- Right-click the Anchor while holding the Disk. The monument changes colour and a shape
  starts turning above it. **It should not take you immediately** — you should get a
  second or two to see it answer.
- Walk into it.

## 4. THE SHATTERED FARMLANDS (dimension 2)

- You arrive on a **crossroads**. This is where the opening instruction becomes useful;
  the game will remind you of it once.
- **THE JOURNEY IS THE POINT.** Follow the road. Expect: a wheat field, animals, a barn,
  open country, and then an enormous **water tower**.
  - Look **directly** at the tower's red light for a while. Then look slightly away and
    keep it in the corner of your eye. Report what you think you saw, and how sure
    you were.
- The animals are not enemies. Watch them for a while. Some of them are wrong. Note
  which kind of wrong: how they **look**, or what they **do**. Those are two different
  systems and the report is more useful if you say which.
- Keep going past the tower. It should get lonelier.
- Eventually you should find evidence that a farm ought to be somewhere it cannot be, and
  then the **Disconnected Home** itself. Note how you found it and whether you felt led
  or lost.
- Inside, get down to the room at the end and open the chest: the **Level 2 Rift Core
  Disk**.
- **You need another Anchor**, and the one you built is in the last dimension. Chop an
  **ashen trunk** — one log is four planks is one Anchor. Confirm you can do this
  without leaving.
- Place it, feed it the Disk, walk in.

**Try this on purpose once:** after feeding a Disk to an Anchor, **break the monument**
with the left button. You should get the Disk back and be able to start again. If you do
not, stop and report it immediately — that is the shape of an unrecoverable bug.

## 5. STATIC SUBURBIA (dimension 3)

- Streets, houses, and most of them ordinary. Go inside several.
- **Standing still is punished here.** Move, and the picture stays legible; stop for more
  than a few seconds and it degrades. Start walking again and it should recover. Confirm
  you can feel all three of those, and say whether the degraded state is unpleasant or
  merely *unreadable* — that distinction is the whole reason this was changed.
- Go back into a house you have already been in. Twice. Note anything you are almost sure
  has changed but cannot prove.
- The objective becomes **"Find what doesn't belong."** There is one house on a ring
  around your arrival point that is obviously wrong once you can see it — **how long did
  this take, and did you consider giving up?** This is the single least-guided stretch in
  the game and the most important number in your report.
- Inside it, the chest hangs in mid-air. You can open it from below.
- Take the Disk. You are not asked to do anything else.

## 6. THE FAKE HAVEN

- **Do not hurry.** The whole thing is about three minutes and nothing happens for the
  first eighty seconds by design.
- Is it warm? Is it safe? Do you want to stay? Those are the questions.
- Use the bed. It genuinely heals you and does not punish you.
- **Turn your back on the fireplace at some point and then look again.** One thing in
  this room changes, once, and only while nobody is looking at it.
- The place ends by things being **removed**. Nothing jumps out. Report whether that
  landed or whether it just felt like the game running out.

## 7. THE FINALE AND THE ENDING

- Roughly thirty seconds. You keep your own camera; it will pull, and you can fight it.
- There is no fight, no health bar and nothing to press. Confirm that pressing keys does
  nothing and opens nothing.
- Then a hard cut, and the credits.
- Was the scale legible? Could you tell how big it was, and when did you realise?

---

## THE THINGS MOST WORTH REPORTING

In this order:

1. **Anything that made progress impossible.** Where, what you had, what you had done.
2. **Anywhere you were stuck for more than five minutes with no idea what to try.**
3. **Silence.** Any place where you noticed there was nothing to hear.
4. **Anything on screen that was wrong**: a line of text that did not match the
   situation, a readout that stopped moving, a panel that would not close.
5. **Pacing.** Which chapter was too long, which was over before it started.
6. Horror that worked, and horror that did not. Both are useful; the second is rarer and
   more valuable.

## AND ONE THING THAT IS NOT A BUG

Objectives are deliberately vague, there are no quest markers, nothing is highlighted and
the game explains almost nothing. If it felt underexplained, say so — but say it as
"I did not know what to do" rather than "there should be a marker", because the marker is
not coming and the wording can change.
