package kube

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func nodeWithLabels(labels map[string]string) *corev1.Node {
	return &corev1.Node{ObjectMeta: metav1.ObjectMeta{Labels: labels}}
}

func TestNodeCapacityType(t *testing.T) {
	cases := []struct {
		name   string
		labels map[string]string
		want   string
	}{
		{"karpenter spot", map[string]string{"karpenter.sh/capacity-type": "spot"}, "spot"},
		{"karpenter uppercase", map[string]string{"karpenter.sh/capacity-type": "ON-DEMAND"}, "on-demand"},
		{"eks spot", map[string]string{"eks.amazonaws.com/capacityType": "SPOT"}, "spot"},
		{"eks on demand", map[string]string{"eks.amazonaws.com/capacityType": "ON_DEMAND"}, "on-demand"},
		{"gke spot", map[string]string{"cloud.google.com/gke-spot": "true"}, "spot"},
		{"aks spot", map[string]string{"kubernetes.azure.com/scalesetpriority": "spot"}, "spot"},
		{"aks regular", map[string]string{"kubernetes.azure.com/scalesetpriority": "regular"}, "on-demand"},
		{"karpenter wins over eks", map[string]string{"karpenter.sh/capacity-type": "spot", "eks.amazonaws.com/capacityType": "ON_DEMAND"}, "spot"},
		{"none", map[string]string{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nodeCapacityType(nodeWithLabels(tc.labels)); got != tc.want {
				t.Errorf("nodeCapacityType = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNodeNodePool(t *testing.T) {
	cases := []struct {
		name   string
		labels map[string]string
		want   string
	}{
		{"karpenter nodepool", map[string]string{"karpenter.sh/nodepool": "default"}, "default"},
		{"karpenter provisioner fallback", map[string]string{"karpenter.sh/provisioner-name": "legacy"}, "legacy"},
		{"eks nodegroup", map[string]string{"eks.amazonaws.com/nodegroup": "ng-1"}, "ng-1"},
		{"gke nodepool", map[string]string{"cloud.google.com/gke-nodepool": "pool-1"}, "pool-1"},
		{"aks agentpool", map[string]string{"kubernetes.azure.com/agentpool": "agentpool"}, "agentpool"},
		{"precedence nodepool over provisioner", map[string]string{"karpenter.sh/nodepool": "new", "karpenter.sh/provisioner-name": "old"}, "new"},
		{"none", map[string]string{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nodeNodePool(nodeWithLabels(tc.labels)); got != tc.want {
				t.Errorf("nodeNodePool = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestNodeInstanceType(t *testing.T) {
	cases := []struct {
		name   string
		labels map[string]string
		want   string
	}{
		{"stable label", map[string]string{"node.kubernetes.io/instance-type": "m5.large"}, "m5.large"},
		{"beta fallback", map[string]string{"beta.kubernetes.io/instance-type": "t3.medium"}, "t3.medium"},
		{"stable wins over beta", map[string]string{"node.kubernetes.io/instance-type": "m5.large", "beta.kubernetes.io/instance-type": "t3.medium"}, "m5.large"},
		{"none", map[string]string{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := nodeInstanceType(nodeWithLabels(tc.labels)); got != tc.want {
				t.Errorf("nodeInstanceType = %q, want %q", got, tc.want)
			}
		})
	}
}
