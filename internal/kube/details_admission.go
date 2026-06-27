package kube

import (
	"fmt"
	"strings"
	"time"

	admissionregv1 "k8s.io/api/admissionregistration/v1"
)

type WebhookSummary struct {
	Name        string   `json:"name"`
	ClientCfg   string   `json:"clientCfg"`
	FailPolicy  string   `json:"failPolicy"`
	SideEffects string   `json:"sideEffects"`
	Operations  []string `json:"operations"`
	Resources   []string `json:"resources"`
}

type WebhookConfigurationDetail struct {
	Name        string            `json:"name"`
	UID         string            `json:"uid"`
	Webhooks    []WebhookSummary  `json:"webhooks"`
	Labels      map[string]string `json:"labels"`
	Annotations map[string]string `json:"annotations"`
	CreatedAt   string            `json:"createdAt"`
}

func (w *contextWatcher) ValidatingWebhookConfiguration(name string) (*WebhookConfigurationDetail, error) {
	f := w.factoryFor("ValidatingWebhookConfiguration")
	if f == nil {
		return nil, errKindNoAccess("ValidatingWebhookConfiguration")
	}
	c, err := f.Admissionregistration().V1().ValidatingWebhookConfigurations().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	whs := make([]WebhookSummary, 0, len(c.Webhooks))
	for _, h := range c.Webhooks {
		whs = append(whs, webhookSummary(h.Name, h.ClientConfig, h.FailurePolicy, h.SideEffects, h.Rules))
	}
	return &WebhookConfigurationDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Webhooks:    whs,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) MutatingWebhookConfiguration(name string) (*WebhookConfigurationDetail, error) {
	f := w.factoryFor("MutatingWebhookConfiguration")
	if f == nil {
		return nil, errKindNoAccess("MutatingWebhookConfiguration")
	}
	c, err := f.Admissionregistration().V1().MutatingWebhookConfigurations().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	whs := make([]WebhookSummary, 0, len(c.Webhooks))
	for _, h := range c.Webhooks {
		whs = append(whs, webhookSummary(h.Name, h.ClientConfig, h.FailurePolicy, h.SideEffects, h.Rules))
	}
	return &WebhookConfigurationDetail{
		Name:        c.Name,
		UID:         string(c.UID),
		Webhooks:    whs,
		Labels:      c.Labels,
		Annotations: c.Annotations,
		CreatedAt:   c.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

// webhookSummary projects one admission webhook into a WebhookSummary. The
// Validating and Mutating webhook types are distinct structs but share these
// field types, so the per-webhook body is the same for both.
func webhookSummary(
	name string,
	cc admissionregv1.WebhookClientConfig,
	failurePolicy *admissionregv1.FailurePolicyType,
	sideEffects *admissionregv1.SideEffectClass,
	rules []admissionregv1.RuleWithOperations,
) WebhookSummary {
	summary := WebhookSummary{Name: name, Operations: []string{}, Resources: []string{}}
	if cc.Service != nil {
		summary.ClientCfg = cc.Service.Namespace + "/" + cc.Service.Name
	} else if cc.URL != nil {
		summary.ClientCfg = *cc.URL
	}
	if failurePolicy != nil {
		summary.FailPolicy = string(*failurePolicy)
	}
	if sideEffects != nil {
		summary.SideEffects = string(*sideEffects)
	}
	seenOps := map[string]struct{}{}
	seenRes := map[string]struct{}{}
	for _, r := range rules {
		for _, op := range r.Operations {
			if _, ok := seenOps[string(op)]; !ok {
				seenOps[string(op)] = struct{}{}
				summary.Operations = append(summary.Operations, string(op))
			}
		}
		for _, rs := range r.Resources {
			if _, ok := seenRes[rs]; !ok {
				seenRes[rs] = struct{}{}
				summary.Resources = append(summary.Resources, rs)
			}
		}
	}
	return summary
}

type AdmissionPolicyValidation struct {
	Expression        string `json:"expression"`
	Message           string `json:"message"`
	Reason            string `json:"reason"`
	MessageExpression string `json:"messageExpression"`
}

type AdmissionPolicyMutation struct {
	Name        string `json:"name"`
	PatchType   string `json:"patchType"`
	Description string `json:"description"`
}

type AdmissionPolicyMatchCondition struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
}

type AdmissionPolicyVariable struct {
	Name       string `json:"name"`
	Expression string `json:"expression"`
}

type AdmissionPolicyAuditAnnotation struct {
	Key             string `json:"key"`
	ValueExpression string `json:"valueExpression"`
}

type AdmissionPolicyDetail struct {
	Name             string                           `json:"name"`
	UID              string                           `json:"uid"`
	FailPolicy       string                           `json:"failPolicy"`
	ParamKind        string                           `json:"paramKind"`
	MatchResources   []string                         `json:"matchResources"`
	Validations      []AdmissionPolicyValidation      `json:"validations"`
	Mutations        []AdmissionPolicyMutation        `json:"mutations"`
	AuditAnnotations []AdmissionPolicyAuditAnnotation `json:"auditAnnotations"`
	MatchConditions  []AdmissionPolicyMatchCondition  `json:"matchConditions"`
	Variables        []AdmissionPolicyVariable        `json:"variables"`
	Labels           map[string]string                `json:"labels"`
	Annotations      map[string]string                `json:"annotations"`
	CreatedAt        string                           `json:"createdAt"`
}

type AdmissionPolicyBindingDetail struct {
	Name              string                          `json:"name"`
	UID               string                          `json:"uid"`
	PolicyName        string                          `json:"policyName"`
	ParamRef          string                          `json:"paramRef"`
	ValidationActions []string                        `json:"validationActions"`
	MatchResources    []string                        `json:"matchResources"`
	MatchConditions   []AdmissionPolicyMatchCondition `json:"matchConditions"`
	Labels            map[string]string               `json:"labels"`
	Annotations       map[string]string               `json:"annotations"`
	CreatedAt         string                          `json:"createdAt"`
}

func summarizeMatchResources(m *admissionregv1.MatchResources) []string {
	if m == nil {
		return []string{}
	}
	out := []string{}
	for _, r := range m.ResourceRules {
		ops := make([]string, 0, len(r.Operations))
		for _, op := range r.Operations {
			ops = append(ops, string(op))
		}
		for _, g := range r.APIGroups {
			for _, v := range r.APIVersions {
				for _, rs := range r.Resources {
					gvr := g + "/" + v + "/" + rs
					if g == "" {
						gvr = "core/" + v + "/" + rs
					}
					out = append(out, fmt.Sprintf("%s [%s]", gvr, strings.Join(ops, ",")))
				}
			}
		}
	}
	return out
}

func matchConditionsFor(in []admissionregv1.MatchCondition) []AdmissionPolicyMatchCondition {
	out := make([]AdmissionPolicyMatchCondition, 0, len(in))
	for _, c := range in {
		out = append(out, AdmissionPolicyMatchCondition{Name: c.Name, Expression: c.Expression})
	}
	return out
}

func variablesFor(in []admissionregv1.Variable) []AdmissionPolicyVariable {
	out := make([]AdmissionPolicyVariable, 0, len(in))
	for _, v := range in {
		out = append(out, AdmissionPolicyVariable{Name: v.Name, Expression: v.Expression})
	}
	return out
}

func (w *contextWatcher) ValidatingAdmissionPolicy(name string) (*AdmissionPolicyDetail, error) {
	f := w.factoryFor("ValidatingAdmissionPolicy")
	if f == nil {
		return nil, errKindNoAccess("ValidatingAdmissionPolicy")
	}
	p, err := f.Admissionregistration().V1().ValidatingAdmissionPolicies().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	fail := ""
	if p.Spec.FailurePolicy != nil {
		fail = string(*p.Spec.FailurePolicy)
	}
	validations := make([]AdmissionPolicyValidation, 0, len(p.Spec.Validations))
	for _, v := range p.Spec.Validations {
		reason := ""
		if v.Reason != nil {
			reason = string(*v.Reason)
		}
		validations = append(validations, AdmissionPolicyValidation{
			Expression:        v.Expression,
			Message:           v.Message,
			Reason:            reason,
			MessageExpression: v.MessageExpression,
		})
	}
	audits := make([]AdmissionPolicyAuditAnnotation, 0, len(p.Spec.AuditAnnotations))
	for _, a := range p.Spec.AuditAnnotations {
		audits = append(audits, AdmissionPolicyAuditAnnotation{Key: a.Key, ValueExpression: a.ValueExpression})
	}
	return &AdmissionPolicyDetail{
		Name:             p.Name,
		UID:              string(p.UID),
		FailPolicy:       fail,
		ParamKind:        paramKindString(p.Spec.ParamKind),
		MatchResources:   summarizeMatchResources(p.Spec.MatchConstraints),
		Validations:      validations,
		AuditAnnotations: audits,
		MatchConditions:  matchConditionsFor(p.Spec.MatchConditions),
		Variables:        variablesFor(p.Spec.Variables),
		Mutations:        []AdmissionPolicyMutation{},
		Labels:           p.Labels,
		Annotations:      p.Annotations,
		CreatedAt:        p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) ValidatingAdmissionPolicyBinding(name string) (*AdmissionPolicyBindingDetail, error) {
	f := w.factoryFor("ValidatingAdmissionPolicyBinding")
	if f == nil {
		return nil, errKindNoAccess("ValidatingAdmissionPolicyBinding")
	}
	b, err := f.Admissionregistration().V1().ValidatingAdmissionPolicyBindings().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	actions := make([]string, 0, len(b.Spec.ValidationActions))
	for _, a := range b.Spec.ValidationActions {
		actions = append(actions, string(a))
	}
	return &AdmissionPolicyBindingDetail{
		Name:              b.Name,
		UID:               string(b.UID),
		PolicyName:        b.Spec.PolicyName,
		ParamRef:          paramRefString(b.Spec.ParamRef),
		ValidationActions: actions,
		MatchResources:    summarizeMatchResources(b.Spec.MatchResources),
		MatchConditions:   []AdmissionPolicyMatchCondition{},
		Labels:            b.Labels,
		Annotations:       b.Annotations,
		CreatedAt:         b.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) MutatingAdmissionPolicy(name string) (*AdmissionPolicyDetail, error) {
	f := w.factoryFor("MutatingAdmissionPolicy")
	if f == nil {
		return nil, errKindNoAccess("MutatingAdmissionPolicy")
	}
	p, err := f.Admissionregistration().V1().MutatingAdmissionPolicies().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	fail := ""
	if p.Spec.FailurePolicy != nil {
		fail = string(*p.Spec.FailurePolicy)
	}
	mutations := make([]AdmissionPolicyMutation, 0, len(p.Spec.Mutations))
	for i, m := range p.Spec.Mutations {
		desc := ""
		if m.JSONPatch != nil {
			desc = "JSONPatch: " + m.JSONPatch.Expression
		} else if m.ApplyConfiguration != nil {
			desc = "ApplyConfiguration: " + m.ApplyConfiguration.Expression
		}
		mutations = append(mutations, AdmissionPolicyMutation{
			Name:        fmt.Sprintf("mutation-%d", i),
			PatchType:   string(m.PatchType),
			Description: desc,
		})
	}
	return &AdmissionPolicyDetail{
		Name:             p.Name,
		UID:              string(p.UID),
		FailPolicy:       fail,
		ParamKind:        paramKindString(p.Spec.ParamKind),
		MatchResources:   summarizeMatchResources(p.Spec.MatchConstraints),
		Validations:      []AdmissionPolicyValidation{},
		AuditAnnotations: []AdmissionPolicyAuditAnnotation{},
		MatchConditions:  matchConditionsFor(p.Spec.MatchConditions),
		Variables:        variablesFor(p.Spec.Variables),
		Mutations:        mutations,
		Labels:           p.Labels,
		Annotations:      p.Annotations,
		CreatedAt:        p.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}

func (w *contextWatcher) MutatingAdmissionPolicyBinding(name string) (*AdmissionPolicyBindingDetail, error) {
	f := w.factoryFor("MutatingAdmissionPolicyBinding")
	if f == nil {
		return nil, errKindNoAccess("MutatingAdmissionPolicyBinding")
	}
	b, err := f.Admissionregistration().V1().MutatingAdmissionPolicyBindings().Lister().Get(name)
	if err != nil {
		return nil, err
	}
	return &AdmissionPolicyBindingDetail{
		Name:              b.Name,
		UID:               string(b.UID),
		PolicyName:        b.Spec.PolicyName,
		ParamRef:          paramRefString(b.Spec.ParamRef),
		ValidationActions: []string{},
		MatchResources:    summarizeMatchResources(b.Spec.MatchResources),
		MatchConditions:   []AdmissionPolicyMatchCondition{},
		Labels:            b.Labels,
		Annotations:       b.Annotations,
		CreatedAt:         b.CreationTimestamp.UTC().Format(time.RFC3339),
	}, nil
}
