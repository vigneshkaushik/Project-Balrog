---
title: Structural Beam × Electrical Cable Tray
category: Structural_x_MEP
elements: ["Structural Beam", "Electrical Cable Tray"]
applies_when: Cable tray routing conflicts with structural beam; bend radius and cable segregation must be preserved.
severity_default: MEDIUM
---

## Anchor constraint

Structural beam is immovable. Cable trays are highly flexible — they can be re-routed, split, bridged, and repositioned with relatively low impact to the electrical design, provided cable bend radius and segregation rules (HV/LV/data/fire) are maintained.

## Recommended resolutions (ranked)

### 1. Route tray through beam web aperture

**Effort:** Medium.

For perforated or ladder trays up to 300mm wide and 75mm deep: core drill or form an opening in the beam web (same web penetration rules apply as for pipes). Sleeve the opening. Tray must be independently supported on both sides of the beam — the beam edge cannot be a tray support. Maintain min 50mm clearance from tray top to beam flange.

**Checks:**

- [ ] SE confirmation for tray-size opening at this location
- [ ] Cable bend radius not violated at penetration edges
- [ ] Tray supports within 300mm of each side of penetration
- [ ] If HV/MV cables: additional fire/safety review required for routed section

### 2. Step tray below beam soffit

**Effort:** Low.

Drop the tray below the beam soffit using a formed step-down (vertical run → horizontal run). Requires 2 × 90° bends + a short vertical run. Ensure total transition fits within plenum void. Check other services below beam are clear of the step-down path. Minimum 150mm clearance from bottom of tray to ceiling line.

**Checks:**

- [ ] Headroom below beam soffit for transition confirmed
- [ ] Other services below beam clear of tray step-down
- [ ] Cable bend radius at bends meets manufacturer spec

### 3. Split tray into two narrower trays flanking beam

**Effort:** Medium.

Split single wide tray into two narrower trays (e.g., 300mm → 2 × 150mm), routing each flank of the beam web. Rejoin after beam. Maintain HV/LV segregation across the split. Ensure fill ratio on each split tray does not exceed 40%.

**Checks:**

- [ ] Cable segregation rules maintained across split confirmed by electrical engineer
- [ ] Fill ratio on each split tray checked after redistribution
- [ ] Flanking clearance ≥ 50mm from beam web each side

## Validate before acting

- [ ] Identify cable types in tray (HV, LV, data, fire) — segregation governs all splitting decisions
- [ ] Check tray fill ratio before splitting — may already be near capacity
- [ ] Confirm beam web has no pre-existing penetrations nearby
- [ ] Identify if clash is at hanger/support location (the tray hanger, not tray body, may be the actual clash)

## Escalate immediately if

- Tray carries HV/MV cables — routing through beam web requires additional fire/safety review and potentially authority approval
- Multiple trays clashing with same beam — zone coordination drawing for this section is required, not individual clash resolutions

## Downstream risk if unresolved

Cable trays are often installed before cables are pulled. Resolving after cable installation means removing all cables, modifying the tray, and re-pulling — extremely labour-intensive. Resolve before tray fabrication drawings are issued.
