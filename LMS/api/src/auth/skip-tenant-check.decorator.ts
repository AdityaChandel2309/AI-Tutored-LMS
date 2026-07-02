import { SetMetadata } from '@nestjs/common';
import { SKIP_TENANT_CHECK } from './tenant.guard';

export const SkipTenantCheck = () => SetMetadata(SKIP_TENANT_CHECK, true);
