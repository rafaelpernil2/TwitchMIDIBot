# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [TwitchMIDI]

## [3.0.0] - 2025-02-08
### Added
- Repetitions per loop, now each loop repeats itself 4 times by default before moving to the next loop in queue. It can be customized via REPETITIONS_PER_LOOP at .env file
- Limit to one request in queue per user. Now if there's a request in queue by a particular user, that user has to wait until it's played or call !wrongrequest and try again
- Custom Time signatures in requests, now you can request loops with different time signatures (only one per request) like 3/4, 5/4, 7/8... or whatever is on your mind. Prog rock!
- Time signature changes trigger a MIDI CC message. You can map it to your metronome time signature within your DAW
- Macro feature: Now you can trigger a set of commands with different timeouts just using a single command or "macro"
- aliases.json has a new section called "macros". Not a breaking change because it is fixed automatically by this update
- !wrongloop command to remove a wrong but valid request from the queue
- New .env flags:
  - SILENCE_MACRO_MESSAGES for new Macro feature. It disables message output for macro commands
  - ALLOW_CUSTOM_TIME_SIGNATURE for custom time signature feature. It enables or disables other time signatures than 4/4
  - TIME_SIGNATURE_NUMERATOR_CC sets the MIDI CC to send messages containing the time signature numerator on each time signature change
  - TIME_SIGNATURE_DENOMINATOR_CC sets the MIDI CC to send messages containing the time signature denominator on each time signature change
  - REPETITIONS_PER_LOOP sets the amount of times each loop is played before moving to the next in queue
- !midibanuser and !midiunbanuser to forbid usage to some users
- !miditimeout to rate-limit requests per user (10 seconds by default)
- Now each request tags the user to let them know about the status of their request
- Revamped and extended Config API (for TwitchMIDI+). Now you can:
  - Query what's in the queue
  - Clear the queue
  - Remove items from the queue
  - Save request from the queue with any alias you like
  - Select a favorite request to keep repeating 
  - Reload configuration from files (./config)
  - Set tempo
  - Set MIDI volume
  - Check if bot is active (!midion has been sent)
  - Sync MIDI loop and clock (like !syncmidi)
- Automatic config file (re)generation and integrity checks. The config files are downloaded and merged from the master branch to fix any compatibility issues while keeping your settings. Updates are now as simple as getting the latest binary!
- Single-instance enforcement through .lock file: Now you can only run one instance of TwitchMIDI at any time to avoid undefined behaviour
- Embedded README.txt inside binary zip. It explains how to install and run TwitchMIDI in basic terms
- Debug profile for VSCode. A launch.json file for easier debugging with VSCode
- New internal queue interface and implementation to improve performance and simplify code. Also now any item can be removed from the queue and the app knows which request to play next properly.
- Logo in README title
- package.json script to find unused exports. This helps remove unused code or reduce code visibility
### Changed
- BREAKING CHANGE: /refreshConfig API now works via POST
- Improved clock precision by removing eventlistener-per-request logic. Now there is no event listener for this logic and the request queue is handled by an in-memory queue without nested promises. EventEmitters are not precise enough for music timing.
- Better exit handling - Now it catches unhandled exceptions to improve exit handling and user experience
- Optimized initial loading, now creates batches of promises to await for reduced times
- Code re-organization to better isolate components and domains (Twitch, MIDI, commands, queue...)
- Re-generated config files with proper alphabetical sorting in aliases.json, permissions.json and rewards.json
- Minor refactors for easier translations. The ASCII logo of TwitchMIDI now is saved as a constant
- Minor naming refactors
- Improved setTimeoutPromise with a default case for 0ns
- Updated all dependencies (Twurple.js, i18next, JZZ, PKG, ESLint...)
- Migrated all code to Node 22, Typescript 5.7 and ESModule
- Replaced NCC with ESBuild for a reduced build time
- Now !fetchdb also disables and regenerates rewards on Twitch in case there is a change
- Improved readability of initial setup links using magenta background as highlight and other text color changes
- Migrated from @vercel/pkg to @yao/pkg due to deprecation
### Fixed
- !midion with virtual MIDI device inactive or non existent would not throw an error. Now it does and helps the streamer find out what is wrong
- !syncmidi logic. nanotimer does not work as expected when calling .clearInterval, so I needed to invalidate the clock at synchronization
- Rewards disable bug. Before, it only disabled the current rewards from rewards.json file. If any reward were changed while running TwitchMIDI, it would stay active forever. Now it disables all rewards created by TwitchMIDI (new behaviour) and enables only the ones from rewards.json file (as before)
- Control Change error handling, now requests without value give a meaningful error
- Bad request bug. If you request "H" it is registered as a valid chord however, JZZ treats it as invalid and the queue stops working. Now it works well!
- !midion or non secure commands on !midipause did not work for mods. Now it does. If requests are paused but you are a mod, you can access
- Migrated Twitch PubSub to EventSub due to deprecation on April 14th 2025
### Removed
- BREAKING CHANGE: !sendchord command
- Documentation page from this repository. Now any documentation change does not require a new version release
- Max loop queue length. Before it was limited by the EventEmitter to 10 items waiting in queue. Now there is no limit since there are no EventEmitters in use.
- Queue clear rollback function that was unused. Now the logic is simpler
- All config files from final artifact (TwitchMIDI.zip file)
- Unnecessary template files
- Dead code


## [2.7.2] - 2022-09-28
### Fixed
- Callback executed on close to disable rewards and stop MIDI was only applied with rewards mode enabled. MIDI has to stop too with rewards mode disabled
### Changed
- Improved blacklist and whitelist search performance. It was using "find" when an "indexOf" is simpler and can provide faster results

## [2.7.1] - 2022-07-08
### Fixed
- Re-configuration of step 3 (REWARDS_MODE, VIP_REWARDS_MODE, TARGET_CHANNEL, SEND_UNAUTHORIZED_MESSAGE) always re-applied SEND_UNAUTHORIZED_MESSAGE even when properly configured
- Empty .env variable validation
### Changed
- Convert TARGET_CHANNEL to lowercase since all Twitch usernames must be lowercase (the display name can have case sensitivity but does not apply here)

## [2.7.0] - 2022-07-06
### Added
- !addchord update validation. If a chord progression is already saved with the same alias, an error is thrown
- Database "insert" method interface and implementation
### Changed
- !sendchord disabled (only available for broadcaster) by default to avoid confusion with !sendloop
- !removechord default permissions restricted to only Moderators and Broadcaster
- Removed default !sendchord and !removechord rewards
- Lowered price for default !sendloop reward from 100 points to 50 points
- Default value for "SEND_UNAUTHORIZED_MESSAGE" variable changed to false
- Database interface method renames

## [2.6.6] - 2022-07-05
### Fixed
- Typo in spanish text for !midihelp sendcc

## [2.6.5] - 2022-06-28
### Changed
- !addchord now validates the chord progression before adding it

## [2.6.4] - 2022-06-19
### Fixed
- Requests with no arguments. Now requests that require arguments throw an error if those are not provided

## [2.6.3] - 2022-06-18
### Fixed
- Rewards were re-enabled on Config API /refreshConfig regardless if bot is on or off. Now only re-enables them if they were enabled before

## [2.6.2] - 2022-06-10
### Changed
- Minor refactors in barLoopChange event listener, removed unused logic and reduced synchronous code
- Now MIDI is stopped automatically when closing the app

## [2.6.1] - 2022-06-07

### Added
- Troubleshooting section for auth errors

### Changed
- Removed .env from bundle, it is not required and creates confusion

## [2.6.0] - 2022-06-07
### Added
- Incremental setup process. Now only invalid or not configured environment variables are prompted on setup
- Environment variable to toggle showing authorization errors, it always showed them before
- Safe commands now also follow requirements/whitelist/blacklist. "Safe" means they can be requested via chat while requests are paused or with rewards mode on

### Fixed
- .env recreation without removing token JSONs, it gave authentication errors

### Changed
- Now users in whitelist do not need to comply to role restrictions. Makes more sense now

## [2.5.9] - 2022-06-06
### Added
- Automatic rewards disable on close, now closing the app without !midioff deactivates the rewards
- Extended Config API for rewards, now they reload in Twitch too!

## [2.5.8] - 2022-06-04
### Added
- Local REST API to refresh configuration files on demand
- Support for longer response messages (for !cclist, !chordlist, !midihelp, !midicurrentrequest, !midirequestqueue)
### Changed
- Now, if the list of saved chord progressions/cc macros is empty, !chordlist and !cclist respectively don't output a message


## [2.5.7] - 2022-05-31
### Changed
- Now !stoploop allows the current loop to finish and !fullstopmidi stops the sound at the moment.
- Simplified queue forwarding skip conditions

## [2.5.6] - 2022-05-26
### Fixed
- Trailing space in !settempo and !midiresume messages

## [2.5.5] - 2022-05-26
### Fixed
- Playing now notification messages repeat in chat when enabling the bot (!midion) several times

## [2.5.4] - 2022-05-19
### Fixed
- !midipause->!midiresume queue forwarding bugs. Now request repetition only applies to loops, as it should.
- Simplified !sendchord vs !sendloop request priority management.

## [2.5.3] - 2022-05-18
### Fixed
- Added missing parameter in JSDocs of getLanguagesFromLocale method

## [2.5.2] - 2022-05-18
### Fixed
- Added JSDocs to i18n init method

## [2.5.1] - 2022-05-17
### Fixed
- Added missing credits on !midioff

## [2.5.0] - 2022-05-17
### Added
- Internacionalization (i18n) and full Spanish translation
### Fixed
- Token expiry bug, now it tries to retrieve the tokens from tokens.json files before .env since .env does not update itself

## [2.4.0] - 2022-05-16
### Added
- Support for music rests, now you can add silences between chords or notes when using !sendchord, !sendloop and !sendnote with the token "rest"

## [2.3.0] - 2022-05-16
### Added
- Support for melodies using !sendnote. Separate your notes by commas to play them sequentially (e.g. "C5,E5,G5")

### Changed
- !sendnote now uses 1 quarter note length by default insead of 4 quarter notes length
- Improved error handling in !sendnote

## [2.2.3] - 2022-05-15
### Fixed
- !addchord does not work properly with chords containing a slash (/) like "m/ma7" or "6/9"

## [2.2.2] - 2022-05-15
### Added
- List of all supported chords at CHORDS.md

### Changed
- Chord parser now supports 13th, 11th, 5th and 4th chords without appending 'th' at the end.

## [2.2.1] - 2022-05-15
### Changed
- !chordlist now can lookup a particular alias and show that chord progression if found. It works as before by default.

## [2.2.0] - 2022-05-15
### Added
- Update detection, now you can know if there is an update at initialization
- Initialization suggestion to use !midihelp to explore all commands available

## [2.1.8] - 2022-05-14
### Changed
- Changed initialization error message

## [2.1.7] - 2022-05-14
### Fixed
- Initialization problems with non-affiliated Twitch users. No rewards code must be executed with REWARDS_MODE as false

## [2.1.6] - 2022-05-14
### Fixed
- App stays open on error to show what happened. The user needs to press enter to close it

## [2.1.5] - 2022-05-14
### Added
- More 69 easter eggs  \\(￣︶￣*\\))

### Changed
- Improved changelog descriptions
- Minor refactor in clearQueue to avoid future bugs using queues for anything other than !sendchord and !sendloop
- Minor variable and method renames for better readability

## [2.1.4] - 2022-05-13
### Fixed
- Request flushing with !stoploop (!sendloop->!stoploop->!sendloop)
### Changed
- Changed isSyncing flag to syncMode with 3 options, "Off", "Repeat last one" and "Skip". "!stoploop" skips all requests while "!sync" and !settempo" repeat last request

## [2.1.3] - 2022-05-13
### Fixed
- !sendchord after !sendloop request. !sendchord is supposed to play once, so it should not disrupt the previous or future !sendloop requests
### Changed
- Removed unused variable

## [2.1.2] - 2022-05-13
### Fixed
- Reward creation/update username, it was tied to the user typing the command when it must be the broadcaster username

## [2.1.1] - 2022-05-13
### Fixed
- Rewards redemption user, it was using the broadcaster userId when it has to be the user that redeemed the reward
- Allow users to access safe commands at any moment (!chordlist, !cclist, !midihelp, !midicurrentrequest and !midirequestqueue)
- Full access as broadcaster without further access checks

### Changed
- Improved rewards/chat selection logic, now there's a flag that shows where the request is coming from
- Rewards only use permissions.json for blacklist and whitelist

## [2.1.0] - 2022-05-12
### Added
- Requests pause (!midipause and !midiresume), allows the streamer to enjoy the current request and blocks chat redemptions and requests
- Support section in README
- Missing comments in code
### Change
- Reduced user roles for rewards to bare minimum. If one user must have extra permissions to do something, it's better to make that user VIP or Mod.

## [2.0.0] - 2022-05-11
### Added
- Automatic rewards management, they are created and enabled on !midion and disabled on !midioff and restart
- If the bot returns an error with a petition, the redeemed points are returned

### Changed
- BREAKING CHANGE: rewards.json has a different model, now stores the price of rewards too
- Updated Twurple, JZZ and dotenv dependencies
- Updated @vercel/ncc devDependency

## [1.3.5] - 2022-05-11
### Fixed
- Command alias reload on !fetchdb
### Changed
- Messages in !fetchdb and !midioff for better usability

## [1.3.4] - 2022-05-11
### Fixed
- Removed kaomojis from init messages because they are not rendered properly ~(>_<。)＼

## [1.3.3] - 2022-05-11
### Added
- Support via Paypal message on start

### Changed
- Improved initialization messages with colors and different order
- Bad MIDI connection error changed to bot disabled error to improve usability

## [1.3.2] - 2022-05-10
### Changed
- Updated a comment, removed typo and updated !fetchdb section at Features in README

## [1.3.1] - 2022-05-08
### Fixed
- Now !settempo and !syncmidi repeat the current loop with the new tempo/synchronized
- !sendloop->!sendchord->!stoploop->!sendloop overlap bug, now the logic is simpler and clearer

## [1.3.0] - 2022-05-07
### Added
- !midirequestqueue command - Shows the requests in the queue
- !midicurrentrequest command - You can see which request is playing right now
- Now a message in chat appears showing the request being played currently

### Fixed
- Now !syncmidi and !settempo commands don't clear the entire queue, only skips the current request

## [1.2.17] - 2022-05-06
### Added
- MacOS execution notes in README. If not launched properly, it has issues with paths

### Fixed
- Reproducibility of bundles, now deletes previous assets before bundling

### Changed
- Upgraded "pkg" from 5.5.2 to 5.6.0
- Updated package-lock.json to Node 16+ version (lockfileVersion 2)
- Updated GitHub Actions pipelines

## [1.2.16] - 2022-04-24
### Fixed
- Sweep CC messages overload, now duplicate messages are avoided

### Changed
- CC messages sweep precision now works as a frequency, taking into account the time difference

## [1.2.15] - 2022-04-22
### Changed
- Documented more methods and added missing return types
- Removed unused files

## [1.2.14] - 2022-04-22
### Changed
- Minor refactors

## [1.2.13] - 2022-04-22
### Fixed
- !addchord now trims spaces before and after in the alias and chord progression before adding

## [1.2.12] - 2022-04-22
### Removed
- GZip compression to binaries

## [1.2.11] - 2022-04-22
### Added
- GZip compression to binaries, now they take up less space
### Changed
- Improved !sendcc command parsing and simplified code further
### Fixed
- Bugs when mixing CC commands with delay and without delay
- CC command list request with spaces between commands now works

## [1.2.10] - 2022-04-20
### Changed
- Re-organized midioff, midivolume and triggerClock to remove unnecessary exports and simplify code

## [1.2.9] - 2022-04-17
### Changed
- Added missing JSDocs in one method

## [1.2.8] - 2022-04-17
### Changed
- Refactor more methods to compact input parameters
- Updated JSDocs

## [1.2.7] - 2022-04-17
### Changed
- Sweep method refactor to compact input parameters

## [1.2.6] - 2022-04-17
### Fixed
- Line jump on first .env initialization error message

## [1.2.5] - 2022-04-17
### Changed
- Improved environment variable load error handling

## [1.2.4] - 2022-04-17
### Changed
- Cleaned up comments and minor name refactors

## [1.2.3] - 2022-04-17
### Changed
- More refactors, grouped code and simplified where possible
- Added environment variable validation and parsing on initialization

## [1.2.2] - 2022-04-15
### Changed
- Code re-ordering/refactors
- Simplified and unified style in .env variable loading
- Documented more methods
### Removed
- Dead code

## [1.2.1] - 2022-04-13
### Changed
- Bettercodehub.yaml excluded directories. Same code

## [1.2.0] - 2022-04-13
### Added
- Fine-grained command access control with role check, whitelist and blackist
### Changed
- Major refactor to reduce code duplicity and spread features in different files/folders
- Reduced sweep precision to 256 again to reduce load, the outcome is pretty much the same

## [1.1.6] - 2022-04-12
### Added
- Easter egg (try !settempo 69)
### Changed
- Tempo value now can have decimals
- Reorganized clock instructions for perfect stability and precision
- Changed Math.floor to Math.round in timeout and sweep calculations to be more precise

## [1.1.5] - 2022-04-12
### Added
- Tempo validation, it must be between 35 and 400
### Fixed
- Clock start sync

## [1.1.4] - 2022-04-12
### Changed
- Removed commented-out code
- Minor refactor

## [1.1.3] - 2022-04-12
### Changed
- Renamed package.json name from "twitch-midi-bot" to "twitch-midi" | This is not a breaking change because this project is not published as a package

## [1.1.2] - 2022-04-12
### Changed
- More refactors to simplify code, now the MIDI clock is separate and all the utils are better categorized
- Documented lots of methods
- Simplified CC message handling code
- Improved error handling and validation
- Increased sweep precision from 256 to 512 steps
### Added
- Shared variables to send information between exported modules
### Fixed
- !midioff bugs, now flushes chord progressions/loops and waits a bit for everything to be clean


## [1.1.1] - 2022-04-12
### Fixed
- !fullstopmidi queue reset again

## [1.1.0] - 2022-04-12
### Added
- Loop queue resumes after chord queue is done
### Changed
- Big refactor of whole project
- Improved and simplified queue code
### Fixed
- No more queue collisions

## [1.0.8] - 2022-04-11
### Fixed
- !sendloop and !sendchord duplicate requests are now ignored
- Queue overlapping issues

## [1.0.7] - 2022-04-11
### Fixed
- !fullstopmidi and !stoploop queue reset

## [1.0.6] - 2022-04-10
### Added
- Command collision prevention, now a queue is created and chord progressions and loops are executed in order
### Fixed
- !midioff variable reset - Now !loop starts the MIDI clock again after !midioff-!midion sequence

## [1.0.5] - 2022-04-10
### Changed
- Now when queing a loop or chord progression, if the MIDI clock was stopped, it starts so that you don't need to always call !settempo to start the beat
- Default MIDI volume changed from 100/127 to 64/127

## [1.0.4] - 2022-04-09
### Changed
- Improved clock stability and sync commands - Now flushes loop when changing tempo and !sync calls !settempo with the current tempo
- Reduced CPU usage

## [1.0.3] - 2022-04-09
### Added
- VIP toggle to allow VIP users to use commands freely when Rewards mode is enabled
- Credits in !midion and !midioff

### Changed
- Command message unification
- Renamed WebMIDI keywords to MIDI for accuracy

## [1.0.2] - 2022-04-01
### Added
- Missing links to commands in README.md

## [1.0.1] - 2022-04-01
### Added
- Multi-OS bundle in Feature section inside README.md
- New documentation from previous commits

## [1.0.0] - 2022-04-01
### Added
- Initial stable version


[TwitchMIDI]: https://github.com/rafaelpernil2/TwitchMIDI
[3.0.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.7.2...v3.0.0
[2.7.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.7.1...v2.7.2
[2.7.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.7.0...v2.7.1
[2.7.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.6...v2.7.0
[2.6.6]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.5...v2.6.6
[2.6.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.4...v2.6.5
[2.6.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.3...v2.6.4
[2.6.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.2...v2.6.3
[2.6.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.1...v2.6.2
[2.6.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.6.0...v2.6.1
[2.6.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.9...v2.6.0
[2.5.9]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.8...v2.5.9
[2.5.9]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.8...v2.5.9
[2.5.8]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.7...v2.5.8
[2.5.7]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.6...v2.5.7
[2.5.6]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.5...v2.5.6
[2.5.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.4...v2.5.5
[2.5.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.3...v2.5.4
[2.5.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.2...v2.5.3
[2.5.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.1...v2.5.2
[2.5.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.4.0...v2.5.0
[2.4.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.3.0...v2.4.0
[2.3.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.2.3...v2.3.0
[2.2.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.2.2...v2.2.3
[2.2.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.8...v2.2.0
[2.1.8]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.7...v2.1.8
[2.1.7]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.6...v2.1.7
[2.1.6]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.5...v2.1.6
[2.1.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.4...v2.1.5
[2.1.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.3...v2.1.4
[2.1.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.2...v2.1.3
[2.1.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.3.5...v2.0.0
[1.3.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.17...v1.3.0
[1.2.17]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.16...v1.2.17
[1.2.16]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.15...v1.2.16
[1.2.15]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.14...v1.2.15
[1.2.14]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.13...v1.2.14
[1.2.13]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.12...v1.2.13
[1.2.12]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.11...v1.2.12
[1.2.11]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.10...v1.2.11
[1.2.10]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.9...v1.2.10
[1.2.9]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.8...v1.2.9
[1.2.8]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.7...v1.2.8
[1.2.7]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.6...v1.2.7
[1.2.6]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.5...v1.2.6
[1.2.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.6...v1.2.0
[1.1.6]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.5...v1.1.6
[1.1.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.4...v1.1.5
[1.1.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.8...v1.1.0
[1.0.8]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/rafaelpernil2/TwitchMIDI/compare/v0.1.3...v1.0.0
