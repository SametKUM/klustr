package kube

import (
	"context"
	"time"

	"github.com/aptible/supercronic/cronexpr"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// The rest of Kyverno's CEL policy family: mutating, generating, deleting
// and image-validating, each with a namespaced variant that acts only within
// its own namespace. They share the admission-style match constraints, match
// conditions and variables of ValidatingPolicy (kyverno_cel.go).
const (
	kyvernoMutatingPoliciesResource                  = "mutatingpolicies"
	kyvernoNamespacedMutatingPoliciesResource        = "namespacedmutatingpolicies"
	kyvernoGeneratingPoliciesResource                = "generatingpolicies"
	kyvernoNamespacedGeneratingPoliciesResource      = "namespacedgeneratingpolicies"
	kyvernoDeletingPoliciesResource                  = "deletingpolicies"
	kyvernoNamespacedDeletingPoliciesResource        = "namespaceddeletingpolicies"
	kyvernoImageValidatingPoliciesResource           = "imagevalidatingpolicies"
	kyvernoNamespacedImageValidatingPoliciesResource = "namespacedimagevalidatingpolicies"
)

// KyvernoCELPolicyBase is the part of a CEL policy row every kind shares.
type KyvernoCELPolicyBase struct {
	Name      string   `json:"name"`
	Namespace string   `json:"namespace"`
	Resources []string `json:"resources"`
	Ready     string   `json:"ready"`
	CreatedAt string   `json:"createdAt"`
}

// KyvernoCELPolicyDetailBase is the part of a CEL policy detail every kind
// shares.
type KyvernoCELPolicyDetailBase struct {
	ReportKey         string                 `json:"reportKey"`
	FailurePolicy     string                 `json:"failurePolicy"`
	Mode              string                 `json:"mode"`
	NamespaceSelector string                 `json:"namespaceSelector"`
	ObjectSelector    string                 `json:"objectSelector"`
	MatchConditions   []KyvernoCELExpression `json:"matchConditions"`
	Variables         []KyvernoCELExpression `json:"variables"`
	Conditions        []ConditionDetail      `json:"conditions"`
}

func kyvernoCELBase(obj *unstructured.Unstructured) KyvernoCELPolicyBase {
	ready := ""
	if r, found, _ := unstructured.NestedBool(obj.Object, "status", "conditionStatus", "ready"); found {
		ready = "False"
		if r {
			ready = "True"
		}
	}
	return KyvernoCELPolicyBase{
		Name: obj.GetName(), Namespace: obj.GetNamespace(),
		Resources: summarizeResourceRules(nestedField(obj.Object, "spec", "matchConstraints", "resourceRules")),
		Ready:     ready, CreatedAt: crCreatedAt(obj),
	}
}

func kyvernoCELDetailBase(obj *unstructured.Unstructured) KyvernoCELPolicyDetailBase {
	failurePolicy, _, _ := unstructured.NestedString(obj.Object, "spec", "failurePolicy")
	mode, _, _ := unstructured.NestedString(obj.Object, "spec", "evaluation", "mode")
	reportKey := obj.GetName()
	if obj.GetNamespace() != "" {
		reportKey = obj.GetNamespace() + "/" + obj.GetName()
	}
	return KyvernoCELPolicyDetailBase{
		ReportKey:         reportKey,
		FailurePolicy:     failurePolicy,
		Mode:              mode,
		NamespaceSelector: summarizeLabelSelector(nestedField(obj.Object, "spec", "matchConstraints", "namespaceSelector")),
		ObjectSelector:    summarizeLabelSelector(nestedField(obj.Object, "spec", "matchConstraints", "objectSelector")),
		MatchConditions:   extractCELExpressions(obj, "name", "expression", "spec", "matchConditions"),
		Variables:         extractCELExpressions(obj, "name", "expression", "spec", "variables"),
		Conditions:        conditionsAt(obj, "status", "conditionStatus", "conditions"),
	}
}

// nestedBoolOrFalse reads an opt-in flag: absent means off.
func nestedBoolOrFalse(obj map[string]any, fields ...string) bool {
	v, _, _ := unstructured.NestedBool(obj, fields...)
	return v
}

func (m *ClientManager) getKyvernoCEL(ctx context.Context, contextName, resource, namespace, name string) (*unstructured.Unstructured, error) {
	return m.getServedCR(ctx, contextName, kyvernoCELGR(resource), namespace, name)
}

// ---------------------------------------------------------------------------
// MutatingPolicy
// ---------------------------------------------------------------------------

type KyvernoMutatingPolicyInfo struct {
	KyvernoCELPolicyBase
	Mutations  int      `json:"mutations"`
	PatchTypes []string `json:"patchTypes"`
	Admission  bool     `json:"admission"`
	// MutateExisting reports that the policy also patches existing objects
	// in the background, picked by its target constraints.
	MutateExisting bool `json:"mutateExisting"`
}

// KyvernoCELMutation is one mutation: an ApplyConfiguration or JSONPatch
// expression.
type KyvernoCELMutation struct {
	PatchType  string `json:"patchType"`
	Expression string `json:"expression"`
}

type KyvernoMutatingPolicyDetail struct {
	KyvernoMutatingPolicyInfo
	KyvernoCELPolicyDetailBase
	MutationList    []KyvernoCELMutation `json:"mutationList"`
	TargetResources []string             `json:"targetResources"`
	// TargetExpression resolves the target objects from the trigger request;
	// the target resource rules still apply alongside it.
	TargetExpression      string                 `json:"targetExpression"`
	TargetMatchConditions []KyvernoCELExpression `json:"targetMatchConditions"`
	ReinvocationPolicy    string                 `json:"reinvocationPolicy"`
}

func (m *ClientManager) ListKyvernoMutatingPolicies(contextName string) []KyvernoMutatingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoMutatingPoliciesResource), "", extractKyvernoMutatingPolicy,
		func(r KyvernoMutatingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) ListKyvernoNamespacedMutatingPolicies(contextName, namespace string) []KyvernoMutatingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoNamespacedMutatingPoliciesResource), namespace, extractKyvernoMutatingPolicy,
		func(r KyvernoMutatingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKyvernoMutatingPolicy(ctx context.Context, contextName, name string) (*KyvernoMutatingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoMutatingPoliciesResource, "", name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoMutatingPolicyDetail(obj), nil
}

func (m *ClientManager) GetKyvernoNamespacedMutatingPolicy(ctx context.Context, contextName, namespace, name string) (*KyvernoMutatingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoNamespacedMutatingPoliciesResource, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoMutatingPolicyDetail(obj), nil
}

func kyvernoMutations(obj *unstructured.Unstructured) []KyvernoCELMutation {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "mutations")
	out := make([]KyvernoCELMutation, 0, len(raw))
	for _, item := range raw {
		mu, _ := item.(map[string]any)
		patchType, _ := mu["patchType"].(string)
		expr := ""
		switch patchType {
		case "JSONPatch":
			expr, _ = nestedMap(mu, "jsonPatch")["expression"].(string)
		default:
			expr, _ = nestedMap(mu, "applyConfiguration")["expression"].(string)
		}
		out = append(out, KyvernoCELMutation{PatchType: patchType, Expression: expr})
	}
	return out
}

func extractKyvernoMutatingPolicy(obj *unstructured.Unstructured) KyvernoMutatingPolicyInfo {
	mutations := kyvernoMutations(obj)
	types := map[string]bool{}
	for _, mu := range mutations {
		if mu.PatchType != "" {
			types[mu.PatchType] = true
		}
	}
	return KyvernoMutatingPolicyInfo{
		KyvernoCELPolicyBase: kyvernoCELBase(obj),
		Mutations:            len(mutations),
		PatchTypes:           sortedKeys(types),
		Admission:            nestedBoolOrTrue(obj.Object, "spec", "evaluation", "admission", "enabled"),
		MutateExisting:       nestedBoolOrFalse(obj.Object, "spec", "evaluation", "mutateExisting", "enabled"),
	}
}

func extractKyvernoMutatingPolicyDetail(obj *unstructured.Unstructured) *KyvernoMutatingPolicyDetail {
	reinvocation, _, _ := unstructured.NestedString(obj.Object, "spec", "reinvocationPolicy")
	targetExpression, _, _ := unstructured.NestedString(obj.Object, "spec", "targetMatchConstraints", "expression")
	return &KyvernoMutatingPolicyDetail{
		KyvernoMutatingPolicyInfo:  extractKyvernoMutatingPolicy(obj),
		KyvernoCELPolicyDetailBase: kyvernoCELDetailBase(obj),
		MutationList:               kyvernoMutations(obj),
		TargetResources:            summarizeResourceRules(nestedField(obj.Object, "spec", "targetMatchConstraints", "resourceRules")),
		TargetExpression:           targetExpression,
		TargetMatchConditions:      extractCELExpressions(obj, "name", "expression", "spec", "targetMatchConditions"),
		ReinvocationPolicy:         reinvocation,
	}
}

// ---------------------------------------------------------------------------
// GeneratingPolicy
// ---------------------------------------------------------------------------

type KyvernoGeneratingPolicyInfo struct {
	KyvernoCELPolicyBase
	Generations int `json:"generations"`
	// Synchronize keeps generated objects in step with the policy and the
	// trigger; GenerateExisting also generates for triggers that existed
	// before the policy.
	Synchronize      bool `json:"synchronize"`
	GenerateExisting bool `json:"generateExisting"`
}

// KyvernoCELGeneration is one generate entry: a CEL expression that creates
// resources, or a template.
type KyvernoCELGeneration struct {
	Expression  string `json:"expression"`
	Template    string `json:"template"`
	Interpolate string `json:"interpolate"`
}

type KyvernoGeneratingPolicyDetail struct {
	KyvernoGeneratingPolicyInfo
	KyvernoCELPolicyDetailBase
	GenerationList []KyvernoCELGeneration `json:"generationList"`
	// OrphanOnDelete keeps generated objects when the policy is deleted.
	OrphanOnDelete bool `json:"orphanOnDelete"`
}

func (m *ClientManager) ListKyvernoGeneratingPolicies(contextName string) []KyvernoGeneratingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoGeneratingPoliciesResource), "", extractKyvernoGeneratingPolicy,
		func(r KyvernoGeneratingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) ListKyvernoNamespacedGeneratingPolicies(contextName, namespace string) []KyvernoGeneratingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoNamespacedGeneratingPoliciesResource), namespace, extractKyvernoGeneratingPolicy,
		func(r KyvernoGeneratingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKyvernoGeneratingPolicy(ctx context.Context, contextName, name string) (*KyvernoGeneratingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoGeneratingPoliciesResource, "", name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoGeneratingPolicyDetail(obj), nil
}

func (m *ClientManager) GetKyvernoNamespacedGeneratingPolicy(ctx context.Context, contextName, namespace, name string) (*KyvernoGeneratingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoNamespacedGeneratingPoliciesResource, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoGeneratingPolicyDetail(obj), nil
}

func kyvernoGenerations(obj *unstructured.Unstructured) []KyvernoCELGeneration {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "generate")
	out := make([]KyvernoCELGeneration, 0, len(raw))
	for _, item := range raw {
		g, _ := item.(map[string]any)
		gen := KyvernoCELGeneration{}
		gen.Expression, _ = g["expression"].(string)
		tmpl := nestedMap(g, "template")
		gen.Template, _ = tmpl["value"].(string)
		gen.Interpolate, _ = tmpl["interpolate"].(string)
		out = append(out, gen)
	}
	return out
}

func extractKyvernoGeneratingPolicy(obj *unstructured.Unstructured) KyvernoGeneratingPolicyInfo {
	return KyvernoGeneratingPolicyInfo{
		KyvernoCELPolicyBase: kyvernoCELBase(obj),
		Generations:          len(kyvernoGenerations(obj)),
		Synchronize:          nestedBoolOrFalse(obj.Object, "spec", "evaluation", "synchronize", "enabled"),
		GenerateExisting:     nestedBoolOrFalse(obj.Object, "spec", "evaluation", "generateExisting", "enabled"),
	}
}

func extractKyvernoGeneratingPolicyDetail(obj *unstructured.Unstructured) *KyvernoGeneratingPolicyDetail {
	return &KyvernoGeneratingPolicyDetail{
		KyvernoGeneratingPolicyInfo: extractKyvernoGeneratingPolicy(obj),
		KyvernoCELPolicyDetailBase:  kyvernoCELDetailBase(obj),
		GenerationList:              kyvernoGenerations(obj),
		OrphanOnDelete:              nestedBoolOrFalse(obj.Object, "spec", "evaluation", "orphanDownstreamOnPolicyDelete", "enabled"),
	}
}

// ---------------------------------------------------------------------------
// DeletingPolicy
// ---------------------------------------------------------------------------

type KyvernoDeletingPolicyInfo struct {
	KyvernoCELPolicyBase
	Schedule      string `json:"schedule"`
	LastExecution string `json:"lastExecution"`
	// NextExecution is the schedule's next hit after now, "" when the
	// schedule does not parse.
	NextExecution string `json:"nextExecution"`
	Propagation   string `json:"propagation"`
}

type KyvernoDeletingPolicyDetail struct {
	KyvernoDeletingPolicyInfo
	KyvernoCELPolicyDetailBase
	// DeleteConditions are the CEL conditions a matched object must meet to
	// be deleted.
	DeleteConditions []KyvernoCELExpression `json:"deleteConditions"`
}

func (m *ClientManager) ListKyvernoDeletingPolicies(contextName string) []KyvernoDeletingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoDeletingPoliciesResource), "", extractKyvernoDeletingPolicy,
		func(r KyvernoDeletingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) ListKyvernoNamespacedDeletingPolicies(contextName, namespace string) []KyvernoDeletingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoNamespacedDeletingPoliciesResource), namespace, extractKyvernoDeletingPolicy,
		func(r KyvernoDeletingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKyvernoDeletingPolicy(ctx context.Context, contextName, name string) (*KyvernoDeletingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoDeletingPoliciesResource, "", name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoDeletingPolicyDetail(obj, time.Now()), nil
}

func (m *ClientManager) GetKyvernoNamespacedDeletingPolicy(ctx context.Context, contextName, namespace, name string) (*KyvernoDeletingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoNamespacedDeletingPoliciesResource, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoDeletingPolicyDetail(obj, time.Now()), nil
}

func extractKyvernoDeletingPolicy(obj *unstructured.Unstructured) KyvernoDeletingPolicyInfo {
	return kyvernoDeletingPolicyAt(obj, time.Now())
}

func kyvernoDeletingPolicyAt(obj *unstructured.Unstructured, now time.Time) KyvernoDeletingPolicyInfo {
	schedule, _, _ := unstructured.NestedString(obj.Object, "spec", "schedule")
	last, _, _ := unstructured.NestedString(obj.Object, "status", "lastExecutionTime")
	propagation, _, _ := unstructured.NestedString(obj.Object, "spec", "deletionPropagationPolicy")
	next := ""
	// Kyverno parses the schedule with cronexpr (day-of-week 7, L, W, #,
	// seconds and years) and evaluates it in the controller's clock, which is
	// UTC unless its pod sets TZ, not in this desktop's zone.
	if expr, err := cronexpr.Parse(schedule); err == nil && schedule != "" {
		if t := expr.Next(now.UTC()); !t.IsZero() {
			next = t.Format(time.RFC3339)
		}
	}
	return KyvernoDeletingPolicyInfo{
		KyvernoCELPolicyBase: kyvernoCELBase(obj),
		Schedule:             schedule,
		LastExecution:        last,
		NextExecution:        next,
		Propagation:          propagation,
	}
}

func extractKyvernoDeletingPolicyDetail(obj *unstructured.Unstructured, now time.Time) *KyvernoDeletingPolicyDetail {
	return &KyvernoDeletingPolicyDetail{
		KyvernoDeletingPolicyInfo:  kyvernoDeletingPolicyAt(obj, now),
		KyvernoCELPolicyDetailBase: kyvernoCELDetailBase(obj),
		DeleteConditions:           extractCELExpressions(obj, "name", "expression", "spec", "conditions"),
	}
}

// ---------------------------------------------------------------------------
// ImageValidatingPolicy
// ---------------------------------------------------------------------------

type KyvernoImageValidatingPolicyInfo struct {
	KyvernoCELPolicyBase
	// Images are the matchImageReferences globs and expressions.
	Images     []string `json:"images"`
	Attestors  []string `json:"attestors"`
	Actions    []string `json:"actions"`
	Admission  bool     `json:"admission"`
	Background bool     `json:"background"`
}

// KyvernoAttestor is a signature verifier: Type is cosign or notary, and
// Details says what it trusts (a key, keyless identities, certificates).
// Key material is never copied, only whether it is inline or referenced.
type KyvernoAttestor struct {
	Name    string   `json:"name"`
	Type    string   `json:"type"`
	Details []string `json:"details"`
}

// KyvernoAttestation is an attestation the policy checks: an in-toto
// predicate or an OCI referrer artifact of Type.
type KyvernoAttestation struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	Type string `json:"type"`
}

type KyvernoImageValidatingPolicyDetail struct {
	KyvernoImageValidatingPolicyInfo
	KyvernoCELPolicyDetailBase
	AttestorList        []KyvernoAttestor      `json:"attestorList"`
	Attestations        []KyvernoAttestation   `json:"attestations"`
	Validations         []KyvernoCELValidation `json:"validationRules"`
	ImageExtractors     []KyvernoCELExpression `json:"imageExtractors"`
	MutateDigest        bool                   `json:"mutateDigest"`
	VerifyDigest        bool                   `json:"verifyDigest"`
	Required            bool                   `json:"required"`
	CredentialProviders []string               `json:"credentialProviders"`
	CredentialSecrets   []string               `json:"credentialSecrets"`
	AllowInsecure       bool                   `json:"allowInsecure"`
}

func (m *ClientManager) ListKyvernoImageValidatingPolicies(contextName string) []KyvernoImageValidatingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoImageValidatingPoliciesResource), "", extractKyvernoImageValidatingPolicy,
		func(r KyvernoImageValidatingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) ListKyvernoNamespacedImageValidatingPolicies(contextName, namespace string) []KyvernoImageValidatingPolicyInfo {
	return listServedRows(m, contextName, kyvernoCELGR(kyvernoNamespacedImageValidatingPoliciesResource), namespace, extractKyvernoImageValidatingPolicy,
		func(r KyvernoImageValidatingPolicyInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetKyvernoImageValidatingPolicy(ctx context.Context, contextName, name string) (*KyvernoImageValidatingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoImageValidatingPoliciesResource, "", name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoImageValidatingPolicyDetail(obj), nil
}

func (m *ClientManager) GetKyvernoNamespacedImageValidatingPolicy(ctx context.Context, contextName, namespace, name string) (*KyvernoImageValidatingPolicyDetail, error) {
	obj, err := m.getKyvernoCEL(ctx, contextName, kyvernoNamespacedImageValidatingPoliciesResource, namespace, name)
	if err != nil {
		return nil, err
	}
	return extractKyvernoImageValidatingPolicyDetail(obj), nil
}

func kyvernoImageReferences(obj *unstructured.Unstructured) []string {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "matchImageReferences")
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		r, _ := item.(map[string]any)
		if g, _ := r["glob"].(string); g != "" {
			out = append(out, g)
		} else if e, _ := r["expression"].(string); e != "" {
			out = append(out, e)
		}
	}
	return out
}

func kyvernoAttestors(obj *unstructured.Unstructured) []KyvernoAttestor {
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "attestors")
	out := make([]KyvernoAttestor, 0, len(raw))
	for _, item := range raw {
		a, _ := item.(map[string]any)
		att := KyvernoAttestor{Details: []string{}}
		att.Name, _ = a["name"].(string)
		if c := nestedMap(a, "cosign"); c != nil {
			att.Type = "cosign"
			att.Details = kyvernoCosignDetails(c)
		} else if n := nestedMap(a, "notary"); n != nil {
			att.Type = "notary"
			if certs := nestedMap(n, "certs"); certs != nil {
				att.Details = append(att.Details, "certificates "+kyvernoInlineOrExpression(certs))
			}
			if tsa := nestedMap(n, "tsaCerts"); tsa != nil {
				att.Details = append(att.Details, "TSA certificates "+kyvernoInlineOrExpression(tsa))
			}
		}
		out = append(out, att)
	}
	return out
}

// kyvernoInlineOrExpression says where a value comes from without copying it.
func kyvernoInlineOrExpression(v map[string]any) string {
	if e, _ := v["expression"].(string); e != "" {
		return "from " + e
	}
	return "inline"
}

func kyvernoCosignDetails(c map[string]any) []string {
	out := []string{}
	if key := nestedMap(c, "key"); key != nil {
		switch {
		case key["kms"] != nil && key["kms"] != "":
			out = append(out, "key in KMS "+key["kms"].(string))
		case key["expression"] != nil && key["expression"] != "":
			out = append(out, "key from "+key["expression"].(string))
		default:
			out = append(out, "inline public key")
		}
	}
	if keyless := nestedMap(c, "keyless"); keyless != nil {
		identities, _ := keyless["identities"].([]any)
		for _, item := range identities {
			id, _ := item.(map[string]any)
			issuer, _ := id["issuer"].(string)
			if issuer == "" {
				issuer, _ = id["issuerRegExp"].(string)
			}
			subject, _ := id["subject"].(string)
			if subject == "" {
				subject, _ = id["subjectRegExp"].(string)
			}
			out = append(out, "keyless "+subject+" from "+issuer)
		}
	}
	if cert := nestedMap(c, "certificate"); cert != nil {
		out = append(out, "certificate")
	}
	if ctlog := nestedMap(c, "ctlog"); ctlog != nil {
		if url, _ := ctlog["url"].(string); url != "" {
			out = append(out, "Rekor "+url)
		}
		if ignore, _ := ctlog["insecureIgnoreTlog"].(bool); ignore {
			out = append(out, "transparency log not checked")
		}
	}
	if src := nestedMap(c, "source"); src != nil {
		if repo, _ := src["repository"].(string); repo != "" {
			out = append(out, "signatures in "+repo)
		}
	}
	return out
}

func extractKyvernoImageValidatingPolicy(obj *unstructured.Unstructured) KyvernoImageValidatingPolicyInfo {
	attestors := kyvernoAttestors(obj)
	names := make([]string, 0, len(attestors))
	for _, a := range attestors {
		label := a.Name
		if a.Type != "" {
			label += " (" + a.Type + ")"
		}
		names = append(names, label)
	}
	return KyvernoImageValidatingPolicyInfo{
		KyvernoCELPolicyBase: kyvernoCELBase(obj),
		Images:               kyvernoImageReferences(obj),
		Attestors:            names,
		Actions:              kyvernoValidationActions(obj),
		Admission:            nestedBoolOrTrue(obj.Object, "spec", "evaluation", "admission", "enabled"),
		Background:           nestedBoolOrTrue(obj.Object, "spec", "evaluation", "background", "enabled"),
	}
}

func extractKyvernoImageValidatingPolicyDetail(obj *unstructured.Unstructured) *KyvernoImageValidatingPolicyDetail {
	d := &KyvernoImageValidatingPolicyDetail{
		KyvernoImageValidatingPolicyInfo: extractKyvernoImageValidatingPolicy(obj),
		KyvernoCELPolicyDetailBase:       kyvernoCELDetailBase(obj),
		AttestorList:                     kyvernoAttestors(obj),
		Attestations:                     []KyvernoAttestation{},
		Validations:                      []KyvernoCELValidation{},
		ImageExtractors:                  extractCELExpressions(obj, "name", "expression", "spec", "images"),
		// mutateDigest, verifyDigest and required default to true.
		MutateDigest:        nestedBoolOrTrue(obj.Object, "spec", "validationConfigurations", "mutateDigest"),
		VerifyDigest:        nestedBoolOrTrue(obj.Object, "spec", "validationConfigurations", "verifyDigest"),
		Required:            nestedBoolOrTrue(obj.Object, "spec", "validationConfigurations", "required"),
		CredentialProviders: nestedStrings(nestedMap(nestedMap(obj.Object, "spec"), "credentials"), "providers"),
		CredentialSecrets:   nestedStrings(nestedMap(nestedMap(obj.Object, "spec"), "credentials"), "secrets"),
		AllowInsecure:       nestedBoolOrFalse(obj.Object, "spec", "credentials", "allowInsecureRegistry"),
	}
	raw, _, _ := nestedSliceNoCopy(obj.Object, "spec", "attestations")
	for _, item := range raw {
		a, _ := item.(map[string]any)
		att := KyvernoAttestation{}
		att.Name, _ = a["name"].(string)
		if in := nestedMap(a, "intoto"); in != nil {
			att.Kind = "in-toto"
			att.Type, _ = in["type"].(string)
		} else if ref := nestedMap(a, "referrer"); ref != nil {
			att.Kind = "referrer"
			att.Type, _ = ref["type"].(string)
		}
		d.Attestations = append(d.Attestations, att)
	}
	validations, _, _ := nestedSliceNoCopy(obj.Object, "spec", "validations")
	for _, item := range validations {
		v, _ := item.(map[string]any)
		val := KyvernoCELValidation{}
		val.Expression, _ = v["expression"].(string)
		val.Message, _ = v["message"].(string)
		val.MessageExpression, _ = v["messageExpression"].(string)
		val.Reason, _ = v["reason"].(string)
		d.Validations = append(d.Validations, val)
	}
	return d
}
