---
title: MEP Penetration × Fire-Rated Compartment Boundary
category: MEP_x_Architecture
elements: ["MEP Penetration", "Fire-Rated Compartment Boundary"]
applies_when: Any service passes through a rated wall, floor, or ceiling; fire-stopping must match test evidence.
severity_default: CRITICAL
---

## Anchor constraint

Fire compartment boundaries (fire-rated walls, floors, and ceilings) are absolute. Every MEP penetration must be sealed with an approved fire-stopping system that maintains the full fire rating of the boundary. No exceptions. No exceptions for small pipes. No exceptions for temporary conditions.

## Recommended resolutions (ranked)

### 1. Intumescent collar/sleeve for plastic pipes

**Effort:** Low.

For plastic pipes (PVC, CPVC, HDPE, PPR) through fire-rated elements: specify intumescent collars that expand on heat and crush/seal the pipe. Size must match pipe OD exactly and match wall/floor thickness. Brand, product reference, and installation method must match the fire test certification exactly (EI60, EI90, EI120 etc.). Installer must be trained/certified for the specific system. Issue a fire stopping schedule drawing listing every penetration location, element rating, pipe spec, and fire stop product reference.

**Checks:**

- [ ] Fire rating of element being penetrated confirmed
- [ ] Correct intumescent collar for pipe material, size, and element thickness specified
- [ ] Fire stopping schedule issued to contractor before MEP installation begins
- [ ] Installer certification confirmed for specified system

### 2. Fire/smoke damper at HVAC duct penetration

**Effort:** Medium.

For HVAC ducts penetrating fire-rated walls or floors: install a fire/smoke damper at the penetration. Damper must match the element fire rating (EI60, EI90, EI120) and be tested for the duct size and airflow direction. Damper requires an access panel in the ceiling/wall for maintenance and testing (min 600×600mm for body access). Specify actuator type (spring-return thermal, electric, pneumatic) and BMS/fire alarm interface.

**Checks:**

- [ ] Damper type and rating matches element rating (60/90/120 min)
- [ ] Access panel specified, coordinated with architectural finish, and shown on RCP
- [ ] BMS/fire alarm interface confirmed with electrical engineer
- [ ] Damper is accessible for annual testing

### 3. Intumescent sealant/batt for metal pipes and cables

**Effort:** Low.

For steel pipes, copper pipes, and cable bundles through fire-rated elements: use intumescent putty, batt, or sealant systems around the service at the penetration. Detail must match the fire test certification for the specific service size and element rating. Allow a minimum curing period before the wall/floor is loaded (typically 24–72 hours depending on product).

**Checks:**

- [ ] Product tested for this service type and size
- [ ] Curing period respected before element is loaded
- [ ] Penetration sealed on both faces of the element where required by the test evidence

## Validate before acting

- [ ] Obtain fire compartment layout drawings from architect — confirm every wall and floor rating at each penetration location
- [ ] Identify service material at each penetration — different materials require entirely different fire stop systems
- [ ] Confirm fire stopping installer is trained and certified for each specified product — incorrect installation invalidates the system

## Escalate immediately if

- Any MEP penetration discovered without fire stopping post-construction — fire authority notification may be required and occupation permit may be at risk
- Penetration is in a smoke barrier wall — smoke sealing adds requirements beyond fire stopping

## Downstream risk if unresolved

Unfire-stopped MEP penetrations through compartment boundaries are a building defect that can invalidate the Occupation Permit and fire certificate. These must be inspected, documented, and closed out before handover — fire authorities increasingly conduct penetration audits as part of their inspection process.
