// record-show helper: macOS facts the Node script cannot read by itself.
//
//   check            JSON: screen and microphone permission, the active displays
//   request          ask macOS for both permissions (shows the system prompts)
//   mouse <file>     append the cursor and button state as JSON lines until SIGTERM
//   menubar <node> <script>
//                    a menu bar item and two hotkeys: Control-Option-Command-R runs
//                    `<node> <script> toggle`, Control-Option-Command-S runs `... shot`
//
// None of this needs Accessibility or Input Monitoring: the cursor is read from
// CGEvent(source: nil).location and the buttons from CGEventSource.buttonState,
// which macOS answers without either permission.

import AppKit
import AVFoundation
import Carbon.HIToolbox
import CoreGraphics
import Foundation

func emit(_ object: Any) {
  let data = try! JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

func micStatus() -> String {
  switch AVCaptureDevice.authorizationStatus(for: .audio) {
  case .authorized: return "granted"
  case .denied: return "denied"
  case .restricted: return "restricted"
  case .notDetermined: return "not-determined"
  @unknown default: return "unknown"
  }
}

func displays() -> [[String: Any]] {
  var count: UInt32 = 0
  CGGetActiveDisplayList(0, nil, &count)
  var ids = [CGDirectDisplayID](repeating: 0, count: Int(count))
  CGGetActiveDisplayList(count, &ids, &count)
  return ids.enumerated().map { index, id in
    let b = CGDisplayBounds(id)
    return [
      "index": index, "id": Int(id), "main": CGDisplayIsMain(id) != 0,
      "x": b.origin.x, "y": b.origin.y, "width": b.size.width, "height": b.size.height,
      "pixelWidth": CGDisplayPixelsWide(id), "pixelHeight": CGDisplayPixelsHigh(id),
    ]
  }
}

func check() {
  emit([
    "screen": CGPreflightScreenCaptureAccess() ? "granted" : "denied",
    "microphone": micStatus(),
    "displays": displays(),
  ])
}

func request() {
  let screen = CGPreflightScreenCaptureAccess() || CGRequestScreenCaptureAccess()
  let done = DispatchSemaphore(value: 0)
  var mic = micStatus() == "granted"
  if micStatus() == "not-determined" {
    AVCaptureDevice.requestAccess(for: .audio) { ok in mic = ok; done.signal() }
    _ = done.wait(timeout: .now() + 120)
  }
  emit(["screen": screen ? "granted" : "denied", "microphone": mic ? "granted" : micStatus()])
}

func mouse(_ path: String) {
  FileManager.default.createFile(atPath: path, contents: nil)
  guard let out = FileHandle(forWritingAtPath: path) else { exit(2) }
  out.seekToEndOfFile()
  signal(SIGTERM) { _ in exit(0) }
  signal(SIGINT) { _ in exit(0) }
  var last = CGPoint(x: -1, y: -1)
  var lastButtons = 0
  var lastWrite = 0.0
  while true {
    let p = CGEvent(source: nil)?.location ?? .zero
    var buttons = 0
    if CGEventSource.buttonState(.combinedSessionState, button: .left) { buttons |= 1 }
    if CGEventSource.buttonState(.combinedSessionState, button: .right) { buttons |= 2 }
    let now = Date().timeIntervalSince1970
    let moved = abs(p.x - last.x) + abs(p.y - last.y) >= 2
    // A move is written at most 10 times a second; a button change always.
    if buttons != lastButtons || (moved && now - lastWrite >= 0.1) || now - lastWrite >= 5 {
      let line: [String: Any] = [
        "t": Int((now * 1000).rounded()), "x": Int(p.x.rounded()), "y": Int(p.y.rounded()), "b": buttons,
      ]
      out.write(try! JSONSerialization.data(withJSONObject: line, options: [.sortedKeys]))
      out.write("\n".data(using: .utf8)!)
      last = p
      lastButtons = buttons
      lastWrite = now
    }
    usleep(25_000)
  }
}

final class MenuBar: NSObject {
  let node: String
  let script: String
  let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
  let toggleItem = NSMenuItem(title: "", action: #selector(toggle), keyEquivalent: "")
  var recording = false

  init(node: String, script: String) {
    self.node = node
    self.script = script
    super.init()
    let menu = NSMenu()
    toggleItem.target = self
    menu.addItem(toggleItem)
    let shotItem = NSMenuItem(title: "Снимок области  ⌃⌥⌘S", action: #selector(shot), keyEquivalent: "")
    shotItem.target = self
    menu.addItem(shotItem)
    let open = NSMenuItem(title: "Открыть папку записей", action: #selector(openFolder), keyEquivalent: "")
    open.target = self
    menu.addItem(open)
    menu.addItem(NSMenuItem.separator())
    let quit = NSMenuItem(title: "Убрать из строки меню", action: #selector(quit), keyEquivalent: "")
    quit.target = self
    menu.addItem(quit)
    item.menu = menu
    refresh()
    Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.refresh() }
  }

  func run(_ args: [String]) -> String {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: node)
    p.arguments = [script] + args
    let pipe = Pipe()
    p.standardOutput = pipe
    p.standardError = pipe
    try? p.run()
    p.waitUntilExit()
    return String(data: pipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
  }

  func refresh() {
    DispatchQueue.global().async {
      let out = self.run(["status", "--json"])
      let state = (try? JSONSerialization.jsonObject(with: Data(out.utf8))) as? [String: Any]
      let rec = (state?["recording"] as? Bool) ?? false
      DispatchQueue.main.async {
        self.recording = rec
        self.item.button?.title = rec ? "● Запись" : "◎"
        self.item.button?.contentTintColor = rec ? .systemRed : nil
        self.toggleItem.title = rec ? "Остановить запись показа  ⌃⌥⌘R" : "Записать показ  ⌃⌥⌘R"
      }
    }
  }

  @objc func toggle() {
    item.button?.title = recording ? "… Сохраняю" : "… Начинаю"
    DispatchQueue.global().async {
      _ = self.run(["toggle", "--from-menu"])
      DispatchQueue.main.async { self.refresh() }
    }
  }

  @objc func shot() {
    DispatchQueue.global().async { _ = self.run(["shot", "--from-menu"]) }
  }

  @objc func openFolder() { _ = run(["open"]) }
  @objc func quit() { NSApp.terminate(nil) }
}

var menuBar: MenuBar?

// Carbon hotkeys need no Accessibility permission. id 1 is ⌃⌥⌘R, id 2 is ⌃⌥⌘S.
func hotkeys(_ handler: @escaping (UInt32) -> Void) {
  var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
  let box = Unmanaged.passRetained(HandlerBox(handler)).toOpaque()
  InstallEventHandler(GetApplicationEventTarget(), { _, event, data in
    var id = EventHotKeyID()
    GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID),
                      nil, MemoryLayout<EventHotKeyID>.size, nil, &id)
    Unmanaged<HandlerBox>.fromOpaque(data!).takeUnretainedValue().run(id.id)
    return noErr
  }, 1, &spec, box, nil)
  for (n, key) in [(UInt32(1), kVK_ANSI_R), (UInt32(2), kVK_ANSI_S)] {
    var ref: EventHotKeyRef?
    RegisterEventHotKey(UInt32(key), UInt32(controlKey | optionKey | cmdKey),
                        EventHotKeyID(signature: OSType(0x5253_4857), id: n),  // "RSHW"
                        GetApplicationEventTarget(), 0, &ref)
  }
}

final class HandlerBox {
  let run: (UInt32) -> Void
  init(_ run: @escaping (UInt32) -> Void) { self.run = run }
}

let args = CommandLine.arguments
switch args.count > 1 ? args[1] : "" {
case "check": check()
case "request": request()
case "mouse" where args.count > 2: mouse(args[2])
case "menubar" where args.count > 3:
  let app = NSApplication.shared
  app.setActivationPolicy(.accessory)
  menuBar = MenuBar(node: args[2], script: args[3])
  hotkeys { id in if id == 1 { menuBar?.toggle() } else { menuBar?.shot() } }
  app.run()
default:
  FileHandle.standardError.write("usage: helper check | request | mouse <file> | menubar <node> <script>\n".data(using: .utf8)!)
  exit(64)
}
