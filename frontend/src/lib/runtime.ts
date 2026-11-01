// The Wails runtime calls the frontend uses, with the v2 call shapes the rest
// of the code was written against.
//
// Events: app/events.go always sends an event's arguments as one list, which
// EventsOn spreads back into the listener's parameters.

import { Browser, Clipboard, Events } from '@wailsio/runtime'

// Listeners declare their own parameter types, as they did with v2's EventsOn.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventListener = (...args: any[]) => unknown

type ListenerWrapper = (name: string, listener: EventListener) => EventListener

let wrapListener: ListenerWrapper | null = null

// Only the perf probe (src/perf/) sets this, before the app subscribes to
// anything, to see every event before its listener does.
export function setListenerWrapper(wrapper: ListenerWrapper): void {
  wrapListener = wrapper
}

export function EventsOn(name: string, listener: EventListener): () => void {
  const target = wrapListener ? wrapListener(name, listener) : listener
  return Events.On(name, (event) => {
    const data: unknown = event.data
    target(...(Array.isArray(data) ? data : [data]))
  })
}

export function EventsOff(name: string, ...additionalNames: string[]): void {
  Events.Off(name, ...additionalNames)
}

export function EventsEmit(name: string, data?: unknown): void {
  void Events.Emit(name, data)
}

export function BrowserOpenURL(url: string): void {
  void Browser.OpenURL(url)
}

export function ClipboardGetText(): Promise<string> {
  return Clipboard.Text()
}

export function ClipboardSetText(text: string): Promise<boolean> {
  return Clipboard.SetText(text).then(() => true)
}
