package kube

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/discovery"
)

var manifestAPIVersionPattern = regexp.MustCompile(`^(?:[a-z0-9][a-z0-9.-]*/)?[a-zA-Z][a-zA-Z0-9]*$`)

type ManifestKind struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Resource   string `json:"resource"`
	Namespaced bool   `json:"namespaced"`
}

type ManifestCatalog struct {
	Resources        []ManifestKind `json:"resources"`
	DefaultNamespace string         `json:"defaultNamespace"`
	Warnings         []string       `json:"warnings"`
}

func (m *ClientManager) manifestDiscovery(contextName string) (discovery.DiscoveryInterface, error) {
	if w, ok := m.watcher(contextName); ok && w.disco != nil {
		return w.disco, nil
	}
	cfg, err := m.restConfig(contextName)
	if err != nil {
		return nil, err
	}
	cfg.Timeout = discoveryTimeout
	return discovery.NewDiscoveryClientForConfig(cfg)
}

func discoverManifestKinds(d discovery.DiscoveryInterface) ([]ManifestKind, []string, error) {
	groups, lists, err := d.ServerGroupsAndResources()
	warnings := []string{}
	if len(lists) == 0 && err != nil {
		return nil, warnings, fmt.Errorf("API discovery failed; check the connection and discovery permissions")
	}
	if err != nil {
		warnings = append(warnings, "Some API groups could not be discovered. Other resource types remain available.")
	}
	kinds := []ManifestKind{}
	seen := make(map[schema.GroupVersionResource]bool)
	preferred := map[string]bool{"v1": true}
	for _, group := range groups {
		preferred[group.PreferredVersion.GroupVersion] = true
	}
	for _, list := range lists {
		gv, err := schema.ParseGroupVersion(list.GroupVersion)
		if err != nil {
			continue
		}
		for _, resource := range list.APIResources {
			if resource.Kind == "" || strings.Contains(resource.Name, "/") || !slices.Contains(resource.Verbs, "create") {
				continue
			}
			gvr := gv.WithResource(resource.Name)
			if seen[gvr] {
				continue
			}
			seen[gvr] = true
			kinds = append(kinds, ManifestKind{APIVersion: list.GroupVersion, Kind: resource.Kind, Resource: resource.Name, Namespaced: resource.Namespaced})
		}
	}
	slices.SortFunc(kinds, func(a, b ManifestKind) int {
		if a.Kind == b.Kind && preferred[a.APIVersion] != preferred[b.APIVersion] {
			if preferred[a.APIVersion] {
				return -1
			}
			return 1
		}
		return strings.Compare(a.Kind+"/"+a.APIVersion, b.Kind+"/"+b.APIVersion)
	})
	return kinds, warnings, nil
}

func (m *ClientManager) ManifestCatalog(contextName string) (*ManifestCatalog, error) {
	d, err := m.manifestDiscovery(contextName)
	if err != nil {
		return nil, err
	}
	kinds, warnings, err := discoverManifestKinds(d)
	if err != nil {
		return nil, err
	}
	ns := m.contextDefaultNamespace(contextName)
	if ns == "" {
		ns = "default"
	}
	return &ManifestCatalog{Resources: kinds, DefaultNamespace: ns, Warnings: warnings}, nil
}

// Only apiserver-relative OpenAPI endpoints are fetched. Schema references never
// cause requests to arbitrary URLs embedded in user manifests or CRD schemas.
func (m *ClientManager) ManifestSchema(ctx context.Context, contextName, apiVersion string) (string, error) {
	if !manifestAPIVersionPattern.MatchString(apiVersion) {
		return "", fmt.Errorf("invalid apiVersion")
	}
	gv, err := schema.ParseGroupVersion(apiVersion)
	if err != nil || gv.Version == "" {
		return "", fmt.Errorf("invalid apiVersion")
	}
	d, err := m.manifestDiscovery(contextName)
	if err != nil {
		return "", err
	}
	path := "apis/" + gv.Group + "/" + gv.Version
	if gv.Group == "" {
		path = "api/" + gv.Version
	}
	if paths, err := d.OpenAPIV3().Paths(); err == nil {
		if group, ok := paths[path]; ok {
			if data, err := group.Schema("application/json"); err == nil {
				return string(data), nil
			}
		} else {
			return "", fmt.Errorf("schema unavailable for %s; this API version is not served", apiVersion)
		}
	}
	if _, err := d.ServerResourcesForGroupVersion(apiVersion); err != nil {
		return "", fmt.Errorf("schema unavailable for %s; check discovery permissions and the served API version", apiVersion)
	}
	client := d.RESTClient()
	if client != nil {
		return m.manifestSchemas.load(ctx, contextName, func() (string, error) {
			data, err := client.Get().AbsPath("/openapi/v2").Do(ctx).Raw()
			if err != nil {
				return "", fmt.Errorf("schema unavailable for %s; server-side validation is still available", apiVersion)
			}
			return string(data), nil
		})
	}
	return "", fmt.Errorf("schema unavailable for %s; server-side validation is still available", apiVersion)
}
