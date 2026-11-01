package app

import (
	"bytes"
	"encoding/json"
	"slices"
	"strings"
	"unicode/utf16"
	"unicode/utf8"
)

// emit sends a Wails event. Use it instead of Event.Emit.
//
// The event's data is always the argument list, even for one argument or
// none. Wails sends a single argument as itself and several as a list, so a
// listener could not tell two arguments from one list argument such as the
// []string of pod:logs:line. src/lib/runtime.ts spreads the list back into
// the listener's arguments.
//
// Wails v2 delivered an event by embedding its JSON payload in a script through
// text/template's JSEscapeString, which writes a rune Go considers unprintable
// as `\u%04X`. Above U+FFFF that is five or six hex digits, and JavaScript
// reads only four, so U+F033D, a Nerd Font icon, arrived as U+F033 followed by
// "D". emit pre-encodes any argument that carries such a rune and writes it as
// JSON surrogate-pair escapes, which decode to the same value on any transport.
func (a *App) emit(name string, data ...any) {
	args := make([]any, len(data))
	for i, d := range data {
		args[i] = eventArg(d)
	}
	a.wails.Event.Emit(name, probeArgs(name, args))
}

// eventArg returns v itself unless its JSON would carry a rune above U+FFFF.
// Only then is it pre-encoded: Wails re-validates a json.RawMessage, which
// costs several times a plain string encode, so the stream events (strings and
// string slices) are checked without encoding them.
func eventArg(v any) any {
	switch s := v.(type) {
	case string:
		if !hasAstral(s) {
			return v
		}
	case []string:
		if !slices.ContainsFunc(s, hasAstral) {
			return v
		}
	}
	raw, err := json.Marshal(v)
	if err != nil || !hasAstralBytes(raw) {
		// A marshal error is left to Wails, which logs it as it always has.
		return v
	}
	return json.RawMessage(escapeAstral(raw))
}

// astralLeads are the lead bytes of four-byte UTF-8 sequences, the encoding of
// every rune above U+FFFF. Five vectorized IndexByte passes scan a 64 KiB
// terminal chunk several times faster than one byte-by-byte loop.
const astralLeads = "\xf0\xf1\xf2\xf3\xf4"

func hasAstral(s string) bool {
	for i := range len(astralLeads) {
		if strings.IndexByte(s, astralLeads[i]) >= 0 {
			return true
		}
	}
	return false
}

func hasAstralBytes(b []byte) bool {
	for i := range len(astralLeads) {
		if bytes.IndexByte(b, astralLeads[i]) >= 0 {
			return true
		}
	}
	return false
}

// escapeAstral rewrites every rune above U+FFFF in encoded JSON as a
// `\uXXXX\uXXXX` surrogate-pair escape. Such runes only occur inside string
// literals, where the escape decodes to the same character. raw comes back
// unchanged when it has none.
func escapeAstral(raw []byte) []byte {
	start := slices.IndexFunc(raw, func(c byte) bool { return c >= 0xF0 })
	if start < 0 {
		return raw
	}
	const hex = "0123456789abcdef"
	out := make([]byte, 0, len(raw))
	out = append(out, raw[:start]...)
	for i := start; i < len(raw); {
		r, size := utf8.DecodeRune(raw[i:])
		if size != 4 {
			out = append(out, raw[i:i+size]...)
			i += size
			continue
		}
		hi, lo := utf16.EncodeRune(r)
		for _, u := range [2]rune{hi, lo} {
			out = append(out, '\\', 'u', hex[u>>12&0xF], hex[u>>8&0xF], hex[u>>4&0xF], hex[u&0xF])
		}
		i += size
	}
	return out
}
