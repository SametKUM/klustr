package kube

import (
	"reflect"
	"strings"
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"
)

func TestGatewayExistingViewsRespectObservedGeneration(t *testing.T) {
	for _, tc := range []struct {
		name     string
		observed int64
		status   metav1.ConditionStatus
		want     string
	}{
		{"current accepted", 2, metav1.ConditionTrue, "True"},
		{"current rejected", 2, metav1.ConditionFalse, "False"},
		{"stale accepted", 1, metav1.ConditionTrue, "Unknown"},
		{"stale rejected", 1, metav1.ConditionFalse, "Unknown"},
		{"unobserved", 0, metav1.ConditionTrue, "Unknown"},
		{"future generation", 3, metav1.ConditionTrue, "Unknown"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			metadata := metav1.ObjectMeta{Name: "resource", Namespace: "app", Generation: 2}
			conditions := []metav1.Condition{{Type: "Accepted", Status: tc.status, ObservedGeneration: tc.observed, Reason: "ControllerResult", Message: "controller message"}}
			programmed := append([]metav1.Condition{}, conditions...)
			programmed[0].Type = "Programmed"
			routeStatus := gatewayv1.RouteStatus{Parents: []gatewayv1.RouteParentStatus{{Conditions: conditions}}}
			for _, resource := range []struct {
				kind, plural string
				object       runtime.Object
				listStatus   func(*contextWatcher) string
				detailStatus func(*contextWatcher) ([]ConditionDetail, error)
			}{
				{
					kind: "Gateway", plural: "gateways",
					object: &gatewayv1.Gateway{ObjectMeta: metadata,
						Spec:   gatewayv1.GatewaySpec{Listeners: []gatewayv1.Listener{{Name: "web"}}},
						Status: gatewayv1.GatewayStatus{Conditions: programmed, Listeners: []gatewayv1.ListenerStatus{{Name: "web", Conditions: conditions}}}},
					listStatus: func(w *contextWatcher) string { return w.Gateways("app")[0].Programmed },
					detailStatus: func(w *contextWatcher) ([]ConditionDetail, error) {
						detail, err := w.Gateway("app", "resource")
						if err != nil {
							return nil, err
						}
						return append(detail.Conditions, detail.Listeners[0].Conditions...), nil
					},
				},
				{
					kind: "GatewayClass", plural: "gatewayclasses",
					object:     &gatewayv1.GatewayClass{ObjectMeta: metav1.ObjectMeta{Name: "resource", Generation: 2}, Status: gatewayv1.GatewayClassStatus{Conditions: conditions}},
					listStatus: func(w *contextWatcher) string { return w.GatewayClasses()[0].Accepted },
					detailStatus: func(w *contextWatcher) ([]ConditionDetail, error) {
						detail, err := w.GatewayClass("resource")
						if err != nil {
							return nil, err
						}
						return detail.Conditions, nil
					},
				},
				{
					kind: "HTTPRoute", plural: "httproutes",
					object:     &gatewayv1.HTTPRoute{ObjectMeta: metadata, Status: gatewayv1.HTTPRouteStatus{RouteStatus: routeStatus}},
					listStatus: func(w *contextWatcher) string { return w.HTTPRoutes("app")[0].Accepted },
					detailStatus: func(w *contextWatcher) ([]ConditionDetail, error) {
						detail, err := w.HTTPRoute("app", "resource")
						if err != nil {
							return nil, err
						}
						return detail.Status[0].Conditions, nil
					},
				},
				{
					kind: "GRPCRoute", plural: "grpcroutes",
					object:     &gatewayv1.GRPCRoute{ObjectMeta: metadata, Status: gatewayv1.GRPCRouteStatus{RouteStatus: routeStatus}},
					listStatus: func(w *contextWatcher) string { return w.GRPCRoutes("app")[0].Accepted },
					detailStatus: func(w *contextWatcher) ([]ConditionDetail, error) {
						detail, err := w.GRPCRoute("app", "resource")
						if err != nil {
							return nil, err
						}
						return detail.Status[0].Conditions, nil
					},
				},
			} {
				t.Run(resource.kind, func(t *testing.T) {
					before := resource.object.DeepCopyObject()
					m := newGatewayResourceManager(t, resource.kind, resource.plural, "v1", resource.object)
					w := m.watchers["ctx"]
					if got := resource.listStatus(w); got != tc.want {
						t.Fatalf("list status = %q, want %q", got, tc.want)
					}
					detail, err := resource.detailStatus(w)
					if err != nil || len(detail) == 0 {
						t.Fatalf("detail = %v, %v", detail, err)
					}
					for _, condition := range detail {
						if condition.Status != tc.want || condition.Reason != "ControllerResult" || !strings.Contains(condition.Message, "controller message") {
							t.Fatalf("detail condition = %+v", condition)
						}
						if strings.Contains(condition.Message, "Stale status") != (tc.observed != 2) {
							t.Fatalf("generation explanation = %q", condition.Message)
						}
					}
					if !reflect.DeepEqual(before, resource.object) {
						t.Fatal("condition projection mutated the informer object")
					}
				})
			}
		})
	}
}
