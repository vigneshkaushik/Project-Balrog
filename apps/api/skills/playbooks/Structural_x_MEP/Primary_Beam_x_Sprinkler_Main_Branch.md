---
title: Structural Beam × Sprinkler Main / Branch
category: Structural_x_MEP
elements: ["Structural Beam", "Sprinkler Main or Branch"]
applies_when: Sprinkler run conflicts with structural beam web or soffit; hydraulic and slope-after-activation rules apply.
severity_default: HIGH
---

## Anchor constraint

Structural beam is immovable. Sprinkler mains have slope dependency (drainage after activation) and are hydraulically sensitive. Branch lines are more flexible but head positioning must comply with maximum spacing rules.

## Recommended resolutions (ranked)

### 1. Core-drilled penetration through beam web

**Effort:** Low.

Drill a circular hole through the beam web. Pipe ≤ DN100: hole Ø = pipe OD + 25mm. Pipe DN100–DN200: SE must confirm and may require reinforcement collar plate. Always specify galvanised steel sleeve, fire collar, and intumescent sealant if penetrating a fire compartment boundary. Maintain pipe slope through the penetration (min 1:500 for drainage after activation).

**Checks:**

- [ ] SE confirmation of hole size and location
- [ ] Fire-stopping spec if compartment boundary
- [ ] Pipe slope maintained through penetration
- [ ] Check if beam web has existing penetrations nearby (cumulative risk)

### 2. Drop branch line with extended pendant drop arm

**Effort:** Low.

Drop the sprinkler branch below the beam soffit and extend the pendant drop arm to reach the required head elevation. Check maximum pendant drop arm per code: typically 300mm standard, up to 600mm for extended drop arms (NFPA 13 / local code). Verify deflector-to-ceiling clearance maintained (typically 25–75mm below ceiling finish).

**Checks:**

- [ ] Local fire code max pendant drop arm length confirmed
- [ ] Deflector-to-ceiling clearance maintained
- [ ] New branch position below beam clear of other services

### 3. Reroute sprinkler branch

**Effort:** Medium.

Reroute the branch run to avoid the beam, adjusting takeoff point from the main. If branch length increases by more than 2m, hydraulic calculations must be re-run. Confirm maximum head spacing rules are maintained. Check revised slope direction.

**Checks:**

- [ ] Fire protection engineer to recheck hydraulics
- [ ] Maximum head spacing rules confirmed
- [ ] Revised branch slope direction maintained

## Validate before acting

- [ ] Confirm beam is RC or steel (drilling method and tolerance differ significantly)
- [ ] Identify if beam web has pre-existing penetrations — cumulative weakness
- [ ] Check compartment boundary status at penetration location
- [ ] Confirm pipe schedule (thin-wall vs thick-wall affects sleeve design and penetration size)

## Escalate immediately if

- Sprinkler main is DN200+ — penetration requires major SE involvement and may be refused
- Beam is transfer or post-tensioned — no penetration permissible at all
- Multiple pipe services need to penetrate same beam at same location — each must be approved individually

## Downstream risk if unresolved

Sprinkler mains installed before this clash is resolved will be cut and modified in the field, adding significant cost and potentially violating the hydraulic design. Discover and resolve before coordination drawings are issued for tender or approval.
