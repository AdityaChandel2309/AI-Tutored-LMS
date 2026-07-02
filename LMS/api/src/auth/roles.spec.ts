import { deriveEffectiveRoles } from './roles';

describe('deriveEffectiveRoles', () => {
  it('makes everyone an employee', () => {
    expect(deriveEffectiveRoles([])).toEqual(['employee']);
    expect(deriveEffectiveRoles(undefined)).toEqual(['employee']);
    expect(deriveEffectiveRoles(['learner'])).toEqual(['learner', 'employee']);
  });

  it('treats admins as learners and employees', () => {
    expect(deriveEffectiveRoles(['admin'])).toEqual([
      'admin',
      'learner',
      'employee',
    ]);
  });

  it('treats instructors as learners and employees', () => {
    expect(deriveEffectiveRoles(['instructor'])).toEqual([
      'instructor',
      'learner',
      'employee',
    ]);
  });

  it('supports the admin + instructor overlap', () => {
    expect(deriveEffectiveRoles(['admin', 'instructor'])).toEqual([
      'admin',
      'instructor',
      'learner',
      'employee',
    ]);
  });

  it('expands super_admin into admin and learner', () => {
    expect(deriveEffectiveRoles(['super_admin'])).toEqual([
      'super_admin',
      'admin',
      'learner',
      'employee',
    ]);
  });

  it('normalizes casing/whitespace and drops unknown roles', () => {
    expect(deriveEffectiveRoles([' Admin ', 'bogus', 'INSTRUCTOR'])).toEqual([
      'admin',
      'instructor',
      'learner',
      'employee',
    ]);
  });

  it('is idempotent and de-duplicated', () => {
    const once = deriveEffectiveRoles(['admin', 'learner', 'employee']);
    expect(once).toEqual(['admin', 'learner', 'employee']);
    expect(deriveEffectiveRoles(once)).toEqual(once);
  });
});
