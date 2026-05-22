package kube

import "fmt"

func (m *ClientManager) Deployments(contextName, namespace string) []DeploymentInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []DeploymentInfo{}
	}
	return w.Deployments(namespace)
}

func (m *ClientManager) Deployment(contextName, namespace, name string) (*DeploymentDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Deployment(namespace, name)
}

func (m *ClientManager) StatefulSets(contextName, namespace string) []StatefulSetInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []StatefulSetInfo{}
	}
	return w.StatefulSets(namespace)
}

func (m *ClientManager) StatefulSet(contextName, namespace, name string) (*StatefulSetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.StatefulSet(namespace, name)
}

func (m *ClientManager) DaemonSets(contextName, namespace string) []DaemonSetInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []DaemonSetInfo{}
	}
	return w.DaemonSets(namespace)
}

func (m *ClientManager) DaemonSet(contextName, namespace, name string) (*DaemonSetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.DaemonSet(namespace, name)
}

func (m *ClientManager) ReplicaSets(contextName, namespace string) []ReplicaSetInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ReplicaSetInfo{}
	}
	return w.ReplicaSets(namespace)
}

func (m *ClientManager) ReplicaSet(contextName, namespace, name string) (*ReplicaSetDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ReplicaSet(namespace, name)
}

func (m *ClientManager) ReplicationControllers(contextName, namespace string) []ReplicationControllerInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []ReplicationControllerInfo{}
	}
	return w.ReplicationControllers(namespace)
}

func (m *ClientManager) ReplicationController(contextName, namespace, name string) (*ReplicationControllerDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.ReplicationController(namespace, name)
}

func (m *ClientManager) Jobs(contextName, namespace string) []JobInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []JobInfo{}
	}
	return w.Jobs(namespace)
}

func (m *ClientManager) Job(contextName, namespace, name string) (*JobDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.Job(namespace, name)
}

func (m *ClientManager) CronJobs(contextName, namespace string) []CronJobInfo {
	w, ok := m.watcher(contextName)
	if !ok {
		return []CronJobInfo{}
	}
	return w.CronJobs(namespace)
}

func (m *ClientManager) CronJob(contextName, namespace, name string) (*CronJobDetail, error) {
	w, ok := m.watcher(contextName)
	if !ok {
		return nil, fmt.Errorf("no active watch for context %q", contextName)
	}
	return w.CronJob(namespace, name)
}
