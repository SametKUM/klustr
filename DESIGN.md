# Klustr interface conventions

## Context and direction

Klustr is a dense desktop data tool for Kubernetes operators. The interface is technical, compact, explicit and consistent. Its visual essence is resources, relationships, status. The existing resource tables and detail panels are the reference for integration screens.

## Typography and tokens

Use the existing Geist Variable body and heading font, and the application's monospace stack for resource names and identifiers. Preserve the existing text-xs, text-sm and text-base hierarchy, four-pixel spacing scale and Tailwind v4/shadcn token adapter.

Colors and theme overrides are defined in frontend/src/style.css and frontend/src/features/_shared/themes.ts. Integration screens use background, card, foreground, muted-foreground, border, ring and destructive tokens. Readiness is shown with text-bearing condition pills. Screens inherit all existing light and dark themes.

## Components and states

Resource details use a resizable inspector beside the live list. The inspector can fill the workspace when expanded or when the available width cannot fit both panes. Keep one mounted detail instance across layout changes so logs, terminal sessions and editor drafts survive resizing. Preserve the list's filter, scroll position and pagination. Compact list columns are temporary and never overwrite saved table preferences. Show the inspected row independently from bulk selection.

Retain reading tabs between resources of the same kind, integration tabs included. Terminal tabs require explicit navigation for each new resource. Guard navigation away from an unapplied YAML draft with Keep editing / Discard changes. Keep source context and namespace visible in every inspector header. Detail grids respond to the inspector's width rather than the window's width.

Browse the current filtered and sorted result set from the inspector, including across list pages and in expanded mode. The counter refers to the complete filtered set. Reveal the chosen resource's current page when navigation completes; informer updates during a draft decision must not change the intended target. Hide result navigation when the inspected resource is outside the current results. Keep this derived navigation local to the workspace rather than creating a global store.

Back navigation restores the previous reading tab without reconnecting terminal tabs. Back history records references followed from the inspector; opening a row from the list, including from its context menu, starts a new history. Unchanged view, context and tab selections preserve the editor without prompting. Show unapplied YAML status in the header, identify the resource and context in discard decisions, and return cancelled navigation to the editor. Confirming a discard drops the draft even when the editor stays open, and closing after a delete or uninstall skips the prompt. Reset inspector width by double-clicking its divider or pressing Enter while the divider is focused; a click without a drag keeps the saved width. The divider's hit area stays off the list's scrollbar. Alt+Up/Down navigates results outside editors, terminals, open menus and confirmations, and Escape closes the inspector from the list or the inspector under the same conditions. A held arrow key opens only the resource it stops on. A selection change closes confirmations opened from the inspector header rather than retargeting them.

Treat explicit tab and container links as navigation requests, including repeated destinations after manual selection. Passive resource updates preserve the user's container choice. Keep visited log and exec sessions mounted during same-resource navigation. While a requested Policy report is unavailable, show Overview; a delayed report must not override subsequent manual tab navigation. A Pod search jump changes the list view and inspected resource together after any draft decision. Explicit inspector closing returns focus to its row, including after discarding a draft; sidebar and context navigation retain their own focus.

Preserve the list search when a namespace is empty, and clear it when the context set changes. Distinguish an empty source list from results hidden by filters; offer Clear filters for the latter without changing the namespace or open inspector.

Inspector tab strips scroll horizontally only when their tabs exceed the available width. Keep their scrollbar hidden without disabling scrolling so native scrollbars cannot squeeze the tab labels. Hide the unused underline decoration in the default boxed variant so it cannot create vertical overflow.

Log toolbars use two stable rows. Group the container picker, a self-describing line-count picker and the previous-instance toggle on the first row, with stream status at the end. Keep related source settings adjacent; do not cap a picker inside a growing field and leave an internal gap. Long names truncate and remain available in tooltips. The second row holds a flexible filter with its regex toggle inside the field, followed by Pause/Resume, Wrap and an overflow menu for Save logs and Clear view. Reveal action labels when the toolbar itself is wide enough; keep accessible names and tooltips at every width. Reserve the same action widths for Pause and Resume, and show buffered counts beside stream status so pausing never shifts the filter. Use the same toolbar for individual and workload logs.

Previous container logs remain a labeled, outlined action at every inspector width. Use the primary selected treatment and a previous status indicator while viewing a terminated instance, so historical output cannot be mistaken for a live stream. Explain the disabled state when the container has never restarted. At narrow widths, hide the redundant Container caption before hiding an important action label; the picker keeps its accessible name and selected-name tooltip.

Resource lists use CustomResourceTable, existing column sizes, context tagging and persisted table preferences. Detail panels use Section, Field, Th and Td. Relations retain the selected resource's context, namespace and discovered API version. Reference buttons show focus, pending and error states, and stop row-click propagation.

Use labeled numerical values with tabular numerals. Empty, loading and error states come from the shared resource components. Use borders for section boundaries and retain existing density. Add no decorative imagery or new motion.

## Accessibility and audit

Use semantic tables and buttons, visible focus and text alongside status colors. Reuse the existing dialog focus management. New references have a minimum 24-pixel height. Verify integration screens in both light and dark modes; report unavailable native previews separately.

The four integration lists and four detail screens were rendered with sample data in the default light and dark themes. Native Wails startup was verified with an empty kubeconfig and the host's WebKit 4.1 build tag. Reference navigation tests cover source context, explicit namespace, discovered API version, permission failure, suspension state and stale requests. Existing typography, theme tokens and table density are retained intentionally.

The inspector and log toolbar were checked in the native Linux Wails window with WebKit 4.1, in light and dark themes, at inspector widths from 480px to 960px and in the full-width fallback. Other operating systems still require native verification.

## Changelog

- 2026-10-20: Close header confirmations when the inspected resource changes and keep shortcuts from acting behind confirmations. Let Overview settle a pending Policy tab, keep focus on the result navigation buttons, open only the row a held arrow stops on, and keep custom resource status columns in compact lists. Keep a pending Policy tab across resources, keep list-cell links out of Back history, leave focus outside the workspace when the inspector fills it, and keep the destination of an open discard decision.

- 2026-10-19: Keep list actions out of Back history, retain integration tabs and pending Policy tabs for every kind, drop discarded drafts, close removed resources without the draft prompt, protect the saved inspector width and the list scrollbar, and clear searches on context changes. Condense the inspector verification notes.

- 2026-10-18: Resolve repeated inspector navigation requests, unavailable Pod Policy tabs, deferred search destinations and focus restoration without reconnecting existing sessions.

- 2026-10-18: Keep Previous visibly labeled at every width and distinguish previous-instance output from live logs.

- 2026-10-18: Use a compact two-row console toolbar for pod and workload logs, integrate regex into filtering, and move Save/Clear into an overflow menu. Keep source controls adjacent and reveal action labels by container width.

- 2026-10-18: Add contextual result navigation, reading-tab history, visible draft status, editor focus recovery and divider reset. Preserve searches across empty namespaces and make filtered empty states recoverable.

- 2026-10-18: Add the resource inspector layout, compact lists, keyboard focus rules and draft navigation protection. Keep Helm actions accessible in narrow inspectors and retain reading tabs between resources. Preserve existing Geist typography, semantic theme tokens, four-pixel spacing and restrained borders.

- 2026-10-11: Record existing interface conventions for EC2NodeClass and Flux image integration screens.

