---
title: HVAC Duct × Gravity Drainage Pipe
category: MEP_x_MEP
elements: ["HVAC Duct", "Gravity Drainage Pipe"]
applies_when: Duct crosses sloped gravity drain; drainage is anchor; duct must not force drain raises.
severity_default: HIGH
---

## Anchor constraint

Gravity drainage always has priority — slope dependency makes it the immovable element. Duct yields in all cases. Do not propose raising the drain to clear the duct; this will invalidate the hydraulic design for every outlet upstream.

## Recommended resolutions (ranked)

### 1. Duct transitions to pass above or alongside drainage pipe

**Effort:** Low.

Insert duct height or width transition to clear the drainage pipe. The duct must pass ABOVE the drainage pipe — never below (condensation drip risk from duct onto drainage pipe insulation). Calculate duct velocity in transition zone. Confirm transition fits within plenum void with clearances.

**Checks:**

- [ ] Duct passes above drainage pipe (not below)
- [ ] Velocity in transition does not exceed NR noise limit
- [ ] Transition fits within plenum void with min 50mm clearance to drainage pipe OD + insulation

### 2. Duct reroutes around drainage run

**Effort:** Medium.

If transition cannot clear the drainage, reroute the duct around the drainage run. Quantify additional duct length and pressure drop. Mechanical engineer to confirm system balance. Check new duct route for secondary clashes.

**Checks:**

- [ ] Mechanical engineer to recheck pressure drop
- [ ] New duct route modelled for secondary clashes
- [ ] Confirm new route does not cross fire compartment without damper

## Validate before acting

- [ ] Confirm drainage invert levels and slope direction before finalising duct route
- [ ] Identify all drainage outlets served by this run — the run cannot be raised or re-sloped without affecting every fixture
- [ ] Check if drainage is cast-in or suspended — resolution options differ significantly

## Escalate immediately if

- Drainage and duct are on a collision course across a long run — indicates a fundamental zone routing conflict that must be re-planned at design level

## Downstream risk if unresolved

Drainage routing should be finalised and modelled first, before HVAC duct routes are locked. If this sequence was not followed, expect multiple drainage-MEP clashes across the floor plate.
