# Klustr interface conventions

## Context and direction

Klustr is a dense desktop data tool for Kubernetes operators. The interface is technical, compact, explicit and consistent. Its visual essence is resources, relationships, status. The existing resource tables and detail panels are the reference for integration screens.

## Typography and tokens

Use the existing Geist Variable body and heading font, and the application's monospace stack for resource names and identifiers. Preserve the existing text-xs, text-sm and text-base hierarchy, four-pixel spacing scale and Tailwind v4/shadcn token adapter.

Colors and theme overrides are defined in frontend/src/style.css and frontend/src/features/_shared/themes.ts. Integration screens use background, card, foreground, muted-foreground, border, ring and destructive tokens. Readiness is shown with text-bearing condition pills. Screens inherit all existing light and dark themes.

## Components and states

Resource details use a resizable inspector beside the live list. The inspector can fill the workspace when expanded or when the available width cannot fit both panes. Keep one mounted detail instance across layout changes so logs, terminal sessions and editor drafts survive resizing. Preserve the list's filter, scroll position and pagination. Compact list columns are temporary and never overwrite saved table preferences. Show the inspected row independently from bulk selection.

Retain reading tabs between resources of the same kind. Terminal tabs require explicit navigation for each new resource. Guard navigation away from an unapplied YAML draft with Keep editing / Discard changes. Keep source context and namespace visible in every inspector header. Detail grids respond to the inspector's width rather than the window's width.

Browse the current filtered and sorted result set from the inspector, including across list pages and in expanded mode. The counter refers to the complete filtered set. Reveal the chosen resource's current page when navigation completes; informer updates during a draft decision must not change the intended target. Hide result navigation when the inspected resource is outside the current results. Keep this derived navigation local to the workspace rather than creating a global store.

Back navigation restores the previous reading tab without reconnecting terminal tabs. Unchanged view, context and tab selections preserve the editor without prompting. Show unapplied YAML status in the header, identify the resource and context in discard decisions, and return cancelled navigation to the editor. Reset inspector width by double-clicking its divider or pressing Enter while the divider is focused. Alt+Up/Down navigates results outside editors, terminals and open menus.

Preserve the list search when a namespace is empty. Distinguish an empty source list from results hidden by filters; offer Clear filters for the latter without changing the namespace or open inspector.

Inspector tab strips scroll horizontally only when their tabs exceed the available width. Keep their scrollbar hidden without disabling scrolling so native scrollbars cannot squeeze the tab labels. Hide the unused underline decoration in the default boxed variant so it cannot create vertical overflow.

Resource lists use CustomResourceTable, existing column sizes, context tagging and persisted table preferences. Detail panels use Section, Field, Th and Td. Relations retain the selected resource's context, namespace and discovered API version. Reference buttons show focus, pending and error states, and stop row-click propagation.

Use labeled numerical values with tabular numerals. Empty, loading and error states come from the shared resource components. Use borders for section boundaries and retain existing density. Add no decorative imagery or new motion.

## Accessibility and audit

Use semantic tables and buttons, visible focus and text alongside status colors. Reuse the existing dialog focus management. New references have a minimum 24-pixel height. Verify integration screens in both light and dark modes; report unavailable native previews separately.

The four integration lists and four detail screens were rendered with sample data in the default light and dark themes. Native Wails startup was verified with an empty kubeconfig and the host's WebKit 4.1 build tag. Reference navigation tests cover source context, explicit namespace, discovered API version, permission failure, suspension state and stale requests. Existing typography, theme tokens and table density are retained intentionally.

Inspector verification uses the native Linux Wails window with WebKit 4.1 and an isolated local kind cluster. Checks cover live pod logs, exec connection preservation and cleanup, same-pod container links, aggregated source-context routing, namespace filtering, retained list scroll, keyboard navigation, Helm History navigation and generic custom-resource YAML. A real ConfigMap edit passes server-side dry-run and applies through the review dialog. Light and dark themes are inspected in narrow, default and wide windows; compact tables account for the native scrollbar width. Headless regressions cover draft navigation, session lifetime, focus restoration and resize cleanup. Other operating systems still require native verification.

Follow-up verification uses a separate native window restricted to the local kind kubeconfig. Result navigation crosses real pagination boundaries, works at the minimum 480px split width and survives full-width fallback. Tests cover source context and discovered API versions, draft confirmation during live row changes, preserved filters across empty namespaces, safe reading-tab history, and focus returning to Monaco after Keep editing. Existing typography, semantic colors, density and restrained motion remain the reference.

## Changelog

- 2026-10-18: Add contextual result navigation, reading-tab history, visible draft status, editor focus recovery and divider reset. Preserve searches across empty namespaces and make filtered empty states recoverable.

- 2026-10-18: Add the resource inspector layout, compact lists, keyboard focus rules and draft navigation protection. Keep Helm actions accessible in narrow inspectors and retain reading tabs between resources. Preserve existing Geist typography, semantic theme tokens, four-pixel spacing and restrained borders.

- 2026-10-11: Record existing interface conventions for EC2NodeClass and Flux image integration screens.

