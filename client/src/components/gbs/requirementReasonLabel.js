export function requirementReasonLabel(reason) {
  if (reason === 'wy_close_llc_out_of_scope') return 'Close LLC is outside this first pack.';
  if (reason === 'name_suffix_invalid') return 'The proposed name needs a Wyoming LLC ending such as LLC.';
  if (reason === 'ra_physical_street_required') return 'Registered office needs a physical Wyoming street address.';
  if (reason === 'ra_state_must_be_wy') return 'Registered office state must be Wyoming.';
  if (reason === 'ra_written_consent_missing') return 'Provider preparation pending: registered agent written consent.';
  if (reason === 'filing_method_missing') return 'Provider preparation pending: filing method.';
  if (reason === 'provider_registered_agent_capability_required') {
    return 'A Provider cannot be the Wyoming registered agent in this pack.';
  }
  if (reason === 'organizer_print_name_missing') return 'Provider preparation pending: organizer name.';
  if (reason === 'professional_authority_invalid') return 'Provider preparation pending.';
  if (String(reason).startsWith('fact_missing:')) {
    return `Missing information: ${String(reason).slice('fact_missing:'.length).replace(/_/g, ' ')}`;
  }
  if (String(reason).startsWith('check_missing:')) return 'Provider preparation pending.';
  return 'Missing information required for STRIDETO pre-submission preparation.';
}
