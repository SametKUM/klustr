package kube

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const karpenterAWSGroup = "karpenter.k8s.aws"
const karpenterEC2NodeClassResource = "ec2nodeclasses"

var karpenterEC2NodeClassGR = schema.GroupResource{Group: karpenterAWSGroup, Resource: karpenterEC2NodeClassResource}

type KarpenterEC2NodeClassInfo struct {
	Name               string `json:"name"`
	AMIFamily          string `json:"amiFamily"`
	Role               string `json:"role"`
	InstanceProfile    string `json:"instanceProfile"`
	SubnetCount        int    `json:"subnetCount"`
	SecurityGroupCount int    `json:"securityGroupCount"`
	AMICount           int    `json:"amiCount"`
	Ready              string `json:"ready"`
	Status             string `json:"status"`
	CreatedAt          string `json:"createdAt"`
}

type KarpenterResolvedResource struct {
	ID           string                         `json:"id"`
	Name         string                         `json:"name"`
	Zone         string                         `json:"zone"`
	Requirements []KarpenterResolvedRequirement `json:"requirements"`
}

type KarpenterResolvedRequirement struct {
	Key      string   `json:"key"`
	Operator string   `json:"operator"`
	Values   []string `json:"values"`
}

type KarpenterEC2NodeClassDetail struct {
	KarpenterEC2NodeClassInfo
	Conditions              []ConditionDetail           `json:"conditions"`
	Subnets                 []KarpenterResolvedResource `json:"subnets"`
	SecurityGroups          []KarpenterResolvedResource `json:"securityGroups"`
	AMIs                    []KarpenterResolvedResource `json:"amis"`
	SubnetSelectors         []string                    `json:"subnetSelectors"`
	SecurityGroupSelectors  []string                    `json:"securityGroupSelectors"`
	AMISelectors            []string                    `json:"amiSelectors"`
	ResolvedInstanceProfile string                      `json:"resolvedInstanceProfile"`
}

func (m *ClientManager) ListKarpenterEC2NodeClasses(contextName string) []KarpenterEC2NodeClassInfo {
	return listServedRows(m, contextName, karpenterEC2NodeClassGR, "", extractKarpenterEC2NodeClass,
		func(r KarpenterEC2NodeClassInfo) (string, string) { return "", r.Name })
}

func (m *ClientManager) GetKarpenterEC2NodeClass(ctx context.Context, contextName, name string) (*KarpenterEC2NodeClassDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, karpenterEC2NodeClassGR, "", name)
	if err != nil {
		return nil, err
	}
	profile, _, _ := unstructured.NestedString(obj.Object, "status", "instanceProfile")
	return &KarpenterEC2NodeClassDetail{
		KarpenterEC2NodeClassInfo: extractKarpenterEC2NodeClass(obj),
		Conditions:                crConditions(obj),
		Subnets:                   extractKarpenterResolvedResources(obj, "subnets"),
		SecurityGroups:            extractKarpenterResolvedResources(obj, "securityGroups"),
		AMIs:                      extractKarpenterResolvedResources(obj, "amis"),
		SubnetSelectors:           extractKarpenterSelectors(obj, "subnetSelectorTerms"),
		SecurityGroupSelectors:    extractKarpenterSelectors(obj, "securityGroupSelectorTerms"),
		AMISelectors:              extractKarpenterSelectors(obj, "amiSelectorTerms"),
		ResolvedInstanceProfile:   profile,
	}, nil
}

func extractKarpenterEC2NodeClass(obj *unstructured.Unstructured) KarpenterEC2NodeClassInfo {
	family := karpenterAMIFamily(obj)
	role, _, _ := unstructured.NestedString(obj.Object, "spec", "role")
	profile, _, _ := unstructured.NestedString(obj.Object, "spec", "instanceProfile")
	ready, message := readyCondition(crConditions(obj))
	// An AMI can appear once per requirement set, so row count overstates image count.
	amiIDs := map[string]struct{}{}
	for _, ami := range extractKarpenterResolvedResources(obj, "amis") {
		amiIDs[ami.ID] = struct{}{}
	}
	return KarpenterEC2NodeClassInfo{
		Name: obj.GetName(), AMIFamily: family, Role: role, InstanceProfile: profile,
		SubnetCount:        len(extractKarpenterResolvedResources(obj, "subnets")),
		SecurityGroupCount: len(extractKarpenterResolvedResources(obj, "securityGroups")),
		AMICount:           len(amiIDs),
		Ready:              ready, Status: message, CreatedAt: crCreatedAt(obj),
	}
}

func karpenterAMIFamily(obj *unstructured.Unstructured) string {
	if family, _, _ := unstructured.NestedString(obj.Object, "spec", "amiFamily"); family != "" {
		return family
	}
	terms, _, _ := nestedSliceNoCopy(obj.Object, "spec", "amiSelectorTerms")
	for _, raw := range terms {
		term, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		alias, _ := term["alias"].(string)
		family, _, found := strings.Cut(alias, "@")
		if !found {
			continue
		}
		switch family {
		case "al2":
			return "AL2"
		case "al2023":
			return "AL2023"
		case "bottlerocket":
			return "Bottlerocket"
		case "windows2019":
			return "Windows2019"
		case "windows2022":
			return "Windows2022"
		case "windows2025":
			return "Windows2025"
		}
	}
	return ""
}

func extractKarpenterResolvedResources(obj *unstructured.Unstructured, field string) []KarpenterResolvedResource {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "status", field)
	out := []KarpenterResolvedResource{}
	for _, item := range raw {
		value, ok := item.(map[string]any)
		if !ok {
			continue
		}
		id, _ := value["id"].(string)
		if id == "" {
			continue
		}
		name, _ := value["name"].(string)
		zone, _ := value["zone"].(string)
		requirements := []KarpenterResolvedRequirement{}
		rawRequirements, _, _ := nestedSliceNoCopy(value, "requirements")
		for _, rawRequirement := range rawRequirements {
			requirement, ok := rawRequirement.(map[string]any)
			if !ok {
				continue
			}
			key, _, _ := unstructured.NestedString(requirement, "key")
			if key == "" {
				continue
			}
			operator, _, _ := unstructured.NestedString(requirement, "operator")
			values, _, _ := unstructured.NestedStringSlice(requirement, "values")
			requirements = append(requirements, KarpenterResolvedRequirement{Key: key, Operator: operator, Values: append([]string{}, values...)})
		}
		out = append(out, KarpenterResolvedResource{ID: id, Name: name, Zone: zone, Requirements: requirements})
	}
	return out
}

func extractKarpenterSelectors(obj *unstructured.Unstructured, field string) []string {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", field)
	out := []string{}
	for _, item := range raw {
		term, ok := item.(map[string]any)
		if !ok {
			continue
		}
		parts := []string{}
		for key, value := range term {
			if key == "tags" {
				if tags, ok := value.(map[string]any); ok {
					for tag, match := range tags {
						parts = append(parts, fmt.Sprintf("tag:%s=%v", tag, match))
					}
				}
			} else if text, ok := value.(string); ok {
				parts = append(parts, key+"="+text)
			}
		}
		sort.Strings(parts)
		if len(parts) > 0 {
			out = append(out, strings.Join(parts, ", "))
		}
	}
	return out
}
