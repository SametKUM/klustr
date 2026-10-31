package kube

import (
	"reflect"
	"testing"
)

func TestSummarizeWorkloads(t *testing.T) {
	got := summarizeWorkloads(workloadLists{
		pods: []PodInfo{
			{Status: "Running", Ready: "2/2"},
			{Status: "Running", Ready: "1/2"},
			{Status: "Running", Ready: "0/0"},
			{Status: "Completed", Ready: "0/1"},
			{Status: "Succeeded", Ready: "0/1"},
			{Status: "CrashLoopBackOff", Ready: "0/1"},
			{Status: "Pending", Ready: ""},
		},
		deployments: []DeploymentInfo{
			{Ready: "3/3"},
			{Ready: "1/3"},
			{Ready: "0/0"},
			{Ready: "garbage"},
		},
		statefulSets: []StatefulSetInfo{
			{Ready: "1/1"},
			{Ready: "0/0"},
		},
		daemonSets: []DaemonSetInfo{
			{Desired: 3, Ready: 3},
			{Desired: 3, Ready: 2},
			{Desired: 0, Ready: 0},
		},
		replicaSets: []ReplicaSetInfo{
			{Desired: 2, Ready: 2},
			{Desired: 0, Ready: 0},
			{Desired: 0, Ready: 0},
		},
		replicationControllers: []ReplicationControllerInfo{
			{Desired: 1, Ready: 0},
		},
		jobs: []JobInfo{
			{Status: "Complete"},
			{Status: "Running"},
			{Status: "Failed"},
		},
		cronJobs: []CronJobInfo{
			{Suspend: false},
			{Suspend: true},
		},
	})
	want := []WorkloadHealth{
		{Kind: "Pod", Total: 7, Healthy: 3},
		{Kind: "Deployment", Total: 3, Healthy: 1},
		{Kind: "StatefulSet", Total: 1, Healthy: 1},
		{Kind: "DaemonSet", Total: 2, Healthy: 1},
		{Kind: "ReplicaSet", Total: 1, Healthy: 1},
		{Kind: "ReplicationController", Total: 1, Healthy: 0},
		{Kind: "Job", Total: 3, Healthy: 2},
		{Kind: "CronJob", Total: 2, Healthy: 1, Neutral: 1},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("summarizeWorkloads:\n got %+v\nwant %+v", got, want)
	}
}

func TestWorkloadsOverviewWithoutWatcherReportsEveryKindEmpty(t *testing.T) {
	m := &ClientManager{watchers: map[string]*contextWatcher{}}
	got := m.WorkloadsOverview("missing", "")
	kinds := make([]string, 0, len(got))
	for _, h := range got {
		if h.Total != 0 || h.Healthy != 0 || h.Neutral != 0 {
			t.Fatalf("%s without a watcher = %+v, want zeros", h.Kind, h)
		}
		kinds = append(kinds, h.Kind)
	}
	want := []string{"Pod", "Deployment", "StatefulSet", "DaemonSet", "ReplicaSet", "ReplicationController", "Job", "CronJob"}
	if !reflect.DeepEqual(kinds, want) {
		t.Fatalf("kinds = %v, want %v", kinds, want)
	}
}
