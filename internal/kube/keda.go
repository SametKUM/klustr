package kube

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	autoscalingv2 "k8s.io/api/autoscaling/v2"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/tools/cache"
)

// kedaScaledObjectGVR is KEDA's ScaledObject CR. Klustr keeps the generic CRD
// browse for KEDA, but additionally enriches HPA target labels with the real
// trigger type / metadata — KEDA stamps a vanilla HPA whose metrics are all
// of type `External` and named `s<N>-<trigger>-<shortkey>`, which without
// this enrichment renders as a wall of identical "external" rows.
var kedaScaledObjectGVR = schema.GroupVersionResource{
	Group:    "keda.sh",
	Version:  "v1alpha1",
	Resource: "scaledobjects",
}

const kedaScaledObjectLabel = "scaledobject.keda.sh/name"

// hpaOwnedByKEDA returns the owning ScaledObject name, or "" when the HPA is
// not managed by KEDA.
func hpaOwnedByKEDA(h *autoscalingv2.HorizontalPodAutoscaler) string {
	if h == nil {
		return ""
	}
	if v, ok := h.Labels[kedaScaledObjectLabel]; ok && v != "" {
		return v
	}
	for _, o := range h.OwnerReferences {
		if o.Kind == "ScaledObject" && strings.HasPrefix(o.APIVersion, "keda.sh/") {
			return o.Name
		}
	}
	return ""
}

// warmKEDA lazily starts the ScaledObject CR informer once the KEDA CRD shows
// up in the cluster, and wires SO change events into an HPA touch so the
// targets column re-renders with fresh trigger labels when a ScaledObject's
// triggers change.
func (w *contextWatcher) warmKEDA(ctx context.Context) {
	if w.crd == nil {
		return
	}
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		if w.crd.HasCRD(kedaScaledObjectGVR) {
			break
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
	if !canList(ctx, w.cs, kedaScaledObjectGVR, "") {
		return
	}
	if err := w.crd.EnsureCRWatch(kedaScaledObjectGVR); err != nil {
		return
	}
	_ = w.crd.AddCRHandler(kedaScaledObjectGVR, cache.ResourceEventHandlerFuncs{
		AddFunc:    func(any) { w.touch("HorizontalPodAutoscaler") },
		UpdateFunc: func(any, any) { w.touch("HorizontalPodAutoscaler") },
		DeleteFunc: func(any) { w.touch("HorizontalPodAutoscaler") },
	})
	w.touch("HorizontalPodAutoscaler")
}

// scaledObjectByName resolves a cached ScaledObject by namespace + name.
func (w *contextWatcher) scaledObjectByName(namespace, name string) (*unstructured.Unstructured, bool) {
	if w.crd == nil {
		return nil, false
	}
	return w.crd.GetCachedCustomResource(kedaScaledObjectGVR, namespace, name)
}

// enrichKEDAMetrics replaces the labels of External-type metrics in `metrics`
// with the ScaledObject trigger they map to. KEDA names HPA external metrics
// `s<N>-<trigger>-<shortkey>`, where N is the index into spec.triggers; this
// preserves the original current/target text the HPA reports so the bars
// still show real numbers.
func enrichKEDAMetrics(metrics []HPAMetricTarget, so *unstructured.Unstructured) []HPAMetricTarget {
	if so == nil || len(metrics) == 0 {
		return metrics
	}
	triggers, found, _ := unstructured.NestedSlice(so.Object, "spec", "triggers")
	if !found || len(triggers) == 0 {
		return metrics
	}
	for i, m := range metrics {
		idx, ok := parseKEDAMetricIndex(m.Name)
		if !ok || idx < 0 || idx >= len(triggers) {
			continue
		}
		trig, ok := triggers[idx].(map[string]any)
		if !ok {
			continue
		}
		text, name := kedaTriggerLabel(trig)
		metrics[i].Name = name
		metrics[i].Text = text
		metrics[i].Source = "keda"
	}
	return metrics
}

// parseKEDAMetricIndex extracts N from "s<N>-..." style metric names that
// KEDA assigns to the HPA's external metrics.
func parseKEDAMetricIndex(metricName string) (int, bool) {
	if len(metricName) < 3 || metricName[0] != 's' {
		return 0, false
	}
	dash := strings.IndexByte(metricName, '-')
	if dash < 2 {
		return 0, false
	}
	n, err := strconv.Atoi(metricName[1:dash])
	if err != nil {
		return 0, false
	}
	return n, true
}

// kedaTriggerLabel turns one ScaledObject trigger entry into (text, name).
// `name` is the row's stable short key (trigger.name if set, else trigger.type);
// `text` is the tooltip/longform label, e.g. "prometheus (metricName=rate_in)".
func kedaTriggerLabel(trigger map[string]any) (text, name string) {
	typ, _ := trigger["type"].(string)
	if typ == "" {
		typ = "trigger"
	}
	name = typ
	if n, _ := trigger["name"].(string); n != "" {
		name = n
	}
	meta, _ := trigger["metadata"].(map[string]any)
	if detail := kedaTriggerMetaSummary(typ, meta); detail != "" {
		return fmt.Sprintf("%s (%s)", typ, detail), name
	}
	return typ, name
}

// kedaTriggerMetaSummary returns a space-separated `key=value` listing of the
// most useful trigger metadata fields per well-known KEDA trigger type. The
// goal is to surface enough that a reader can predict how many replicas the
// trigger will demand once it activates — for cron that means start + end +
// desiredReplicas, for prometheus the metric name + threshold +
// activationThreshold, and so on.
func kedaTriggerMetaSummary(triggerType string, meta map[string]any) string {
	if len(meta) == 0 {
		return ""
	}
	take := func(k string) string {
		raw, ok := meta[k]
		if !ok {
			return ""
		}
		var v string
		switch s := raw.(type) {
		case string:
			v = s
		case int64:
			v = strconv.FormatInt(s, 10)
		case float64:
			v = strconv.FormatFloat(s, 'g', -1, 64)
		case bool:
			v = strconv.FormatBool(s)
		}
		if v == "" {
			return ""
		}
		return k + "=" + v
	}
	join := func(parts ...string) string {
		out := parts[:0]
		for _, p := range parts {
			if p != "" {
				out = append(out, p)
			}
		}
		return strings.Join(out, " ")
	}
	switch triggerType {
	case "prometheus":
		return join(take("metricName"), take("threshold"), take("activationThreshold"))
	case "cron":
		return join(take("start"), take("end"), take("desiredReplicas"), take("timezone"))
	case "kafka":
		return join(take("topic"), take("consumerGroup"), take("lagThreshold"), take("activationLagThreshold"))
	case "rabbitmq":
		return join(take("queueName"), take("value"), take("activationValue"), take("mode"))
	case "aws-sqs-queue":
		return join(take("queueURL"), take("queueLength"), take("activationQueueLength"))
	case "redis", "redis-streams", "redis-cluster", "redis-sentinel":
		return join(take("listName"), take("stream"), take("consumerGroup"), take("listLength"), take("activationListLength"))
	case "cpu", "memory":
		return join(take("type"), take("value"))
	case "external", "external-push":
		return join(take("scalerAddress"), take("scalerName"))
	case "azure-servicebus":
		return join(take("queueName"), take("topicName"), take("subscriptionName"), take("messageCount"), take("activationMessageCount"))
	case "gcp-pubsub":
		return join(take("subscriptionName"), take("topicName"), take("value"), take("activationValue"))
	case "datadog":
		return join(take("query"), take("queryValue"), take("activationQueryValue"))
	}
	return join(take("threshold"), take("activationThreshold"), take("value"), take("queryValue"))
}
