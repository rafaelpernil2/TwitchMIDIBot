export enum Command {
    midihelp = 'midihelp',
    midion = 'midion',
    midioff = 'midioff',
    addchord = 'addchord',
    removechord = 'removechord',
    chordlist = 'chordlist',
    sendnote = 'sendnote',
    sendchord = 'sendchord',
    sendloop = 'sendloop',
    sendcc = 'sendcc',
    cclist = 'cclist',
    midivolume = 'midivolume',
    stoploop = 'stoploop',
    fullstopmidi = 'fullstopmidi',
    settempo = 'settempo',
    syncmidi = 'syncmidi',
    fetchdb = 'fetchdb',
    midicurrentrequest = 'midicurrentrequest',
    midirequestqueue = 'midirequestqueue',
    midipause = 'midipause',
    midiresume = 'midiresume',
    midibanuser = 'midibanuser',
    midiunbanuser = 'midiunbanuser',
    miditimeout = 'miditimeout'
}

export type CCCommand = [controller: number, value: number, time: number];
