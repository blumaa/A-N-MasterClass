// In-memory tables for DATA_SOURCE=fake. REPLACED BY: Supabase tables (supabase/migrations).
import type { Grant, Member, Module, Part, Product, Profile, Space, SpaceProfile, Step, StepProgress } from '../types';

export type Db = {
  spaces: Space[];
  profiles: Profile[];
  spaceProfiles: SpaceProfile[];
  members: Member[];
  products: Product[];
  modules: Module[];
  steps: Step[];
  parts: Part[];
  grants: Grant[];
  stepProgress: StepProgress[];
};

export const emptyDb = (): Db => ({
  spaces: [],
  profiles: [],
  spaceProfiles: [],
  members: [],
  products: [],
  modules: [],
  steps: [],
  parts: [],
  grants: [],
  stepProgress: [],
});
