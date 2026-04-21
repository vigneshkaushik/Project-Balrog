---
title: HVAC Main Duct × HVAC Main Duct
category: MEP_x_MEP
elements: ["HVAC Main Duct", "HVAC Main Duct"]
applies_when: Two air mains occupy the same routing zone; neither automatically yields; system priority and coordinated sections apply.
severity_default: HIGH
---

## Anchor constraint

Both are mains, so neither automatically yields. Apply system priority: supply air main > return air main > exhaust air main > toilet exhaust. The duct serving the larger area or with the longer AHU run has less rerouting flexibility.

## Recommended resolutions (ranked)

### 1. Vertical stacking in priority order

**Effort:** Medium.

Stack ducts vertically in the plenum: supply at highest elevation, return below, exhaust below that. Calculate total stack depth including hanger hardware (min 50mm above top duct, 50mm below bottom duct). Confirm structural supports are designed for combined load. Produce a coordinated section drawing at the clash location before any duct fabrication.

**Checks:**

- [ ] Plenum void depth accommodates full services stack with clearances
- [ ] Combined service weight checked against slab hanger capacity
- [ ] Hanger spacing for lower duct does not conflict with upper duct body
- [ ] Coordinated section drawing issued before fabrication

### 2. Transition to circular/oval duct in clash zone

**Effort:** Medium.

Where rectangular ducts clash due to depth, transition one or both to circular or oval duct of equivalent cross-section. Circular ducts have a smaller height footprint for the same airflow and can pass alongside or below a rectangular main. Transition fittings (rect-to-round) add pressure drop — mechanical engineer must re-check.

**Checks:**

- [ ] Mechanical engineer to recheck velocity and pressure drop in circular section
- [ ] Acoustic NR rating at increased circular duct velocity
- [ ] Transition fitting angle ≤ 15° on entry and exit to minimise turbulence loss

### 3. Reroute lower-priority duct

**Effort:** High.

Reroute the lower-priority duct (return or exhaust) around the clash zone. Quantify additional duct length (typically +2–6m) and resultant pressure drop increase. Flag to mechanical engineer for system rebalancing. Check new route does not cross a fire compartment boundary without a damper.

**Checks:**

- [ ] Mechanical engineer to assess pressure drop impact
- [ ] Check rerouted path for new clashes in full
- [ ] Confirm reroute does not cross fire compartment boundary without fire damper

## Validate before acting

- [ ] Identify which system each duct serves (AHU number, supply/return/exhaust)
- [ ] Check fire compartment boundaries — mains crossing compartments require fire/smoke dampers
- [ ] Confirm acoustic requirements in the zone — duct proximity creates flanking noise paths

## Escalate immediately if

- Both ducts are smoke extraction mains — fire code clearance requirements govern and fire engineer must be involved
- Clash indicates an MEP zone where no coordinated plenum section drawing has been produced — individual clash resolution will not be sufficient

## Downstream risk if unresolved

Resolving duct-to-duct clashes one at a time without a coordinated plenum section drawing results in repeated clashes as other services are modelled. Produce a coordinated zone section first, then resolve all clashes in that zone simultaneously.
