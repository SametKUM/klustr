package kube

import "testing"

// discovery/v1 documents a nil EndpointConditions.Ready as ready; a regression
// to a false default renders live endpoints as not-ready in the detail view.
func TestEndpointReady(t *testing.T) {
	if !endpointReady(nil) {
		t.Error("nil Ready must be treated as ready (discovery/v1 contract)")
	}
	f := false
	if endpointReady(&f) {
		t.Error("explicit false must stay not-ready")
	}
	tr := true
	if !endpointReady(&tr) {
		t.Error("explicit true must stay ready")
	}
}
