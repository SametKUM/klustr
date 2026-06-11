package kube

import (
	"path/filepath"
	"sort"
	"strings"

	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
)

type ContextInfo struct {
	Name      string `json:"name"`
	Cluster   string `json:"cluster"`
	Server    string `json:"server"`
	User      string `json:"user"`
	Namespace string `json:"namespace"`
	// Exec credential hints drive the credential-helper UI: which contexts
	// authenticate through `aws eks get-token` (candidates for an aws-vault
	// mapping), which already wrap a helper themselves, and the profile the
	// exec block names so the mapping dialog can preselect it.
	ExecCommand    string `json:"execCommand"`
	AWSExec        bool   `json:"awsExec"`
	AWSVaultExec   bool   `json:"awsVaultExec"`
	AWSProfileHint string `json:"awsProfileHint"`
}

type Kubeconfig struct {
	Contexts       []ContextInfo `json:"contexts"`
	CurrentContext string        `json:"currentContext"`
}

func loadRawConfig(rules *clientcmd.ClientConfigLoadingRules) (*Kubeconfig, error) {
	raw, err := rules.Load()
	if err != nil {
		return nil, err
	}

	contexts := make([]ContextInfo, 0, len(raw.Contexts))
	for name, c := range raw.Contexts {
		var server string
		if cl, ok := raw.Clusters[c.Cluster]; ok {
			server = cl.Server
		}
		info := ContextInfo{
			Name:      name,
			Cluster:   c.Cluster,
			Server:    server,
			User:      c.AuthInfo,
			Namespace: c.Namespace,
		}
		if auth, ok := raw.AuthInfos[c.AuthInfo]; ok && auth != nil {
			applyExecHints(&info, auth.Exec)
		}
		contexts = append(contexts, info)
	}
	sort.Slice(contexts, func(i, j int) bool { return contexts[i].Name < contexts[j].Name })

	return &Kubeconfig{
		Contexts:       contexts,
		CurrentContext: raw.CurrentContext,
	}, nil
}

func applyExecHints(info *ContextInfo, exec *clientcmdapi.ExecConfig) {
	if exec == nil || exec.Command == "" {
		return
	}
	info.ExecCommand = exec.Command
	base := filepath.Base(exec.Command)
	switch base {
	case "aws":
		info.AWSExec = hasArgPair(exec.Args, "eks", "get-token") || hasArg(exec.Args, "get-token")
	case "aws-vault":
		info.AWSVaultExec = true
	}
	info.AWSProfileHint = awsProfileHint(exec)
}

func hasArg(args []string, want string) bool {
	for _, a := range args {
		if a == want {
			return true
		}
	}
	return false
}

func hasArgPair(args []string, first, second string) bool {
	for i := 0; i+1 < len(args); i++ {
		if args[i] == first && args[i+1] == second {
			return true
		}
	}
	return false
}

func awsProfileHint(exec *clientcmdapi.ExecConfig) string {
	for i, a := range exec.Args {
		if a == "--profile" && i+1 < len(exec.Args) {
			return exec.Args[i+1]
		}
		if p, ok := strings.CutPrefix(a, "--profile="); ok {
			return p
		}
	}
	for _, e := range exec.Env {
		if e.Name == "AWS_PROFILE" {
			return e.Value
		}
	}
	return ""
}
