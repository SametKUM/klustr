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

Treat explicit tab and container links as navigation requests, including repeated destinations after manual selection. Passive resource updates preserve the user's container choice. Keep visited log and exec sessions mounted during same-resource navigation. While a requested Pod Policy report is unavailable, show Overview; a delayed report must not override subsequent manual tab navigation. A Pod search jump changes the list view and inspected resource together after any draft decision. Explicit inspector closing returns focus to its row, including after discarding a draft; sidebar and context navigation retain their own focus.

Preserve the list search when a namespace is empty. Distinguish an empty source list from results hidden by filters; offer Clear filters for the latter without changing the namespace or open inspector.

Inspector tab strips scroll horizontally only when their tabs exceed the available width. Keep their scrollbar hidden without disabling scrolling so native scrollbars cannot squeeze the tab labels. Hide the unused underline decoration in the default boxed variant so it cannot create vertical overflow.

Log toolbars use two stable rows. Group the container picker, a self-describing line-count picker and the previous-instance toggle on the first row, with stream status at the end. Keep related source settings adjacent; do not cap a picker inside a growing field and leave an internal gap. Long names truncate and remain available in tooltips. The second row holds a flexible filter with its regex toggle inside the field, followed by Pause/Resume, Wrap and an overflow menu for Save logs and Clear view. Reveal action labels when the toolbar itself is wide enough; keep accessible names and tooltips at every width. Reserve the same action widths for Pause and Resume, and show buffered counts beside stream status so pausing never shifts the filter. Use the same toolbar for individual and workload logs.

Previous container logs remain a labeled, outlined action at every inspector width. Use the primary selected treatment and a previous status indicator while viewing a terminated instance, so historical output cannot be mistaken for a live stream. Explain the disabled state when the container has never restarted. At narrow widths, hide the redundant Container caption before hiding an important action label; the picker keeps its accessible name and selected-name tooltip.

Resource lists use CustomResourceTable, existing column sizes, context tagging and persisted table preferences. Detail panels use Section, Field, Th and Td. Relations retain the selected resource's context, namespace and discovered API version. Reference buttons show focus, pending and error states, and stop row-click propagation.

Use labeled numerical values with tabular numerals. Empty, loading and error states come from the shared resource components. Use borders for section boundaries and retain existing density. Add no decorative imagery or new motion.

## Accessibility and audit

Use semantic tables and buttons, visible focus and text alongside status colors. Reuse the existing dialog focus management. New references have a minimum 24-pixel height. Verify integration screens in both light and dark modes; report unavailable native previews separately.

The four integration lists and four detail screens were rendered with sample data in the default light and dark themes. Native Wails startup was verified with an empty kubeconfig and the host's WebKit 4.1 build tag. Reference navigation tests cover source context, explicit namespace, discovered API version, permission failure, suspension state and stale requests. Existing typography, theme tokens and table density are retained intentionally.

Inspector verification uses the native Linux Wails window with WebKit 4.1 and an isolated local kind cluster. Checks cover live pod logs, exec connection preservation and cleanup, same-pod container links, aggregated source-context routing, namespace filtering, retained list scroll, keyboard navigation, Helm History navigation and generic custom-resource YAML. A real ConfigMap edit passes server-side dry-run and applies through the review dialog. Light and dark themes are inspected in narrow, default and wide windows; compact tables account for the native scrollbar width. Headless regressions cover draft navigation, session lifetime, focus restoration and resize cleanup. Other operating systems still require native verification.

Follow-up verification uses a separate native window restricted to the local kind kubeconfig. Result navigation crosses real pagination boundaries, works at the minimum 480px split width and survives full-width fallback. Tests cover source context and discovered API versions, draft confirmation during live row changes, preserved filters across empty namespaces, safe reading-tab history, and focus returning to Monaco after Keep editing. Existing typography, semantic colors, density and restrained motion remain the reference.

Log toolbar verification covers thirteen inspector widths from 480px to 960px, including both sides of the action-label breakpoint, with a long container name. The toolbar stays 77px tall in two rows, including expanded workload logs. Native checks confirm aligned controls without overlap or horizontal overflow, filtering and invalid-regex recovery, buffered pause/resume, wrap toggling, keyboard access to Save/Clear and restored menu focus. Resizing keeps the existing log stream, and stream status changes preserve the filter's position and width. Light and dark themes retain the same layout. Responsive action widths change without layout animation; buffered counts remain outside live screen-reader announcements.

Previous-log verification reads a real terminated local container instance, checks the labeled action at the same thirteen widths, and returns to the current stream. Previous mode remains explicitly identified after historical output arrives. Regression coverage checks that switching to a container without restarts disables Previous and restores current-instance status and request routing.

Review regressions cover repeated tab requests for built-in, custom and Helm resources, repeated container links after manual selection, unavailable and delayed Pod policy reports, atomic search navigation through draft decisions, and scoped focus restoration. Native local-kind verification confirms real log and exec session retention, repeated container routing, continued sidebar arrow navigation, editor focus after cancelling a search jump, and row focus after confirming an inspector close. These navigation checks edit local drafts without applying them to the cluster.

## Changelog

- 2026-10-18: Resolve repeated inspector navigation requests, unavailable Pod Policy tabs, deferred search destinations and focus restoration without reconnecting existing sessions.

- 2026-10-18: Keep Previous visibly labeled at every width and distinguish previous-instance output from live logs.

- 2026-10-18: Use a compact two-row console toolbar for pod and workload logs, integrate regex into filtering, and move Save/Clear into an overflow menu. Keep source controls adjacent and reveal action labels by container width.

- 2026-10-18: Add contextual result navigation, reading-tab history, visible draft status, editor focus recovery and divider reset. Preserve searches across empty namespaces and make filtered empty states recoverable.

- 2026-10-18: Add the resource inspector layout, compact lists, keyboard focus rules and draft navigation protection. Keep Helm actions accessible in narrow inspectors and retain reading tabs between resources. Preserve existing Geist typography, semantic theme tokens, four-pixel spacing and restrained borders.

- 2026-10-11: Record existing interface conventions for EC2NodeClass and Flux image integration screens.

