package kube

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	authv1 "k8s.io/api/authorization/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	clienttesting "k8s.io/client-go/testing"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
	gatewayv1alpha2 "sigs.k8s.io/gateway-api/apis/v1alpha2"
	gwfake "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/fake"
	gwinformers "sigs.k8s.io/gateway-api/pkg/client/informers/externalversions"
)

func TestGatewayDiscoveryRecoversWithoutReconnect(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		const stable = "gateway.networking.k8s.io/v1"
		d := &gatewayDiscoveryStub{
			resources: map[string][]metav1.APIResource{
				stable:                               {gatewayTestResource("Gateway", "gateways")},
				"gateway.networking.k8s.io/v1alpha2": {gatewayTestResource("TCPRoute", "tcproutes")},
			},
			failures: map[string][]error{stable: {errors.New("offline"), errors.New("offline"), errors.New("offline"), errors.New("offline")}},
		}
		gw := gwfake.NewSimpleClientset(
			&gatewayv1alpha2.TCPRoute{ObjectMeta: metav1.ObjectMeta{Name: "tcp", Namespace: "app"}},
		)
		if _, err := gw.GatewayV1().Gateways("app").Create(t.Context(), &gatewayv1.Gateway{ObjectMeta: metav1.ObjectMeta{Name: "edge", Namespace: "app"}}, metav1.CreateOptions{}); err != nil {
			t.Fatal(err)
		}
		var changes []string
		var changesMu sync.Mutex
		w := newContextWatcher(nil, d, gw, nil, "", func(kind string, _ *KindDelta) {
			changesMu.Lock()
			defer changesMu.Unlock()
			changes = append(changes, kind)
		})
		cs := fakeSAR(t, map[string]bool{"list:gateways:": true, "watch:gateways:": true, "list:tcproutes:": true, "watch:tcproutes:": true})
		w.cs = cs
		ctx, cancel := context.WithCancel(t.Context())
		w.cancel = cancel
		defer func() { w.stop(); w.gwFactory.Shutdown() }()
		if err := w.startGatewayInformers(ctx); err != nil {
			t.Fatal(err)
		}
		m := &ClientManager{watchers: map[string]*contextWatcher{"ctx": w}}
		<-time.After(500 * time.Millisecond)
		synctest.Wait()
		if len(w.TCPRoutes("app")) != 1 || w.gatewayFactoryFor("Gateway") != nil {
			t.Fatal("an unavailable version blocked a healthy API or invented Gateway support")
		}
		if _, err := m.resolveKind("ctx", "Gateway"); err == nil {
			t.Fatal("resolved Gateway before discovery recovered")
		}
		<-time.After(4 * time.Second)
		synctest.Wait()
		if got := w.Gateways("app"); len(got) != 1 || got[0].Name != "edge" {
			t.Fatalf("recovered Gateway list = %v, versions=%v pending=%v access=%v discovery=%v requests=%v", got, w.gwVersions, w.gwPending, w.gwAccess.kinds, d.calls, gw.Actions())
		}
		if got, err := m.resolveKind("ctx", "Gateway"); err != nil || got.Version != "v1" {
			t.Fatalf("recovered mutation GVR = %v, %v", got, err)
		}
		if !slices.Contains(m.AccessibleKinds("ctx"), "Gateway") || !slices.Contains(changes, "_access") || !slices.Contains(changes, "Gateway") {
			t.Fatalf("recovered capabilities were not published: %v", changes)
		}
		accessUpdates := 0
		for _, kind := range changes {
			if kind == "_access" {
				accessUpdates++
			}
		}
		if accessUpdates != 1 {
			t.Fatalf("unchanged capabilities caused redundant resets: %v", changes)
		}
		if len(cs.Actions()) != 4 {
			t.Fatalf("healthy access was re-probed: %d requests", len(cs.Actions()))
		}
		if w.gatewayVersion("TCPRoute") != "v1alpha2" || d.calls[stable] != 5 {
			t.Fatalf("unexpected recovery: versions=%v, calls=%v", w.gwVersions, d.calls)
		}
		calls := d.calls[stable]
		<-time.After(time.Minute)
		synctest.Wait()
		if d.calls[stable] != calls {
			t.Fatal("discovery continued polling after recovery")
		}
	})
}

func TestGatewayDiscoveryStopsOnCancellationOrConfirmedAbsence(t *testing.T) {
	for _, cancelBeforeRetry := range []bool{false, true} {
		t.Run(map[bool]string{false: "absent", true: "canceled"}[cancelBeforeRetry], func(t *testing.T) {
			synctest.Test(t, func(t *testing.T) {
				d := &gatewayDiscoveryStub{}
				if cancelBeforeRetry {
					d.failures = map[string][]error{"gateway.networking.k8s.io/v1": {errors.New("offline"), errors.New("offline")}}
				}
				gw := gwfake.NewClientset()
				w := newContextWatcher(nil, d, gw, nil, "", func(string, *KindDelta) { t.Error("unexpected resource change") })
				w.cs = fake.NewClientset()
				ctx, cancel := context.WithCancel(t.Context())
				w.cancel = cancel
				defer func() { w.stop(); w.gwFactory.Shutdown() }()
				if err := w.startGatewayInformers(ctx); err != nil {
					t.Fatal(err)
				}
				if cancelBeforeRetry {
					w.stop()
				}
				before := d.calls["gateway.networking.k8s.io/v1"]
				<-time.After(time.Minute)
				synctest.Wait()
				if d.calls["gateway.networking.k8s.io/v1"] != before || len(gw.Actions()) != 0 {
					t.Fatalf("unexpected discovery or informer requests: %v, %v", d.calls, gw.Actions())
				}
			})
		})
	}
}

func TestGatewayCredentialRefreshReusesCompatibleAccess(t *testing.T) {
	for _, tc := range []struct {
		name, namespace, version string
		wantProbes               int
	}{
		{name: "same capabilities", namespace: "team-a", version: "v1", wantProbes: 0},
		{name: "changed version", namespace: "team-a", version: "v1alpha2", wantProbes: 2},
		{name: "changed namespace", namespace: "team-b", version: "v1", wantProbes: 4},
	} {
		t.Run(tc.name, func(t *testing.T) {
			previous := &contextWatcher{
				defaultNS: "team-a", gwVersions: map[string]string{"TLSRoute": "v1", "Gateway": "v1"},
				gwAccess: &contextAccess{kinds: map[string]KindAccess{"TLSRoute": {Mode: AccessCluster}, "Gateway": {Mode: AccessDenied}}},
			}
			cs := fakeSAR(t, map[string]bool{"list:tlsroutes:": true, "watch:tlsroutes:": true})
			ctx, cancel := context.WithCancel(t.Context())
			w := &contextWatcher{
				cs: cs, defaultNS: tc.namespace, gwVersions: map[string]string{"TLSRoute": tc.version, "Gateway": "v1"},
				gwFactory: gwinformers.NewSharedInformerFactory(gwfake.NewClientset(), 0),
				pending:   make(map[string]*pendingKind), gen: make(map[string]uint64),
				cancel: cancel, onChange: func(string, *KindDelta) {},
			}
			defer func() { w.stop(); w.gwFactory.Shutdown() }()
			w.reuseGatewayAccess(previous)
			if err := w.startGatewayInformers(ctx); err != nil {
				t.Fatal(err)
			}
			access := w.gwAccess
			if len(cs.Actions()) != tc.wantProbes {
				t.Fatalf("refresh probes = %d, want %d", len(cs.Actions()), tc.wantProbes)
			}
			if !reflect.DeepEqual(access.kinds, previous.gwAccess.kinds) {
				t.Fatalf("reused access changed routing: %v", access.kinds)
			}
			delete(access.kinds, "Gateway")
			if previous.gwAccess.For("Gateway").Mode != AccessDenied {
				t.Fatal("refresh mutated the previous watcher's access")
			}
		})
	}
}

type cancelingGatewayDiscovery struct {
	*gatewayDiscoveryStub
	cancel context.CancelFunc
}

func (d *cancelingGatewayDiscovery) ServerResourcesForGroupVersion(gv string) (*metav1.APIResourceList, error) {
	list, err := d.gatewayDiscoveryStub.ServerResourcesForGroupVersion(gv)
	d.cancel()
	return list, err
}

func TestGatewayDiscoveryCancellationStopsFurtherRequests(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	d := &cancelingGatewayDiscovery{
		gatewayDiscoveryStub: &gatewayDiscoveryStub{failures: map[string][]error{
			"gateway.networking.k8s.io/v1": {errors.New("discovery failed")},
		}},
		cancel: cancel,
	}
	versions, pending := discoverGatewayVersions(ctx, d)
	if len(versions) != 0 || !pending["Gateway"] || len(d.calls) != 1 || d.calls["gateway.networking.k8s.io/v1"] != 1 {
		t.Fatalf("discovery continued after cancellation: versions=%v pending=%v calls=%v", versions, pending, d.calls)
	}
}

func TestGatewayAccessErrorIsRetriedWithoutRepeatingDiscovery(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		d := &gatewayDiscoveryStub{resources: map[string][]metav1.APIResource{
			"gateway.networking.k8s.io/v1": {gatewayTestResource("Gateway", "gateways")},
		}}
		cs := fake.NewClientset()
		calls := 0
		cs.PrependReactor("create", "selfsubjectaccessreviews", func(clienttesting.Action) (bool, runtime.Object, error) {
			calls++
			if calls <= 2 {
				return true, nil, errors.New("SSAR unavailable")
			}
			return true, &authv1.SelfSubjectAccessReview{Status: authv1.SubjectAccessReviewStatus{Allowed: true}}, nil
		})
		w := newContextWatcher(nil, d, gwfake.NewClientset(), nil, "", func(string, *KindDelta) {})
		w.cs = cs
		ctx, cancel := context.WithCancel(t.Context())
		w.cancel = cancel
		defer func() { w.stop(); w.gwFactory.Shutdown() }()
		if err := w.startGatewayInformers(ctx); err != nil {
			t.Fatal(err)
		}
		if w.gatewayFactoryFor("Gateway") != nil {
			t.Fatal("started informer before access was known")
		}
		<-time.After(2 * time.Second)
		synctest.Wait()
		if w.gatewayFactoryFor("Gateway") == nil || calls != 4 || d.calls["gateway.networking.k8s.io/v1"] != 1 {
			t.Fatalf("failed access did not recover independently: probes=%d discovery=%v", calls, d.calls)
		}
	})
}
