package kube

import (
	"context"
	"fmt"

	certv1 "k8s.io/api/certificates/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ApproveCSR appends an Approved condition through the /approval subresource.
// Reason is set to "KlustrApproved" so a later look at the CSR shows the
// approval did not come from kubectl or a controller. Errors out when the CSR
// is already approved or denied — approval is meant to be terminal.
func (m *ClientManager) ApproveCSR(ctx context.Context, contextName, name, message string) error {
	return m.patchCSRApproval(ctx, contextName, name, certv1.CertificateApproved, "KlustrApproved", message, "Approved by Klustr.")
}

// DenyCSR is the mirror of ApproveCSR using a Denied condition.
func (m *ClientManager) DenyCSR(ctx context.Context, contextName, name, message string) error {
	return m.patchCSRApproval(ctx, contextName, name, certv1.CertificateDenied, "KlustrDenied", message, "Denied by Klustr.")
}

func (m *ClientManager) patchCSRApproval(
	ctx context.Context,
	contextName, name string,
	condType certv1.RequestConditionType,
	reason, userMessage, defaultMessage string,
) error {
	cs, err := m.Clientset(contextName)
	if err != nil {
		return err
	}
	csr, err := cs.CertificatesV1().CertificateSigningRequests().Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	for _, c := range csr.Status.Conditions {
		if c.Status != corev1.ConditionTrue {
			continue
		}
		switch c.Type {
		case certv1.CertificateApproved:
			return fmt.Errorf("CSR %q is already approved", name)
		case certv1.CertificateDenied:
			return fmt.Errorf("CSR %q is already denied", name)
		}
	}
	msg := userMessage
	if msg == "" {
		msg = defaultMessage
	}
	now := metav1.Now()
	csr.Status.Conditions = append(csr.Status.Conditions, certv1.CertificateSigningRequestCondition{
		Type:               condType,
		Status:             corev1.ConditionTrue,
		Reason:             reason,
		Message:            msg,
		LastUpdateTime:     now,
		LastTransitionTime: now,
	})
	_, err = cs.CertificatesV1().CertificateSigningRequests().UpdateApproval(ctx, name, csr, metav1.UpdateOptions{})
	return err
}
