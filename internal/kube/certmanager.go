package kube

import (
	"context"
	"fmt"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// cert-manager resources. Certificate, Issuer and CertificateRequest are
// namespaced; ClusterIssuer is cluster-scoped.
var (
	certManagerCertificateGR        = schema.GroupResource{Group: "cert-manager.io", Resource: "certificates"}
	certManagerIssuerGR             = schema.GroupResource{Group: "cert-manager.io", Resource: "issuers"}
	certManagerClusterIssuerGR      = schema.GroupResource{Group: "cert-manager.io", Resource: "clusterissuers"}
	certManagerCertificateRequestGR = schema.GroupResource{Group: "cert-manager.io", Resource: "certificaterequests"}
	// Order and Challenge are the ACME-specific leg of the issuance chain and
	// live under acme.cert-manager.io. They only exist on installs that use an
	// ACME issuer; the listers return empty when the CRDs are absent.
	certManagerOrderGR     = schema.GroupResource{Group: "acme.cert-manager.io", Resource: "orders"}
	certManagerChallengeGR = schema.GroupResource{Group: "acme.cert-manager.io", Resource: "challenges"}
)

// certManagerIssuingReason is the reason Klustr stamps on the Issuing status
// condition when manually triggering re-issuance, mirroring `cmctl renew`.
const certManagerIssuingReason = "ManuallyTriggered"

// ---------------------------------------------------------------------------
// Certificate
// ---------------------------------------------------------------------------

// CertManagerCertificateInfo is the row shape for the Certificates list.
// NotAfter drives the expiry-countdown column and RenewalTime tells the user
// when cert-manager will rotate it next.
type CertManagerCertificateInfo struct {
	Name        string `json:"name"`
	Namespace   string `json:"namespace"`
	Ready       string `json:"ready"`
	Status      string `json:"status"`
	SecretName  string `json:"secretName"`
	Issuer      string `json:"issuer"`
	CommonName  string `json:"commonName"`
	NotAfter    string `json:"notAfter"`
	RenewalTime string `json:"renewalTime"`
	CreatedAt   string `json:"createdAt"`
}

type CertManagerCertificateDetail struct {
	CertManagerCertificateInfo
	Conditions  []ConditionDetail `json:"conditions"`
	IssuerKind  string            `json:"issuerKind"`
	IssuerGroup string            `json:"issuerGroup"`
	DNSNames    []string          `json:"dnsNames"`
	IPAddresses []string          `json:"ipAddresses"`
	URIs        []string          `json:"uris"`
	Usages      []string          `json:"usages"`
	NotBefore   string            `json:"notBefore"`
	Duration    string            `json:"duration"`
	RenewBefore string            `json:"renewBefore"`
	IsCA        bool              `json:"isCA"`
}

func (m *ClientManager) ListCertManagerCertificates(contextName, namespace string) []CertManagerCertificateInfo {
	return listServedRows(m, contextName, certManagerCertificateGR, namespace, extractCertManagerCertificate,
		func(r CertManagerCertificateInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetCertManagerCertificate(ctx context.Context, contextName, namespace, name string) (*CertManagerCertificateDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, certManagerCertificateGR, namespace, name)
	if err != nil {
		return nil, err
	}
	dnsNames, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "dnsNames")
	ipAddresses, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "ipAddresses")
	uris, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "uris")
	usages, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "usages")
	notBefore, _, _ := unstructured.NestedString(obj.Object, "status", "notBefore")
	duration, _, _ := unstructured.NestedString(obj.Object, "spec", "duration")
	renewBefore, _, _ := unstructured.NestedString(obj.Object, "spec", "renewBefore")
	isCA, _, _ := unstructured.NestedBool(obj.Object, "spec", "isCA")
	issuerKind, _, _ := unstructured.NestedString(obj.Object, "spec", "issuerRef", "kind")
	issuerGroup, _, _ := unstructured.NestedString(obj.Object, "spec", "issuerRef", "group")
	return &CertManagerCertificateDetail{
		CertManagerCertificateInfo: extractCertManagerCertificate(obj),
		Conditions:                 crConditions(obj),
		IssuerKind:                 issuerKind,
		IssuerGroup:                issuerGroup,
		DNSNames:                   append([]string{}, dnsNames...),
		IPAddresses:                append([]string{}, ipAddresses...),
		URIs:                       append([]string{}, uris...),
		Usages:                     append([]string{}, usages...),
		NotBefore:                  notBefore,
		Duration:                   duration,
		RenewBefore:                renewBefore,
		IsCA:                       isCA,
	}, nil
}

func extractCertManagerCertificate(obj *unstructured.Unstructured) CertManagerCertificateInfo {
	conds := crConditions(obj)
	readyStatus, readyMsg := readyCondition(conds)
	secretName, _, _ := unstructured.NestedString(obj.Object, "spec", "secretName")
	commonName, _, _ := unstructured.NestedString(obj.Object, "spec", "commonName")
	notAfter, _, _ := unstructured.NestedString(obj.Object, "status", "notAfter")
	renewalTime, _, _ := unstructured.NestedString(obj.Object, "status", "renewalTime")
	return CertManagerCertificateInfo{
		Name:        obj.GetName(),
		Namespace:   obj.GetNamespace(),
		Ready:       readyStatus,
		Status:      readyMsg,
		SecretName:  secretName,
		Issuer:      formatIssuerRef(obj),
		CommonName:  commonName,
		NotAfter:    notAfter,
		RenewalTime: renewalTime,
		CreatedAt:   obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Issuer / ClusterIssuer
// ---------------------------------------------------------------------------

// CertManagerIssuerInfo is the row shape shared by both Issuer (namespaced)
// and ClusterIssuer (cluster-scoped). Namespace is empty for ClusterIssuers.
// Type collapses the one-of spec block (acme / ca / selfSigned / vault /
// venafi) into a single scannable column.
type CertManagerIssuerInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Status    string `json:"status"`
	Type      string `json:"type"`
	CreatedAt string `json:"createdAt"`
}

type CertManagerIssuerDetail struct {
	CertManagerIssuerInfo
	Conditions []ConditionDetail `json:"conditions"`
	ACMEServer string            `json:"acmeServer"`
	ACMEEmail  string            `json:"acmeEmail"`
}

func (m *ClientManager) ListCertManagerIssuers(contextName, namespace string) []CertManagerIssuerInfo {
	return m.listCertManagerIssuers(contextName, certManagerIssuerGR, namespace)
}

func (m *ClientManager) ListCertManagerClusterIssuers(contextName string) []CertManagerIssuerInfo {
	return m.listCertManagerIssuers(contextName, certManagerClusterIssuerGR, "")
}

func (m *ClientManager) listCertManagerIssuers(contextName string, gr schema.GroupResource, namespace string) []CertManagerIssuerInfo {
	return listServedRows(m, contextName, gr, namespace, extractCertManagerIssuer,
		func(r CertManagerIssuerInfo) (string, string) { return r.Namespace, r.Name })
}

func (m *ClientManager) GetCertManagerIssuer(ctx context.Context, contextName, namespace, name string) (*CertManagerIssuerDetail, error) {
	return m.getCertManagerIssuer(ctx, contextName, certManagerIssuerGR, namespace, name)
}

func (m *ClientManager) GetCertManagerClusterIssuer(ctx context.Context, contextName, name string) (*CertManagerIssuerDetail, error) {
	return m.getCertManagerIssuer(ctx, contextName, certManagerClusterIssuerGR, "", name)
}

func (m *ClientManager) getCertManagerIssuer(ctx context.Context, contextName string, gr schema.GroupResource, namespace, name string) (*CertManagerIssuerDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, gr, namespace, name)
	if err != nil {
		return nil, err
	}
	acmeServer, _, _ := unstructured.NestedString(obj.Object, "spec", "acme", "server")
	acmeEmail, _, _ := unstructured.NestedString(obj.Object, "spec", "acme", "email")
	return &CertManagerIssuerDetail{
		CertManagerIssuerInfo: extractCertManagerIssuer(obj),
		Conditions:            crConditions(obj),
		ACMEServer:            acmeServer,
		ACMEEmail:             acmeEmail,
	}, nil
}

func extractCertManagerIssuer(obj *unstructured.Unstructured) CertManagerIssuerInfo {
	conds := crConditions(obj)
	readyStatus, readyMsg := readyCondition(conds)
	return CertManagerIssuerInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Ready:     readyStatus,
		Status:    readyMsg,
		Type:      issuerType(obj),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Renew
// ---------------------------------------------------------------------------

// RenewCertificate triggers a manual re-issuance the same way `cmctl renew`
// does: it sets the Issuing status condition to True. The cert-manager
// certificate-trigger controller observes that and reissues immediately
// rather than waiting for the renewal window. Uses the status subresource so
// the spec is never touched.
func (m *ClientManager) RenewCertificate(ctx context.Context, contextName, namespace, name string) error {
	ri, err := m.writableResource(contextName, certManagerCertificateGR, namespace)
	if err != nil {
		return err
	}
	err = updateCRStatus(ctx, ri, name, func(obj *unstructured.Unstructured) (bool, error) {
		conds, _, _ := unstructured.NestedSlice(obj.Object, "status", "conditions")
		issuing := map[string]any{
			"type":               "Issuing",
			"status":             "True",
			"reason":             certManagerIssuingReason,
			"message":            "Certificate re-issuance manually triggered by Klustr",
			"lastTransitionTime": time.Now().UTC().Format(time.RFC3339),
			"observedGeneration": obj.GetGeneration(),
		}
		replaced := false
		for i, c := range conds {
			cm, ok := c.(map[string]any)
			if !ok {
				continue
			}
			if t, _ := cm["type"].(string); t == "Issuing" {
				conds[i] = issuing
				replaced = true
				break
			}
		}
		if !replaced {
			conds = append(conds, issuing)
		}
		if err := unstructured.SetNestedSlice(obj.Object, conds, "status", "conditions"); err != nil {
			return false, err
		}
		return true, nil
	})
	if err != nil {
		return fmt.Errorf("renew certificate %s/%s: %w", namespace, name, err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// CertificateRequest
// ---------------------------------------------------------------------------

// CertManagerCertificateRequestInfo is the row shape for the
// CertificateRequests list. Approved/Denied/Ready collapse the three
// independent conditions cert-manager tracks during issuance so a stuck
// request is obvious at a glance.
type CertManagerCertificateRequestInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	Ready     string `json:"ready"`
	Approved  string `json:"approved"`
	Denied    string `json:"denied"`
	Status    string `json:"status"`
	Issuer    string `json:"issuer"`
	CreatedAt string `json:"createdAt"`
}

type CertManagerCertificateRequestDetail struct {
	CertManagerCertificateRequestInfo
	Conditions  []ConditionDetail `json:"conditions"`
	IssuerKind  string            `json:"issuerKind"`
	IssuerGroup string            `json:"issuerGroup"`
	Usages      []string          `json:"usages"`
	IsCA        bool              `json:"isCA"`
	FailureTime string            `json:"failureTime"`
}

func (m *ClientManager) ListCertManagerCertificateRequests(contextName, namespace string) []CertManagerCertificateRequestInfo {
	objs := m.listServedCRs(contextName, certManagerCertificateRequestGR, namespace)
	return certificateRequestRows(objs)
}

// CertManagerCertificateRequestsFor returns the CertificateRequests owned by
// the named Certificate — the next link down the issuance chain. The frontend
// renders these in the Certificate detail's Requests tab.
func (m *ClientManager) CertManagerCertificateRequestsFor(contextName, namespace, certName string) []CertManagerCertificateRequestInfo {
	objs := m.listServedCRs(contextName, certManagerCertificateRequestGR, namespace)
	owned := make([]*unstructured.Unstructured, 0, len(objs))
	for _, obj := range objs {
		if ownedBy(obj, "Certificate", certName) {
			owned = append(owned, obj)
		}
	}
	return certificateRequestRows(owned)
}

func certificateRequestRows(objs []*unstructured.Unstructured) []CertManagerCertificateRequestInfo {
	out := make([]CertManagerCertificateRequestInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractCertManagerCertificateRequest(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetCertManagerCertificateRequest(ctx context.Context, contextName, namespace, name string) (*CertManagerCertificateRequestDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, certManagerCertificateRequestGR, namespace, name)
	if err != nil {
		return nil, err
	}
	usages, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "usages")
	isCA, _, _ := unstructured.NestedBool(obj.Object, "spec", "isCA")
	failureTime, _, _ := unstructured.NestedString(obj.Object, "status", "failureTime")
	issuerKind, _, _ := unstructured.NestedString(obj.Object, "spec", "issuerRef", "kind")
	issuerGroup, _, _ := unstructured.NestedString(obj.Object, "spec", "issuerRef", "group")
	return &CertManagerCertificateRequestDetail{
		CertManagerCertificateRequestInfo: extractCertManagerCertificateRequest(obj),
		Conditions:                        crConditions(obj),
		IssuerKind:                        issuerKind,
		IssuerGroup:                       issuerGroup,
		Usages:                            append([]string{}, usages...),
		IsCA:                              isCA,
		FailureTime:                       failureTime,
	}, nil
}

func extractCertManagerCertificateRequest(obj *unstructured.Unstructured) CertManagerCertificateRequestInfo {
	conds := crConditions(obj)
	readyStatus, readyMsg := readyCondition(conds)
	return CertManagerCertificateRequestInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		Ready:     readyStatus,
		Approved:  conditionStatusByType(conds, "Approved"),
		Denied:    conditionStatusByType(conds, "Denied"),
		Status:    readyMsg,
		Issuer:    formatIssuerRef(obj),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Order (ACME)
// ---------------------------------------------------------------------------

// CertManagerOrderInfo is the row shape for ACME Orders. Orders track state
// through .status.state (pending / ready / valid / invalid / errored /
// expired) rather than metav1 conditions; Reason carries the failure detail.
type CertManagerOrderInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	State     string `json:"state"`
	Reason    string `json:"reason"`
	DNSNames  string `json:"dnsNames"`
	CreatedAt string `json:"createdAt"`
}

type CertManagerOrderDetail struct {
	CertManagerOrderInfo
	CommonName     string   `json:"commonName"`
	DNSNameList    []string `json:"dnsNameList"`
	URL            string   `json:"url"`
	FinalizeURL    string   `json:"finalizeURL"`
	Authorizations int      `json:"authorizations"`
	FailureTime    string   `json:"failureTime"`
}

func (m *ClientManager) ListCertManagerOrders(contextName, namespace string) []CertManagerOrderInfo {
	objs := m.listServedCRs(contextName, certManagerOrderGR, namespace)
	return orderRows(objs)
}

// CertManagerOrdersFor returns the Orders owned by the named
// CertificateRequest — the ACME leg of the chain.
func (m *ClientManager) CertManagerOrdersFor(contextName, namespace, requestName string) []CertManagerOrderInfo {
	objs := m.listServedCRs(contextName, certManagerOrderGR, namespace)
	owned := make([]*unstructured.Unstructured, 0, len(objs))
	for _, obj := range objs {
		if ownedBy(obj, "CertificateRequest", requestName) {
			owned = append(owned, obj)
		}
	}
	return orderRows(owned)
}

func orderRows(objs []*unstructured.Unstructured) []CertManagerOrderInfo {
	out := make([]CertManagerOrderInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractCertManagerOrder(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetCertManagerOrder(ctx context.Context, contextName, namespace, name string) (*CertManagerOrderDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, certManagerOrderGR, namespace, name)
	if err != nil {
		return nil, err
	}
	commonName, _, _ := unstructured.NestedString(obj.Object, "spec", "commonName")
	dnsNames, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "dnsNames")
	url, _, _ := unstructured.NestedString(obj.Object, "status", "url")
	finalizeURL, _, _ := unstructured.NestedString(obj.Object, "status", "finalizeURL")
	failureTime, _, _ := unstructured.NestedString(obj.Object, "status", "failureTime")
	authz, _, _ := nestedSliceNoCopy(obj.Object, "status", "authorizations")
	return &CertManagerOrderDetail{
		CertManagerOrderInfo: extractCertManagerOrder(obj),
		CommonName:           commonName,
		DNSNameList:          append([]string{}, dnsNames...),
		URL:                  url,
		FinalizeURL:          finalizeURL,
		Authorizations:       len(authz),
		FailureTime:          failureTime,
	}, nil
}

func extractCertManagerOrder(obj *unstructured.Unstructured) CertManagerOrderInfo {
	state, _, _ := unstructured.NestedString(obj.Object, "status", "state")
	reason, _, _ := unstructured.NestedString(obj.Object, "status", "reason")
	dnsNames, _, _ := unstructured.NestedStringSlice(obj.Object, "spec", "dnsNames")
	return CertManagerOrderInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		State:     state,
		Reason:    reason,
		DNSNames:  joinTrim(dnsNames, 3),
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Challenge (ACME)
// ---------------------------------------------------------------------------

// CertManagerChallengeInfo is the row shape for ACME Challenges — the leaf of
// the issuance chain where the real failure (DNS-01 / HTTP-01 self-check,
// propagation, rate limit) is reported in .status.reason.
type CertManagerChallengeInfo struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	State     string `json:"state"`
	Type      string `json:"type"`
	DNSName   string `json:"dnsName"`
	Reason    string `json:"reason"`
	CreatedAt string `json:"createdAt"`
}

type CertManagerChallengeDetail struct {
	CertManagerChallengeInfo
	Token            string `json:"token"`
	Wildcard         bool   `json:"wildcard"`
	Presented        bool   `json:"presented"`
	Processing       bool   `json:"processing"`
	AuthorizationURL string `json:"authorizationURL"`
}

func (m *ClientManager) ListCertManagerChallenges(contextName, namespace string) []CertManagerChallengeInfo {
	objs := m.listServedCRs(contextName, certManagerChallengeGR, namespace)
	return challengeRows(objs)
}

// CertManagerChallengesFor returns the Challenges owned by the named Order.
func (m *ClientManager) CertManagerChallengesFor(contextName, namespace, orderName string) []CertManagerChallengeInfo {
	objs := m.listServedCRs(contextName, certManagerChallengeGR, namespace)
	owned := make([]*unstructured.Unstructured, 0, len(objs))
	for _, obj := range objs {
		if ownedBy(obj, "Order", orderName) {
			owned = append(owned, obj)
		}
	}
	return challengeRows(owned)
}

func challengeRows(objs []*unstructured.Unstructured) []CertManagerChallengeInfo {
	out := make([]CertManagerChallengeInfo, 0, len(objs))
	for _, obj := range objs {
		out = append(out, extractCertManagerChallenge(obj))
	}
	sortByNamespaceName(out, func(i int) (string, string) { return out[i].Namespace, out[i].Name })
	return out
}

func (m *ClientManager) GetCertManagerChallenge(ctx context.Context, contextName, namespace, name string) (*CertManagerChallengeDetail, error) {
	obj, err := m.getServedCR(ctx, contextName, certManagerChallengeGR, namespace, name)
	if err != nil {
		return nil, err
	}
	token, _, _ := unstructured.NestedString(obj.Object, "spec", "token")
	wildcard, _, _ := unstructured.NestedBool(obj.Object, "spec", "wildcard")
	authzURL, _, _ := unstructured.NestedString(obj.Object, "spec", "authorizationURL")
	presented, _, _ := unstructured.NestedBool(obj.Object, "status", "presented")
	processing, _, _ := unstructured.NestedBool(obj.Object, "status", "processing")
	return &CertManagerChallengeDetail{
		CertManagerChallengeInfo: extractCertManagerChallenge(obj),
		Token:                    token,
		Wildcard:                 wildcard,
		Presented:                presented,
		Processing:               processing,
		AuthorizationURL:         authzURL,
	}, nil
}

func extractCertManagerChallenge(obj *unstructured.Unstructured) CertManagerChallengeInfo {
	state, _, _ := unstructured.NestedString(obj.Object, "status", "state")
	reason, _, _ := unstructured.NestedString(obj.Object, "status", "reason")
	chType, _, _ := unstructured.NestedString(obj.Object, "spec", "type")
	dnsName, _, _ := unstructured.NestedString(obj.Object, "spec", "dnsName")
	return CertManagerChallengeInfo{
		Name:      obj.GetName(),
		Namespace: obj.GetNamespace(),
		State:     state,
		Type:      chType,
		DNSName:   dnsName,
		Reason:    reason,
		CreatedAt: obj.GetCreationTimestamp().UTC().Format(time.RFC3339),
	}
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// ownedBy reports whether obj carries an ownerReference of the given kind and
// name — the link cert-manager stamps down each step of the issuance chain
// (Certificate → CertificateRequest → Order → Challenge).
func ownedBy(obj *unstructured.Unstructured, kind, name string) bool {
	for _, ref := range obj.GetOwnerReferences() {
		if ref.Kind == kind && ref.Name == name {
			return true
		}
	}
	return false
}

// joinTrim joins up to max strings with ", ", appending "+N" when more remain,
// so a long dnsNames list stays a fixed-width table cell.
func joinTrim(items []string, max int) string {
	if len(items) <= max {
		return strings.Join(items, ", ")
	}
	return strings.Join(items[:max], ", ") + fmt.Sprintf(" +%d", len(items)-max)
}

// formatIssuerRef collapses .spec.issuerRef into "Kind/name" (or just name
// when kind is the default Issuer). Empty when issuerRef is absent.
func formatIssuerRef(obj *unstructured.Unstructured) string {
	name, _, _ := unstructured.NestedString(obj.Object, "spec", "issuerRef", "name")
	if name == "" {
		return ""
	}
	kind, _, _ := unstructured.NestedString(obj.Object, "spec", "issuerRef", "kind")
	if kind == "" || kind == "Issuer" {
		return name
	}
	return kind + "/" + name
}

// issuerType reports which provider block an Issuer/ClusterIssuer spec
// carries. cert-manager's spec is a one-of, so the first present key wins.
func issuerType(obj *unstructured.Unstructured) string {
	spec, found, _ := nestedMapNoCopy(obj.Object, "spec")
	if !found {
		return ""
	}
	for _, t := range []string{"acme", "ca", "vault", "selfSigned", "venafi"} {
		if _, ok := spec[t]; ok {
			return t
		}
	}
	return ""
}
