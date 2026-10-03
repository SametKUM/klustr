package app

import (
	"encoding/json"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"text/template"
)

// deliver reproduces how Wails hands an event to the frontend: it marshals
// {name, data} (frontend/desktop/*/frontend.go, Notify), embeds the payload
// in a JavaScript string literal through template.JSEscapeString, and the
// runtime JSON.parses that literal. It returns the data arguments the
// frontend's listener receives, re-encoded as JSON.
func deliver(t *testing.T, args ...any) []string {
	t.Helper()
	payload, err := json.Marshal(struct {
		Name string `json:"name"`
		Data []any  `json:"data"`
	}{"test", args})
	if err != nil {
		t.Fatal(err)
	}
	literal := jsStringLiteral(t, template.JSEscapeString(string(payload)))
	var message struct {
		Data []json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal([]byte(literal), &message); err != nil {
		t.Fatalf("frontend JSON.parse failed: %v", err)
	}
	out := make([]string, len(message.Data))
	for i, d := range message.Data {
		var v any
		if err := json.Unmarshal(d, &v); err != nil {
			t.Fatal(err)
		}
		canonical, _ := json.Marshal(v)
		out[i] = string(canonical)
	}
	return out
}

// jsStringLiteral decodes the body of a JavaScript string literal for the
// escapes JSEscapeString emits: backslash, quote and apostrophe escapes, and a
// backslash-u followed by exactly four hex digits, which is all a JavaScript
// engine reads.
func jsStringLiteral(t *testing.T, s string) string {
	t.Helper()
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] != '\\' {
			b.WriteByte(s[i])
			continue
		}
		i++
		switch s[i] {
		case '\\', '\'', '"':
			b.WriteByte(s[i])
		case 'u':
			n, err := strconv.ParseUint(s[i+1:i+5], 16, 32)
			if err != nil {
				t.Fatalf("bad escape %q", s[i-1:i+5])
			}
			b.WriteRune(rune(n))
			i += 4
		default:
			t.Fatalf("unexpected escape %q", s[i-1:i+1])
		}
	}
	return b.String()
}

func canonical(t *testing.T, v any) string {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	var decoded any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	out, _ := json.Marshal(decoded)
	return string(out)
}

// The workaround exists because of this: an unescaped Nerd Font icon above
// U+FFFF loses its last hex digit to the following text. If Go or Wails ever
// stops doing this, the test fails and emit's escaping can go.
func TestWailsTransportSplitsAstralRunes(t *testing.T) {
	got := deliver(t, "\U000F033D")
	if want := "\"\U0000F033D\""; got[0] != want {
		t.Fatalf("transport behaviour changed: got %+q, want %+q", got[0], want)
	}
}

func TestEventArgsSurviveWailsTransport(t *testing.T) {
	type row struct {
		Name    string   `json:"name"`
		Message string   `json:"message"`
		Lines   []string `json:"lines"`
	}
	cases := map[string]any{
		"starship prompt": "\x1b[38;2;255;140;0m\U0000E0B6 \U000F033D ~ \U000F10FE bitaksi-data \U0000F017 00:00\x1b[0m\r\n",
		"emoji and tags":  "\U0001F680 \U0001FAE9 \U0001F3F4\U000E0067\U000E0062\U000E0065\U000E006E\U000E0067\U000E007F",
		"log lines":       []string{"plain", "icon \U000F033D", ""},
		"struct":          row{Name: "web", Message: "ready \U000F10FE", Lines: []string{"\U000F0001"}},
		"js specials":     `quote ' " back \ <script> & = ` + "\U00002028\U00002029\x00\x07",
		"bmp only":        "çğışöü \U00002500\U00002502 \U0000E0B0",
		"invalid utf-8":   "tail \xf0\x9f",
	}
	for name, v := range cases {
		t.Run(name, func(t *testing.T) {
			got := deliver(t, eventArg(v))
			if want := canonical(t, v); got[0] != want {
				t.Fatalf("got %+q\nwant %+q", got[0], want)
			}
		})
	}
}

func TestEmitArgsKeepTheirOrder(t *testing.T) {
	args := []any{"ctx", "Pod", map[string]any{"upserts": []string{"\U000F033D"}}}
	converted := make([]any, len(args))
	for i, a := range args {
		converted[i] = eventArg(a)
	}
	got := deliver(t, converted...)
	want := make([]string, len(args))
	for i, a := range args {
		want[i] = canonical(t, a)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+q, want %+q", got, want)
	}
}

// Payloads without a rune above U+FFFF, nearly all of them, reach Wails as the
// original value, so the hot stream events pay only for a byte scan.
func TestEventArgPassesPlainPayloadsThrough(t *testing.T) {
	type row struct{ Name string }
	plain := "\x1b[0mçğ \U00002500 \U0000E0B0\r\n"
	if got, ok := eventArg(plain).(string); !ok || got != plain {
		t.Fatalf("string: got %#v", eventArg(plain))
	}
	lines := []string{"a", plain}
	if got, ok := eventArg(lines).([]string); !ok || &got[0] != &lines[0] {
		t.Fatalf("[]string: got %#v", eventArg(lines))
	}
	if got, ok := eventArg(row{Name: plain}).(row); !ok || got.Name != plain {
		t.Fatalf("struct: got %#v", eventArg(row{Name: plain}))
	}
	if _, ok := eventArg([]string{"a", "\U000F033D"}).(json.RawMessage); !ok {
		t.Fatal("expected a slice with an astral rune to be pre-encoded")
	}
}

func TestEscapeAstral(t *testing.T) {
	raw := []byte("{\"text\":\"\U000000E7 \U00002500 \U0000E0B0\"}")
	if out := escapeAstral(raw); &out[0] != &raw[0] {
		t.Fatal("expected the input slice back when nothing needs escaping")
	}
	in := []byte("\"a\U0001F680b\U000F033D\"")
	want := `"a` + `\` + `ud83d` + `\` + `ude80b` + `\` + `udb80` + `\` + `udf3d"`
	if got := string(escapeAstral(in)); got != want {
		t.Fatalf("got %s, want %s", got, want)
	}
}
