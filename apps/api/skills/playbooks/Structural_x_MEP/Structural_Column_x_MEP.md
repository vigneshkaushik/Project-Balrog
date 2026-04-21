---
title: Structural Column × Any MEP Service
category: Structural_x_MEP
elements: ["Structural Column", "Any MEP Service"]
applies_when: MEP routing appears to pass through or load a structural column; columns are absolute anchors.
severity_default: CRITICAL
aliases: [column clash, column zone mep]
---

## Anchor constraint

Structural columns are ABSOLUTE ANCHORS. No MEP service may penetrate, notch, cut, or apply structural loads to a column without SE-approved fixings. If a clash shows a service routing through a column, it is always a routing error — not a penetration opportunity. Full MEP relocation is the only valid resolution.

## Recommended resolutions (ranked)

### 1. Distinguish structural column from fire/architectural encasement

**Effort:** Low.

First verify whether the clash is against the structural column itself or against its fire protection build-up (intumescent paint, spray fireproofing, or architectural casing). Column fire protection + architectural casing can add 20–75mm around the column on all faces. If the clash is within the build-up zone only, the service can potentially pass in the gap between column face and finished casing — confirm min 50mm clearance from structural face is maintained.

**Checks:**

- [ ] Confirm column fire rating and protection method (intumescent / board / spray)
- [ ] Measure actual gap between structural face and finished casing from drawings
- [ ] Check service fits in gap with 50mm min clearance from structural face

### 2. Reroute MEP service around all four faces of column

**Effort:** Medium.

All MEP services must route around (not through) the column. Analyse available clearance on all four column sides. For large ducts and pipes, reroute around a column adds significant length — quantify and check hydraulic/pressure impact. Check if rerouting creates new clashes with services on flanking sides.

**Checks:**

- [ ] Quantify additional pipe/duct length
- [ ] Check pressure drop or flow impact (HVAC ducts and large pipes)
- [ ] Rerouted path clear of other services on all four column faces

### 3. Full zone coordination at column node

**Effort:** High.

If the column is at the intersection of multiple services — a coordination node — produce a full multi-trade section drawing showing all services and their correct priority route around the column. Resolve all services at the node simultaneously, not individually.

**Checks:**

- [ ] Zone section drawing produced and reviewed by all trade contractors
- [ ] All services in correct priority order in the section drawing
- [ ] Section approved before installation begins in this zone

## Validate before acting

- [ ] Confirm column is structural (some "columns" in arch drawings are purely decorative fins or casings)
- [ ] Check column encasement drawings for fire protection spec and build-up dimensions
- [ ] Identify ALL MEP services clashing with the same column — resolve as a package, not individually

## Escalate immediately if

- Any field proposal to notch, cut, drill, or weld to a structural column — immediate escalation to SE and PM required
- Column is a transfer column supporting multiple levels above — zero tolerance for any modification or loading
- Clash is not a routing error but a design error — structure and MEP grids were never coordinated at this column

## Downstream risk if unresolved

Field cuts to structural columns have resulted in partial structural failures on construction sites. Any such work discovered must be immediately escalated to the structural engineer and project manager. Document all instances in the project risk register.
