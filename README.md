# <img src="./img/logo.svg" width="35"> TwitchMIDI

A full-featured configurable Twitch bot to connect with your MIDI equipment while streaming. Allow your viewers to be part of your musical creations!

[![Twitch MIDI Demo](./img/demo.gif)](https://www.youtube.com/watch?v=3JK5JukHRn0)

## Table of Contents
- [ TwitchMIDI](#-twitchmidi)
  - [Table of Contents](#table-of-contents)
  - [Download](#download)
  - [Installation](#installation)
  - [Update](#update)
  - [Why?](#why)
  - [Features](#features)
  - [Commands](#commands)
      - [!midihelp](#midihelp)
      - [!midion](#midion)
      - [!midioff](#midioff)
      - [!midipause](#midipause)
      - [!midiresume](#midiresume)
      - [!addchord](#addchord)
      - [!removechord](#removechord)
      - [!chordlist](#chordlist)
      - [!sendnote](#sendnote)
      - [!sendchord](#sendchord)
      - [!sendloop](#sendloop)
      - [!sendcc](#sendcc)
      - [!midicurrentrequest](#midicurrentrequest)
      - [!midirequestqueue](#midirequestqueue)
      - [!cclist](#cclist)
      - [!midivolume](#midivolume)
      - [!stoploop](#stoploop)
      - [!fullstopmidi](#fullstopmidi)
      - [!settempo](#settempo)
      - [!syncmidi](#syncmidi)
      - [!fetchdb](#fetchdb)
      - [!midibanuser](#midibanuser)
      - [!midiunbanuser](#midiunbanuser)
  - [Troubleshooting](#troubleshooting)
  - [Contributing](#contributing)
  - [Support](#support)
  - [Credits](#credits)
  - [Changelog](#changelog)
  - [License](#license)

## Download

Latest release - [TwitchMIDI for Windows, Linux & MacOS (x86-64)](https://github.com/rafaelpernil2/TwitchMIDI/releases/latest/download/TwitchMIDI.zip)

## Installation

* Extract the zip
* Run TwitchMIDI-yourplatform (e.g TwitchMIDI-win.exe)
* Follow the configuration steps to link this bot to your account. You will see something like this:

[![](./img/init_config.webp)](#installation)

* Done. Have fun!

> Note: For MacOS, open a terminal, "cd" into the extracted folder and then execute it from there with "./TwitchMIDI-macos".
> Otherwise you will get an error like: "no such file or directory, open './config/aliases.json'"

## Update

Just put the new version in your folder. TwitchMIDI will configure everything automatically and add anything missing.


## Why?

This project was born out of an idea for my music streams ([twitch.tv/rafaelpernil](https://twitch.tv/rafaelpernil)) where I play piano and improvise with my synth and drum machine.
It is really fun, but I wanted to apply my software engineering skills to make something special for my streams, to provide my viewers a new fun way of interacting with my gear.

I had this idea for months but it was not up until recently that I started to define tangible goals and implement them. My previous project, PolyVolcaWeb using the Web MIDI API gave me the confidence and clarity to start :)

My goals were:

- Create a Twitch bot and process commands
- Create a set of MIDI functionalities such as MIDI clock with tempo adjustments, synced chord progressions, notes, loops, cc messages, macros...
- Unite commands and MIDI functionalities
- Make it fast, suitable for streamers, stable and easy to use

So far, this first version does all that, keep reading the features for more details!

## Features

* Wide set of MIDI functionalities:
  * High precision MIDI Clock using "nanotimer" with adjustable tempo via [!settempo](#settempo)
  * Sequencer on 4/4 time signature with infinite subdivisions (1 = Quarter note, 0.5 = 8th note, 0.25 = 16th note...)
  * Trigger individual notes, build a chord or send a melody separated by commas via [!sendnote](#sendnote)
  * Trigger chord progressions with specific length per chord via [!sendchord](#sendchord) with an extensive list of chords to choose from. See [CHORDS.md](CHORDS.md)
  * Loop chord progressions via [!sendloop](#sendloop)
  * Support for music rests using "rest" as a replacement for a chord or note in [!sendnote](#sendnote), [!sendchord](#sendchord) and [!sendloop](#sendloop) requests
  * See the current chord progression via [!midicurrentrequest](#midicurrentrequest)
  * Check the chord progression request queue via [!midirequestqueue](#midirequestqueue)
  * Change MIDI velocity via [!midivolume](#midivolume)
  * Send CC (Control Change) messages and sweeps between values via [!sendcc](#sendcc)
  * Clock-Loop synchronizer to correct sync issues via [!syncmidi](#syncmidi)
  * Automatic synchronization that forces loops to wait until the start of the beat
  * On/Off bot toggle
  * Pause requests with [!midipause](#midipause) and resume with [!midiresume](#midiresume)
* Configurable aliases on [config/aliases.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/aliases.json)
  * Commands - Add as many command aliases as you want
  * Macros - Launch a set of actions from a single command
  * Chord progressions/loops - Add an alias for a chord progresion to play or loop using "name/chords" syntax
    * Add chord progressions via [!addchord](#addchord)
    * Remove chord progression via [!removechord](#removechord)
    * List all added chord progressions with their name with [!chordlist](#chordlist)
  * Control Change controller names - Put a name to your Control Change controllers (e.g sustain: 64)
  * Control Change commands - Assign a set of cc commands
    * Sweep functionality, specify two values and the time in milliseconds to get from one value to other (e.g "cutoff 20(5000),cutoff 120(10000)")
    * List all added Control Change commands with their name via [!cclist](#cclist)
  * Reload [config/aliases.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/aliases.json), [config/permissions.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/permissions.json) and [config/rewards.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/rewards.json) file while using the bot with [!fetchdb](#fetchdb)
* Commands explanation with examples via [!midihelp](#midihelp) commandname
* Fine-grained command access control with role check, whitelist and blackist on [config/permissions.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/permissions.json)
* Channel Points reward mode enabled via REWARDS_MODE flag and configurable on [config/rewards.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/rewards.json)
  * Set the name of your channel points reward, the command to launch and the price (e.g. "Twitch Midi - Loop": \["!sendloop",100\] )
  * Automatic enable/disable rewards on [!midion](#midion)/[!midioff](#midioff)
  * Automatic points refund on bad requests / any kind of error
  * Commands only work for the streamer and mods
  * Allow VIPs to bypass rewards via VIP_REWARDS_MODE
* Bundle optimized for different operating systems and no extra software required for execution
* HTTP API to interact with the bot behind the scenes with an alternative UI (like TwitchMIDI+ Control Panel)
* Internationalization with full support for English and Spanish as of right now
* Update checking on startup, a message appears if there is a new version available
* Automatic checking and fix of configuration files. It ensures that all settings are correct while keeping the good ones

## Commands

#### !midihelp
&nbsp;&nbsp;&nbsp;&nbsp;Shows all commands available and info about each command.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````command // (e.g "sendloop")````


#### !midion
&nbsp;&nbsp;&nbsp;&nbsp;Turns on the MIDI functionality of the bot


#### !midioff
&nbsp;&nbsp;&nbsp;&nbsp;Turns off the MIDI functionality of the bot

#### !midipause
&nbsp;&nbsp;&nbsp;&nbsp;Pauses the requests but keeps playing whatever was already playing

#### !midiresume
&nbsp;&nbsp;&nbsp;&nbsp;Reactivates requests after they were paused with !midipause

#### !addchord
&nbsp;&nbsp;&nbsp;&nbsp;Adds a chord progression or loop with an alias to [config/aliases.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/aliases.json).

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````name/chords(chord length in quarter notes) // (e.g. "pop/C G(2) Amin(2) F")````


#### !removechord
&nbsp;&nbsp;&nbsp;&nbsp;Removes a chord progression or loop with an alias from [config/aliases.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/aliases.json).

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````alias // (e.g. "pop")````


#### !chordlist
&nbsp;&nbsp;&nbsp;&nbsp;Shows all saved chord progressions or loops from [config/aliases.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/aliases.json) that can be used


#### !sendnote
&nbsp;&nbsp;&nbsp;&nbsp;Sends a note or a set of notes.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````note1 note2 ... // (e.g. "C4 E4 G4")````


#### !sendchord
&nbsp;&nbsp;&nbsp;&nbsp;Sends a chord progression with an alias or with chords.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````chord1 chord2(chord length in quarter notes)... // (e.g. "C(4) G Amin(2) F","pop")````


#### !sendloop
&nbsp;&nbsp;&nbsp;&nbsp;Sends a loop with an alias or with chords.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````chord1 chord2(chord length in quarter notes)... // (e.g. "C G Amin F","pop")````


#### !sendcc
&nbsp;&nbsp;&nbsp;&nbsp;Sends a MIDI CC message with an alias, code or value sweeps.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````controller value,controller2 value2(delay_in_ms) // (e.g. "43 100,43 60", "cutoff sweep", "cutoff 100,cutoff 10(10000)")````


#### !midicurrentrequest
&nbsp;&nbsp;&nbsp;&nbsp;Shows the current request being played.


#### !midirequestqueue
&nbsp;&nbsp;&nbsp;&nbsp;Shows the request queue for chord progressions and loops.


#### !cclist
&nbsp;&nbsp;&nbsp;&nbsp;Shows a list of available CC command macros from [config/aliases.json](https://github.com/rafaelpernil2/TwitchMIDI/blob/master/config/aliases.json)


#### !midivolume
&nbsp;&nbsp;&nbsp;&nbsp;Sets the velocity for the chords/notes/loops.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````value between 0 and 100 // (e.g. "50","100")````


#### !stoploop
&nbsp;&nbsp;&nbsp;&nbsp;Stops the loop once it ends


#### !fullstopmidi
&nbsp;&nbsp;&nbsp;&nbsp;Stops all MIDI messages and sound


#### !settempo
&nbsp;&nbsp;&nbsp;&nbsp;Starts the MIDI clock and sets a tempo.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````tempo // (e.g. "120", "200")````


#### !syncmidi
&nbsp;&nbsp;&nbsp;&nbsp;Restarts the MIDI clock and syncs loop and clock on the next repetition


#### !fetchdb
&nbsp;&nbsp;&nbsp;&nbsp;Refreshes aliases, rewards and permissions configurations from the respective files.


#### !midibanuser
&nbsp;&nbsp;&nbsp;&nbsp;Blocks access to TwitchMIDI commands and rewards to a given username.

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````!midibanuser username````


#### !midiunbanuser
&nbsp;&nbsp;&nbsp;&nbsp;Unblocks access to TwitchMIDI commands and rewards to a previously blocked user. Syntax: !midiunbanuser username

&nbsp;&nbsp;&nbsp;&nbsp;Syntax:

&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;````!midiunbanuser username````

## Troubleshooting

Question: I get authentication errors each time I open the app. What can I do?

Answer:

>Delete `bot-tokens.json` and `broadcaster-tokens.json` from your `config` folder. If that does not work, remove BROADCASTER_REFRESH_TOKEN, BROADCASTER_ACCESS_TOKEN, BOT_REFRESH_TOKEN and BOT_ACCESS_TOKEN from your `.env` file and re-configure it again

## Contributing
There is no plan regarding contributions in this project.

## Support
This software is free and maintained in my spare time.
If you want to support my work, please contribute on [Paypal](https://www.paypal.com/donate/?hosted_button_id=9RRAEE5J7NNNN)

Thank you! ♥

## Credits
This software is developed by:

**Rafael Pernil Bronchalo** - *Software Engineer*

* [github/rafaelpernil2](https://github.com/rafaelpernil2)

## Changelog
The format is based on Keep a Changelog, and this project adheres to Semantic Versioning - see the [CHANGELOG.md](CHANGELOG.md) file for details.

## License
All rights reserved
