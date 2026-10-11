# Klustr interface conventions

## Context and direction

Klustr is a dense desktop data tool for Kubernetes operators. The interface is technical, compact, explicit and consistent. Its visual essence is resources, relationships, status. The existing resource tables and detail panels are the reference for integration screens.

## Typography and tokens

Use the existing Geist Variable body and heading font, and the application's monospace stack for resource names and identifiers. Preserve the existing text-xs, text-sm and text-base hierarchy, four-pixel spacing scale and Tailwind v4/shadcn token adapter.

Colors and theme overrides are defined in frontend/src/style.css and frontend/src/features/_shared/themes.ts. Integration screens use background, card, foreground, muted-foreground, border, ring and destructive tokens. Readiness is shown with text-bearing condition pills. Screens inherit all existing light and dark themes.

## Components and states

Resource lists use CustomResourceTable, existing column sizes, context tagging and persisted table preferences. Detail panels use Section, Field, Th and Td. Relations retain the selected resource's context, namespace and discovered API version. Reference buttons show focus, pending and error states, and stop row-click propagation.

Use labeled numerical values with tabular numerals. Empty, loading and error states come from the shared resource components. Use borders for section boundaries and retain existing density. Add no decorative imagery or new motion.

## Accessibility and audit

Use semantic tables and buttons, visible focus and text alongside status colors. Reuse the existing dialog focus management. New references have a minimum 24-pixel height. Verify integration screens in both light and dark modes; report unavailable native previews separately.

The four integration lists and four detail screens were rendered with sample data in the default light and dark themes. Native Wails startup was verified with an empty kubeconfig and the host's WebKit 4.1 build tag. Reference navigation tests cover source context, explicit namespace, discovered API version, permission failure, suspension state and stale requests. Existing typography, theme tokens and table density are retained intentionally.

## Changelog

- 2026-10-11: Record existing interface conventions for EC2NodeClass and Flux image integration screens.

