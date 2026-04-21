---
title: Primary Beam × Gravity Drainage Pipe
category: Structural_x_MEP
elements: ["Primary Structural Beam", "Gravity Drainage Pipe"]
applies_when: Sloped gravity drainage conflicts with a primary beam; slope and structure both constrain routing.
severity_default: CRITICAL
aliases: [beam vs stack, beam vs drain]
---

## Anchor constraint

Gravity drainage is slope-dependent (1:50 for DN100, 1:80 for DN150, 1:100 for DN225+) and CANNOT be rerouted freely without affecting every outlet upstream. Structural beam is equally immovable. This is one of the highest-severity clash pairs — it is a joint design problem, not a field fix.

## Recommended resolutions (ranked)

### 1. Beam web penetration with sleeved pipe

**Effort:** Medium.

Pass drainage pipe through beam web via a formed or core-drilled hole. Hole Ø = pipe OD + 50mm minimum (drainage needs more clearance than pressurised pipes — no-contact rule with structure). Confirm drainage slope gradient is maintained THROUGH the penetration — calculate elevation difference across the beam width. Sleeve must be independently supported; pipe load must not bear on the beam penetration edge.

**Checks:**

- [ ] SE confirmation for penetration size and location at this beam
- [ ] Verify slope gradient maintained through beam — calculate EGL
- [ ] Sleeve independently supported; pipe load not transferred to beam edge
- [ ] If pressurised sewer gas scenario: sealed penetration required

### 2. Raise beam soffit via haunch (secondary beam only)

**Effort:** High. **VO risk:** Yes (formal variation / redesign likely).

If beam is secondary and headroom is non-critical (BOH or plant), propose a beam haunch or soffit raise to allow drainage to pass below. Requires architectural and structural sign-off. Only viable in areas where ceiling line is not controlled by minimum headroom.

**Checks:**

- [ ] SE approval for beam haunch profile change
- [ ] Architect to confirm ceiling height impact is acceptable
- [ ] Check revised beam profile against all other services in zone

### 3. Redesign drainage layout (last resort)

**Effort:** High. **VO risk:** Yes (formal variation / redesign likely).

If beam penetration is not possible and beam elevation is fixed, drainage must be redesigned. Plumbing engineer to re-plan outlet positions and stack connection points. Quantify: additional pipe length, revised fixture invert levels, impact on stack vertical position.

**Checks:**

- [ ] Plumbing engineer to redesign layout and resubmit hydraulic scheme
- [ ] Architect to confirm relocated floor outlet positions
- [ ] Check revised route for new clashes with other services

## Validate before acting

- [ ] Calculate precise drainage invert levels at both faces of the beam
- [ ] Confirm beam type, span, and structural classification BEFORE any recommendation
- [ ] Identify all outlets served by this run — any change affects every fixture upstream
- [ ] Check pipe type: waste, soil, or stormwater (different slope and diameter rules)

## Escalate immediately if

- Multiple drainage pipes need to cross same beam — each penetration weakens it cumulatively
- Beam is primary structure or transfer beam — no penetration available, full redesign required
- Drainage slope cannot be maintained even with penetration — elevation deficit forces full layout redesign
- Clash discovered after concrete is poured — coring is high-risk, must be SE-supervised

## Downstream risk if unresolved

Drainage and structural clashes discovered on site after concrete pours are among the most expensive AEC defects to resolve. Coring through structural beams on site without SE supervision has caused structural failures in documented cases globally. Resolve at design stage with SE sign-off in writing.
