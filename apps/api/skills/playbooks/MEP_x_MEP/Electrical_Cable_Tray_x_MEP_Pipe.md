---
title: Electrical Cable Tray × MEP Pipe (Any)
category: MEP_x_MEP
elements: ["Electrical Cable Tray", "MEP Pipe"]
applies_when: Cable tray and pipe compete for the same space; clearances, EMC, and moisture risks apply.
severity_default: LOW-MEDIUM
---

## Anchor constraint

Pipes generally take priority over cable trays because tray edges can damage pipe insulation and create moisture risk at contact points. HV/MV trays also require minimum clearance from pipes for thermal and EMC reasons. The cable tray yields.

## Recommended resolutions (ranked)

### 1. Vertical segregation with minimum clearance

**Effort:** Low.

Maintain minimum 150mm vertical clearance between cable tray and any MEP pipe (300mm for HV/MV trays adjacent to uninsulated pipes). Route tray ABOVE pipes wherever possible — water above electrical is a safety risk. If tray must pass below a pipe, specify a drip shield (min 500×500mm GI sheet) over the tray at the crossing to protect cables from condensation or pipe failure drips.

**Checks:**

- [ ] Cable type in tray confirmed — HV/MV requires 300mm minimum clearance from pipes
- [ ] If tray below pipe: drip shield specified and shown on MEP coordination drawing
- [ ] Check condensation risk if cold pipe (CW, refrigerant) adjacent to tray

### 2. Tray horizontal offset at clash

**Effort:** Low.

Insert a horizontal jog in the cable tray to route around the pipe in the horizontal plane. Cable tray horizontal bends require minimum bend radius: 3 × cable OD. Cables must be secured at bends to prevent movement. Confirm offset takes tray into clear space (check for other services at the offset destination).

**Checks:**

- [ ] Cable bend radius at jog corners meets spec for all cable types in tray
- [ ] Offset destination is clear of other services

### 3. Crossing at 90° with drip shield

**Effort:** Low.

If pipe and tray must cross, ensure the crossing is as close to 90° perpendicular as possible to minimise overlap area. Install drip shield over tray at the crossing. Document the crossing on the MEP coordination drawing.

**Checks:**

- [ ] Crossing angle is 90° or as close as possible
- [ ] Drip shield specified on coordination drawing

## Validate before acting

- [ ] Identify cable voltage class (LV, HV, fire, data) — each has different clearance requirements from pipes
- [ ] Check if pipe is insulated — uninsulated pipes adjacent to cable trays require more clearance
- [ ] Confirm if zone is a wet area (bathroom, plant room, kitchen) — additional protection ratings apply

## Escalate immediately if

- Tray carries fire detection/alarm cables — route and protection requirements are more stringent under fire codes
- Tray is immediately below a water-bearing pipe in a humid environment — condensation damage risk is high

## Downstream risk if unresolved

Cables damaged by dripping water from overhead pipes are a persistent maintenance callback. Even where clearances are maintained at design stage, ensure drip shields are detailed on coordination drawings and inspected at installation.
