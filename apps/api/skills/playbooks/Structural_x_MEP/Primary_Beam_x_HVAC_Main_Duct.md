---
title: Primary Beam × HVAC Main Duct
category: Structural_x_MEP
elements: ["Primary Structural Beam", "HVAC Main Duct"]
applies_when: Primary steel or concrete beam conflicts with a main HVAC supply or return duct in a horizontal service plenum.
severity_default: HIGH
aliases: [structural beam vs duct, beam web vs main duct]
---

## Anchor constraint

Primary beam is immovable without SE approval. HVAC main duct has low-medium flexibility — resizing or offsetting is possible but affects system-wide pressure balance. The beam yields nothing; the duct engineer must find a solution.

## Recommended resolutions (ranked)

### 1. Web penetration

**Effort:** Medium.

Cut a rectangular or circular opening in the beam web. Rules: opening ≤ 40% of clear web depth; opening width ≤ 60% of web depth; min edge-to-flange = 0.25 × beam depth; min to support = 0.25 × span; min 150mm between adjacent openings. Specify formed steel sleeve + fire collar + SE sign-off. Sleeve OD = duct OD + 25mm all sides.

**Checks:**

- [ ] SE must confirm penetration location and beam loading
- [ ] Verify no PT tendons in web at penetration point
- [ ] IFC fire-stopping spec for sleeve must match compartment rating
- [ ] Check duct-to-sleeve clearance allows thermal expansion

### 2. Duct height reduction via transition

**Effort:** Low.

Insert transition pieces to reduce duct height to pass below or through the beam zone, then expand back. Velocity increase in reduced section must not exceed 20% of design velocity to avoid noise exceedance. Transition angle ≤ 15° for low noise. Minimum 500mm of reduced section before re-expanding.

**Checks:**

- [ ] Mechanical engineer to recheck system pressure drop
- [ ] Acoustic engineer to verify NR rating at transition section
- [ ] Check transition fits within plenum alongside other services

### 3. Split duct into twin runs

**Effort:** Medium.

Split single duct into two smaller ducts of equal total cross-section, routing each flank of the beam web. Rejoin after the beam. Requires equal path lengths for balanced flow. Add splitter and collector boxes. Check plenum width permits twin runs with min 50mm clearance to beam flanges on each side.

**Checks:**

- [ ] Equal path lengths confirmed for flow balance
- [ ] Total cross-section of twin ducts ≥ original duct area
- [ ] Plenum width allows twin layout with hanger clearance

### 4. Duct reroute (last resort)

**Effort:** High. **VO risk:** Yes (formal variation / redesign likely).

Reroute duct around the beam. Quantify additional duct length (typically +1.5–3m), increased pressure drop, and additional hangers. Flag to mechanical engineer for re-commissioning implications. Document via formal RFI.

**Checks:**

- [ ] Mechanical engineer to recalculate pressure drop impact
- [ ] Check rerouted path for new clashes
- [ ] Confirm reroute does not cross a fire compartment boundary without a damper

## Validate before acting

- [ ] Confirm beam type (primary/secondary/transfer) and span before recommending web penetration
- [ ] Confirm beam is not post-tensioned before any penetration proposal
- [ ] Check IFC drawings for web stiffener locations — stiffeners prohibit penetrations
- [ ] Verify plenum void height on both sides of beam is adequate for full services stack

## Escalate immediately if

- Clash is at mid-span of a transfer beam — no web penetration permissible
- Multiple clashes within 1m of each other on same beam web — cumulative weakening risk
- Duct is a fire-rated smoke duct — penetration detailing is significantly more complex
- Clash occurs at beam-to-column connection node — no modification permitted

## Downstream risk if unresolved

If unresolved before ductwork fabrication, field cuts may be made to the beam web without structural sign-off — creating a structural liability. Adjacent services (sprinklers, cable trays) in the same zone will also be impacted once one resolution is adopted. Coordinate the full plenum cross-section before any resolution is executed.
