export function qualifies(r, lane) {
  if (lane === 'webdev') return true;
  // Explicit operator assignments are B2B routing, never proof of consumer consent.
  if (r.source === 'manual-client-entry' && r.assigned_workers?.includes(lane)) return true;
  if (lane === 'books' && /^(books|stationery|school|college|university|library|kindergarten|educational_institution|publisher)$/.test(r.category || '')) return true;
  if (lane === 'books' && /^(restaurant|bar|cafe|fast_food|car_wash|car_repair|plumber|roofer|carpenter|fitness_centre)$/.test(r.category || '')) return false;
  if (lane === 'books' && ['beauty','hairdresser'].includes(r.category) && !/\b(school|college|academy)\b/i.test(r.name || '')) return false;
  if (lane === 'dating' && /senior|elderly|older_adults/i.test(r.source_evidence?.qualification_tags?.community_centre_for || '')) return true;
  const s = [r.name,r.category].filter(Boolean).join(' ').toLowerCase();
  const rules = {
    dating: /\b(senior center|senior centre|retirement community|older adults|senior social club|senior association|senior recreation)\b/,
    hashnomads: /\b(bitcoin|cryptocurrency|blockchain|crypto|bitcoin mining|asic miner|mining hosting)\b/,
    books: /\b(bookshop|bookstore|books|library|publisher|publishing|school|college|university|education|childcare|preschool|psychology|therapy|coaching|entrepreneurship|technology|stationery)\b/
  };
  return rules[lane]?.test(s) || false;
}
