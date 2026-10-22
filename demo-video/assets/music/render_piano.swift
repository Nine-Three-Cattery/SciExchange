import AVFoundation
import AudioToolbox
import Foundation

struct NoteEvent: Decodable {
    let time: Double
    let type: String
    let note: UInt8
    let velocity: UInt8
}
struct Performance: Decodable {
    let duration_seconds: Double
    let events: [NoteEvent]
}
guard CommandLine.arguments.count == 3 else {
    fatalError("Usage: render_piano performance.json output.wav")
}
let performance = try JSONDecoder().decode(Performance.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1])))
let engine = AVAudioEngine()
let piano = AVAudioUnitSampler()
let reverb = AVAudioUnitReverb()
engine.attach(piano)
engine.attach(reverb)
let format = AVAudioFormat(standardFormatWithSampleRate: 48000, channels: 2)!
engine.connect(piano, to: reverb, format: format)
engine.connect(reverb, to: engine.mainMixerNode, format: format)
try piano.loadSoundBankInstrument(at: URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls"), program: 0, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
reverb.loadFactoryPreset(.mediumHall)
reverb.wetDryMix = 13
piano.masterGain = -7
try engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: 4096)
var output: AVAudioFile? = try AVAudioFile(forWriting: URL(fileURLWithPath: CommandLine.arguments[2]), settings: format.settings)
let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: 4096)!
try engine.start()
var index = 0
let finalFrame = AVAudioFramePosition((performance.duration_seconds * 48000).rounded())
while engine.manualRenderingSampleTime < finalFrame {
    let current = engine.manualRenderingSampleTime
    while index < performance.events.count && AVAudioFramePosition((performance.events[index].time * 48000).rounded()) <= current {
        let event = performance.events[index]
        if event.type == "on" { piano.startNote(event.note, withVelocity: event.velocity, onChannel: 0) }
        else { piano.stopNote(event.note, onChannel: 0) }
        index += 1
    }
    let next = index < performance.events.count ? AVAudioFramePosition((performance.events[index].time * 48000).rounded()) : finalFrame
    let frames = AVAudioFrameCount(min(4096, min(finalFrame - current, max(1, next - current))))
    let status = try engine.renderOffline(frames, to: buffer)
    switch status {
    case .success: try output!.write(from: buffer)
    case .cannotDoInCurrentContext: continue
    default: fatalError("Offline piano rendering failed: \(status.rawValue)")
    }
}
engine.stop()
output = nil // Finalize the WAV header before the command-line process exits.
print("Rendered piano:", performance.duration_seconds, "seconds, stereo 48 kHz")
