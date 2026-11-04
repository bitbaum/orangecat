# Cat and overlay launcher placement — 2026-11-04

A real failed-history reload at 390px showed Loki's feedback tab overlapping
Cat's error card. The supplied screenshots also showed the floating launcher
above create dialogs and mobile navigation.

Use the existing widget host contract, `data-fc-place="hidden"`, on visible
Cat panels, the shared dialog content primitive and the open mobile sidebar.
The sidebar uses its existing mobile-open state; its desktop counterpart never
requests hiding. Closing/unmounting a dialog removes its directive. No observer,
modal detector, global style or per-page launcher offset is introduced.

The deployed widget's contract was exercised in Chromium by injecting/removing
the marker on the live chat root: initially visible, hidden with the marker,
restored without it. The first probe incorrectly waited for display:none;
the widget uses visibility:hidden, and the corrected visibility probe passed.
This proves the live consumer contract, not deployment of the application change.
Existing create, messaging and delete-dialog regressions passed (9 tests).
Normal hooks, CI and deployed mobile drawer/dialog/chat journeys remain required.
Native sheets outside these primitives and the real OS keyboard journey remain
in the wider review queue; this repair does not claim all overlays are audited.
