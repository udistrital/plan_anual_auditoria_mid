import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TercerosService } from './terceros.service';
import { TercerosHelperService } from './terceros-helper.service';

@Module({
    imports: [HttpModule],
    providers: [TercerosService, TercerosHelperService],
    exports: [TercerosService, TercerosHelperService]
})
export class TercerosModule {}