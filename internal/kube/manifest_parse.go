package kube

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
	"slices"
	"strings"

	yamlv3 "go.yaml.in/yaml/v3"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"
)

const (
	maxManifestBytes = 2 << 20
	maxManifestItems = 200
	maxManifestDepth = 100
)

type manifestDocument struct {
	object   *unstructured.Unstructured
	document int
	line     int
}

// Parser diagnostics must never echo a scalar: manifests can contain credentials.
var yamlLinePattern = regexp.MustCompile(`line (\d+)`)

func parseManifest(source string) ([]manifestDocument, error) {
	if len(source) > maxManifestBytes {
		return nil, fmt.Errorf("manifest exceeds the 2 MiB limit")
	}
	decoder := yamlv3.NewDecoder(strings.NewReader(source))
	items := []manifestDocument{}
	for document := 1; ; document++ {
		var node yamlv3.Node
		if err := decoder.Decode(&node); err == io.EOF {
			break
		} else if err != nil {
			location := yamlLinePattern.FindString(err.Error())
			return nil, fmt.Errorf("document %d: invalid YAML %s", document, location)
		}
		if len(node.Content) == 0 {
			continue
		}
		root := node.Content[0]
		if root.Tag == "!!null" {
			continue
		}
		if err := validateManifestNode(root, 0, make(map[*yamlv3.Node]bool), new(int)); err != nil {
			return nil, fmt.Errorf("document %d: %w", document, err)
		}
		if root.Kind != yamlv3.MappingNode {
			return nil, fmt.Errorf("document %d, line %d: expected a Kubernetes object", document, root.Line)
		}
		var encoded bytes.Buffer
		encoder := yamlv3.NewEncoder(&encoded)
		if err := encoder.Encode(root); err != nil {
			return nil, fmt.Errorf("document %d: cannot encode YAML", document)
		}
		_ = encoder.Close()
		data, err := yaml.YAMLToJSONStrict(encoded.Bytes())
		if err != nil {
			return nil, fmt.Errorf("document %d, line %d: invalid YAML keys or values", document, root.Line)
		}
		var object map[string]any
		if err := json.Unmarshal(data, &object); err != nil {
			return nil, fmt.Errorf("document %d: invalid object", document)
		}
		if err := appendManifestObject(&items, object, document, root.Line, 0); err != nil {
			return nil, err
		}
	}
	if len(items) == 0 {
		return nil, fmt.Errorf("manifest contains no resources")
	}
	return items, nil
}

func validateManifestNode(node *yamlv3.Node, depth int, path map[*yamlv3.Node]bool, aliases *int) error {
	if depth > maxManifestDepth || path[node] {
		return fmt.Errorf("line %d: YAML nesting or alias cycle exceeds the limit", node.Line)
	}
	path[node] = true
	defer delete(path, node)
	if node.Kind == yamlv3.AliasNode {
		*aliases += 1
		if *aliases > 100 {
			return fmt.Errorf("line %d: too many YAML aliases", node.Line)
		}
		return validateManifestNode(node.Alias, depth+1, path, aliases)
	}
	if node.Kind == yamlv3.MappingNode {
		keys := make(map[string]bool)
		for i := 0; i < len(node.Content); i += 2 {
			key := node.Content[i]
			canonical, err := manifestKeyString(key)
			if err != nil {
				return fmt.Errorf("line %d: object keys must be strings, numbers or booleans", key.Line)
			}
			if keys[canonical] {
				return fmt.Errorf("line %d, column %d: duplicate object key", key.Line, key.Column)
			}
			keys[canonical] = true
		}
	}
	if node.Tag != "" && !strings.HasPrefix(node.Tag, "!!") {
		return fmt.Errorf("line %d: custom YAML tags are not supported", node.Line)
	}
	for _, child := range node.Content {
		if err := validateManifestNode(child, depth+1, path, aliases); err != nil {
			return err
		}
	}
	return nil
}

func manifestKeyString(key *yamlv3.Node) (string, error) {
	if key.Kind != yamlv3.ScalarNode {
		return "", fmt.Errorf("non-scalar key")
	}
	switch key.Tag {
	case "!!merge":
		return key.Value, nil
	case "!!str":
		// YAML 1.1 also resolves plain yes/no/on/off keys as booleans.
		if key.Style != 0 || !slices.Contains([]string{"y", "n", "yes", "no", "on", "off"}, strings.ToLower(key.Value)) {
			return key.Value, nil
		}
	case "!!int", "!!float", "!!bool":
	default:
		return "", fmt.Errorf("unsupported key")
	}
	encoded, err := yamlv3.Marshal(&yamlv3.Node{Kind: yamlv3.MappingNode, Content: []*yamlv3.Node{key, {Kind: yamlv3.ScalarNode, Tag: "!!null", Value: "null"}}})
	if err != nil {
		return "", err
	}
	data, err := yaml.YAMLToJSONStrict(encoded)
	if err != nil {
		return "", err
	}
	var object map[string]any
	if err := json.Unmarshal(data, &object); err != nil {
		return "", err
	}
	for name := range object {
		return name, nil
	}
	return "", fmt.Errorf("invalid key")
}

func appendManifestObject(items *[]manifestDocument, object map[string]any, document, line, depth int) error {
	if depth > maxManifestDepth {
		return fmt.Errorf("document %d: List nesting exceeds the limit", document)
	}
	obj := &unstructured.Unstructured{Object: object}
	if obj.GetAPIVersion() == "v1" && obj.GetKind() == "List" {
		list, ok := object["items"].([]any)
		if !ok {
			return fmt.Errorf("document %d: List.items must be an array", document)
		}
		for _, raw := range list {
			item, ok := raw.(map[string]any)
			if !ok {
				return fmt.Errorf("document %d: List.items must contain objects", document)
			}
			if err := appendManifestObject(items, item, document, line, depth+1); err != nil {
				return err
			}
		}
		return nil
	}
	if obj.GetAPIVersion() == "" || obj.GetKind() == "" {
		return fmt.Errorf("document %d, line %d: apiVersion and kind are required", document, line)
	}
	if obj.GetName() == "" && obj.GetGenerateName() == "" {
		return fmt.Errorf("document %d, line %d: metadata.name or metadata.generateName is required", document, line)
	}
	if len(*items) >= maxManifestItems {
		return fmt.Errorf("manifest exceeds the %d resource limit", maxManifestItems)
	}
	*items = append(*items, manifestDocument{object: obj, document: document, line: line})
	return nil
}
