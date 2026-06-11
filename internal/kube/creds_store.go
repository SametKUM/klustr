package kube

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func credsStorePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "klustr", "credential-mappings.json"), nil
}

func loadCredentialMappings(path string) (map[string]CredentialMapping, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return map[string]CredentialMapping{}, nil
		}
		return nil, err
	}
	mappings := map[string]CredentialMapping{}
	if err := json.Unmarshal(data, &mappings); err != nil {
		return nil, err
	}
	return mappings, nil
}

func saveCredentialMappings(path string, mappings map[string]CredentialMapping) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(mappings, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
