---
title: HVAC Duct × Facade Louvre / Grille
category: MEP_x_Facade
elements: ["HVAC Duct", "Facade Louvre or Grille"]
applies_when: Duct centreline does not align with fixed louvre module; transitions or louvre moves must occur before fabrication locks.
severity_default: HIGH
---

## Anchor constraint

Facade louvre positions are architecturally fixed — visible on the building exterior, coordinated with the facade module, and structurally framed into the facade system. The HVAC duct connecting to the louvre must align with it. Louvre positions are locked once facade panels are fabricated.

## Recommended resolutions (ranked)

### 1. Flexible transition plenum at louvre connection

**Effort:** Low.

Where the duct centreline does not align with the louvre centreline, use a tapered transition piece (offset plenum box or angled elbow) to connect them. Maximum offset achievable via transition: approximately 300mm horizontal, 200mm vertical, within the wall/facade buildup zone. Beyond these limits, a full duct reroute is needed. The transition piece must fit within the wall/facade thickness — coordinate against facade and wall thickness drawings.

**Checks:**

- [ ] Transition piece fits within wall/facade buildup thickness
- [ ] No condensation pocket created by horizontal transition configuration
- [ ] Mechanical engineer confirms transition does not create unacceptable pressure drop at AHU intake/exhaust point

### 2. Relocate louvre within facade module (before fabrication)

**Effort:** Medium.

If louvre position has flexibility within the spandrel or non-glazed zone, coordinate with the facade designer to move the louvre to align with the duct. This MUST happen before facade panel fabrication — louvre positions are permanently fixed once panels are fabricated. Check: revised louvre position is above minimum height from grade (typically 2400mm for security), is architecturally acceptable, and maintains minimum separation from other louvres (recirculation risk).

**Checks:**

- [ ] Facade designer confirms louvre can move within module limits
- [ ] Revised position checked for architectural impact on elevation
- [ ] Min separation from adjacent intake/exhaust louvres maintained (recirculation risk) — typically 2000mm min vertically

### 3. Reroute HVAC duct to fixed louvre position

**Effort:** Medium.

If louvre is fixed (facade panels already fabricated or approved), reroute the HVAC duct to connect to the fixed louvre position. Mechanical engineer to confirm revised duct route does not introduce excessive pressure drop or airflow imbalance.

**Checks:**

- [ ] Mechanical engineer to check revised pressure drop
- [ ] Check revised duct route for new clashes with structure and other MEP

## Validate before acting

- [ ] Request facade fabrication programme — louvre positions are locked once panels are ordered. Resolve before this date.
- [ ] Confirm louvre is intake or exhaust — governs clearance requirements to adjacent louvres (recirculation min distances)
- [ ] Check louvre anti-rain and bird screen spec — these add depth to the louvre face that affects duct connection design

## Escalate immediately if

- Clash discovered after facade panels are fabricated — louvre relocation is now a fabrication variation at significant cost
- HVAC louvre is adjacent to a smoke exhaust louvre — minimum separation distances governed by fire code must be maintained and fire engineer must confirm

## Downstream risk if unresolved

Facade-MEP coordination clashes discovered after panel fabrication lead to very expensive facade variations. All louvre and penetration positions must be confirmed between the MEP engineer and facade subcontractor before the facade shop drawing is approved for fabrication.
